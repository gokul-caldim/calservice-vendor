"""
Authoritative Automatic Geo-Based Dispatch Service.

Single source of truth for all automatic job dispatch, candidate ranking,
proximity evaluation, offer creation, fallback re-assignment, and cross-application
job reconciliation across Workforce and Marketplace.
"""
import logging
from datetime import timedelta
from typing import List, Dict, Any, Tuple, Optional

from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime

from service_requests.models import ServiceRequest, EmployeeJob
from employees.models import Employee
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceEmployeeSkill,
    WorkforceEmployeeCompliance,
    WorkforceEmployeeSchedule,
)
from time_tracking.geo import haversine_distance

logger = logging.getLogger("workforce.dispatch")

# Strict GPS telemetry freshness requirement (2 minutes maximum age for live dispatch)
MAX_GPS_AGE_SECONDS = 120

# Maximum geographic dispatch radius (50 km)
MAX_DISPATCH_RADIUS_KM = 50.0

# Default job offer duration before auto-expiry and fallback
DEFAULT_OFFER_DURATION_MINUTES = 5

# Dispatchable database statuses
DISPATCHABLE_STATUSES = ["draft", "new_request", "confirmed", "unassigned", "assigned"]

# Canonical service synonyms and explicit alias dictionary
EXPLICIT_SERVICE_ALIASES = {
    "hvac": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "ac": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "air conditioning": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "ac repair & diagnostics": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "ac service & cleaning": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "ac gas & refrigerant": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "ac installation & uninstallation": {"hvac", "ac", "air conditioning", "ac service", "ac repair", "ac installation", "ac gas", "ac repair & diagnostics", "ac service & cleaning", "ac gas & refrigerant", "ac installation & uninstallation"},
    "plumbing": {"plumbing", "plumber", "pipe repair", "water leakage", "drainage", "tap repair", "sanitary"},
    "electrical": {"electrical", "electrician", "wiring", "switchboard", "fan repair", "fuse repair", "light fitting"},
    "electrician": {"electrical", "electrician", "wiring", "switchboard", "fan repair", "fuse repair", "light fitting"},
    "refrigerator": {"refrigerator", "fridge", "freezer", "single door fridge", "double door fridge"},
    "washing machine": {"washing machine", "washer", "dryer", "top load", "front load"},
    "tv & display": {"tv & display", "tv", "television", "led tv", "smart tv", "display"},
    "microwave oven repair": {"microwave", "microwave oven", "microwave oven repair", "oven"},
    "carpentry services": {"carpentry", "carpenter", "wood work", "furniture repair", "door repair", "carpentry services"},
    "pest control": {"pest control", "cockroach control", "ants & bed bugs control", "termite control", "bed bugs", "cockroach", "termite"},
    "cockroach control": {"cockroach control", "cockroach", "pest control"},
    "ants & bed bugs control": {"ants & bed bugs control", "ants", "bed bugs", "pest control"},
    "termite control": {"termite control", "termite", "pest control"},
    "cleaning": {"cleaning", "kitchen cleaning", "bathroom cleaning", "full house cleaning", "sofa cleaning", "deep cleaning", "house cleaning"},
    "kitchen cleaning": {"kitchen cleaning", "cleaning", "deep cleaning"},
    "bathroom cleaning": {"bathroom cleaning", "cleaning", "deep cleaning"},
    "full house cleaning": {"full house cleaning", "cleaning", "deep cleaning", "house cleaning"},
    "sofa cleaning": {"sofa cleaning", "cleaning", "couch cleaning"},
    "two wheeler": {"two wheeler", "bike", "scooter", "motorcycle", "bike repair", "two wheeler repair"},
    "truck": {"truck", "packer & mover", "packers & movers", "logistics", "shifting"},
    "packer & mover": {"packer & mover", "packers & movers", "truck", "shifting", "relocation"},
}


