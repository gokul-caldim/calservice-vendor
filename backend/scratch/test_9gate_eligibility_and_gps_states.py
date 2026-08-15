"""
WORKFORCE — 9-GATE ELIGIBILITY + REAL GPS-DRIVEN DISPATCH TEST

Authoritative verification against real PostgreSQL and Workforce services:
TEST A: ONLINE + FRESH GPS -> All 9 gates pass -> Exclusive WorkforceJobOffer & Notification created
TEST B: OFFLINE EMPLOYEE -> Fails Gate 7 -> No offer, no notification
TEST C: ONLINE BUT STALE GPS -> Excluded by freshness gate (>300s) -> No offer
TEST D: CURRENT LOCATION REFRESH -> POST /presence/location/ -> Reconsideration -> Offer received
TEST E: DISTANCE RANKING -> Tech C (0.1km stale) excluded; Tech A (0.5km fresh) wins over Tech B (3km fresh)
TEST F: NINE GATES FAIL-CLOSED -> Independent fail-closed test for all 9 gates (1 through 9)
TEST G: WATCHER / LOCATION IDEMPOTENCY -> Repeated updates produce exactly 1 active offer
TEST H: CROSS-TENANT SECURITY -> Company B tech blocked from Company A jobs
"""
import os
import sys
from pathlib import Path
from datetime import timedelta, time
import uuid

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceEmployeeSkill,
    WorkforceSkill,
    WorkforceEmployeeCompliance,
    WorkforceComplianceRequirement,
    WorkforceEmployeeSchedule,
)
from workforce_api.services.automatic_dispatch import (
    dispatch_pending_jobs,
    reconsider_jobs_for_employee,
    check_candidate_eligibility,
    MAX_GPS_AGE_SECONDS,
)
from workforce_api.views import (
    WorkforceLocationUpdateView,
    WorkforceJobListView,
    WorkforceDispatchAssignView,
)

User = get_user_model()
factory = APIRequestFactory()


