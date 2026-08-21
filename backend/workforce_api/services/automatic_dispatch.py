"""
Authoritative Automatic Geo-Based Distance Wave Dispatch Service.

Single source of truth for all automatic job dispatch, candidate ranking,
6-wave sequential proximity evaluation (0-1km, 1-2km, 2-5km, 5-10km, 10-15km, 15-20km),
synchronized 2-minute offer creation with UUID wave IDs, lazy and scheduled wave progression,
and cross-application job reconciliation across Workforce and Marketplace.
"""
import uuid
import logging
from datetime import timedelta
from typing import List, Dict, Any, Tuple, Optional

from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime

from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.state_machine import apply_transition
from employees.models import Employee
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceEmployeeSkill,
    WorkforceEmployeeCompliance,
    WorkforceEmployeeSchedule,
    WorkforceEventLog,
)
from workforce_api.services.geo_spatial import (
    ADMIN_DISPATCH_RADIUS_KM,
    MAX_DISPATCH_RADIUS_KM,
    MAX_GPS_AGE_SECONDS,
    DISTANCE_TOLERANCE_KM,
    calculate_distance_km,
    calculate_distance_meters,
    get_spatial_bounding_box,
    classify_wave,
    get_distance_band,
    is_within_automatic_radius,
    is_within_radius,
    validate_coordinates,
)
from workforce_api.services.workload import get_employee_active_job, ACTIVE_WORKLOAD_STATUSES

logger = logging.getLogger("workforce.dispatch")

# Backward compatibility alias
haversine_distance = calculate_distance_meters

# Phase 1: Exact 2-minute offer duration
DEFAULT_OFFER_DURATION_MINUTES = 2

# Dispatchable database statuses
DISPATCHABLE_STATUSES = ["draft", "new_request", "received", "confirmed", "unassigned", "assigned", "redispatching"]

# Explicit canonical alias dictionary covering normal and specialized categories
EXPLICIT_SERVICE_ALIASES = {
    "hvac": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "ac": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "air conditioning": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "ac repair and diagnostics": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "ac service and cleaning": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "ac gas and refrigerant": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "ac installation and uninstallation": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair and diagnostics", "ac service and cleaning", "ac gas and refrigerant", "ac installation and uninstallation"},
    "plumbing": {"plumbing", "plumber", "pipe repair", "water leakage", "drainage", "tap repair", "sanitary"},
    "electrical": {"electrical", "electrician", "wiring", "switchboard", "fan repair", "fuse repair", "light fitting"},
    "electrician": {"electrical", "electrician", "wiring", "switchboard", "fan repair", "fuse repair", "light fitting"},
    "refrigerator": {"refrigerator", "fridge", "freezer", "single door fridge", "double door fridge", "appliance repair"},
    "washing machine": {"washing machine", "washer", "dryer", "top load", "front load", "appliance repair"},
    "tv and display": {"tv and display", "tv", "television", "led tv", "smart tv", "display", "appliance repair"},
    "microwave oven repair": {"microwave", "microwave oven", "microwave oven repair", "oven", "appliance repair"},
    "appliance repair": {"appliance repair", "refrigerator", "fridge", "washing machine", "microwave", "tv", "appliance"},
    "carpentry services": {"carpentry", "carpenter", "wood work", "furniture repair", "door repair", "carpentry services"},
    "carpentry": {"carpentry", "carpenter", "wood work", "furniture repair", "door repair", "carpentry services"},
    "pest control": {"pest control", "cockroach control", "ants and bed bugs control", "termite control", "bed bugs", "cockroach", "termite"},
    "cockroach control": {"cockroach control", "cockroach", "pest control"},
    "ants and bed bugs control": {"ants and bed bugs control", "ants", "bed bugs", "pest control"},
    "termite control": {"termite control", "termite", "pest control"},
    "cleaning": {"cleaning", "kitchen cleaning", "bathroom cleaning", "full house cleaning", "sofa cleaning", "deep cleaning", "house cleaning"},
    "kitchen cleaning": {"kitchen cleaning", "cleaning", "deep cleaning"},
    "bathroom cleaning": {"bathroom cleaning", "cleaning", "deep cleaning"},
    "full house cleaning": {"full house cleaning", "cleaning", "deep cleaning", "house cleaning"},
    "sofa cleaning": {"sofa cleaning", "cleaning", "couch cleaning"},
    "two wheeler": {"two wheeler", "bike", "scooter", "motorcycle", "bike repair", "two wheeler repair"},
    "goods and transport": {"goods and transport", "goods transport", "transport", "logistics", "truck", "cargo", "delivery", "shifting", "commercial transport"},
    "goods transport": {"goods and transport", "goods transport", "transport", "logistics", "truck", "cargo", "delivery", "shifting", "commercial transport"},
    "transport": {"goods and transport", "goods transport", "transport", "logistics", "truck", "cargo", "delivery", "shifting"},
    "packers and movers": {"packers and movers", "packers movers", "packer and mover", "packer mover", "truck", "shifting", "relocation", "house shifting", "goods and transport"},
    "packers movers": {"packers and movers", "packers movers", "packer and mover", "packer mover", "truck", "shifting", "relocation", "house shifting", "goods and transport"},
    "packer and mover": {"packers and movers", "packers movers", "packer and mover", "packer mover", "truck", "shifting", "relocation", "house shifting", "goods and transport"},
    "truck": {"truck", "packer and mover", "packers and movers", "logistics", "shifting", "goods and transport", "goods transport", "transport", "relocation"},
}