def canonical_service_match(requested_service: str, approved_services: List[str], verified_skills: List[str]) -> Tuple[bool, str, str]:
    """
    Evaluates whether a requested service matches an employee's authorized services or verified skills.
    Returns (is_match, match_method, matched_term).
    """
    if not requested_service:
        return True, "EMPTY_SERVICE_BYPASS", ""

    req_clean = requested_service.lower().replace("—", " ").replace("-", " ").strip()
    req_words = set(w for w in req_clean.split() if len(w) >= 2)

    # 1. Check exact or direct match against approved employee services
    for it in approved_services:
        if not it:
            continue
        it_clean = it.lower().replace("—", " ").replace("-", " ").strip()
        if req_clean == it_clean or req_clean in it_clean or it_clean in req_clean:
            return True, "EXACT_OR_SUBSTRING_SERVICE", it

    # 2. Check verified skills
    for sk in verified_skills:
        if not sk:
            continue
        sk_clean = sk.lower().replace("—", " ").replace("-", " ").strip()
        if req_clean == sk_clean or req_clean in sk_clean or sk_clean in req_clean:
            return True, "VERIFIED_SKILL_MATCH", sk

    # 3. Check explicit canonical alias table
    for alias_key, alias_group in EXPLICIT_SERVICE_ALIASES.items():
        # If requested service matches this alias key/group
        if req_clean == alias_key or req_clean in alias_group or any(req_word in alias_group for req_word in req_words):
            # Check if employee has any matching service in that alias group
            for it in approved_services:
                it_clean = it.lower().replace("—", " ").replace("-", " ").strip()
                if it_clean in alias_group or any(w in alias_group for w in it_clean.split() if len(w) >= 2):
                    return True, "EXPLICIT_ALIAS_SERVICE", it
            for sk in verified_skills:
                sk_clean = sk.lower().replace("—", " ").replace("-", " ").strip()
                if sk_clean in alias_group or any(w in alias_group for w in sk_clean.split() if len(w) >= 2):
                    return True, "EXPLICIT_ALIAS_SKILL", sk

    return False, "NO_MATCH", ""


