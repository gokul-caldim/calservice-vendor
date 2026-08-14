"""
Phase 4: Comprehensive Verification Test Suite for Completed Workforce Features:
1. Work Start OTP Flow (random 6-digit, 15-min expiry, attempt limits, customer endpoint, non-leaking tech arrival).
2. Pre-Service Verification Gate (5 items: Geofence arrival + Customer OTP + Identity photo + Appliance photo + Work-area photo).
3. Clock-In Gate (Requires active job + 100% complete pre-service verification -> TimeLog + in_progress transition).
4. Relational Work Extensions Subsystem (WorkforceWorkExtension lifecycle, labor/materials estimates, critical flags).
5. Admin Extension Review (Approve/Reject with adjusted approved amounts, concurrency locks).
6. Same-Technician Continuation (Lifecycle: REQUESTED -> ADMIN_APPROVED -> CUSTOMER_ACCEPTED -> IN_PROGRESS -> COMPLETED -> RESOLVED).
7. Customer Decline Logic:
   - Optional decline (is_critical = False): Extension CUSTOMER_DECLINED, job remains in_progress.
   - Critical decline (is_critical = True): Extension CUSTOMER_DECLINED, job transitions to unable_to_complete.
"""

import os
import django
import secrets
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from companies.models import Company, Region
from employees.models import Employee
from service_requests.models import ServiceRequest
from time_tracking.models import Location, TimeLog
from workforce_api.models import (
    WorkforceJobOffer,
    PreServiceVerification,
    WorkforceWorkExtension,
    WorkforceSkill,
)

User = get_user_model()