def normalize_service_name(name: str) -> str:
    """
    Normalizes service names by lowercasing, replacing dashes, underscores,
    unicode hyphens, and ampersands with standard words.
    """
    if not name:
        return ""
    s = str(name).lower()
    s = s.replace("—", " ").replace("–", " ").replace("-", " ").replace("_", " ")
    s = s.replace("&", " and ")
    return " ".join(s.split())


def canonical_service_match(requested_service: str, approved_services: List[str], verified_skills: List[str]) -> Tuple[bool, str, str]:
    """
    Evaluates whether a requested service matches an employee's authorized services or verified skills.
    Returns (is_match, match_method, matched_term).
    """
    if not requested_service:
        return True, "EMPTY_SERVICE_BYPASS", ""

    req_clean = normalize_service_name(requested_service)
    req_words = set(w for w in req_clean.split() if len(w) >= 2)

    # 1. Check exact or direct match against approved employee services
    for it in approved_services:
        if not it:
            continue
        it_clean = normalize_service_name(it)
        if req_clean == it_clean or req_clean in it_clean or it_clean in req_clean:
            return True, "EXACT_OR_SUBSTRING_SERVICE", it

    # 2. Check verified skills
    for sk in verified_skills:
        if not sk:
            continue
        sk_clean = normalize_service_name(sk)
        if req_clean == sk_clean or req_clean in sk_clean or sk_clean in req_clean:
            return True, "VERIFIED_SKILL_MATCH", sk

    # 3. Check explicit canonical alias table
    for alias_key, alias_group in EXPLICIT_SERVICE_ALIASES.items():
        if req_clean == alias_key or req_clean in alias_group or any(req_word in alias_group for req_word in req_words):
            for it in approved_services:
                it_clean = normalize_service_name(it)
                if it_clean in alias_group or any(w in alias_group for w in it_clean.split() if len(w) >= 2):
                    return True, "EXPLICIT_ALIAS_SERVICE", it
            for sk in verified_skills:
                sk_clean = normalize_service_name(sk)
                if sk_clean in alias_group or any(w in alias_group for w in sk_clean.split() if len(w) >= 2):
                    return True, "EXPLICIT_ALIAS_SKILL", sk

    return False, "NO_MATCH", ""


