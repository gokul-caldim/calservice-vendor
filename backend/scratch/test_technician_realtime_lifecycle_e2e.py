import os
import sys
import django
from decimal import Decimal
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from rest_framework.test import APIRequestFactory, force_authenticate

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import WorkforceJobOffer, JobTrackingSession, WorkforceEventLog
from workforce_api.views import (
    WorkforceJobListView,
    WorkforceJobAcceptOfferView,
    WorkforceJobTechnicianCancelView,
    WorkforceLocationUpdateView,
)

User = get_user_model()
factory = APIRequestFactory()

def run_tests():
    print("=" * 80)
    print("TECHNICIAN REALTIME LIFECYCLE & INVARIANTS VERIFICATION SUITE")
    print("=" * 80)

    passed = 0
    failed = 0
    errors = []

    def record_pass(title, detail=""):
        nonlocal passed
        passed += 1
        print(f" [PASS] {title} {f'-- {detail}' if detail else ''}")

    def record_fail(title, err):
        nonlocal failed
        failed += 1
        import traceback
        tb = traceback.format_exc()
        msg = f"FAILED: {title} -> {repr(err)}\n{tb}"
        errors.append(msg)
        print(f" [FAIL] {title} -> {repr(err)}\n{tb}")

    # Setup Company and Techs
    company, _ = Company.objects.get_or_create(company_name="Lifecycle Test Company")

    tech1_user, _ = User.objects.get_or_create(
        username="tech_lifecycle_01",
        defaults={"email": "tech01_lifecycle@calservice.com", "first_name": "Ravi", "last_name": "Tech"}
    )
    tech1_emp, _ = Employee.objects.get_or_create(
        user=tech1_user,
        defaults={
            "employee_id": "EMP-LC-01",
            "company": company,
            "is_active": True,
            "bank_details": {"onboarding": {"status": "approved"}},
        }
    )
    tech1_emp.company = company
    tech1_emp.is_active = True
    tech1_emp.save()

    tech2_user, _ = User.objects.get_or_create(
        username="tech_lifecycle_02",
        defaults={"email": "tech02_lifecycle@calservice.com", "first_name": "Suresh", "last_name": "Tech"}
    )
    tech2_emp, _ = Employee.objects.get_or_create(
        user=tech2_user,
        defaults={
            "employee_id": "EMP-LC-02",
            "company": company,
            "is_active": True,
            "bank_details": {"onboarding": {"status": "approved"}},
        }
    )
    tech2_emp.company = company
    tech2_emp.is_active = True
    tech2_emp.save()

    cust_user, _ = User.objects.get_or_create(
        username="cust_lifecycle_01",
        defaults={"email": "cust01@gmail.com", "first_name": "Customer", "last_name": "One"}
    )

    import secrets
    run_id = secrets.token_hex(3)

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 1: Simultaneous Acceptance & Winner-Takes-All (Winner gets 200, Loser gets 409)
    # ─────────────────────────────────────────────────────────────────────────────
    try:
        job1 = ServiceRequest.objects.create(
            request_id=f"SR-LC1-{run_id}",
            company=company,
            customer=cust_user,
            customer_name="Customer One",
            phone="+919876543210",
            service_category="Electrical",
            issue_title="Main Breaker Tripping",
            total_amount=Decimal("1500.00"),
            address="Tech Park, Bengaluru",
            preferred_date=timezone.now().date(),
            status="confirmed",
            latitude=12.9716,
            longitude=77.5946,
        )

        offer1 = WorkforceJobOffer.objects.create(
            job=job1,
            employee=tech1_emp,
            status="OFFERED",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        offer2 = WorkforceJobOffer.objects.create(
            job=job1,
            employee=tech2_emp,
            status="OFFERED",
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        # Tech 1 accepts first (Winner)
        req_acc1 = factory.post(f"/api/workforce/jobs/{job1.id}/accept-offer/")
        force_authenticate(req_acc1, user=tech1_user)
        res_acc1 = WorkforceJobAcceptOfferView.as_view()(req_acc1, pk=job1.id)
        assert res_acc1.status_code == 200, f"Winner expected 200 OK, got {res_acc1.status_code}: {res_acc1.data}"

        job1.refresh_from_db()
        assert job1.assigned_employee == tech1_emp
        assert job1.status == "on_the_way"

        # Tech 2 attempts to accept second (Loser)
        req_acc2 = factory.post(f"/api/workforce/jobs/{job1.id}/accept-offer/")
        force_authenticate(req_acc2, user=tech2_user)
        res_acc2 = WorkforceJobAcceptOfferView.as_view()(req_acc2, pk=job1.id)
        assert res_acc2.status_code == 409, f"Loser expected 409 Conflict, got {res_acc2.status_code}: {res_acc2.data}"
        assert res_acc2.data.get("code") == "JOB_ALREADY_ACCEPTED", f"Expected code JOB_ALREADY_ACCEPTED, got {res_acc2.data.get('code')}"

        record_pass("1. Simultaneous Acceptance Winner-Takes-All", "Winner received 200 ON_THE_WAY, Loser received 409 JOB_ALREADY_ACCEPTED")
    except Exception as e:
        record_fail("1. Simultaneous Acceptance Winner-Takes-All", e)

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 2: Hard Single Active Job Invariant (Offer Suppression & 409 EMPLOYEE_ALREADY_BUSY)
    # ─────────────────────────────────────────────────────────────────────────────
    try:
        # Tech 1 is currently active on Job 1. Create a second job offer for Tech 1.
        job2 = ServiceRequest.objects.create(
            request_id=f"SR-LC2-{run_id}",
            company=company,
            customer=cust_user,
            customer_name="Customer Two",
            phone="+919876543211",
            service_category="Plumbing",
            issue_title="Kitchen Pipe Leakage",
            total_amount=Decimal("800.00"),
            address="Tech Park, Bengaluru",
            preferred_date=timezone.now().date(),
            status="confirmed",
            latitude=12.9800,
            longitude=77.6000,
        )
        offer_job2 = WorkforceJobOffer.objects.create(
            job=job2,
            employee=tech1_emp,
            status="OFFERED",
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        # GET /api/workforce/jobs/ for Tech 1 must suppress new offers (offered_job_ids = [])
        req_list = factory.get("/api/workforce/jobs/")
        force_authenticate(req_list, user=tech1_user)
        res_list = WorkforceJobListView.as_view()(req_list)
        assert res_list.status_code == 200

        retrieved_ids = [j["id"] for j in res_list.data]
        assert job1.id in retrieved_ids, "Active Job 1 must be present in job list"
        assert job2.id not in retrieved_ids, "Unaccepted Job 2 offer MUST be suppressed while technician has an active job"

        # Attempting to accept Job 2 must return 409 EMPLOYEE_ALREADY_BUSY
        req_busy = factory.post(f"/api/workforce/jobs/{job2.id}/accept-offer/")
        force_authenticate(req_busy, user=tech1_user)
        res_busy = WorkforceJobAcceptOfferView.as_view()(req_busy, pk=job2.id)
        assert res_busy.status_code == 409, f"Expected 409 Conflict, got {res_busy.status_code}"
        assert res_busy.data.get("code") == "EMPLOYEE_ALREADY_BUSY", f"Expected EMPLOYEE_ALREADY_BUSY, got {res_busy.data.get('code')}"

        record_pass("2. Hard Single Active Job Invariant", "Offers suppressed in GET /jobs/ and 409 EMPLOYEE_ALREADY_BUSY returned on accept attempt")
    except Exception as e:
        record_fail("2. Hard Single Active Job Invariant", e)

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 3: 5-Minute Authoritative Technician Cancellation & Redispatch
    # ─────────────────────────────────────────────────────────────────────────────
    try:
        # Tech 1 cancels Job 1 within 5 minutes due to VEHICLE_ISSUE
        req_cancel = factory.post(f"/api/workforce/jobs/{job1.id}/cancel/", {
            "reason_code": "VEHICLE_ISSUE",
            "reason_detail": "Flat tire on highway",
        }, format="json")
        force_authenticate(req_cancel, user=tech1_user)
        res_cancel = WorkforceJobTechnicianCancelView.as_view()(req_cancel, pk=job1.id)
        assert res_cancel.status_code == 200, f"Expected 200 OK, got {res_cancel.status_code}: {res_cancel.data}"

        job1.refresh_from_db()
        assert job1.assigned_employee is None, "Technician assignment cleared on job"
        assert job1.status == "confirmed", "Job returned to confirmed state for redispatch"

        emp_job = EmployeeJob.objects.filter(service_request=job1, employee=tech1_emp).first()
        assert emp_job.status == "CANCELLED", f"Expected EmployeeJob status CANCELLED, got {emp_job.status}"

        tracking_session = JobTrackingSession.objects.filter(job=job1, employee=tech1_emp).first()
        assert tracking_session.status == JobTrackingSession.SessionStatus.CANCELLED, "Tracking session terminated"

        log_exists = WorkforceEventLog.objects.filter(
            user=tech1_user,
            event_type="JOB_CANCELLED_BY_TECH",
            payload__job_id=job1.id,
        ).exists()
        assert log_exists, "Audit event log JOB_CANCELLED_BY_TECH recorded"

        record_pass("3. 5-Minute Technician Cancellation & Redispatch", "Assignment cleared, tracking terminated, EmployeeJob marked CANCELLED, audit event logged")
    except Exception as e:
        record_fail("3. 5-Minute Technician Cancellation & Redispatch", e)

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 4: Cancellation Window Expiry (>5 minutes) Enforced by Server
    # ─────────────────────────────────────────────────────────────────────────────
    try:
        job3 = ServiceRequest.objects.create(
            request_id=f"SR-LC3-{run_id}",
            company=company,
            customer=cust_user,
            customer_name="Customer Three",
            phone="+919876543212",
            service_category="Appliance",
            issue_title="Washing Machine Vibration",
            total_amount=Decimal("1200.00"),
            address="Tech Park, Bengaluru",
            preferred_date=timezone.now().date(),
            status="on_the_way",
            assigned_employee=tech2_emp,
            latitude=12.9500,
            longitude=77.6100,
        )
        emp_job3 = EmployeeJob.objects.create(
            service_request=job3,
            employee=tech2_emp,
            status="ON_THE_WAY",
            accepted_date=timezone.now() - timedelta(minutes=6), # Accepted 6 minutes ago (>5 min deadline)
        )

        req_expired = factory.post(f"/api/workforce/jobs/{job3.id}/cancel/", {
            "reason_code": "TRAFFIC_ROUTE_ISSUE",
        }, format="json")
        force_authenticate(req_expired, user=tech2_user)
        res_expired = WorkforceJobTechnicianCancelView.as_view()(req_expired, pk=job3.id)

        assert res_expired.status_code == 409, f"Expected 409 Conflict, got {res_expired.status_code}: {res_expired.data}"
        assert res_expired.data.get("code") == "CANCELLATION_WINDOW_EXPIRED", f"Expected CANCELLATION_WINDOW_EXPIRED, got {res_expired.data.get('code')}"

        record_pass("4. Cancellation Window Expiry (>5 min) Enforced", "Server strictly rejected cancellation attempt 6 minutes after acceptance with 409 CANCELLATION_WINDOW_EXPIRED")
    except Exception as e:
        record_fail("4. Cancellation Window Expiry (>5 min) Enforced", e)

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 5: Out-of-Order GPS Packet Rejection
    # ─────────────────────────────────────────────────────────────────────────────
    try:
        now = timezone.now()
        # Newer packet first
        req_gps1 = factory.post("/api/workforce/presence/location/", {
            "latitude": 12.9750,
            "longitude": 77.5950,
            "accuracy": 8.0,
            "captured_at": now.isoformat(),
        }, format="json")
        force_authenticate(req_gps1, user=tech1_user)
        res_gps1 = WorkforceLocationUpdateView.as_view()(req_gps1)
        assert res_gps1.status_code == 200

        tech1_user.refresh_from_db()
        assert float(tech1_user.last_known_location["latitude"]) == 12.9750

        # Older out-of-order packet (captured 30 seconds before now)
        req_ooo = factory.post("/api/workforce/presence/location/", {
            "latitude": 12.8000,
            "longitude": 77.4000,
            "accuracy": 10.0,
            "captured_at": (now - timedelta(seconds=30)).isoformat(),
        }, format="json")
        force_authenticate(req_ooo, user=tech1_user)
        res_ooo = WorkforceLocationUpdateView.as_view()(req_ooo)
        assert res_ooo.status_code == 200
        assert res_ooo.data.get("ignored") is True, "Out-of-order GPS packet was ignored"

        tech1_user.refresh_from_db()
        assert float(tech1_user.last_known_location["latitude"]) == 12.9750, "User location was not overwritten by stale packet"

        record_pass("5. Out-of-Order GPS Telemetry Protection", "Server correctly ignored older packet (captured_at) and preserved freshest coordinates")
    except Exception as e:
        record_fail("5. Out-of-Order GPS Telemetry Protection", e)

    print("\n" + "=" * 80)
    print(f"VERIFICATION RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 80)

    if errors:
        for err in errors:
            print("  -", err)
        return False
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