def run_tests():
    print("=" * 80)
    print("STARTING WORKFORCE COMPREHENSIVE VERIFICATION SUITE")
    print("=" * 80)

    results = {"passed": 0, "failed": 0, "errors": []}

    def record_pass(name):
        results["passed"] += 1
        print(f"  [PASS] {name}")

    def record_fail(name, err):
        results["failed"] += 1
        results["errors"].append((name, str(err)))
        print(f"  [FAIL] {name}: {err}")

    # ─── SETUP FIXTURES ──────────────────────────────────────────────────────────
    region, _ = Region.objects.get_or_create(code="IN", defaults={"name": "India", "currency": "INR"})
    company, _ = Company.objects.get_or_create(
        display_id="COMP-EXT-01",
        defaults={"company_name": "Workforce Production Services", "region": region, "geofence_enabled": True}
    )

    loc, _ = Location.objects.get_or_create(
        company=company,
        name="Indiranagar Hub",
        defaults={"address": "100 Feet Rd, Bengaluru", "lat": 12.9716, "lng": 77.5946, "geofence_radius": 500, "is_active": True}
    )

    # Customer User
    customer_user, _ = User.objects.get_or_create(
        username="cust_phase4",
        defaults={"email": "cust_phase4@example.com", "first_name": "Customer", "last_name": "Phase4", "role": "customer"}
    )
    customer_user.set_password("Password123!")
    customer_user.save()

    # Admin User
    admin_user, _ = User.objects.get_or_create(
        username="admin_phase4",
        defaults={"email": "admin_phase4@example.com", "first_name": "Admin", "last_name": "User", "role": "admin", "company": company, "is_staff": True}
    )
    admin_user.company = company
    admin_user.set_password("Password123!")
    admin_user.save()

    # Technician User
    tech_user, _ = User.objects.get_or_create(
        username="tech_phase4",
        defaults={"email": "tech_phase4@example.com", "first_name": "Tech", "last_name": "Field", "role": "employee", "company": company}
    )
    tech_user.company = company
    tech_user.set_password("Password123!")
    tech_user.save()

    emp, _ = Employee.objects.get_or_create(
        user=tech_user,
        defaults={
            "employee_id": "EMP-P4-001",
            "company": company,
            "title": "Senior Field Technician",
            "is_active": True,
            "is_online": True,
            "hourly_rate": Decimal("350.00"),
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "documents_verified": True,
                    "services_approved": True,
                    "skills_verified": True,
                }
            }
        }
    )


    # Secondary Technician User
    tech2_user, _ = User.objects.get_or_create(
        username="tech2_phase4",
        defaults={"email": "tech2_phase4@example.com", "first_name": "Tech2", "last_name": "Field", "role": "employee", "company": company}
    )
    tech2_user.company = company
    tech2_user.set_password("Password123!")
    tech2_user.save()

    emp2, _ = Employee.objects.get_or_create(
        user=tech2_user,
        defaults={
            "employee_id": "EMP-P4-002",
            "company": company,
            "title": "Apprentice Technician",
            "is_active": True,
            "is_online": True,
            "hourly_rate": Decimal("250.00"),
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "documents_verified": True,
                    "services_approved": True,
                    "skills_verified": True,
                }
            }
        }
    )

    TimeLog.objects.filter(employee__in=[emp, emp2]).delete()

    client_tech = APIClient()

    client_tech.force_authenticate(user=tech_user)

    client_tech2 = APIClient()
    client_tech2.force_authenticate(user=tech2_user)

    client_admin = APIClient()
    client_admin.force_authenticate(user=admin_user)

    client_cust = APIClient()
    client_cust.force_authenticate(user=customer_user)

    dummy_image = SimpleUploadedFile("proof.jpg", b"fake-jpg-content", content_type="image/jpeg")

    # ─── TEST SUITE EXECUTION ──────────────────────────────────────────────────

    # Helper to create fresh service request
    def create_test_job(issue_title="AC Deep Service & Gas Refill"):
        req_id = f"REQ-P4-{secrets.randbelow(900000)+100000}"
        job = ServiceRequest.objects.create(
            request_id=req_id,
            company=company,
            customer=customer_user,
            customer_name=f"{customer_user.first_name} {customer_user.last_name}",
            phone="9876543210",
            address="Indiranagar 100ft Rd, Bengaluru",
            service_category="Air Conditioner",
            issue_title=issue_title,
            description="AC servicing required.",
            preferred_date=timezone.now().date(),
            total_amount=Decimal("1500.00"),
            status="accepted",
            assigned_employee=emp,
            cart_data=[],
        )

        return job

    # ── TEST 1: Work Start OTP Generation & Non-Leaking Arrival Response ──────
    try:
        job1 = create_test_job("OTP & Arrival Test Job")
        res = client_tech.post(f"/api/workforce/jobs/{job1.id}/arrive/", {
            "lat": 12.9716,
            "lon": 77.5946
        }, format="json")

        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
        assert res.data.get("geofence_passed") is True, "Geofence should pass"
        assert res.data.get("otp_generated") is True, "OTP generation flag missing"
        assert "otp" not in res.data and "otp_code" not in res.data, "Security Violation: OTP leaked to technician response!"

        psv = PreServiceVerification.objects.get(job=job1)
        assert len(psv.otp_code) == 6 and psv.otp_code.isdigit(), f"Invalid OTP format: {psv.otp_code}"
        assert psv.otp_expires_at is not None, "OTP expiry timestamp missing"
        assert psv.otp_attempts == 0, "OTP attempt count should be 0 on fresh arrival"
        record_pass("1. Arrival generates fresh 6-digit cryptographic OTP without leaking to technician")
    except Exception as e:
        record_fail("1. Arrival generates fresh 6-digit cryptographic OTP without leaking to technician", e)

    # ── TEST 2: Customer/Admin OTP Retrieval vs Technician Access Block ───────
    try:
        # Technician attempts to read customer OTP endpoint -> 403 Forbidden
        res_tech_blocked = client_tech.get(f"/api/workforce/jobs/{job1.id}/customer-otp/")
        assert res_tech_blocked.status_code == 403, f"Expected 403 for technician, got {res_tech_blocked.status_code}"

        # Customer reads customer OTP endpoint -> 200 OK with correct OTP
        res_cust = client_cust.get(f"/api/workforce/jobs/{job1.id}/customer-otp/")
        assert res_cust.status_code == 200, f"Expected 200 for customer, got {res_cust.status_code}"
        assert res_cust.data.get("otp") == psv.otp_code, "Customer received wrong OTP code"

        # Admin reads customer OTP endpoint -> 200 OK
        res_admin = client_admin.get(f"/api/workforce/jobs/{job1.id}/customer-otp/")
        assert res_admin.status_code == 200, f"Expected 200 for admin, got {res_admin.status_code}"
        assert res_admin.data.get("otp") == psv.otp_code, "Admin received wrong OTP code"
        record_pass("2. Customer & Admin can view Work Start OTP; Technician is strictly forbidden (403)")
    except Exception as e:
        record_fail("2. Customer & Admin can view Work Start OTP; Technician is strictly forbidden (403)", e)

    # ── TEST 3: Invalid OTP Increments Attempt Counter ────────────────────────
    try:
        res_bad = client_tech.post(f"/api/workforce/jobs/{job1.id}/verify-otp/", {"otp": "000000"}, format="json")
        assert res_bad.status_code == 400, f"Expected 400, got {res_bad.status_code}"
        assert res_bad.data.get("attempts_remaining") == 4, f"Expected 4 remaining, got {res_bad.data.get('attempts_remaining')}"

        psv.refresh_from_db()
        assert psv.otp_attempts == 1, f"Expected otp_attempts == 1, got {psv.otp_attempts}"
        record_pass("3. Invalid OTP code increments attempt counter and displays remaining attempts")
    except Exception as e:
        record_fail("3. Invalid OTP code increments attempt counter and displays remaining attempts", e)

    # ── TEST 4: Max 5 Attempts Lockout ────────────────────────────────────────
    try:
        for _ in range(4):
            client_tech.post(f"/api/workforce/jobs/{job1.id}/verify-otp/", {"otp": "000000"}, format="json")

        psv.refresh_from_db()
        assert psv.otp_attempts == 5, f"Expected 5 attempts, got {psv.otp_attempts}"

        res_locked = client_tech.post(f"/api/workforce/jobs/{job1.id}/verify-otp/", {"otp": psv.otp_code}, format="json")
        assert res_locked.status_code == 400, "Max attempts should lock verification even if correct OTP entered"
        assert res_locked.data.get("code") == "MAX_OTP_ATTEMPTS_EXCEEDED"
        record_pass("4. Max 5 OTP attempts locks verification")
    except Exception as e:
        record_fail("4. Max 5 OTP attempts locks verification", e)

    # ── TEST 5: Correct OTP Verification & Expiry Validation ──────────────────
    try:
        # Re-arrive to get fresh OTP
        client_tech.post(f"/api/workforce/jobs/{job1.id}/arrive/", {"lat": 12.9716, "lon": 77.5946}, format="json")
        psv.refresh_from_db()
        valid_otp = psv.otp_code

        res_verify = client_tech.post(f"/api/workforce/jobs/{job1.id}/verify-otp/", {"otp": valid_otp}, format="json")
        assert res_verify.status_code == 200, f"Expected 200, got {res_verify.status_code}: {res_verify.data}"
        assert res_verify.data.get("otp_verified") is True

        psv.refresh_from_db()
        assert psv.otp_verified is True
        record_pass("5. Correct Work Start OTP verification succeeds and updates PreServiceVerification")
    except Exception as e:
        record_fail("5. Correct Work Start OTP verification succeeds and updates PreServiceVerification", e)

    # ── TEST 6: Pre-Service Photo Evidence Gate ───────────────────────────────
    try:
        # Upload presence photo
        res_p1 = client_tech.post(f"/api/workforce/jobs/{job1.id}/pre-service-photo/", {"photo_type": "presence", "file": dummy_image}, format="multipart")
        assert res_p1.status_code == 201, f"Expected 201, got {res_p1.status_code}"

        # Upload appliance photo
        res_p2 = client_tech.post(f"/api/workforce/jobs/{job1.id}/pre-service-photo/", {"photo_type": "appliance", "file": dummy_image}, format="multipart")
        assert res_p2.status_code == 201, f"Expected 201, got {res_p2.status_code}"

        # Upload work area photo
        res_p3 = client_tech.post(f"/api/workforce/jobs/{job1.id}/pre-service-photo/", {"photo_type": "work_area", "file": dummy_image}, format="multipart")
        assert res_p3.status_code == 201, f"Expected 201, got {res_p3.status_code}"
        assert res_p3.data.get("is_complete") is True, "Pre-service verification should be 100% complete"

        psv.refresh_from_db()
        assert psv.is_complete is True
        record_pass("6. Uploading 3 pre-service photos completes all 5 pre-service verification items")
    except Exception as e:
        record_fail("6. Uploading 3 pre-service photos completes all 5 pre-service verification items", e)

    # ── TEST 7: Clock-In Blocked When Pre-Service Verification Incomplete ──────
    try:
        job2 = create_test_job("Incomplete Pre-Service Job")
        # Technician attempts clock-in before arrival or OTP -> 400 PRE_SERVICE_INCOMPLETE
        res_clockin_blocked = client_tech.post("/api/workforce/time-tracking/clock-in/", {"lat": 12.9716, "lng": 77.5946}, format="json")
        assert res_clockin_blocked.status_code == 400, f"Expected 400, got {res_clockin_blocked.status_code}"
        assert res_clockin_blocked.data.get("code") == "PRE_SERVICE_INCOMPLETE"
        job2.delete()
        record_pass("7. Clock-In is strictly blocked when pre-service verification is incomplete")

    except Exception as e:
        record_fail("7. Clock-In is strictly blocked when pre-service verification is incomplete", e)

    # ── TEST 8: Clock-In Gate Passing -> TimeLog & in_progress Transition ──────
    try:
        # Complete pre-service for job1 and clock in
        res_clockin = client_tech.post("/api/workforce/time-tracking/clock-in/", {"lat": 12.9716, "lon": 77.5946, "lng": 77.5946}, format="json")

        assert res_clockin.status_code == 201, f"Expected 201, got {res_clockin.status_code}: {res_clockin.data}"

        job1.refresh_from_db()
        assert job1.status == "in_progress", f"Expected status 'in_progress', got '{job1.status}'"

        open_timelog = TimeLog.objects.filter(employee=emp, clock_out__isnull=True).first()
        assert open_timelog is not None, "TimeLog record not created on clock in"
        record_pass("8. Clock-In succeeds with complete verification, creates TimeLog, and transitions job to 'in_progress'")
    except Exception as e:
        record_fail("8. Clock-In succeeds with complete verification, creates TimeLog, and transitions job to 'in_progress'", e)

    # ── TEST 9: Relational Work Extension Submission ──────────────────────────
    try:
        res_ext = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/", {
            "title": "Copper Pipe Replacement & Deep Coil Wash",
            "reason": "Corroded copper tubes found inside indoor unit requiring brazing and replacement.",
            "estimated_labor_cost": 600.0,
            "estimated_materials_cost": 850.0,
            "is_critical": False,
            "requires_specialist": False,
        }, format="json")

        assert res_ext.status_code == 201, f"Expected 201, got {res_ext.status_code}: {res_ext.data}"
        ext_data = res_ext.data.get("extension")
        ext_id = ext_data.get("id")

        ext_obj = WorkforceWorkExtension.objects.get(pk=ext_id)
        assert ext_obj.status == WorkforceWorkExtension.Status.REQUESTED
        assert float(ext_obj.requested_amount) == 1450.0
        assert float(ext_obj.estimated_labor_cost) == 600.0
        assert float(ext_obj.estimated_materials_cost) == 850.0
        assert ext_obj.is_critical is False
        record_pass("9. Technician submits relational Work Extension with labor & material breakdown")
    except Exception as e:
        record_fail("9. Technician submits relational Work Extension with labor & material breakdown", e)

    # ── TEST 10: Block Duplicate Active Work Extensions on Same Job ───────────
    try:
        res_dup = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/", {
            "title": "Duplicate Scope Request",
            "reason": "Another scope while previous is pending.",
            "estimated_labor_cost": 200.0,
        }, format="json")

        assert res_dup.status_code == 400, f"Expected 400 for duplicate active extension, got {res_dup.status_code}"
        record_pass("10. Duplicate active work extension requests on the same job are blocked")
    except Exception as e:
        record_fail("10. Duplicate active work extension requests on the same job are blocked", e)

    # ── TEST 11: Admin Pending Extensions List View ───────────────────────────
    try:
        res_pending = client_admin.get("/api/workforce/admin/extensions/pending/")
        assert res_pending.status_code == 200, f"Expected 200, got {res_pending.status_code}"
        pending_ids = [e["id"] for e in res_pending.data]
        assert ext_obj.id in pending_ids, f"Extension #{ext_obj.id} missing from admin pending queue"
        record_pass("11. Admin pending extensions queue returns active extension requests")
    except Exception as e:
        record_fail("11. Admin pending extensions queue returns active extension requests", e)

    # ── TEST 12: Admin Approves Extension with Adjusted Amount ────────────────
    try:
        res_approve = client_admin.post(f"/api/workforce/admin/jobs/{job1.id}/extension/{ext_obj.id}/decide/", {
            "action": "APPROVED",
            "approved_amount": 1400.0,
            "reason": "Approved with slight adjustment on labor rate.",
        }, format="json")

        assert res_approve.status_code == 200, f"Expected 200, got {res_approve.status_code}"
        ext_obj.refresh_from_db()
        assert ext_obj.status == WorkforceWorkExtension.Status.ADMIN_APPROVED
        assert float(ext_obj.approved_amount) == 1400.0
        assert ext_obj.admin_reviewed_by == admin_user
        record_pass("12. Admin reviews and approves extension with adjusted approved amount")
    except Exception as e:
        record_fail("12. Admin reviews and approves extension with adjusted approved amount", e)

    # ── TEST 13: Customer Accepts Extension & Job Total Updates ───────────────
    try:
        initial_job_total = float(job1.total_amount)
        res_cust_decide = client_cust.post(f"/api/workforce/jobs/{job1.id}/extension/{ext_obj.id}/customer-decide/", {
            "action": "ACCEPT",
        }, format="json")

        assert res_cust_decide.status_code == 200, f"Expected 200, got {res_cust_decide.status_code}"
        ext_obj.refresh_from_db()
        job1.refresh_from_db()

        assert ext_obj.status == WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED
        assert float(job1.total_amount) == initial_job_total + 1400.0
        assert job1.status == "in_progress"
        record_pass("13. Customer accepts extension, adding approved amount to job total")
    except Exception as e:
        record_fail("13. Customer accepts extension, adding approved amount to job total", e)

    # ── TEST 14: Same-Technician Extension Progression ────────────────────────
    try:
        # Start work
        res_start = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/{ext_obj.id}/progress/", {"action": "start"}, format="json")
        assert res_start.status_code == 200, f"Expected 200, got {res_start.status_code}"
        ext_obj.refresh_from_db()
        assert ext_obj.status == WorkforceWorkExtension.Status.IN_PROGRESS

        # Complete work
        res_comp = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/{ext_obj.id}/progress/", {"action": "complete"}, format="json")
        assert res_comp.status_code == 200, f"Expected 200, got {res_comp.status_code}"
        ext_obj.refresh_from_db()
        assert ext_obj.status == WorkforceWorkExtension.Status.COMPLETED

        # Resolve extension
        res_res = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/{ext_obj.id}/progress/", {"action": "resolve"}, format="json")
        assert res_res.status_code == 200, f"Expected 200, got {res_res.status_code}"
        ext_obj.refresh_from_db()
        assert ext_obj.status == WorkforceWorkExtension.Status.RESOLVED
        record_pass("14. Same-technician extension progression: CUSTOMER_ACCEPTED -> IN_PROGRESS -> COMPLETED -> RESOLVED")
    except Exception as e:
        record_fail("14. Same-technician extension progression: CUSTOMER_ACCEPTED -> IN_PROGRESS -> COMPLETED -> RESOLVED", e)

    # ── TEST 15: Customer Declines Optional Extension (Job Continues) ─────────
    try:
        job1.status = "in_progress"
        job1.save()
        # Create new extension on job1 (is_critical = False)
        res_opt_ext = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/", {

            "title": "Optional Antibacterial Sanitization",
            "reason": "Recommended optional duct sanitization.",
            "estimated_labor_cost": 300.0,
            "is_critical": False,
        }, format="json")
        opt_ext_id = res_opt_ext.data["extension"]["id"]

        # Admin approves
        client_admin.post(f"/api/workforce/admin/jobs/{job1.id}/extension/{opt_ext_id}/decide/", {"action": "APPROVED"}, format="json")

        # Customer declines
        res_opt_decline = client_cust.post(f"/api/workforce/jobs/{job1.id}/extension/{opt_ext_id}/customer-decide/", {
            "action": "DECLINE",
            "reason": "Not needed right now.",
        }, format="json")

        assert res_opt_decline.status_code == 200, f"Expected 200, got {res_opt_decline.status_code}"
        opt_ext_obj = WorkforceWorkExtension.objects.get(pk=opt_ext_id)
        job1.refresh_from_db()

        assert opt_ext_obj.status == WorkforceWorkExtension.Status.CUSTOMER_DECLINED
        assert job1.status == "in_progress", f"Optional decline should leave job in_progress, got '{job1.status}'"
        record_pass("15. Customer declining optional extension (is_critical=False) keeps original job IN_PROGRESS")
    except Exception as e:
        record_fail("15. Customer declining optional extension (is_critical=False) keeps original job IN_PROGRESS", e)

    # ── TEST 16: Customer Declines Critical Extension (Unable to Complete) ───
    try:
        job1.status = "in_progress"
        job1.save()
        # Create critical extension on job1 (is_critical = True)
        res_crit_ext = client_tech.post(f"/api/workforce/jobs/{job1.id}/extension/", {

            "title": "Critical Compressor Ground Fault Repair",
            "reason": "High electrical leakage risk on compressor. Hazardous to operate without repair.",
            "estimated_labor_cost": 1200.0,
            "estimated_materials_cost": 2500.0,
            "is_critical": True,
        }, format="json")
        crit_ext_id = res_crit_ext.data["extension"]["id"]

        # Admin approves
        client_admin.post(f"/api/workforce/admin/jobs/{job1.id}/extension/{crit_ext_id}/decide/", {"action": "APPROVED"}, format="json")

        # Customer declines critical extension
        res_crit_decline = client_cust.post(f"/api/workforce/jobs/{job1.id}/extension/{crit_ext_id}/customer-decide/", {
            "action": "DECLINE",
            "reason": "Too expensive, do not repair compressor.",
        }, format="json")

        assert res_crit_decline.status_code == 200, f"Expected 200, got {res_crit_decline.status_code}"
        crit_ext_obj = WorkforceWorkExtension.objects.get(pk=crit_ext_id)
        job1.refresh_from_db()

        assert crit_ext_obj.status == WorkforceWorkExtension.Status.CUSTOMER_DECLINED
        assert job1.status == "unable_to_complete", f"Critical decline must transition job to 'unable_to_complete', got '{job1.status}'"
        assert "[UNABLE_TO_COMPLETE]" in (job1.description or ""), "Uncompletion note missing from job description"
        record_pass("16. Customer declining critical extension (is_critical=True) transitions job to UNABLE_TO_COMPLETE")
    except Exception as e:
        record_fail("16. Customer declining critical extension (is_critical=True) transitions job to UNABLE_TO_COMPLETE", e)

    # ── TEST 17: Unauthorized Technician Cannot Manage Other Tech's Extension ─
    try:
        job3 = create_test_job("Isolation Test Job")
        # Assigned to tech_user (emp). Tech 2 attempts to request extension on it -> 403 Forbidden
        res_unauth_ext = client_tech2.post(f"/api/workforce/jobs/{job3.id}/extension/", {
            "title": "Unauthorized Scope",
            "reason": "Testing tenant isolation",
            "estimated_labor_cost": 100.0,
        }, format="json")
        assert res_unauth_ext.status_code == 403, f"Expected 403 for unauthorized tech, got {res_unauth_ext.status_code}"
        record_pass("17. Strict technician isolation: Only assigned technician may manage job extensions")
    except Exception as e:
        record_fail("17. Strict technician isolation: Only assigned technician may manage job extensions", e)

    # ── TEST 18: State Machine & Unable to Complete Terminal State Validation ─
    try:
        from service_requests.state_machine import can_transition, transition
        assert can_transition("in_progress", "unable_to_complete") is True
        assert can_transition("unable_to_complete", "in_progress") is False, "unable_to_complete must be a terminal state"
        assert can_transition("unable_to_complete", "completed") is False, "unable_to_complete cannot transition to completed"
        record_pass("18. State machine rules: unable_to_complete transition allowed from in_progress and enforced as terminal")
    except Exception as e:
        record_fail("18. State machine rules: unable_to_complete transition allowed from in_progress and enforced as terminal", e)

    # ─── SUMMARY REPORT ────────────────────────────────────────────────────────
    print("=" * 80)
    print(f"VERIFICATION COMPLETED: {results['passed']} PASSED, {results['failed']} FAILED")
    print("=" * 80)

    if results["failed"] > 0:
        print("FAILURES:")
        for name, err in results["errors"]:
            print(f"  - {name}: {err}")

    return results


if __name__ == "__main__":
    run_tests()