def check_candidate_eligibility(emp: Employee, service_name: Optional[str] = None, check_workload: bool = True) -> Tuple[bool, str, Dict[str, bool]]:
    """
    9-Gate Employee Eligibility Engine:
    Authoritative server-side evaluation of 9 mandatory operational gates.
    
    Parameters:
      emp: Employee model instance
      service_name: Optional requested service name
      check_workload: If True (default, for acceptance), Gate 9 fails if the technician has an active job.
                      If False (for offer discovery), Gate 9 passes so that busy technicians can still
                      receive and view upcoming job offers.
    
    Returns (is_eligible, reason_message, gate_results_dict).
    """
    gate_results = {f"G{i}": True for i in range(1, 10)}

    # ── Gate 1: Account Active ────────────────────────────────────────────────
    if not emp or not emp.is_active or not getattr(emp.user, "is_active", True):
        gate_results["G1"] = False
        logger.debug(f"[9GATE_REJECT_GATE1_ACCOUNT_INACTIVE] Employee #{getattr(emp, 'id', None)} account is inactive.")
        return False, "Gate 1: Technician account is inactive.", gate_results

    bank_details = emp.bank_details or {}
    onboarding = bank_details.get("onboarding", {})

    # ── Gate 2: Registration Approved ─────────────────────────────────────────
    reg_status = onboarding.get("status", "not_started")
    if reg_status != "approved":
        gate_results["G2"] = False
        logger.debug(f"[9GATE_REJECT_GATE2_ONBOARDING_UNAPPROVED] Employee #{emp.id} onboarding status is '{reg_status}'.")
        return False, "Gate 2: Technician registration onboarding is not approved.", gate_results

    # ── Gate 3: Required Documents Approved ───────────────────────────────────
    if emp and getattr(emp, "company_id", None):
        if hasattr(emp, "prefetched_mandatory_doc_reqs"):
            mandatory_doc_reqs = emp.prefetched_mandatory_doc_reqs
        else:
            from workforce_api.models import WorkforceRequiredDocument
            mandatory_doc_reqs = list(WorkforceRequiredDocument.objects.filter(company_id=emp.company_id, is_mandatory=True))

        if mandatory_doc_reqs:
            if hasattr(emp, "prefetched_employee_documents"):
                emp_docs_map = {d.requirement_id: d for d in emp.prefetched_employee_documents}
            else:
                from workforce_api.models import WorkforceEmployeeDocument
                emp_docs_map = {
                    d.requirement_id: d
                    for d in WorkforceEmployeeDocument.objects.filter(employee=emp, requirement__in=mandatory_doc_reqs)
                }

            today = timezone.now().date()
            for req_doc in mandatory_doc_reqs:
                emp_doc = emp_docs_map.get(req_doc.id)
                if not emp_doc or emp_doc.status != "APPROVED":
                    gate_results["G3"] = False
                    st = emp_doc.status if emp_doc else "MISSING"
                    logger.debug(f"[9GATE_REJECT_GATE3_DOCUMENTS_UNAPPROVED] Employee #{emp.id} mandatory document '{req_doc.title}' is {st}.")
                    return False, f"Gate 3: Technician mandatory document '{req_doc.title}' is {st} (must be APPROVED).", gate_results
                if emp_doc.expiry_date and emp_doc.expiry_date < today:
                    gate_results["G3"] = False
                    logger.debug(f"[9GATE_REJECT_GATE3_DOCUMENTS_EXPIRED] Employee #{emp.id} mandatory document '{req_doc.title}' expired on {emp_doc.expiry_date}.")
                    return False, f"Gate 3: Technician mandatory document '{req_doc.title}' expired on {emp_doc.expiry_date}.", gate_results
        else:
            documents = onboarding.get("documents", {})
            if any(doc.get("status") in ["rejected", "pending_review", "missing"] for doc in documents.values()):
                gate_results["G3"] = False
                logger.debug(f"[9GATE_REJECT_GATE3_DOCUMENTS_UNAPPROVED] Employee #{emp.id} has unapproved documents.")
                return False, "Gate 3: Technician has unapproved dossier documents.", gate_results
    else:
        documents = onboarding.get("documents", {})
        if any(doc.get("status") in ["rejected", "pending_review", "missing"] for doc in documents.values()):
            gate_results["G3"] = False
            return False, "Gate 3: Technician has unapproved dossier documents.", gate_results

    # ── Gate 4: Mandatory Compliance Valid ────────────────────────────────────
    if emp and getattr(emp, "company_id", None):
        if hasattr(emp, "prefetched_mandatory_comp_reqs"):
            mandatory_comp_reqs = emp.prefetched_mandatory_comp_reqs
        else:
            from workforce_api.models import WorkforceComplianceRequirement
            mandatory_comp_reqs = list(WorkforceComplianceRequirement.objects.filter(company_id=emp.company_id, is_mandatory=True))

        if mandatory_comp_reqs:
            today = timezone.now().date()
            if hasattr(emp, "prefetched_compliance_records"):
                emp_comp_records = emp.prefetched_compliance_records
            else:
                emp_comp_records = list(WorkforceEmployeeCompliance.objects.filter(employee=emp, requirement__in=mandatory_comp_reqs))
            emp_comp_map = {c.requirement_id: c for c in emp_comp_records}
            for comp_req in mandatory_comp_reqs:
                c_rec = emp_comp_map.get(comp_req.id)
                if not c_rec or c_rec.status in ["MISSING", "PENDING_REVIEW", "REJECTED", "EXPIRED"]:
                    gate_results["G4"] = False
                    st = c_rec.status if c_rec else "MISSING"
                    logger.debug(f"[9GATE_REJECT_GATE4_COMPLIANCE_INVALID] Employee #{emp.id} mandatory compliance '{comp_req.title}' is {st}.")
                    return False, f"Gate 4: Mandatory compliance '{comp_req.title}' is {st} (must be VALID).", gate_results
                if c_rec.expiry_date and c_rec.expiry_date < today:
                    gate_results["G4"] = False
                    return False, f"Gate 4: Mandatory compliance '{comp_req.title}' expired on {c_rec.expiry_date}.", gate_results
        else:
            if hasattr(emp, "prefetched_compliance_records"):
                invalid_comp = next((c for c in emp.prefetched_compliance_records if c.status in ["EXPIRED", "REJECTED"]), None)
                if invalid_comp:
                    gate_results["G4"] = False
                    return False, "Gate 4: Technician has expired or rejected mandatory compliance document.", gate_results
            elif hasattr(emp, "prefetched_invalid_compliance"):
                if emp.prefetched_invalid_compliance:
                    gate_results["G4"] = False
                    logger.debug(f"[9GATE_REJECT_GATE4_COMPLIANCE_INVALID] Employee #{emp.id} has invalid compliance.")
                    return False, "Gate 4: Technician has expired or rejected mandatory compliance document.", gate_results
            else:
                mandatory_comp = WorkforceEmployeeCompliance.objects.filter(
                    employee=emp,
                    requirement__is_mandatory=True,
                    status__in=["EXPIRED", "REJECTED"],
                ).first()
                if mandatory_comp:
                    gate_results["G4"] = False
                    logger.debug(f"[9GATE_REJECT_GATE4_COMPLIANCE_INVALID] Employee #{emp.id} compliance '{mandatory_comp.requirement.title}' is {mandatory_comp.status}.")
                    return False, f"Gate 4: Technician has expired or rejected mandatory compliance document: '{mandatory_comp.requirement.title}'.", gate_results
    else:
        if hasattr(emp, "prefetched_invalid_compliance"):
            if emp.prefetched_invalid_compliance:
                gate_results["G4"] = False
                return False, "Gate 4: Technician has expired or rejected mandatory compliance document.", gate_results
        else:
            mandatory_comp = WorkforceEmployeeCompliance.objects.filter(
                employee=emp,
                requirement__is_mandatory=True,
                status__in=["EXPIRED", "REJECTED"],
            ).first()
            if mandatory_comp:
                gate_results["G4"] = False
                return False, f"Gate 4: Technician has expired or rejected mandatory compliance document: '{mandatory_comp.requirement.title}'.", gate_results

    # ── Gate 5: Working Schedule ──────────────────────────────────────────────
    if hasattr(emp, "prefetched_today_schedules"):
        sched = emp.prefetched_today_schedules[0] if emp.prefetched_today_schedules else None
    else:
        today_dow = timezone.now().weekday()
        sched = WorkforceEmployeeSchedule.objects.filter(employee=emp, day_of_week=today_dow).first()

    if sched:
        if not sched.is_working_day:
            gate_results["G5"] = False
            logger.debug(f"[9GATE_REJECT_GATE5_SCHEDULE_OFF] Employee #{emp.id} is scheduled off today.")
            return False, "Gate 5: Technician is scheduled off today.", gate_results
        now_time = timezone.now().time()
        if not (sched.start_time <= now_time <= sched.end_time):
            gate_results["G5"] = False
            logger.debug(f"[9GATE_REJECT_GATE5_SCHEDULE_OUTSIDE] Employee #{emp.id} outside hours ({sched.start_time}-{sched.end_time}).")
            return False, f"Gate 5: Technician is outside scheduled working hours ({sched.start_time.strftime('%H:%M')}-{sched.end_time.strftime('%H:%M')}).", gate_results

    # ── Gate 6: Service / Skill Authorization ─────────────────────────────────
    approved_svcs = []
    for s in onboarding.get("services", []):
        if s.get("status") == "approved":
            if s.get("name"):
                approved_svcs.append(s["name"])
            if s.get("category"):
                approved_svcs.append(s["category"])

    if hasattr(emp, "prefetched_verified_skills"):
        verified_skills = [es.skill.name for es in emp.prefetched_verified_skills]
    else:
        verified_skills = list(
            WorkforceEmployeeSkill.objects.filter(employee=emp, is_verified=True).values_list("skill__name", flat=True)
        )

    if service_name:
        is_match, method, matched = canonical_service_match(service_name, approved_svcs, verified_skills)
        logger.debug(f"[DISPATCH_SERVICE_MATCH] job_service=\"{service_name}\" employee_services={approved_svcs} verified_skills={verified_skills} match_method={method} result={'PASS' if is_match else 'FAIL'}")
        if not is_match:
            gate_results["G6"] = False
            logger.debug(f"[9GATE_REJECT_GATE6_SKILL_MISMATCH] Employee #{emp.id} not authorized/verified for '{service_name}'.")
            return False, f"Gate 6: Technician is not authorized or verified for requested service '{service_name}'.", gate_results

    # ── Gate 7: Live Presence (Online & Available) ────────────────────────────
    # For offer receipt, technician must be online; current_availability can be 'busy' if they are currently executing another job
    if not emp.is_online:
        gate_results["G7"] = False
        logger.debug(f"[9GATE_REJECT_GATE7_PRESENCE_OFFLINE] Employee #{emp.id} presence is is_online={emp.is_online}.")
        return False, "Gate 7: Technician is currently OFFLINE.", gate_results

    # ── Gate 8: Leave Check ───────────────────────────────────────────────────
    today_str = timezone.now().date().isoformat()
    leaves = bank_details.get("leaves", [])
    for l in leaves:
        if l.get("status") == "approved":
            start_date = l.get("start_date", "")
            end_date = l.get("end_date", "")
            if start_date <= today_str <= end_date:
                gate_results["G8"] = False
                logger.debug(f"[9GATE_REJECT_GATE8_LEAVE_ACTIVE] Employee #{emp.id} on approved leave ({start_date} to {end_date}).")
                return False, f"Gate 8: Technician is on approved leave from {start_date} to {end_date}.", gate_results

    # ── Gate 9: Workload Concurrency (Single-Active-Job Isolation) ──────────────
    # Checked strictly on Accept. Bypassed for offer recipient discovery so busy technicians can see upcoming offers.
    if check_workload:
        if hasattr(emp, "is_busy_job"):
            if emp.is_busy_job:
                gate_results["G9"] = False
                logger.info(f"[DISPATCH_REJECT] employee={emp.id} reason=EMPLOYEE_ALREADY_BUSY (annotated)")
                return False, f"Gate 9: Technician #{emp.id} is busy on an active job.", gate_results
        else:
            active_job = get_employee_active_job(emp)
            if active_job:
                gate_results["G9"] = False
                logger.info(f"[DISPATCH_REJECT] employee={emp.id} reason=EMPLOYEE_ALREADY_BUSY active_job={active_job.id}")
                return False, f"Gate 9: Technician is busy on active Job #{active_job.id} ({active_job.request_id}).", gate_results

    return True, "All Eligibility Gates Passed", gate_results


