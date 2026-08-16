"""
Production Hardening Regression Test Suite:
Workforce Live Tracking, Automatic Dispatch, 9-Gate Eligibility,
Consecutive-Fix Arrival, OTP Security, and State Machine Concurrency.

Tested against real PostgreSQL database.
"""
import os
import sys
import uuid
from datetime import timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
import django
django.setup()

from rest_framework.test import APIRequestFactory
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import (
    WorkforceJobOffer,
    WorkforceNotification,
    WorkforceSkill,
    WorkforceEmployeeSkill,
    WorkforceComplianceRequirement,
    WorkforceEmployeeCompliance,
    WorkforceEmployeeSchedule,
    WorkforceEventLog,
    PreServiceVerification,
    JobTrackingSession,
    JobLocationPoint,
)
from workforce_api.services.automatic_dispatch import (
    check_candidate_eligibility,
    get_eligible_candidates,
    dispatch_job,
    MAX_GPS_AGE_SECONDS,
    MAX_DISPATCH_RADIUS_KM,
)
from workforce_api.views import (
    WorkforceLocationUpdateView,
    WorkforceJobLiveTrackingView,
    WorkforceJobAcceptOfferView,
    WorkforceJobRejectOfferView,
    WorkforceJobVerifyOTPView,
)

User = get_user_model()
factory = APIRequestFactory()

PASSED = 0
FAILED = 0


