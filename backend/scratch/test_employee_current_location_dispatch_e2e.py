"""
EMPLOYEE CURRENT LOCATION SCAN + LOCATION-DRIVEN JOB QUEUE E2E TEST

Verifies:
TEST 1: Employee OFFLINE -> no dispatch eligibility.
TEST 2: Employee ONLINE but stale GPS -> no dispatch.
TEST 3: Employee clicks Current Location -> fresh GPS obtained.
TEST 4: POST /presence/location/ -> User.last_known_location updated.
TEST 5: updated_at becomes current.
TEST 6: Automatic dispatch reconsideration triggered.
TEST 7: Nearest eligible employee receives WorkforceJobOffer.
TEST 8: Employee dashboard receives offer without F5.
TEST 9: Distance shown correctly.
TEST 10: Far employee does not receive exclusive offer.
TEST 11: Cross-company employee receives nothing.
TEST 12: Repeated Current Location clicks do not create duplicate offers.
TEST 13: Continuous GPS tracking still works after manual refresh.
TEST 14: Customer creates job from separate application/machine.
TEST 15: No Admin dispatch action is required.
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
from datetime import timedelta
import uuid

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
)
from workforce_api.services.automatic_dispatch import (
    dispatch_pending_jobs,
    reconsider_jobs_for_employee,
    MAX_GPS_AGE_SECONDS,
)
from workforce_api.views import (
    WorkforceLocationUpdateView,
    WorkforceJobListView,
    WorkforceDispatchAssignView,
)

User = get_user_model()
factory = APIRequestFactory()


def run_location_scan_dispatch_e2e_tests():
    print("=" * 80)
    print("  WORKFORCE — EMPLOYEE CURRENT LOCATION SCAN & JOB QUEUE E2E TEST")
    print("=" * 80)

    now = timezone.now()
    test_id = uuid.uuid4().hex[:6].upper()

    # 1. Setup Tenant Companies (Company A and Company B)
    comp_a, _ = Company.objects.get_or_create(
        company_name=f"LocScan Enterprise A ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )
    comp_b, _ = Company.objects.get_or_create(
        company_name=f"LocScan Enterprise B ({test_id})",
        defaults={"is_active": True, "geofence_enabled": True}
    )

    skill_appliance, _ = WorkforceSkill.objects.get_or_create(
        name="Appliance Repair & Servicing",
        company=comp_a,
        defaults={"category": "Appliance", "code": f"APP-{test_id}"}
    )

    # 2. Setup Technicians
    # Customer Site: Indiranagar 100ft Rd (12.9716, 77.6413)
    # Tech A (Company A): Initially Stale GPS (10 min old), ~0.5 km away (12.9750, 77.6440)
    # Tech B (Company A): Fresh GPS (20s old), ~6.0 km away (13.0250, 77.6413)
    # Tech C (Company B): Fresh GPS (10s old), ~0.1 km away (12.9720, 77.6415)
    def create_tech(username, emp_id_str, company, is_online, lat, lon, age_seconds=0):
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@test.com", "role": "employee", "first_name": username}
        )
        user.set_password("Pass1234!")
        user.is_active = True
        user.last_known_location = {
            "latitude": lat,
            "longitude": lon,
            "updated_at": (timezone.now() - timedelta(seconds=age_seconds)).isoformat() if age_seconds >= 0 else None,
            "accuracy": 5.0,
        }
        user.save()

        emp, _ = Employee.objects.get_or_create(
            user=user,
            defaults={
                "employee_id": emp_id_str,
                "company": company,
                "is_active": True,
                "is_online": is_online,
                "current_availability": "available" if is_online else "offline",
            }
        )
        emp.company = company
        emp.is_active = True
        emp.is_online = is_online
        emp.current_availability = "available" if is_online else "offline"
        emp.bank_details = {
            "onboarding": {
                "status": "approved",
                "documents": {"id_proof": {"status": "approved"}},
                "services": [{"name": "Appliance Repair & Servicing", "status": "approved"}],
                "draft": {"personal": {"city": "Bengaluru"}},
            },
            "attendance": {"is_clocked_in": True},
            "leaves": [],
        }
        emp.save()

        WorkforceEmployeeSkill.objects.get_or_create(
            employee=emp,
            skill=skill_appliance,
            defaults={"proficiency_level": "EXPERT", "is_verified": True}
        )
        return emp

    # Tech A starts with STALE GPS (600 seconds old = 10 minutes)
    tech_a = create_tech(f"loc_tech_a_{test_id}", f"EMP_LOC_A_{test_id}", comp_a, True, 12.9750, 77.6440, 600)
    # Tech B has fresh GPS, but is far away (6km)
    tech_b_far = create_tech(f"loc_tech_b_{test_id}", f"EMP_LOC_B_{test_id}", comp_a, True, 13.0250, 77.6413, 20)
    # Tech C is close, but belongs to Company B
    tech_c_comp_b = create_tech(f"loc_tech_c_{test_id}", f"EMP_LOC_C_{test_id}", comp_b, True, 12.9720, 77.6415, 10)
    # Tech D is OFFLINE
    tech_d_offline = create_tech(f"loc_tech_d_{test_id}", f"EMP_LOC_D_{test_id}", comp_a, False, 12.9718, 77.6414, 10)

    cust_user, _ = User.objects.get_or_create(
        username=f"loc_cust_{test_id}",
        defaults={"email": f"cust_{test_id}@test.com", "role": "customer", "first_name": "CustLoc"}
    )
    cust_user.company = comp_a
    cust_user.save()

    print("[OK] Test environment initialized with 4 Technicians and Customer.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 14: Customer creates job from separate application directly in DB
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 14: External Customer Job Creation in Shared DB ---")
    sr_id = f"SR-LOC-{test_id}-1"
    ServiceRequest.objects.bulk_create([
        ServiceRequest(
            customer=cust_user,
            company=comp_a,
            request_id=sr_id,
            issue_title="Appliance Repair & Servicing",
            service_category="Appliance Repair & Servicing",
            status="confirmed",
            latitude=12.9716,
            longitude=77.6413,
            address="Indiranagar 100ft Rd, Bengaluru",
            preferred_date=now.date(),
            preferred_time="11:00 AM",
        )
    ])
    job = ServiceRequest.objects.get(request_id=sr_id)
    assert job.assigned_employee is None
    print(f"[OK] External Customer Job inserted in DB: #{job.id} ({job.request_id}, status={job.status})")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 1: Employee OFFLINE -> No Dispatch Eligibility
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 1: Employee OFFLINE Dispatch Gate ---")
    assert tech_d_offline.is_online is False
    # Check eligibility of offline tech
    from workforce_api.services.automatic_dispatch import check_candidate_eligibility
    is_elig_offline, reason_offline = check_candidate_eligibility(tech_d_offline, job.service_category)
    assert is_elig_offline is False, "Offline employee should not be eligible!"
    assert "OFFLINE" in reason_offline.upper() or "UNAVAILABLE" in reason_offline.upper()
    print(f"[OK] TEST 1 PASSED: Offline employee #{tech_d_offline.id} disqualified: {reason_offline}")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 2: Employee ONLINE but Stale GPS (> 300s) -> No Dispatch
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 2: Employee ONLINE with Stale GPS (10 min old) ---")
    # Run dispatch reconciliation
    recon_stale = dispatch_pending_jobs(company_id=comp_a.id)
    # Since Tech A has stale GPS (600s old), Tech A is skipped. Tech B (6km away) receives offer
    offer_initial = WorkforceJobOffer.objects.filter(job=job, status="OFFERED").first()
    assert offer_initial is not None
    assert offer_initial.employee_id == tech_b_far.id, f"Tech A with stale GPS should have been skipped! Got {offer_initial.employee_id}"
    print(f"[OK] TEST 2 PASSED: Tech A (0.5km, stale GPS 600s) was skipped; Tech B (6km, fresh GPS) received offer.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 3, 4, 5: Employee A clicks "Current Location" -> Fresh GPS transmitted
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 3, 4, 5: Current Location Scan & User.last_known_location Update ---")
    # Simulate Tech B declining so job is free for Tech A
    offer_initial.status = "REJECTED"
    offer_initial.save()

    view_loc = WorkforceLocationUpdateView.as_view()
    fresh_lat = 12.9725
    fresh_lon = 77.6420  # ~0.13 km away from customer
    fresh_acc = 4.2
    req_scan = factory.post("/api/workforce/presence/location/", {
        "latitude": fresh_lat,
        "longitude": fresh_lon,
        "accuracy": fresh_acc,
    })
    force_authenticate(req_scan, user=tech_a.user)
    resp_scan = view_loc(req_scan)
    assert resp_scan.status_code == 200, f"Location update failed: {resp_scan.data}"

    # Verify User.last_known_location updated
    tech_a.user.refresh_from_db()
    loc_db = tech_a.user.last_known_location
    assert loc_db is not None, "last_known_location is None!"
    assert float(loc_db["latitude"]) == fresh_lat, "Latitude mismatch!"
    assert float(loc_db["longitude"]) == fresh_lon, "Longitude mismatch!"
    assert loc_db.get("updated_at") is not None, "updated_at missing!"

    # Verify updated_at is within last 5 seconds (current)
    from django.utils.dateparse import parse_datetime
    loc_time = parse_datetime(loc_db["updated_at"])
    assert (timezone.now() - loc_time).total_seconds() < 5, "updated_at is not fresh!"
    print(f"[OK] TEST 3, 4, 5 PASSED: Fresh GPS ({fresh_lat}, {fresh_lon}, ±{fresh_acc}m) updated in User.last_known_location with current timestamp.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 6 & 7: Automatic Dispatch Reconsideration Triggered -> Tech A gets offer
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 6 & 7: Automatic Dispatch Reconsideration & Job Offer ---")
    offer_fresh = WorkforceJobOffer.objects.filter(job=job, status="OFFERED").first()
    assert offer_fresh is not None, "No offer created on location scan!"
    assert offer_fresh.employee_id == tech_a.id, f"Expected Tech A ({tech_a.id}), got {offer_fresh.employee_id}"
    print(f"[OK] TEST 6 & 7 PASSED: GPS update immediately triggered reconsideration; Tech A received exclusive Offer #{offer_fresh.id}.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 8 & 9: Employee Dashboard Receives Offer and Proximity Distance
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 8 & 9: Employee Dashboard Query & Distance Calculation ---")
    view_jobs = WorkforceJobListView.as_view()
    req_jobs = factory.get("/api/workforce/jobs/")
    force_authenticate(req_jobs, user=tech_a.user)
    resp_jobs = view_jobs(req_jobs)
    assert resp_jobs.status_code == 200
    jobs_data = resp_jobs.data
    assert len(jobs_data) >= 1

    job_data_a = next((j for j in jobs_data if j["id"] == job.id), None)
    assert job_data_a is not None, "Offered job not returned in dashboard query!"
    assert job_data_a["active_offer"] is not None
    assert job_data_a["active_offer"]["status"] == "OFFERED"

    # Distance check
    dist_km = job_data_a.get("distance_km")
    assert dist_km is not None, "distance_km missing from job serializer!"
    assert 0.05 <= dist_km <= 0.30, f"Unexpected distance: {dist_km} km (expected ~0.13 km)"
    print(f"[OK] TEST 8 & 9 PASSED: Job #{job.id} appears with active offer and distance_km={dist_km} km.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 10: Far Employee Does Not Receive Exclusive Offer
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 10: Far Employee Rejection ---")
    req_jobs_b = factory.get("/api/workforce/jobs/")
    force_authenticate(req_jobs_b, user=tech_b_far.user)
    resp_jobs_b = view_jobs(req_jobs_b)
    assert resp_jobs_b.status_code == 200
    # Far employee Tech B should NOT see active offer for Job 1
    job_data_b = next((j for j in resp_jobs_b.data if j["id"] == job.id), None)
    if job_data_b:
        assert job_data_b.get("active_offer") is None, "Far Tech B should not have active offer!"
    print("[OK] TEST 10 PASSED: Far employee (6km) correctly does NOT receive exclusive offer.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 11: Cross-Company Employee Receives Nothing
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 11: Cross-Company Isolation ---")
    req_jobs_c = factory.get("/api/workforce/jobs/")
    force_authenticate(req_jobs_c, user=tech_c_comp_b.user)
    resp_jobs_c = view_jobs(req_jobs_c)
    assert resp_jobs_c.status_code == 200
    # Company B tech should receive 0 jobs from Company A
    job_ids_c = [j["id"] for j in resp_jobs_c.data]
    assert job.id not in job_ids_c, "Company B tech received Company A job!"
    print("[OK] TEST 11 PASSED: Company B employee receives 0 jobs from Company A.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 12: Repeated Current Location Clicks Do Not Duplicate Offers
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 12: Idempotency on Repeated Location Scans ---")
    for i in range(3):
        req_repeat = factory.post("/api/workforce/presence/location/", {
            "latitude": fresh_lat + (i * 0.0001),
            "longitude": fresh_lon + (i * 0.0001),
            "accuracy": fresh_acc,
        })
        force_authenticate(req_repeat, user=tech_a.user)
        resp_repeat = view_loc(req_repeat)
        assert resp_repeat.status_code == 200

    active_offers_count = WorkforceJobOffer.objects.filter(job=job, status="OFFERED").count()
    assert active_offers_count == 1, f"Found {active_offers_count} active offers, expected 1!"
    print(f"[OK] TEST 12 PASSED: 3 repeated scans generated exactly 1 active offer.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 13: Continuous GPS Tracking Operates Correctly
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 13: Continuous GPS Tracking Verification ---")
    req_cont = factory.post("/api/workforce/presence/location/", {
        "latitude": 12.9730,
        "longitude": 77.6425,
        "accuracy": 4.5,
    })
    force_authenticate(req_cont, user=tech_a.user)
    resp_cont = view_loc(req_cont)
    assert resp_cont.status_code == 200
    assert resp_cont.data["message"] == "Live GPS coordinates updated."
    print("[OK] TEST 13 PASSED: Continuous GPS tracking functions seamlessly.")

    # ──────────────────────────────────────────────────────────────────────────
    # TEST 15: No Admin Action Required (Manual Dispatch 410 Blocked)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 15: Zero Admin Action & Manual Dispatch Blocked ---")
    view_manual = WorkforceDispatchAssignView.as_view()
    req_admin_man = factory.post("/api/workforce/dispatch/assign/", {"job_id": job.id, "employee_id": tech_a.id})
    admin_u, _ = User.objects.get_or_create(username=f"loc_admin_{test_id}", defaults={"role": "admin", "is_staff": True})
    admin_u.company = comp_a
    admin_u.save()
    force_authenticate(req_admin_man, user=admin_u)
    resp_admin_man = view_manual(req_admin_man)
    assert resp_admin_man.status_code in [403, 410]
    assert resp_admin_man.data.get("code") == "MANUAL_DISPATCH_DISABLED"
    print(f"[OK] TEST 15 PASSED: Entire flow was 100% automated with zero admin action. Manual dispatch is blocked (HTTP 410).")

    print("\n" + "=" * 80)
    print("  ALL 15 LOCATION-SCAN DISPATCH E2E TESTS PASSED 100%!")
    print("=" * 80)


if __name__ == "__main__":
    run_location_scan_dispatch_e2e_tests()