def get_eligible_candidates(
    job_id_or_obj,
    max_gps_age_seconds: int = MAX_GPS_AGE_SECONDS,
    radius_km: float = MAX_DISPATCH_RADIUS_KM,
    exclude_employee_ids: Optional[List[int]] = None,
    check_workload: bool = False,
) -> List[Dict[str, Any]]:
    """
    Finds and ranks all eligible candidate employees for a given ServiceRequest within 20 km.
    Uses mathematical bounding-box prefiltering and exact Haversine distance calculation.
    
    By default check_workload=False so busy employees are eligible to receive and view offers.
    """
    if hasattr(job_id_or_obj, "latitude"):
        job_obj = job_id_or_obj
    else:
        job_obj = ServiceRequest.objects.filter(pk=job_id_or_obj).first()
        if not job_obj:
            logger.warning(f"[DISPATCH_JOB_NOT_FOUND] Job #{job_id_or_obj} not found.")
            return []

    is_valid_coords, cust_lat, cust_lon, coord_err = validate_coordinates(job_obj.latitude, job_obj.longitude)
    if not is_valid_coords:
        logger.warning(f"[DISPATCH_GPS_MISSING] Job #{job_obj.id} invalid coordinates: {coord_err}")
        return []

    min_lat, max_lat, min_lon, max_lon = get_spatial_bounding_box(cust_lat, cust_lon, radius_km=radius_km)

    today_dow = timezone.now().weekday()
    busy_subquery = ServiceRequest.objects.filter(
        assigned_employee_id=OuterRef("pk"),
        status__in=ACTIVE_WORKLOAD_STATUSES
    )

    candidates_qs = (
        Employee.objects.filter(
            is_active=True,
            is_online=True,
        )
        .select_related("user", "company")
        .annotate(is_busy_job=Exists(busy_subquery))
    )

    if exclude_employee_ids:
        candidates_qs = candidates_qs.exclude(pk__in=exclude_employee_ids)

    candidates_qs = (
        candidates_qs
        .prefetch_related(
            Prefetch(
                "compliance_records",
                queryset=WorkforceEmployeeCompliance.objects.filter(
                    requirement__is_mandatory=True,
                    status__in=["EXPIRED", "REJECTED"],
                ),
                to_attr="prefetched_invalid_compliance",
            ),
            Prefetch(
                "schedules",
                queryset=WorkforceEmployeeSchedule.objects.filter(day_of_week=today_dow),
                to_attr="prefetched_today_schedules",
            ),
            Prefetch(
                "skills",
                queryset=WorkforceEmployeeSkill.objects.filter(is_verified=True).select_related("skill"),
                to_attr="prefetched_verified_skills",
            ),
        )
    )

    if not job_obj.company_id:
        logger.warning(f"[DISPATCH_COMPANY_MISSING] Job #{job_obj.id} lacks an associated company/vendor tenant.")
        return []

    candidates_qs = candidates_qs.filter(company_id=job_obj.company_id)

    # Exclude candidates who have already received or rejected/cancelled an offer for this job
    previous_offers = set(
        WorkforceJobOffer.objects.filter(
            job=job_obj,
        ).values_list("employee_id", flat=True)
    )
    if exclude_employee_ids:
        previous_offers.update(exclude_employee_ids)

    ranked_candidates = []
    now = timezone.now()

    for emp in candidates_qs:
        if emp.id in previous_offers:
            logger.debug(f"[DISPATCH_CANDIDATE_REJECTED] Employee #{emp.id} already has offer history for Job #{job_obj.id}.")
            continue

        # Extract live GPS from User.last_known_location
        last_loc = getattr(emp.user, "last_known_location", None) or {}
        emp_lat = last_loc.get("latitude") if last_loc.get("latitude") is not None else last_loc.get("lat")
        emp_lon = last_loc.get("longitude") if last_loc.get("longitude") is not None else (last_loc.get("lng") or last_loc.get("lon"))

        is_emp_loc_valid, emp_lat_f, emp_lon_f, _ = validate_coordinates(emp_lat, emp_lon)
        if not is_emp_loc_valid:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=GPS_MISSING")
            continue

        # Bounding box prefilter
        if not (min_lat <= emp_lat_f <= max_lat and min_lon <= emp_lon_f <= max_lon):
            logger.debug(f"[DISPATCH_BOUNDING_BOX_EXCLUDED] employee={emp.id} outside bbox ({emp_lat_f}, {emp_lon_f})")
            continue

        gps_age_s = None
        updated_at_str = last_loc.get("updated_at") or last_loc.get("captured_at")
        if updated_at_str:
            try:
                loc_dt = parse_datetime(str(updated_at_str))
                if loc_dt:
                    if timezone.is_naive(loc_dt):
                        loc_dt = timezone.make_aware(loc_dt)
                    gps_age_s = (now - loc_dt).total_seconds()
            except Exception:
                pass

        # Exact geodesic distance
        dist_km = calculate_distance_km(cust_lat, cust_lon, emp_lat_f, emp_lon_f)

        # Strict boundary enforcement: strictly <= 20.0 km
        if not is_within_automatic_radius(dist_km):
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=RADIUS_EXCEEDED distance_km={dist_km}")
            continue

        # Classify sequential distance wave (1 to 6)
        wave_number = classify_wave(dist_km)
        if wave_number is None:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=OUTSIDE_AUTOMATIC_WAVES distance_km={dist_km}")
            continue

        # Check eligibility against service_category, then issue_title
        is_eligible, reason, gate_results = check_candidate_eligibility(emp, job_obj.service_category, check_workload=check_workload)
        if not is_eligible and job_obj.issue_title:
            is_eligible, reason, gate_results = check_candidate_eligibility(emp, job_obj.issue_title, check_workload=check_workload)

        if not is_eligible:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason={reason}")
            continue

        if gps_age_s is None or gps_age_s > max_gps_age_seconds or gps_age_s < -60:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=GPS_STALE gps_age={gps_age_s}s")
            continue

        # Proximity score (closer = higher score, max 100)
        proximity_score = max(0.0, 100.0 - (dist_km * 2.0))

        # Skill proficiency score bonus
        skills = getattr(emp, "prefetched_verified_skills", [])
        max_prof = 0
        for sk in skills:
            sk_name = sk.skill.name.lower()
            matches = False
            for term in [job_obj.service_category, job_obj.issue_title]:
                if term and (normalize_service_name(term) in sk_name or sk_name in normalize_service_name(term)):
                    matches = True
                    break
            if matches:
                if sk.proficiency_level == "EXPERT":
                    max_prof = max(max_prof, 30)
                elif sk.proficiency_level == "INTERMEDIATE":
                    max_prof = max(max_prof, 20)
                else:
                    max_prof = max(max_prof, 10)

        # Territory bonus
        city = (emp.bank_details or {}).get("onboarding", {}).get("draft", {}).get("personal", {}).get("city", "")
        territory_bonus = 15.0 if (job_obj.address and city and city.lower() in job_obj.address.lower()) else 0.0

        # Shift clock-in bonus
        bank_details = emp.bank_details or {}
        is_clocked_in = bank_details.get("attendance", {}).get("is_clocked_in", False)
        clock_in_bonus = 10.0 if is_clocked_in else 0.0

        total_score = proximity_score + max_prof + territory_bonus + clock_in_bonus

        logger.info(
            f"[DISPATCH_CANDIDATE_FOUND] Employee #{emp.id} ({emp.user.username}) eligible for Job #{job_obj.id}: "
            f"{dist_km:.2f}km away (Wave {wave_number}), score={total_score:.1f}"
        )

        ranked_candidates.append({
            "employee": emp,
            "distance_km": dist_km,
            "wave_number": wave_number,
            "distance_band": get_distance_band(dist_km),
            "latitude": emp_lat_f,
            "longitude": emp_lon_f,
            "gps_age_seconds": gps_age_s,
            "score": round(total_score, 1),
        })

    # Deterministic sort: distance (ascending), score (descending), employee ID (ascending)
    ranked_candidates.sort(key=lambda x: (x["distance_km"], -x["score"], x["employee"].id))
    return ranked_candidates