def run_9gate_and_gps_states_tests():
    print("=" * 80)
    print("  WORKFORCE — 9-GATE ELIGIBILITY & GPS DISPATCH STATE MACHINE TEST")
    print("=" * 80)

    now = timezone.now()
    test_id = uuid.uuid4().hex[:6].upper()

    # Setup Companies
    comp_a, _ = Company.objects.get_or_create(
        company_name=f"9Gate Enterprise A ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )
    comp_b, _ = Company.objects.get_or_create(
        company_name=f"9Gate Enterprise B ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )

    skill_ac, _ = WorkforceSkill.objects.get_or_create(
        name=f"HVAC & AC Service ({test_id})",
        company=comp_a,
        defaults={"category": "HVAC", "code": f"AC-{test_id}"}
    )

    req_comp, _ = WorkforceComplianceRequirement.objects.get_or_create(
        title=f"HVAC Safety Cert ({test_id})",
        company=comp_a,
        defaults={"is_mandatory": True, "validity_days": 365}
    )

    def create_test_tech(username, emp_id_str, company, is_online=True, availability="available", lat=12.9750, lon=77.6440, gps_age_s=0, active=True):
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@test.com", "role": "employee", "first_name": username}
        )
        user.set_password("Pass1234!")
        user.is_active = active
        user.company = company
        user.last_known_location = {
            "latitude": lat,
            "longitude": lon,
            "updated_at": (timezone.now() - timedelta(seconds=gps_age_s)).isoformat() if gps_age_s >= 0 else None,
            "accuracy": 5.0,
        }
        user.save()

        emp, _ = Employee.objects.get_or_create(
            user=user,
            defaults={
                "employee_id": emp_id_str,
                "company": company,
                "is_active": active,
                "is_online": is_online,
                "current_availability": availability,
            }
        )
        emp.is_active = active
        emp.company = company
        emp.is_online = is_online
        emp.current_availability = availability
        emp.bank_details = {
            "onboarding": {
                "status": "approved",
                "documents": {
                    "id_proof": {"status": "approved"},
                    "driver_license": {"status": "approved"},
                },
                "services": [{"name": f"HVAC & AC Service ({test_id})", "status": "approved"}],
            },
            "attendance": {"is_clocked_in": True},
            "leaves": [],
        }
        emp.save()

        # Verified Skill
        WorkforceEmployeeSkill.objects.get_or_create(
            employee=emp,
            skill=skill_ac,
            defaults={"proficiency_level": "EXPERT", "is_verified": True}
        )

        # Valid Compliance
        WorkforceEmployeeCompliance.objects.get_or_create(
            employee=emp,
            requirement=req_comp,
            defaults={"status": "VALID", "expiry_date": timezone.now().date() + timedelta(days=90)}
        )

        # Today's Working Schedule (00:00 to 23:59 so all tests are in-schedule)
        today_dow = timezone.now().weekday()
        WorkforceEmployeeSchedule.objects.update_or_create(
            employee=emp,
            day_of_week=today_dow,
            defaults={
                "company": company,
                "is_working_day": True,
                "start_time": time(0, 0, 0),
                "end_time": time(23, 59, 59),
            }
        )
        return emp

    cust_user, _ = User.objects.get_or_create(
        username=f"cust_9gate_{test_id}",
        defaults={"email": f"cust_9gate_{test_id}@test.com", "role": "customer"}
    )
    cust_user.company = comp_a
    cust_user.save()

    print("[OK] Test environment initialized with 9-Gate structures.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST A: ONLINE + FRESH GPS (All 9 Gates Pass)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST A: Online + Fresh GPS (~2 km away) ---")
    tech_a = create_test_tech(f"tech_a_{test_id}", f"EMP_9G_A_{test_id}", comp_a, lat=12.9850, lon=77.6413, gps_age_s=30)
    
    # Customer at 12.9716, 77.6413 (~1.5 km away)
    job_a = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-9G-A-{test_id}",
        issue_title=f"HVAC & AC Service ({test_id})",
        service_category=f"HVAC & AC Service ({test_id})",
        status="confirmed",
        latitude=12.9716,
        longitude=77.6413,
        address="Customer Location A",
        preferred_date=now.date(),
        preferred_time="10:00 AM",
    )
    
    import time as pytime
    # Give background worker up to 2 seconds or trigger manually
    offer_a = None
    for _ in range(5):
        offer_a = WorkforceJobOffer.objects.filter(job=job_a, status="OFFERED").first()
        if offer_a:
            break
        pytime.sleep(0.3)

    if not offer_a:
        recon_a = dispatch_pending_jobs(company_id=comp_a.id)
        offer_a = WorkforceJobOffer.objects.filter(job=job_a, status="OFFERED").first()

    assert offer_a is not None, "WorkforceJobOffer not found for Job A!"
    assert offer_a.employee_id == tech_a.id
    
    # Verify in-app notification
    notif_a = WorkforceNotification.objects.filter(recipient=tech_a.user, notification_type="JOB_OFFER").first()
    assert notif_a is not None, "Notification not created for Tech A!"
    
    # Verify distance in serializer
    view_jobs = WorkforceJobListView.as_view()
    req_a = factory.get("/api/workforce/jobs/")
    force_authenticate(req_a, user=tech_a.user)
    resp_a = view_jobs(req_a)
    assert resp_a.status_code == 200
    job_data_a = next(j for j in resp_a.data if j["id"] == job_a.id)
    assert job_data_a["distance_km"] is not None
    assert 1.2 <= job_data_a["distance_km"] <= 1.8, f"Unexpected distance: {job_data_a['distance_km']} km"
    print(f"[PASS] TEST A: Tech A passed all 9 gates, received Offer #{offer_a.id}, dist={job_data_a['distance_km']}km.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST B: OFFLINE EMPLOYEE (Gate 7 Fail-Closed)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST B: Offline Employee Gate 7 Fail-Closed ---")
    # All techs are marked offline/busy before job_b is created
    tech_a.is_online = False
    tech_a.current_availability = "busy"
    tech_a.save()
    offer_a.status = "ACCEPTED"
    offer_a.save()
    job_a.status = "accepted"
    job_a.assigned_employee = tech_a
    job_a.save()
    EmployeeJob.objects.create(service_request=job_a, employee=tech_a, status="ACCEPTED", is_primary=True)

    tech_b_offline = create_test_tech(f"tech_b_{test_id}", f"EMP_9G_B_{test_id}", comp_a, is_online=False, availability="offline")
    job_b = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-9G-B-{test_id}",
        issue_title=f"HVAC & AC Service ({test_id})",
        service_category=f"HVAC & AC Service ({test_id})",
        status="confirmed",
        latitude=12.9716,
        longitude=77.6413,
        address="Customer Location B",
        preferred_date=now.date(),
    )

    recon_b = dispatch_pending_jobs(company_id=comp_a.id)
    offer_b = WorkforceJobOffer.objects.filter(job=job_b, status="OFFERED").first()
    assert offer_b is None, f"Offline employee unexpectedly received offer: {offer_b}"
    notif_b = WorkforceNotification.objects.filter(recipient=tech_b_offline.user, notification_type="JOB_OFFER").first()
    assert notif_b is None, "Offline employee received notification!"
    print("[PASS] TEST B: Offline technician correctly received 0 offers and 0 notifications.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST C: ONLINE BUT STALE GPS (>300s)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST C: Online Technician with Stale GPS (10 min old) ---")
    tech_c_stale = create_test_tech(f"tech_c_{test_id}", f"EMP_9G_C_{test_id}", comp_a, is_online=True, lat=12.9720, lon=77.6415, gps_age_s=600)
    job_c = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-9G-C-{test_id}",
        issue_title=f"HVAC & AC Service ({test_id})",
        service_category=f"HVAC & AC Service ({test_id})",
        status="confirmed",
        latitude=12.9716,
        longitude=77.6413,
        address="Customer Location C",
        preferred_date=now.date(),
    )
    recon_c = dispatch_pending_jobs(company_id=comp_a.id)
    offer_c = WorkforceJobOffer.objects.filter(job=job_c, status="OFFERED").first()
    assert offer_c is None, f"Stale GPS tech unexpectedly received offer: {offer_c}"
    print("[PASS] TEST C: Stale GPS technician (600s old) rejected from dispatch.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST D: CURRENT LOCATION REFRESH -> DISPATCH RECONSIDERATION
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST D: Current Location Scan -> Real Location API -> Reconsideration ---")
    view_loc = WorkforceLocationUpdateView.as_view()
    fresh_lat = 12.9722
    fresh_lon = 77.6418
    req_scan = factory.post("/api/workforce/presence/location/", {
        "latitude": fresh_lat,
        "longitude": fresh_lon,
        "accuracy": 3.8,
    })
    force_authenticate(req_scan, user=tech_c_stale.user)
    resp_scan = view_loc(req_scan)
    assert resp_scan.status_code == 200

    # Verify updated_at is fresh
    tech_c_stale.user.refresh_from_db()
    assert float(tech_c_stale.user.last_known_location["latitude"]) == fresh_lat

    # Verify pending Job C was automatically offered on location scan
    offer_c_fresh = WorkforceJobOffer.objects.filter(job=job_c, status="OFFERED").first()
    assert offer_c_fresh is not None, "Offer not created after Current Location scan!"
    assert offer_c_fresh.employee_id == tech_c_stale.id
    print(f"[PASS] TEST D: Current Location scan immediately triggered reconsideration -> Offer #{offer_c_fresh.id}.")

    # Tech C accepts Job C and is marked busy
    offer_c_fresh.status = "ACCEPTED"
    offer_c_fresh.save()
    job_c.status = "accepted"
    job_c.assigned_employee = tech_c_stale
    job_c.save()
    EmployeeJob.objects.create(service_request=job_c, employee=tech_c_stale, status="ACCEPTED", is_primary=True)
    tech_c_stale.is_online = False
    tech_c_stale.current_availability = "busy"
    tech_c_stale.save()

    # ──────────────────────────────────────────────────────────────────────────
    # TEST E: DISTANCE RANKING WITH GPS FRESHNESS PRIORITY
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST E: Distance Ranking (Tech A: 0.5km fresh, Tech B: 3km fresh, Tech C: 0.1km stale) ---")
    # Tech 1: 0.5km, fresh (30s)
    t1_close = create_test_tech(f"rank_t1_{test_id}", f"EMP_R1_{test_id}", comp_a, lat=12.9750, lon=77.6440, gps_age_s=30)
    # Tech 2: 3.0km, fresh (20s)
    t2_far = create_test_tech(f"rank_t2_{test_id}", f"EMP_R2_{test_id}", comp_a, lat=12.9980, lon=77.6413, gps_age_s=20)
    # Tech 3: 0.05km, stale (600s)
    t3_stale_closest = create_test_tech(f"rank_t3_{test_id}", f"EMP_R3_{test_id}", comp_a, lat=12.9718, lon=77.6414, gps_age_s=600)

    job_e = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-9G-E-{test_id}",
        issue_title=f"HVAC & AC Service ({test_id})",
        service_category=f"HVAC & AC Service ({test_id})",
        status="confirmed",
        latitude=12.9716,
        longitude=77.6413,
        address="Customer Location E",
        preferred_date=now.date(),
    )
    offer_e = None
    for _ in range(5):
        offer_e = WorkforceJobOffer.objects.filter(job=job_e, status="OFFERED").first()
        if offer_e:
            break
        pytime.sleep(0.3)
    if not offer_e:
        recon_e = dispatch_pending_jobs(company_id=comp_a.id)
        offer_e = WorkforceJobOffer.objects.filter(job=job_e, status="OFFERED").first()
    assert offer_e is not None
    assert offer_e.employee_id == t1_close.id, f"Expected closest fresh Tech #{t1_close.id}, got #{offer_e.employee_id}"
    print(f"[PASS] TEST E: Stale closest Tech 3 excluded; closest fresh Tech 1 (#{t1_close.id}, 0.5km) selected over far Tech 2 (3km).")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST F: NINE GATES FAIL-CLOSED VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST F: Comprehensive Fail-Closed Test for All 9 Gates ---")
    
    # Gate 1: Account Inactive
    g1_tech = create_test_tech(f"g1_{test_id}", f"EMP_G1_{test_id}", comp_a, active=False)
    is_ok, reason = check_candidate_eligibility(g1_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 1" in reason.upper(), f"Gate 1 failed: {reason}"
    print("[PASS] Gate 1 Fail-Closed: Inactive account rejected.")

    # Gate 2: Onboarding Unapproved
    g2_tech = create_test_tech(f"g2_{test_id}", f"EMP_G2_{test_id}", comp_a)
    g2_tech.bank_details["onboarding"]["status"] = "pending"
    g2_tech.save()
    is_ok, reason = check_candidate_eligibility(g2_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 2" in reason.upper(), f"Gate 2 failed: {reason}"
    print("[PASS] Gate 2 Fail-Closed: Unapproved onboarding rejected.")

    # Gate 3: Required Documents Unapproved
    g3_tech = create_test_tech(f"g3_{test_id}", f"EMP_G3_{test_id}", comp_a)
    g3_tech.bank_details["onboarding"]["documents"]["id_proof"]["status"] = "rejected"
    g3_tech.save()
    is_ok, reason = check_candidate_eligibility(g3_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 3" in reason.upper(), f"Gate 3 failed: {reason}"
    print("[PASS] Gate 3 Fail-Closed: Rejected/missing documents rejected.")

    # Gate 4: Compliance Invalid
    g4_tech = create_test_tech(f"g4_{test_id}", f"EMP_G4_{test_id}", comp_a)
    WorkforceEmployeeCompliance.objects.filter(employee=g4_tech).update(status="EXPIRED")
    is_ok, reason = check_candidate_eligibility(g4_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 4" in reason.upper(), f"Gate 4 failed: {reason}"
    print("[PASS] Gate 4 Fail-Closed: Expired mandatory compliance rejected.")

    # Gate 5: Working Schedule Outside Hours
    g5_tech = create_test_tech(f"g5_{test_id}", f"EMP_G5_{test_id}", comp_a)
    WorkforceEmployeeSchedule.objects.filter(employee=g5_tech).update(is_working_day=False)
    is_ok, reason = check_candidate_eligibility(g5_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 5" in reason.upper(), f"Gate 5 failed: {reason}"
    print("[PASS] Gate 5 Fail-Closed: Scheduled off today rejected.")

    # Gate 6: Service / Skill Mismatch
    g6_tech = create_test_tech(f"g6_{test_id}", f"EMP_G6_{test_id}", comp_a)
    is_ok, reason = check_candidate_eligibility(g6_tech, "Unrelated Plumbing Specialty")
    assert is_ok is False and "GATE 6" in reason.upper(), f"Gate 6 failed: {reason}"
    print("[PASS] Gate 6 Fail-Closed: Service/skill mismatch rejected.")

    # Gate 7: Live Presence (Offline/Unavailable)
    g7_tech = create_test_tech(f"g7_{test_id}", f"EMP_G7_{test_id}", comp_a, is_online=True, availability="busy")
    is_ok, reason = check_candidate_eligibility(g7_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 7" in reason.upper(), f"Gate 7 failed: {reason}"
    print("[PASS] Gate 7 Fail-Closed: Unavailable presence rejected.")

    # Gate 8: Leave Active
    g8_tech = create_test_tech(f"g8_{test_id}", f"EMP_G8_{test_id}", comp_a)
    g8_tech.bank_details["leaves"] = [{
        "status": "approved",
        "start_date": (timezone.now() - timedelta(days=1)).date().isoformat(),
        "end_date": (timezone.now() + timedelta(days=1)).date().isoformat(),
    }]
    g8_tech.save()
    is_ok, reason = check_candidate_eligibility(g8_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 8" in reason.upper(), f"Gate 8 failed: {reason}"
    print("[PASS] Gate 8 Fail-Closed: Active approved leave rejected.")

    # Gate 9: Workload Concurrency (Busy on conflicting job)
    g9_tech = create_test_tech(f"g9_{test_id}", f"EMP_G9_{test_id}", comp_a)
    active_sr = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-BUSY-{test_id}",
        status="in_progress",
        assigned_employee=g9_tech,
        preferred_date=now.date(),
    )
    is_ok, reason = check_candidate_eligibility(g9_tech, f"HVAC & AC Service ({test_id})")
    assert is_ok is False and "GATE 9" in reason.upper(), f"Gate 9 failed: {reason}"
    print("[PASS] Gate 9 Fail-Closed: Active busy job workload rejected.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST G: WATCHER / LOCATION IDEMPOTENCY
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST G: Location & Dispatch Idempotency ---")
    tech_g = create_test_tech(f"tech_g_{test_id}", f"EMP_9G_G_{test_id}", comp_a, lat=12.9730, lon=77.6420, gps_age_s=10)
    job_g = ServiceRequest.objects.create(
        customer=cust_user,
        company=comp_a,
        request_id=f"SR-9G-G-{test_id}",
        issue_title=f"HVAC & AC Service ({test_id})",
        service_category=f"HVAC & AC Service ({test_id})",
        status="confirmed",
        latitude=12.9716,
        longitude=77.6413,
        preferred_date=now.date(),
    )
    # Send 5 rapid location updates for tech_g
    for i in range(5):
        req_idem = factory.post("/api/workforce/presence/location/", {
            "latitude": 12.9730 + (i * 0.00005),
            "longitude": 77.6420 + (i * 0.00005),
            "accuracy": 4.0,
        })
        force_authenticate(req_idem, user=tech_g.user)
        resp_idem = view_loc(req_idem)
        assert resp_idem.status_code == 200

    active_offers_g = WorkforceJobOffer.objects.filter(job=job_g, status="OFFERED").count()
    assert active_offers_g == 1, f"Found {active_offers_g} active offers (expected 1)!"
    print(f"[PASS] TEST G: 5 rapid location updates resulted in exactly 1 active offer.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST H: CROSS-TENANT SECURITY
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST H: Cross-Tenant Multi-Company Isolation ---")
    tech_h_comp_b = create_test_tech(f"tech_h_{test_id}", f"EMP_9G_H_{test_id}", comp_b, lat=12.9717, lon=77.6414, gps_age_s=10)
    req_jobs_h = factory.get("/api/workforce/jobs/")
    force_authenticate(req_jobs_h, user=tech_h_comp_b.user)
    resp_jobs_h = view_jobs(req_jobs_h)
    assert resp_jobs_h.status_code == 200
    comp_a_job_ids = [job_a.id, job_b.id, job_c.id, job_e.id, job_g.id]
    returned_ids = [j["id"] for j in resp_jobs_h.data]
    assert not any(jid in returned_ids for jid in comp_a_job_ids), "Company B tech received Company A jobs!"
    print("[PASS] TEST H: Company B technician completely isolated from Company A jobs.")

    print("\n" + "=" * 80)
    print("  ALL 9-GATE ELIGIBILITY & GPS DISPATCH STATE TESTS PASSED 100%!")
    print("=" * 80)


if __name__ == "__main__":
    run_9gate_and_gps_states_tests()