def check_candidate_eligibility(emp: Employee, service_name: Optional[str] = None) -> Tuple[bool, str, Dict[str, bool]]:
    """
    9-Gate Employee Eligibility Engine:
    Authoritative server-side evaluation of 9 mandatory operational gates.
    Every gate fails closed.
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
    documents = onboarding.get("documents", {})
    if any(doc.get("status") != "approved" for doc in documents.values()):
        gate_results["G3"] = False
        logger.debug(f"[9GATE_REJECT_GATE3_DOCUMENTS_UNAPPROVED] Employee #{emp.id} has unapproved documents.")
        return False, "Gate 3: Technician has unapproved dossier documents.", gate_results

    # ── Gate 4: Mandatory Compliance Valid ────────────────────────────────────
    if hasattr(emp, "prefetched_invalid_compliance"):
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
        logger.info(f"[DISPATCH_SERVICE_MATCH] job_service=\"{service_name}\" employee_services={approved_svcs} verified_skills={verified_skills} match_method={method} result={'PASS' if is_match else 'FAIL'}")
        if not is_match:
            gate_results["G6"] = False
            logger.debug(f"[9GATE_REJECT_GATE6_SKILL_MISMATCH] Employee #{emp.id} not authorized/verified for '{service_name}'.")
            return False, f"Gate 6: Technician is not authorized or verified for requested service '{service_name}'.", gate_results

    # ── Gate 7: Live Presence (Online & Available) ────────────────────────────
    if not emp.is_online or emp.current_availability != "available":
        gate_results["G7"] = False
        logger.debug(f"[9GATE_REJECT_GATE7_PRESENCE_OFFLINE] Employee #{emp.id} presence is is_online={emp.is_online}, avail={emp.current_availability}.")
        return False, "Gate 7: Technician is currently OFFLINE or unavailable.", gate_results

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

    # ── Gate 9: Workload Concurrency ──────────────────────────────────────────
    if hasattr(emp, "is_busy_job"):
        if emp.is_busy_job:
            gate_results["G9"] = False
            logger.debug(f"[9GATE_REJECT_GATE9_WORKLOAD_BUSY] Employee #{emp.id} has active busy job.")
            return False, "Gate 9: Technician is busy on active job assignment.", gate_results
    else:
        active_job = ServiceRequest.objects.filter(
            assigned_employee=emp,
            status__in=["accepted", "on_the_way", "arrived", "in_progress"],
        ).first()
        if active_job:
            gate_results["G9"] = False
            logger.debug(f"[9GATE_REJECT_GATE9_WORKLOAD_BUSY] Employee #{emp.id} is busy on active Job #{active_job.id}.")
            return False, f"Gate 9: Technician is busy on active Job #{active_job.id} ({active_job.request_id}).", gate_results

    return True, "All 9 Eligibility Gates Passed", gate_results


def get_eligible_candidates(job_id_or_obj, max_gps_age_seconds: int = MAX_GPS_AGE_SECONDS) -> List[Dict[str, Any]]:
    """
    Finds and ranks all eligible candidate employees for a given ServiceRequest.
    Uses database-level filtering and prefetching for optimal WAN performance.
    """
    if hasattr(job_id_or_obj, "latitude"):
        job_obj = job_id_or_obj
    else:
        job_obj = ServiceRequest.objects.filter(pk=job_id_or_obj).first()
        if not job_obj:
            logger.warning(f"[DISPATCH_JOB_NOT_FOUND] Job #{job_id_or_obj} not found.")
            return []

    if job_obj.latitude is None or job_obj.longitude is None:
        logger.warning(f"[DISPATCH_GPS_MISSING] Job #{job_obj.id} lacks customer GPS coordinates.")
        return []

    try:
        cust_lat = float(job_obj.latitude)
        cust_lon = float(job_obj.longitude)
    except (ValueError, TypeError):
        logger.warning(f"[DISPATCH_GPS_MISSING] Job #{job_obj.id} has invalid customer GPS coordinates ({job_obj.latitude}, {job_obj.longitude}).")
        return []

    today_dow = timezone.now().weekday()
    busy_subquery = ServiceRequest.objects.filter(
        assigned_employee_id=OuterRef("pk"),
        status__in=["accepted", "on_the_way", "arrived", "in_progress"]
    )

    candidates_qs = (
        Employee.objects.filter(
            is_active=True,
            is_online=True,
            current_availability="available",
        )
        .select_related("user", "company")
        .annotate(is_busy_job=Exists(busy_subquery))
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

    if job_obj.company_id:
        candidates_qs = candidates_qs.filter(company_id=job_obj.company_id)

    # Exclude candidates who have already received or rejected an offer for this job
    previous_offers = set(
        WorkforceJobOffer.objects.filter(job=job_obj).values_list("employee_id", flat=True)
    )

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

        gps_age_s = None
        updated_at_str = last_loc.get("updated_at")
        if updated_at_str:
            try:
                loc_dt = parse_datetime(str(updated_at_str))
                if loc_dt:
                    if timezone.is_naive(loc_dt):
                        loc_dt = timezone.make_aware(loc_dt)
                    gps_age_s = (now - loc_dt).total_seconds()
            except Exception:
                pass

        dist_km = None
        emp_lat_f = None
        emp_lon_f = None
        if emp_lat is not None and emp_lon is not None:
            try:
                emp_lat_f = float(emp_lat)
                emp_lon_f = float(emp_lon)
                dist_m = haversine_distance(cust_lat, cust_lon, emp_lat_f, emp_lon_f)
                dist_km = dist_m / 1000.0
            except (ValueError, TypeError):
                pass

        logger.info(
            f"[9GATE_EVALUATION] employee={emp.id} online={emp.is_online} availability={emp.current_availability} "
            f"gps_age={f'{gps_age_s:.1f}s' if gps_age_s is not None else 'MISSING'} "
            f"distance_km={f'{dist_km:.2f}km' if dist_km is not None else 'UNKNOWN'}"
        )

        # Check eligibility against service_category, then issue_title
        is_eligible, reason, gate_results = check_candidate_eligibility(emp, job_obj.service_category)
        if not is_eligible and job_obj.issue_title:
            is_eligible, reason, gate_results = check_candidate_eligibility(emp, job_obj.issue_title)

        g_str = " ".join(f"{k}={'PASS' if v else 'FAIL'}" for k, v in gate_results.items())
        logger.info(f"[9GATE_RESULT] employee={emp.id} {g_str}")

        if not is_eligible:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason={reason}")
            continue

        if emp_lat_f is None or emp_lon_f is None:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=GPS_MISSING")
            continue

        if gps_age_s is None or gps_age_s > max_gps_age_seconds or gps_age_s < -60:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=GPS_STALE gps_age={gps_age_s}s")
            continue

        if dist_km is None or dist_km > MAX_DISPATCH_RADIUS_KM:
            logger.info(f"[DISPATCH_REJECT] job={job_obj.id} employee={emp.id} reason=RADIUS_EXCEEDED distance_km={dist_km}")
            continue

        # Proximity score (closer = higher score, max 100)
        proximity_score = max(0.0, 100.0 - (dist_km * 2.0))

        # Skill proficiency score bonus from prefetched skills
        skills = getattr(emp, "prefetched_verified_skills", [])
        max_prof = 0
        for sk in skills:
            sk_name = sk.skill.name.lower()
            matches = False
            for term in [job_obj.service_category, job_obj.issue_title]:
                if term and (term.lower() in sk_name or sk_name in term.lower()):
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

        logger.info(f"[DISPATCH_CANDIDATE_FOUND] Employee #{emp.id} ({emp.user.username}) eligible for Job #{job_obj.id}: {dist_km:.2f}km away, score={total_score:.1f}")

        ranked_candidates.append({
            "employee": emp,
            "distance_km": dist_km,
            "score": total_score,
        })

    # Sort primarily by nearest distance (ascending), then by highest score (descending)
    ranked_candidates.sort(key=lambda x: (x["distance_km"], -x["score"]))
    return ranked_candidates


def dispatch_job(job_id_or_obj, max_gps_age_seconds: int = MAX_GPS_AGE_SECONDS) -> Tuple[bool, str]:
    """
    Executes automatic dispatch for a single ServiceRequest:
    1. Locks ServiceRequest row with select_for_update inside transaction.atomic()
    2. Validates dispatchable state and coordinates
    3. Checks if an active exclusive offer already exists (idempotent guard)
    4. Evaluates and ranks eligible candidates
    5. Creates WorkforceJobOffer, sends JOB_OFFER notification, and logs audit events
    """
    job_id = job_id_or_obj.pk if hasattr(job_id_or_obj, "pk") else job_id_or_obj
    from workforce_api.models import WorkforceEventLog

    with transaction.atomic():
        job_obj = ServiceRequest.objects.select_for_update().filter(pk=job_id).first()
        if not job_obj:
            return False, "Job not found."

        if job_obj.status in ["completed", "cancelled"]:
            return False, f"Job #{job_id} is {job_obj.status} and cannot be dispatched."

        if job_obj.status in ["accepted", "on_the_way", "arrived", "in_progress"] and job_obj.assigned_employee:
            return False, f"Job #{job_id} is already accepted and in progress with Employee #{job_obj.assigned_employee_id}."

        now = timezone.now()

        logger.info(
            f"[DISPATCH_EVALUATION] job_id={job_obj.id} "
            f"service=\"{job_obj.service_category or job_obj.issue_title}\" "
            f"customer_lat={job_obj.latitude} customer_lng={job_obj.longitude}"
        )

        # Idempotency: Check if an active, non-expired offer already exists
        active_offer = WorkforceJobOffer.objects.select_for_update().filter(
            job=job_obj,
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at__gt=now,
        ).first()

        if active_offer:
            logger.info(f"[DISPATCH_OFFER_EXISTS] Job #{job_id} already has active offer #{active_offer.id} for Employee #{active_offer.employee_id}.")
            return True, f"Active offer already pending for Employee #{active_offer.employee_id}."

        # Validate customer booking coordinates
        if job_obj.latitude is None or job_obj.longitude is None:
            if job_obj.status != "unassigned":
                job_obj.status = "unassigned"
                job_obj.save(update_fields=["status"])
            logger.warning(f"[DISPATCH_GPS_MISSING] Job #{job_id} is missing coordinates.")
            return False, "Customer booking is missing valid GPS coordinates."

        WorkforceEventLog.objects.create(
            event_type="DISPATCH_STARTED",
            payload={"job_id": job_obj.id, "service": job_obj.service_category}
        )

        # Find eligible candidate technicians
        candidates = get_eligible_candidates(job_obj, max_gps_age_seconds=max_gps_age_seconds)

        WorkforceEventLog.objects.create(
            event_type="CANDIDATES_EVALUATED",
            payload={"job_id": job_obj.id, "eligible_count": len(candidates)}
        )

        if not candidates:
            if job_obj.status != "unassigned":
                job_obj.status = "unassigned"
                job_obj.save(update_fields=["status"])

            logger.info(f"[DISPATCH_NO_CANDIDATE] No eligible technician found for Job #{job_id}.")
            admin_user = get_user_model().objects.filter(role="admin").first()
            if admin_user:
                service_name = job_obj.issue_title or job_obj.service_category or "Service"
                WorkforceNotification.objects.create(
                    recipient=admin_user,
                    title="Automatic Dispatch: Awaiting Technician",
                    message=f"No eligible nearby technician available for Job #{job_obj.id} ({service_name}). Job remains unassigned.",
                    notification_type="DISPATCH_UNASSIGNED",
                    company=job_obj.company,
                    related_object_id=str(job_obj.id),
                )
            return False, "No eligible technicians available for automatic dispatch."

        # Top nearest candidate
        top_candidate = candidates[0]
        top_emp = top_candidate["employee"]
        top_dist_km = top_candidate["distance_km"]
        top_score = top_candidate["score"]

        # Expire any previous offers for this job that might be dangling
        WorkforceJobOffer.objects.filter(job=job_obj, status=WorkforceJobOffer.Status.OFFERED).update(status=WorkforceJobOffer.Status.EXPIRED)

        # Create new exclusive job offer valid for 5 minutes
        expires_at = now + timedelta(minutes=DEFAULT_OFFER_DURATION_MINUTES)
        offer = WorkforceJobOffer.objects.create(
            job=job_obj,
            employee=top_emp,
            status=WorkforceJobOffer.Status.OFFERED,
            rank_score=top_score,
            expires_at=expires_at,
        )

        if job_obj.status in ["draft", "new_request", "confirmed", "unassigned"]:
            job_obj.status = "assigned"
            job_obj.save(update_fields=["status"])

        WorkforceEventLog.objects.create(
            user=top_emp.user,
            event_type="OFFER_CREATED",
            payload={"job_id": job_obj.id, "offer_id": offer.id, "employee_id": top_emp.id, "distance_km": round(top_dist_km, 2)}
        )

        loc_str = f" at {job_obj.address}" if job_obj.address else ""
        req_id_str = f" ({job_obj.request_id})" if job_obj.request_id else f" #{job_obj.id}"
        service_label = job_obj.issue_title or job_obj.service_category or "Service Request"
        expiry_str = expires_at.strftime("%H:%M:%S UTC")

        WorkforceNotification.objects.create(
            recipient=top_emp.user,
            title="New Job Offer Available!",
            message=f"You have a new exclusive job offer for '{service_label}'{req_id_str}{loc_str} ({top_dist_km:.1f} km away). Expiry: {expiry_str}. Open your dashboard to Accept or Decline.",
            notification_type="JOB_OFFER",
            company=job_obj.company,
            related_object_id=str(job_obj.id),
        )

        logger.info(
            f"[DISPATCH_DECISION] job={job_obj.id} employee={top_emp.id} "
            f"distance_km={top_dist_km:.2f} score={top_score:.1f} status=OFFER_CREATED"
        )
        return True, f"Job #{job_obj.id} offered to {top_emp.user.get_full_name() or top_emp.user.username} ({top_dist_km:.1f}km away, Score: {top_score:.1f})."


def dispatch_next_candidate(job_id_or_obj) -> Tuple[bool, str]:
    """
    Triggered when an offer is declined or expired:
    Recalculates eligibility and dispatches to the next nearest candidate.
    """
    logger.info(f"[DISPATCH_FALLBACK] Triggering fallback dispatch for Job #{job_id_or_obj}.")
    return dispatch_job(job_id_or_obj)


def expire_and_reassign_offers() -> int:
    """
    Scans for expired job offers in OFFERED state, marks them EXPIRED,
    and automatically triggers fallback dispatch for each affected job.
    Returns the count of expired offers handled.
    """
    now = timezone.now()
    expired_offers = list(
        WorkforceJobOffer.objects.filter(
            status=WorkforceJobOffer.Status.OFFERED,
            expires_at__lte=now,
        ).select_related("job")
    )

    count = 0
    for offer in expired_offers:
        with transaction.atomic():
            off_locked = WorkforceJobOffer.objects.select_for_update().filter(pk=offer.pk, status=WorkforceJobOffer.Status.OFFERED).first()
            if not off_locked:
                continue
            off_locked.status = WorkforceJobOffer.Status.EXPIRED
            off_locked.save(update_fields=["status"])
            count += 1
            logger.info(f"[DISPATCH_OFFER_EXPIRED] Offer #{offer.id} for Job #{offer.job_id} expired. Triggering fallback dispatch.")

        # Re-dispatch job outside the offer lock transaction
        dispatch_next_candidate(offer.job_id)

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
            # Exclude jobs that already have an active exclusive offer
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
    if not emp or not emp.is_active or not emp.is_online or emp.current_availability != "available":
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