def sweep_job_expired_offers(job_obj) -> int:
    """
    Lazy reconciliation helper: sweeps and marks EXPIRED any overdue OFFERED offers
    for the given job.
    """
    now = timezone.now()
    return WorkforceJobOffer.objects.filter(
        job=job_obj,
        status=WorkforceJobOffer.Status.OFFERED,
        expires_at__lte=now,
    ).update(status=WorkforceJobOffer.Status.EXPIRED)


def dispatch_job(job_id_or_obj, max_gps_age_seconds: int = MAX_GPS_AGE_SECONDS, exclude_employee_ids: Optional[List[int]] = None) -> Tuple[bool, str]:
    """
    Authoritative sequential distance-wave dispatch engine (Phase 1):
    1. Locks ServiceRequest row with select_for_update inside transaction.atomic()
    2. Sweeps and expires any overdue offers for this job (Lazy Reconciliation)
    3. Checks if an active unexpired wave is currently pending (Idempotency & Same-Wave Stability)
    4. Evaluates eligible candidates in 6 sequential waves (0-1km, 1-2km, 2-5km, 5-10km, 10-15km, 15-20km)
    5. Picks the lowest non-empty wave (empty waves are skipped immediately without delay)
    6. Generates a unique UUID wave_id and synchronized timestamps (offered_at = now, expires_at = now + 2 min)
    7. Atomically creates WorkforceJobOffer for ALL candidates in the wave
    8. Falls back to Admin escalation when all 20 km waves are exhausted
    """
    job_id = job_id_or_obj.pk if hasattr(job_id_or_obj, "pk") else job_id_or_obj

    with transaction.atomic():
        job_obj = ServiceRequest.objects.select_for_update().filter(pk=job_id).first()
        if not job_obj:
            return False, "Job not found."

        if job_obj.status in ["completed", "cancelled"]:
            return False, f"Job #{job_id} is {job_obj.status} and cannot be dispatched."

        if job_obj.status in ["accepted", "on_the_way", "en_route", "arrived", "in_progress", "proof_submitted", "service_completed", "payment_pending", "cash_pending"] and job_obj.assigned_employee:
            return False, f"Job #{job_id} is already accepted and in progress with Employee #{job_obj.assigned_employee_id}."

        now = timezone.now()

        # Step 1: Lazy reconciliation of expired offers for this job
        sweep_job_expired_offers(job_obj)

        # Step 2: Idempotency check: Is there an active unexpired wave running for this job?
        active_offers = list(
            WorkforceJobOffer.objects.select_for_update().filter(
                job=job_obj,
                status=WorkforceJobOffer.Status.OFFERED,
                expires_at__gt=now,
            )
        )

        if active_offers:
            current_wave_num = active_offers[0].wave_number
            logger.info(
                f"[DISPATCH_WAVE_ACTIVE] Job #{job_id} already has active Wave {current_wave_num} "
                f"with {len(active_offers)} pending offer(s)."
            )
            return True, f"Active Wave {current_wave_num} already pending ({len(active_offers)} offers)."

        # Step 3: Validate customer booking coordinates
        if job_obj.latitude is None or job_obj.longitude is None:
            if job_obj.status != "unassigned":
                apply_transition(job_obj, "unassigned")
            logger.warning(f"[DISPATCH_GPS_MISSING] Job #{job_id} is missing coordinates.")
            return False, "Customer booking is missing valid GPS coordinates."

        WorkforceEventLog.objects.create(
            event_type="DISPATCH_STARTED",
            payload={"job_id": job_obj.id, "service": job_obj.service_category}
        )

        # Step 4: Find eligible candidate technicians across 0 to 20 km
        candidates = get_eligible_candidates(
            job_obj,
            max_gps_age_seconds=max_gps_age_seconds,
            radius_km=MAX_DISPATCH_RADIUS_KM,
            exclude_employee_ids=exclude_employee_ids,
            check_workload=False,
        )

        WorkforceEventLog.objects.create(
            event_type="CANDIDATES_EVALUATED",
            payload={"job_id": job_obj.id, "eligible_count": len(candidates)}
        )

        # Step 5: Group candidates by sequential distance wave (1 to 6)
        wave_groups: Dict[int, List[Dict[str, Any]]] = {w: [] for w in range(1, 7)}
        for c in candidates:
            w_num = c.get("wave_number")
            if w_num and 1 <= w_num <= 6:
                wave_groups[w_num].append(c)

        # Step 6: Select lowest non-empty wave (skip empty waves immediately)
        target_wave_number = None
        target_wave_candidates = []
        for w_idx in range(1, 7):
            if wave_groups[w_idx]:
                target_wave_number = w_idx
                target_wave_candidates = wave_groups[w_idx]
                break

        # Step 7: If all 6 waves are exhausted, escalate to Admin fallback
        if not target_wave_number or not target_wave_candidates:
            if job_obj.status != "unassigned" or job_obj.assigned_employee is not None:
                job_obj.status = "unassigned"
                job_obj.assigned_employee = None
                job_obj.save(update_fields=["status", "assigned_employee"])

            WorkforceEventLog.objects.create(
                event_type="DISPATCH_ADMIN_FALLBACK",
                payload={"job_id": job_obj.id, "reason": "ALL_WAVES_EXHAUSTED", "candidates_considered": len(candidates)}
            )

            admin_user = None
            if job_obj.company:
                admin_user = get_user_model().objects.filter(
                    Q(role__in=["admin", "manager"]) | Q(is_staff=True),
                    company=job_obj.company
                ).first()
            if not admin_user:
                admin_user = get_user_model().objects.filter(is_superuser=True).first()

            if admin_user:
                service_name = job_obj.issue_title or job_obj.service_category or "Service"
                WorkforceNotification.objects.create(
                    recipient=admin_user,
                    title="Automatic Dispatch: Awaiting Technician",
                    message=f"No eligible nearby technician available within 20 km for Job #{job_obj.id} ({service_name}). Job escalated to Admin dispatch.",
                    notification_type="DISPATCH_UNASSIGNED",
                    company=job_obj.company,
                    related_object_id=str(job_obj.id),
                )
            return False, "No eligible technicians available for automatic dispatch within 20 km. Job escalated to Admin dispatch."

        # Step 8: Wave Synchronization Constants (computed ONCE outside employee loop)
        wave_uuid = uuid.uuid4()
        wave_created_at = timezone.now()
        wave_expires_at = wave_created_at + timedelta(minutes=DEFAULT_OFFER_DURATION_MINUTES)
        wave_label = f"Wave {target_wave_number}"

        # Keep ServiceRequest in unassigned status until an employee accepts
        if job_obj.status in ["draft", "new_request", "received", "confirmed"]:
            apply_transition(job_obj, "unassigned")

        created_offers = []
        for cand in target_wave_candidates:
            cand_emp = cand["employee"]
            cand_dist = cand["distance_km"]
            cand_score = cand["score"]

            offer = WorkforceJobOffer.objects.create(
                job=job_obj,
                employee=cand_emp,
                status=WorkforceJobOffer.Status.OFFERED,
                wave_id=wave_uuid,
                wave_number=target_wave_number,
                rank_score=cand_score,
                offered_at=wave_created_at,
                expires_at=wave_expires_at,
            )
            created_offers.append(offer)

            WorkforceEventLog.objects.create(
                user=cand_emp.user,
                event_type="OFFER_CREATED",
                payload={
                    "job_id": job_obj.id,
                    "offer_id": offer.id,
                    "employee_id": cand_emp.id,
                    "wave_id": str(wave_uuid),
                    "wave_number": target_wave_number,
                    "distance_km": round(cand_dist, 3),
                    "expires_at": wave_expires_at.isoformat(),
                }
            )

            loc_str = f" at {job_obj.address}" if job_obj.address else ""
            req_id_str = f" ({job_obj.request_id})" if job_obj.request_id else f" #{job_obj.id}"
            service_label = job_obj.issue_title or job_obj.service_category or "Service Request"
            expiry_str = wave_expires_at.strftime("%H:%M:%S UTC")

            WorkforceNotification.objects.create(
                recipient=cand_emp.user,
                title="New Job Offer Available!",
                message=f"You have a new job offer for '{service_label}'{req_id_str}{loc_str} ({cand_dist:.1f} km away via {wave_label}). Expiry: {expiry_str}. Open your dashboard to review.",
                notification_type="JOB_OFFER",
                company=job_obj.company,
                related_object_id=str(job_obj.id),
            )

            logger.info(
                f"[DISPATCH_DECISION] job={job_obj.id} employee={cand_emp.id} wave_id={wave_uuid} "
                f"wave_number={target_wave_number} distance_km={cand_dist:.3f} score={cand_score:.1f} status=OFFER_CREATED"
            )

        return True, f"Job #{job_obj.id} dispatched to Wave {target_wave_number} ({len(created_offers)} technicians offered)."