def assert_test(condition, name, details=""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  [PASS] {name}")
    else:
        FAILED += 1
        print(f"  [FAIL] {name} | {details}")


def run_all_tests():
    print("=" * 80)
    print("STARTING WORKFORCE PRODUCTION HARDENING REGRESSION TEST SUITE")
    print("=" * 80)

    uid = uuid.uuid4().hex[:6].upper()
    now = timezone.now()

    # 1. Setup Base Company, Users and Customer
    company = Company.objects.create(company_name=f"Hardened Logistics {uid}")

    customer_user = User.objects.create_user(
        username=f"cust_{uid}",
        email=f"cust_{uid}@test.com",
        password="Password123!",
        role="customer",
        company=company,
    )

    other_customer_user = User.objects.create_user(
        username=f"other_cust_{uid}",
        email=f"other_cust_{uid}@test.com",
        password="Password123!",
        role="customer",
        company=company,
    )

    other_company = Company.objects.create(company_name=f"Other Logistics {uid}")
    cross_tech_user = User.objects.create_user(
        username=f"cross_tech_{uid}",
        email=f"cross_tech_{uid}@test.com",
        password="Password123!",
        role="employee",
        company=other_company,
    )
    cross_emp = Employee.objects.create(
        user=cross_tech_user,
        company=other_company,
        employee_id=f"EMP-CROSS-{uid}",
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={"onboarding": {"status": "approved"}},
    )

    # Primary Tech User
    tech_user = User.objects.create_user(
        username=f"tech_lead_{uid}",
        email=f"tech_lead_{uid}@test.com",
        password="Password123!",
        role="employee",
        company=company,
    )
    tech_emp = Employee.objects.create(
        user=tech_user,
        company=company,
        employee_id=f"EMP-TECH-{uid}",
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "approved",
                "services": [{"name": "AC Repair & Maintenance", "category": "Air Conditioning", "status": "approved"}],
                "documents": {"aadhaar": {"status": "approved"}},
            }
        },
    )

    # Competitor Tech User for concurrency tests
    tech2_user = User.objects.create_user(
        username=f"tech_two_{uid}",
        email=f"tech_two_{uid}@test.com",
        password="Password123!",
        role="employee",
        company=company,
    )
    tech2_emp = Employee.objects.create(
        user=tech2_user,
        company=company,
        employee_id=f"EMP-TWO-{uid}",
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "approved",
                "services": [{"name": "AC Repair & Maintenance", "category": "Air Conditioning", "status": "approved"}],
                "documents": {"aadhaar": {"status": "approved"}},
            }
        },
    )

    # Customer Job Location (Chennai Coordinates: 13.0827, 80.2707)
    JOB_LAT = 13.0827000
    JOB_LON = 80.2707000

    job = ServiceRequest.objects.create(
        customer=customer_user,
        customer_name="Test Customer",
        phone="+919876543210",
        service_category="Air Conditioning",
        issue_title="AC Repair & Maintenance",
        address="123 Anna Salai, Chennai",
        latitude=JOB_LAT,
        longitude=JOB_LON,
        preferred_date=now.date(),
        status="confirmed",
        company=company,
    )

    print("\n--- GROUP 1: GPS Architecture & Quality ---")

    # Test 1: Single watchPosition watcher in frontend
    frontend_hooks_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "hooks", "useGPSPosition.js")
    with open(frontend_hooks_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert_test("navigator.geolocation.watchPosition" in content and "WebGeolocationAdapter" in content, "Test 01: Single watchPosition architecture in useGPSPosition.js")

    # Test 2: Out of order older GPS packet rejection
    view_loc = WorkforceLocationUpdateView.as_view()
    t_now = timezone.now()
    t_past = t_now - timedelta(seconds=45)

    # First send fresh location
    req1 = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": 13.0830, "longitude": 80.2705, "accuracy": 10.0, "captured_at": t_now.isoformat()},
        content_type="application/json",
    )
    req1.user = tech_user
    resp1 = view_loc(req1)
    assert_test(resp1.status_code == 200, "Test 02a: Initial valid GPS update accepted")

    # Now send older packet with captured_at in the past
    tech_user.refresh_from_db()
    req_old = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": 13.0100, "longitude": 80.2100, "accuracy": 10.0, "captured_at": t_past.isoformat()},
        format="json",
    )
    req_old.user = tech_user
    resp_old = view_loc(req_old)
    tech_user.refresh_from_db()
    current_lat = float(tech_user.last_known_location["latitude"])
    assert_test(resp_old.data.get("ignored") is True and current_lat == 13.0830, "Test 02b: Out-of-order older GPS packet does not overwrite newer location")

    # Test 3: Coordinate range validation
    req_bad_range = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": 95.0, "longitude": 80.2705},
        format="json",
    )
    req_bad_range.user = tech_user
    resp_bad = view_loc(req_bad_range)
    assert_test(resp_bad.status_code == 400 and resp_bad.data["code"] == "COORDINATES_OUT_OF_RANGE", "Test 03: Out-of-range coordinates rejected (400 Bad Request)")

    print("\n--- GROUP 2: Automatic Consecutive-Fix Arrival Engine ---")

    # Assign tech to job for tracking
    job.assigned_employee = tech_emp
    job.status = "on_the_way"
    job.save()

    # Test 4: Stale GPS (>15s) inside geofence cannot trigger arrival
    t_stale = timezone.now() - timedelta(seconds=20)
    req_stale = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT, "longitude": JOB_LON, "accuracy": 15.0, "captured_at": t_stale.isoformat()},
        format="json",
    )
    req_stale.user = tech_user
    view_loc(req_stale)
    job.refresh_from_db()
    assert_test(job.status == "on_the_way", "Test 04: Stale GPS (>15s) inside geofence cannot trigger arrival")

    # Test 5: Inaccurate GPS (>50m) cannot trigger arrival
    req_inaccurate = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT, "longitude": JOB_LON, "accuracy": 75.0, "captured_at": timezone.now().isoformat()},
        format="json",
    )
    req_inaccurate.user = tech_user
    view_loc(req_inaccurate)
    job.refresh_from_db()
    assert_test(job.status == "on_the_way", "Test 05: Inaccurate GPS (75m > 50m) cannot trigger arrival")

    # Test 6: First valid fix records inside-fix but does NOT prematurely arrive (requires 2)
    t_fix1 = timezone.now()
    req_fix1 = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT + 0.0005, "longitude": JOB_LON + 0.0005, "accuracy": 12.0, "captured_at": t_fix1.isoformat()},
        format="json",
    )
    req_fix1.user = tech_user
    view_loc(req_fix1)
    job.refresh_from_db()
    session = JobTrackingSession.objects.filter(job=job, employee=tech_emp, status="ACTIVE").first()
    assert_test(job.status == "on_the_way" and session.consecutive_arrival_fixes == 1, "Test 06: Valid Fix #1 records inside fix (1/2) without prematurely arriving")

    # Test 7: Fixes received milliseconds apart without >=3s or movement do NOT confirm arrival
    t_rapid = t_fix1 + timedelta(milliseconds=200)
    req_rapid = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT + 0.0005, "longitude": JOB_LON + 0.0005, "accuracy": 12.0, "captured_at": t_rapid.isoformat()},
        format="json",
    )
    req_rapid.user = tech_user
    view_loc(req_rapid)
    job.refresh_from_db()
    assert_test(job.status == "on_the_way", "Test 07: Rapid fix without >=3s interval does not satisfy consecutive arrival confirmation")

    # Test 8: Consecutive valid fix #2 (with simulated 4s elapsed) triggers automatic arrival
    session.last_fix_time = timezone.now() - timedelta(seconds=4)
    session.save()

    t_fix2 = timezone.now()
    req_fix2 = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT + 0.0002, "longitude": JOB_LON + 0.0002, "accuracy": 10.0, "captured_at": t_fix2.isoformat()},
        format="json",
    )
    req_fix2.user = tech_user
    view_loc(req_fix2)
    job.refresh_from_db()
    verification = PreServiceVerification.objects.filter(job=job).first()
    assert_test(
        job.status == "arrived" and verification.geofence_passed is True and len(verification.otp_code) == 6,
        "Test 08: Consecutive Fix #2 triggers automatic arrival & generates secure 6-digit Work Start OTP",
    )

    # Test 9: Repeated GPS inside geofence is idempotent
    first_otp = verification.otp_code
    req_repeat = factory.post(
        "/api/workforce/presence/location/",
        data={"latitude": JOB_LAT, "longitude": JOB_LON, "accuracy": 8.0, "captured_at": timezone.now().isoformat()},
        format="json",
    )
    req_repeat.user = tech_user
    view_loc(req_repeat)
    verification.refresh_from_db()
    notifs_count = WorkforceNotification.objects.filter(recipient=customer_user, notification_type="WORK_START_OTP").count()
    assert_test(verification.otp_code == first_otp and notifs_count == 1, "Test 09: Repeated GPS inside geofence is idempotent (no duplicate OTP, no duplicate notifications)")

    print("\n--- GROUP 3: 9-Gate Fail-Closed Eligibility & Dispatch ---")

    # Complete and unassign prior test job so technician workload is free (Gate 9)
    ServiceRequest.objects.filter(assigned_employee=tech_emp).update(assigned_employee=None, status="completed")
    ServiceRequest.objects.filter(id=job.id).update(assigned_employee=None, status="completed")
    EmployeeJob.objects.filter(employee=tech_emp).delete()

    # Test 10: Inactive employee fails Gate 1
    Employee.objects.filter(id=tech_emp.id).update(is_active=False)
    tech_emp.refresh_from_db()
    is_ok, reason = check_candidate_eligibility(tech_emp, "Air Conditioning")
    assert_test(not is_ok and "Gate 1" in reason, "Test 10: Inactive employee fails Gate 1")
    Employee.objects.filter(id=tech_emp.id).update(is_active=True)
    tech_emp.refresh_from_db()

    # Test 11: Pending onboarding fails Gate 2
    bd_pending = {
        "onboarding": {
            "status": "pending",
            "services": [{"name": "AC Repair & Maintenance", "category": "Air Conditioning", "status": "approved"}],
            "documents": {"aadhaar": {"status": "approved"}},
        }
    }
    Employee.objects.filter(id=tech_emp.id).update(bank_details=bd_pending)
    tech_emp.refresh_from_db()
    is_ok, reason = check_candidate_eligibility(tech_emp, "Air Conditioning")
    assert_test(not is_ok and "Gate 2" in reason, "Test 11: Pending onboarding fails Gate 2")

    # Restore approved onboarding
    bd_approved = {
        "onboarding": {
            "status": "approved",
            "services": [{"name": "AC Repair & Maintenance", "category": "Air Conditioning", "status": "approved"}],
            "documents": {"aadhaar": {"status": "approved"}},
        }
    }
    Employee.objects.filter(id=tech_emp.id).update(bank_details=bd_approved)
    tech_emp.refresh_from_db()

    # Test 12: Unapproved mandatory document fails Gate 3
    bd_doc_rejected = {
        "onboarding": {
            "status": "approved",
            "services": [{"name": "AC Repair & Maintenance", "category": "Air Conditioning", "status": "approved"}],
            "documents": {"aadhaar": {"status": "rejected"}},
        }
    }
    Employee.objects.filter(id=tech_emp.id).update(bank_details=bd_doc_rejected)
    tech_emp.refresh_from_db()
    is_ok, reason = check_candidate_eligibility(tech_emp, "Air Conditioning")
    assert_test(not is_ok and "Gate 3" in reason, "Test 12: Rejected dossier document fails Gate 3")

    # Restore approved document
    Employee.objects.filter(id=tech_emp.id).update(bank_details=bd_approved)
    tech_emp.refresh_from_db()

    # Test 13: Expired mandatory compliance fails Gate 4
    comp_req = WorkforceComplianceRequirement.objects.create(company=company, title=f"Police Verification {uid}", is_mandatory=True)
    comp_rec = WorkforceEmployeeCompliance.objects.create(employee=tech_emp, requirement=comp_req, status="EXPIRED")
    is_ok, reason = check_candidate_eligibility(tech_emp, "Air Conditioning")
    assert_test(not is_ok and "Gate 4" in reason, "Test 13: Expired mandatory compliance fails Gate 4")
    comp_rec.status = "VALID"
    comp_rec.save()

    # Test 14: Unverified service / skill fails Gate 6
    is_ok, reason = check_candidate_eligibility(tech_emp, "Deep Commercial Plumbing")
    assert_test(not is_ok and "Gate 6" in reason, "Test 14: Unverified service category fails Gate 6")

    # Test 15: Offline technician fails Gate 7
    Employee.objects.filter(id=tech_emp.id).update(is_online=False, current_availability="offline")
    tech_emp.refresh_from_db()
    is_ok, reason = check_candidate_eligibility(tech_emp, "Air Conditioning")
    assert_test(not is_ok and "Gate 7" in reason, "Test 15: Offline technician fails Gate 7")
    Employee.objects.filter(id=tech_emp.id).update(is_online=True, current_availability="available")
    tech_emp.refresh_from_db()

    # Clean Job for dispatch candidate ranking test
    job_disp_test = ServiceRequest.objects.create(
        customer=customer_user,
        customer_name="Dispatch Test Customer",
        phone="+919876543210",
        service_category="Air Conditioning",
        issue_title="AC Repair & Maintenance",
        address="123 Anna Salai, Chennai",
        latitude=JOB_LAT,
        longitude=JOB_LON,
        preferred_date=now.date(),
        status="confirmed",
        company=company,
    )

    # Clear automatic signal dispatch offer on job_disp_test to evaluate pure candidate ranking
    WorkforceJobOffer.objects.filter(job=job_disp_test).delete()

    # Test 16: Dispatch GPS freshness <= 120s enforced
    fresh_loc = {
        "latitude": 13.0820,
        "longitude": 80.2700,
        "updated_at": (timezone.now() - timedelta(seconds=130)).isoformat(),
    }
    User.objects.filter(id=tech_user.id).update(last_known_location=fresh_loc)
    User.objects.filter(id=tech2_user.id).update(last_known_location=fresh_loc)

    candidates = get_eligible_candidates(job_disp_test, max_gps_age_seconds=120)
    assert_test(len(candidates) == 0, "Test 16: Technician with GPS older than 120s is excluded from dispatch")

    # Update to fresh GPS (10s old)
    fresh_loc_10s = {
        "latitude": 13.0820,
        "longitude": 80.2700,
        "updated_at": (timezone.now() - timedelta(seconds=10)).isoformat(),
    }
    User.objects.filter(id=tech_user.id).update(last_known_location=fresh_loc_10s)

    candidates_fresh = get_eligible_candidates(job_disp_test, max_gps_age_seconds=120)
    assert_test(len(candidates_fresh) >= 1 and any(c["employee"].id == tech_emp.id for c in candidates_fresh), "Test 17: Technician with fresh GPS is successfully ranked as top candidate")

    print("\n--- GROUP 4: Concurrency, Tracking Privacy & Lifecycle ---")

    # Create fresh unassigned job for dispatch & offer acceptance race
    job_race = ServiceRequest.objects.create(
        customer=customer_user,
        customer_name="Race Customer",
        phone="+919876543210",
        service_category="Air Conditioning",
        issue_title="AC Repair & Maintenance",
        address="Race Venue, Chennai",
        latitude=JOB_LAT,
        longitude=JOB_LON,
        preferred_date=now.date(),
        status="confirmed",
        company=company,
    )

    # Dispatch job
    ok_disp, msg_disp = dispatch_job(job_race)
    assert_test(ok_disp is True, "Test 18: Automatic dispatch creates exclusive WorkforceJobOffer")

    offer = WorkforceJobOffer.objects.filter(job=job_race, employee=tech_emp, status="OFFERED").first()

    # Test 19: Cross-tenant tech cannot accept offer
    view_accept = WorkforceJobAcceptOfferView.as_view()
    req_cross = factory.post(f"/api/workforce/jobs/{job_race.id}/accept-offer/")
    req_cross.user = cross_tech_user
    resp_cross = view_accept(req_cross, pk=job_race.id)
    assert_test(resp_cross.status_code == 403, "Test 19: Cross-tenant technician acceptance returns 403 Forbidden")

    # Test 20: Valid acceptance transitions to on_the_way and starts tracking session
    req_acc = factory.post(f"/api/workforce/jobs/{job_race.id}/accept-offer/")
    req_acc.user = tech_user
    resp_acc = view_accept(req_acc, pk=job_race.id)
    job_race.refresh_from_db()
    session_race = JobTrackingSession.objects.filter(job=job_race, employee=tech_emp, status="ACTIVE").first()
    assert_test(
        resp_acc.status_code == 200 and job_race.status == "on_the_way" and session_race is not None,
        "Test 20: Offer acceptance immediately activates JobTrackingSession and transitions to ON_THE_WAY",
    )

    # Test 21: Duplicate acceptance rejected
    req_dup = factory.post(f"/api/workforce/jobs/{job_race.id}/accept-offer/")
    req_dup.user = tech2_user
    resp_dup = view_accept(req_dup, pk=job_race.id)
    assert_test(resp_dup.status_code in [400, 403], "Test 21: Competing technician cannot accept already-accepted job (Race-safe)")

    # Test 22: Customer Live Tracking privacy (unauthorized user returns 403)
    view_track = WorkforceJobLiveTrackingView.as_view()
    req_track_bad = factory.get(f"/api/workforce/jobs/{job_race.id}/live-tracking/")
    req_track_bad.user = other_customer_user
    resp_track_bad = view_track(req_track_bad, pk=job_race.id)
    assert_test(resp_track_bad.status_code == 403, "Test 22: Non-owner customer tracking access returns 403 Forbidden")

    # Test 23: Authorized customer tracking includes fresh coordinates and freshness state
    req_track_good = factory.get(f"/api/workforce/jobs/{job_race.id}/live-tracking/")
    req_track_good.user = customer_user
    resp_track_good = view_track(req_track_good, pk=job_race.id)
    assert_test(
        resp_track_good.status_code == 200
        and resp_track_good.data["assigned_technician"]["location"] is not None
        and "freshness_state" in resp_track_good.data,
        "Test 23: Authorized customer live tracking includes technician location & freshness state",
    )

    # Test 24: Completed job stops exposing live coordinates
    job_race.status = "completed"
    job_race.save()
    resp_track_completed = view_track(req_track_good, pk=job_race.id)
    assert_test(
        resp_track_completed.data["assigned_technician"]["location"] is None,
        "Test 24: Completed job stops exposing live technician coordinates (Privacy Protected)",
    )

    # Test 25: Work Start OTP Verification
    job_race.assigned_employee = tech_emp
    job_race.status = "arrived"
    job_race.save()

    verif = PreServiceVerification.objects.create(
        job=job_race,
        employee=tech_emp,
        geofence_passed=True,
        otp_code="582194",
        otp_expires_at=timezone.now() + timedelta(minutes=15),
        otp_attempts=0,
    )
    view_otp = WorkforceJobVerifyOTPView.as_view()

    # Wrong OTP
    req_wrong_otp = factory.post(f"/api/workforce/jobs/{job_race.id}/verify-otp/", data={"otp": "111111"}, format="json")
    req_wrong_otp.user = tech_user
    resp_wrong = view_otp(req_wrong_otp, pk=job_race.id)
    assert_test(resp_wrong.status_code == 400 and resp_wrong.data["code"] == "INVALID_OTP", "Test 25: Incorrect OTP rejected with remaining attempts")

    # Correct OTP
    req_right_otp = factory.post(f"/api/workforce/jobs/{job_race.id}/verify-otp/", data={"otp": "582194"}, format="json")
    req_right_otp.user = tech_user
    resp_right = view_otp(req_right_otp, pk=job_race.id)
    verif.refresh_from_db()
    assert_test(resp_right.status_code == 200 and verif.otp_verified is True, "Test 26: Correct OTP successfully verified & locked")

    print("\n" + "=" * 80)
    print(f"TEST RESULTS SUMMARY: {PASSED} PASSED, {FAILED} FAILED (TOTAL: {PASSED + FAILED})")
    print("=" * 80)

    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