def dispatch_next_candidate(job_id_or_obj) -> Tuple[bool, str]:
    """
    Triggered when a wave expires or all offers in a wave are declined:
    Advances dispatch to the next appropriate distance wave.
    """
    logger.info(f"[DISPATCH_FALLBACK] Triggering next wave dispatch for Job #{job_id_or_obj}.")
    return dispatch_job(job_id_or_obj)


def expire_and_reassign_offers() -> int:
    """
    Scans for expired job offers in OFFERED state, marks them EXPIRED,
    and automatically triggers next wave dispatch for jobs whose wave has completed.
    Returns the count of expired offers handled.
    """
    now = timezone.now()
    expired_offers = list(
        WorkforceJobOffer.objects.filter(
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at__lte=now,
        ).select_related("job")
    )

    if not expired_offers:
        return 0

    affected_job_ids = set()
    count = 0

    for offer in expired_offers:
        with transaction.atomic():
            off_locked = WorkforceJobOffer.objects.select_for_update().filter(
                pk=offer.pk,
                status=WorkforceJobOffer.Status.OFFERED,
            ).first()
            if not off_locked:
                continue
            off_locked.status = WorkforceJobOffer.Status.EXPIRED
            off_locked.save(update_fields=["status"])
            count += 1
            affected_job_ids.add(offer.job_id)
            logger.info(f"[DISPATCH_OFFER_EXPIRED] Offer #{offer.id} for Job #{offer.job_id} expired.")

    # For each affected job, check if any active offers remain; if not, trigger next wave dispatch
    for j_id in affected_job_ids:
        has_active_peers = WorkforceJobOffer.objects.filter(
            job_id=j_id,
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at__gt=now,
        ).exists()
        if not has_active_peers:
            logger.info(f"[DISPATCH_WAVE_EXPIRED] All offers for Job #{j_id} expired. Advancing to next wave.")
            dispatch_job(j_id)

    return count


def dispatch_pending_jobs(company_id=None, limit: int = 50) -> Dict[str, Any]:
    """
    Core cross-application reconciliation function:
    1. Sweeps and reassigns expired offers.
    2. Discovers all dispatchable jobs in the database (regardless of which application created them).
    3. Filters out jobs that already have an active exclusive offer.
    4. Evaluates proximity and dispatches pending jobs.
    """
    # 1. Sweep expired offers first
    expired_count = expire_and_reassign_offers()

    now = timezone.now()
    qs = ServiceRequest.objects.filter(
        status__in=DISPATCHABLE_STATUSES,
        assigned_employee__isnull=True,
        latitude__isnull=False,
        longitude__isnull=False,
    )
    if company_id:
        qs = qs.filter(company_id=company_id)

    # Find all jobs in dispatchable states
    pending_jobs = list(
        qs.exclude(
            # Exclude jobs that already have an active unexpired offer
            job_offers__status=WorkforceJobOffer.Status.OFFERED,
            job_offers__expires_at__gt=now,
        ).order_by("-created_at").distinct()[:limit]
    )

    results = {
        "expired_offers_swept": expired_count,
        "pending_jobs_found": len(pending_jobs),
        "dispatched_count": 0,
        "unassigned_count": 0,
        "details": [],
    }

    for job in pending_jobs:
        logger.info(f"[DISPATCH_JOB_FOUND] Reconciling pending Job #{job.id} ({job.request_id}, status={job.status}).")
        success, msg = dispatch_job(job)
        results["details"].append({"job_id": job.id, "success": success, "message": msg})
        if success:
            results["dispatched_count"] += 1
        else:
            results["unassigned_count"] += 1

    return results


def reconsider_jobs_for_employee(employee_or_id) -> int:
    """
    Triggered when an employee transmits fresh GPS coordinates:
    Finds pending unassigned/dispatchable jobs within the employee's company
    and evaluates dispatch immediately.
    """
    emp_id = employee_or_id.pk if hasattr(employee_or_id, "pk") else employee_or_id
    emp = Employee.objects.filter(pk=emp_id).first()
    if not emp or not emp.is_active or not emp.is_online:
        return 0

    now = timezone.now()
    pending_jobs = ServiceRequest.objects.filter(
        company_id=emp.company_id,
        status__in=DISPATCHABLE_STATUSES,
        assigned_employee__isnull=True,
        latitude__isnull=False,
        longitude__isnull=False,
    ).exclude(
        job_offers__status=WorkforceJobOffer.Status.OFFERED,
        job_offers__expires_at__gt=now,
    ).exclude(
        # Don't reconsider jobs the employee already declined/received
        job_offers__employee_id=emp.id,
    ).distinct()

    dispatched_count = 0
    for job in pending_jobs:
        logger.info(f"[DISPATCH_GPS_TRIGGER] Fresh GPS for Employee #{emp.id} triggered evaluation for Job #{job.id}.")
        success, msg = dispatch_job(job)
        if success:
            dispatched_count += 1

    return dispatched_count
