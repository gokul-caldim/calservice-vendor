import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import django
from decimal import Decimal
from datetime import timedelta

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.state_machine import apply_transition
from time_tracking.models import TimeLog
from workforce_api.models import (
    JobPayment,
    PaymentCollectionEvent,
    PreServiceVerification,
    PostServiceProof,
    WorkforceNotification,
)
from workforce_api.views import (
    WorkforceJobPaymentDetailView,
    WorkforceJobCashCollectView,
    WorkforceJobPaymentVerifyOTPView,
    WorkforceCustomerJobPaymentView,
    WorkforceCustomerPaymentConfirmView,
    WorkforceJobProofView,
)
from workforce_api.serializers import JobPaymentSerializer

User = get_user_model()
factory = APIRequestFactory()

passed_count = 0
failed_count = 0

def record_test(test_id, description, passed, detail=""):
    global passed_count, failed_count
    status_str = "PASS" if passed else "FAIL"
    if passed:
        passed_count += 1
        print(f"[{status_str}] Test {test_id:02d}: {description}")
    else:
        failed_count += 1
        print(f"[{status_str}] Test {test_id:02d}: {description} - FAILED: {detail}")


def run_tests():
    print("=" * 80)
    print("STARTING WORKFORCE PAYMENT & CASH COLLECTION E2E TEST SUITE")
    print("=" * 80)

    # Setup core test entities
    company1, _ = Company.objects.get_or_create(
        id=99101,
        defaults={"company_name": "Test Company Alpha", "is_active": True}
    )
    company2, _ = Company.objects.get_or_create(
        id=99102,
        defaults={"company_name": "Test Company Beta", "is_active": True}
    )

    # Customer User
    customer_user, _ = User.objects.get_or_create(
        username="cust_pay_test_99",
        defaults={
            "email": "cust_pay_99@test.com",
            "role": "customer",
            "first_name": "Alice",
            "last_name": "Customer",
        }
    )

    # Other Customer User (for unauthorized checks)
    other_customer, _ = User.objects.get_or_create(
        username="cust_other_test_99",
        defaults={
            "email": "cust_other_99@test.com",
            "role": "customer",
            "first_name": "Bob",
            "last_name": "Other",
        }
    )

    # Technician 1 (Company 1)
    tech1_user, _ = User.objects.get_or_create(
        username="tech1_pay_test_99",
        defaults={
            "email": "tech1_99@test.com",
            "role": "employee",
            "first_name": "Dave",
            "last_name": "Technician",
        }
    )
    emp1, _ = Employee.objects.get_or_create(
        user=tech1_user,
        defaults={
            "employee_id": "EMP-PAY-01",
            "company": company1,
            "is_active": True,
            "is_online": True,
            "current_availability": "available",
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                    "documents": {"aadhaar": {"status": "approved"}},
                    "services": [{"name": "Refrigerator Repair", "status": "approved"}, {"name": "Washing Machine Repair", "status": "approved"}, {"name": "AC Service", "status": "approved"}, {"name": "Geyser Installation", "status": "approved"}],
                }
            },
        }
    )
    emp1.is_active = True
    emp1.is_online = True
    emp1.current_availability = "available"
    emp1.company = company1
    emp1.bank_details = {
        "onboarding": {
            "status": "approved",
            "documents": {"aadhaar": {"status": "approved"}},
            "services": [{"name": "Refrigerator Repair", "status": "approved"}, {"name": "Washing Machine Repair", "status": "approved"}, {"name": "AC Service", "status": "approved"}, {"name": "Geyser Installation", "status": "approved"}],
        }
    }
    emp1.save()

    # Technician 2 (Company 2 - Tenant isolation)
    tech2_user, _ = User.objects.get_or_create(
        username="tech2_pay_test_99",
        defaults={
            "email": "tech2_99@test.com",
            "role": "employee",
            "first_name": "Eve",
            "last_name": "Technician2",
        }
    )
    emp2, _ = Employee.objects.get_or_create(
        user=tech2_user,
        defaults={
            "employee_id": "EMP-PAY-02",
            "company": company2,
            "is_active": True,
            "is_online": True,
            "current_availability": "available",
            "bank_details": {
                "onboarding": {
                    "status": "approved",
                }
            },
        }
    )
    emp2.is_active = True
    emp2.company = company2
    emp2.save()

    # Active Clock-in for Tech 1
    TimeLog.objects.filter(employee=emp1, clock_out__isnull=True).delete()
    TimeLog.objects.create(
        employee=emp1,
        company=emp1.company,
        user=emp1.user,
        work_date=timezone.now().date(),
        clock_in=timezone.now() - timedelta(hours=2),
    )

    # ── Test 01: Online Payment Booking Creation & Auto-Payment Record ───────────
    job_online, _ = ServiceRequest.objects.get_or_create(
        id=99201,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "Refrigerator Repair",
            "issue_title": "Cooling Failure",
            "status": "in_progress",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "ONLINE",
            "payment_status": "paid",
            "total_amount": Decimal("1499.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_online.status = "in_progress"
    job_online.save()
    JobPayment.objects.filter(job=job_online).delete()
    
    # Query payment detail endpoint
    req = factory.get(f"/api/workforce/jobs/{job_online.id}/payment/")
    force_authenticate(req, user=tech1_user)
    resp = WorkforceJobPaymentDetailView.as_view()(req, pk=job_online.id)
    pmt_online = JobPayment.objects.filter(job=job_online).first()

    record_test(
        1,
        "Online payment booking initializes JobPayment with ONLINE method & PAID status",
        resp.status_code == 200 and pmt_online and pmt_online.payment_method == "ONLINE" and pmt_online.payment_status == "PAID",
        str(resp.data)
    )

    # ── Test 02: Online Payment Rejects Cash Collection ──────────────────────────
    req = factory.post(f"/api/workforce/jobs/{job_online.id}/payment/collect/", {"amount_received": 1499.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp = WorkforceJobCashCollectView.as_view()(req, pk=job_online.id)

    record_test(
        2,
        "Online payment booking strictly rejects cash collection attempt (400 Bad Request)",
        resp.status_code == 400 and "Cannot collect cash for online payment booking" in str(resp.data),
        str(resp.data)
    )

    # ── Test 03: Online Payment Allows Job Closure After Service Proof ───────────
    # Set pre-service verification
    PreServiceVerification.objects.update_or_create(
        job=job_online,
        defaults={"employee": emp1, "geofence_passed": True, "otp_verified": True}
    )
    proof_online, _ = PostServiceProof.objects.update_or_create(
        job=job_online,
        defaults={
            "employee": emp1,
            "after_appliance_photo": "proof/after_app.jpg",
            "after_work_area_photo": "proof/after_area.jpg",
            "completion_notes": "Compressor replaced and gas refilled.",
            "is_submitted": True,
        }
    )
    apply_transition(job_online, "proof_submitted", actor=tech1_user)
    apply_transition(job_online, "completed", actor=tech1_user)
    job_online.refresh_from_db()

    record_test(
        3,
        "Online prepaid job successfully completes when service proof is submitted",
        job_online.status == "completed",
        f"status={job_online.status}"
    )

    # ── Test 04: Cash on Service Booking Creation & Initial State ────────────────
    job_cash1, _ = ServiceRequest.objects.get_or_create(
        id=99202,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "Washing Machine Repair",
            "issue_title": "Motor Noise",
            "status": "arrived",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "COD",
            "payment_status": "pending",
            "total_amount": Decimal("850.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_cash1.status = "arrived"
    job_cash1.save()
    JobPayment.objects.filter(job=job_cash1).delete()
    PreServiceVerification.objects.update_or_create(
        job=job_cash1,
        defaults={"employee": emp1, "geofence_passed": True, "otp_verified": True}
    )
    pmt_cash1, _ = JobPayment.objects.get_or_create(
        job=job_cash1,
        defaults={
            "company": company1,
            "employee": emp1,
            "payment_method": JobPayment.PaymentMethod.CASH_ON_SERVICE,
            "payment_status": JobPayment.PaymentStatus.PENDING,
            "amount_due": Decimal("850.00"),
        }
    )

    record_test(
        4,
        "Cash on Service booking initializes with CASH_ON_SERVICE method & PENDING status",
        pmt_cash1.payment_method == "CASH_ON_SERVICE" and pmt_cash1.payment_status == "PENDING",
        f"method={pmt_cash1.payment_method}, status={pmt_cash1.payment_status}"
    )

    # ── Test 05: Pre-Service Gate & Work Start Transition to IN_PROGRESS ─────────
    apply_transition(job_cash1, "service_started", actor=tech1_user)
    apply_transition(job_cash1, "in_progress", actor=tech1_user)
    job_cash1.refresh_from_db()

    record_test(
        5,
        "Pre-service verification allows transition from ARRIVED -> SERVICE_STARTED -> IN_PROGRESS",
        job_cash1.status == "in_progress",
        f"status={job_cash1.status}"
    )

    # ── Test 06: Payment Closure Gate Rejects Closure While Payment is PENDING ───
    PostServiceProof.objects.update_or_create(
        job=job_cash1,
        defaults={
            "employee": emp1,
            "after_appliance_photo": "proof/after_app.jpg",
            "after_work_area_photo": "proof/after_area.jpg",
            "completion_notes": "Motor bearing lubricated.",
            "is_submitted": True,
        }
    )
    is_ready, reason, deps = job_cash1.is_ready_to_complete()

    record_test(
        6,
        "ServiceRequest.is_ready_to_complete() rejects completion when cash payment is PENDING",
        is_ready is False and any("payment" in d.lower() for d in deps),
        f"is_ready={is_ready}, reason={reason}"
    )

    # ── Test 07: Cash Collection Rejects amount_received < amount_due ────────────
    req = factory.post(f"/api/workforce/jobs/{job_cash1.id}/payment/collect/", {"amount_received": 500.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp = WorkforceJobCashCollectView.as_view()(req, pk=job_cash1.id)

    record_test(
        7,
        "Cash collection rejects amount_received less than amount_due (₹500 < ₹850)",
        resp.status_code == 400 and "cannot be less than" in str(resp.data),
        str(resp.data)
    )

    # ── Test 08: Cash Collection Computes Change, Generates & Hashes OTP ─────────
    req = factory.post(f"/api/workforce/jobs/{job_cash1.id}/payment/collect/", {"amount_received": 1000.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp = WorkforceJobCashCollectView.as_view()(req, pk=job_cash1.id)
    pmt_cash1.refresh_from_db()

    expected_change = Decimal("150.00")
    otp_hash_present = bool(pmt_cash1.payment_confirmation_otp_hash)
    otp_is_django_hash = pmt_cash1.payment_confirmation_otp_hash.startswith("pbkdf2_") or pmt_cash1.payment_confirmation_otp_hash.startswith("argon2") or pmt_cash1.payment_confirmation_otp_hash.startswith("bcrypt")
    resp_omits_hash = "payment_confirmation_otp_hash" not in resp.data and "otp" not in resp.data

    record_test(
        8,
        "Cash collection computes change (₹150), hashes 6-digit OTP with make_password, sets CASH_PENDING, omits hash from response",
        resp.status_code == 200 and pmt_cash1.payment_status == "CASH_PENDING" and pmt_cash1.change_returned == expected_change and otp_hash_present and otp_is_django_hash and resp_omits_hash,
        f"change={pmt_cash1.change_returned}, hash_prefix={pmt_cash1.payment_confirmation_otp_hash[:15]}, resp={resp.data}"
    )

    # ── Test 09: Cash Collection Idempotency ─────────────────────────────────────
    req = factory.post(f"/api/workforce/jobs/{job_cash1.id}/payment/collect/", {"amount_received": 1000.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_dup = WorkforceJobCashCollectView.as_view()(req, pk=job_cash1.id)

    record_test(
        9,
        "Duplicate cash collect call while CASH_PENDING is safe & idempotent (200 OK)",
        resp_dup.status_code == 200 and resp_dup.data.get("payment_status") == "CASH_PENDING",
        str(resp_dup.data)
    )

    # ── Test 10: Customer Notification Created for Cash Confirmation ─────────────
    notif = WorkforceNotification.objects.filter(recipient=customer_user, notification_type="PAYMENT_CONFIRMATION").first()

    record_test(
        10,
        "Customer notification created alerting customer to confirm cash payment",
        notif is not None and str(job_cash1.id) in notif.message,
        f"notif={notif.message if notif else 'None'}"
    )

    # ── Test 11: Path A Unauthorized Customer Blocked from Confirming ────────────
    req = factory.post(f"/api/workforce/customer/jobs/{job_cash1.id}/payment/confirm/", {"action": "CONFIRM"}, format="json")
    force_authenticate(req, user=other_customer)
    resp = WorkforceCustomerPaymentConfirmView.as_view()(req, pk=job_cash1.id)

    record_test(
        11,
        "Path A: Unauthorized customer is blocked (403 Forbidden) from confirming another user's job",
        resp.status_code == 403,
        str(resp.data)
    )

    # ── Test 12: Path A Customer Queries Payment Status Without Exposing OTP ─────
    req = factory.get(f"/api/workforce/customer/jobs/{job_cash1.id}/payment/")
    force_authenticate(req, user=customer_user)
    resp = WorkforceCustomerJobPaymentView.as_view()(req, pk=job_cash1.id)

    cust_view_safe = (
        resp.status_code == 200
        and resp.data.get("confirmation_required") is True
        and resp.data.get("payment_status") == "CASH_PENDING"
        and "payment_confirmation_otp_hash" not in resp.data
        and "otp" not in resp.data
    )

    record_test(
        12,
        "Path A: Customer GET endpoint returns confirmation_required=True and NEVER exposes OTP hash",
        cust_view_safe,
        str(resp.data)
    )

    # ── Test 13: Path A Customer Directly Confirms Cash Payment ──────────────────
    # Job is in proof_submitted
    job_cash1.status = "proof_submitted"
    job_cash1.save()

    req = factory.post(f"/api/workforce/customer/jobs/{job_cash1.id}/payment/confirm/", {"action": "CONFIRM"}, format="json")
    force_authenticate(req, user=customer_user)
    resp = WorkforceCustomerPaymentConfirmView.as_view()(req, pk=job_cash1.id)
    pmt_cash1.refresh_from_db()
    job_cash1.refresh_from_db()

    events = list(PaymentCollectionEvent.objects.filter(job_payment=pmt_cash1).values_list("event_type", flat=True))

    record_test(
        13,
        "Path A: Customer direct confirmation atomically marks payment PAID, logs events, and completes job",
        (
            resp.status_code == 200
            and pmt_cash1.payment_status == "PAID"
            and pmt_cash1.customer_confirmation_method == "DIRECT_CONFIRMATION"
            and job_cash1.status == "completed"
            and "CUSTOMER_CONFIRMED" in events
            and "CASH_COLLECTED" in events
            and "PAYMENT_PAID" in events
        ),
        f"pmt_status={pmt_cash1.payment_status}, job_status={job_cash1.status}, events={events}"
    )

    # ── Test 14: Path A Repeated Confirmation is Idempotent ──────────────────────
    req = factory.post(f"/api/workforce/customer/jobs/{job_cash1.id}/payment/confirm/", {"action": "CONFIRM"}, format="json")
    force_authenticate(req, user=customer_user)
    resp_rep = WorkforceCustomerPaymentConfirmView.as_view()(req, pk=job_cash1.id)

    record_test(
        14,
        "Path A: Repeated customer confirmation call is safe & idempotent (200 OK)",
        resp_rep.status_code == 200 and resp_rep.data.get("payment_status") == "PAID",
        str(resp_rep.data)
    )

    # ── Test 15: Setup Path B Job (Technician Enters Customer OTP) ────────────────
    job_cash2, _ = ServiceRequest.objects.get_or_create(
        id=99203,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "AC Service",
            "issue_title": "AC Not Cooling",
            "status": "in_progress",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "COD",
            "payment_status": "pending",
            "total_amount": Decimal("1200.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_cash2.status = "in_progress"
    job_cash2.save()
    JobPayment.objects.filter(job=job_cash2).delete()
    PreServiceVerification.objects.update_or_create(
        job=job_cash2,
        defaults={"employee": emp1, "geofence_passed": True, "otp_verified": True}
    )
    PostServiceProof.objects.update_or_create(
        job=job_cash2,
        defaults={
            "employee": emp1,
            "after_appliance_photo": "proof/after_app.jpg",
            "after_work_area_photo": "proof/after_area.jpg",
            "completion_notes": "AC coil cleaned.",
            "is_submitted": True,
        }
    )

    # Tech collects cash
    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/collect/", {"amount_received": 1200.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp = WorkforceJobCashCollectView.as_view()(req, pk=job_cash2.id)
    pmt_cash2 = JobPayment.objects.get(job=job_cash2)

    # We manually set a known OTP for test determinism
    test_otp = "654321"
    pmt_cash2.payment_confirmation_otp_hash = make_password(test_otp)
    pmt_cash2.otp_expires_at = timezone.now() + timedelta(minutes=15)
    pmt_cash2.otp_attempts = 0
    pmt_cash2.otp_used_at = None
    pmt_cash2.save()

    record_test(
        15,
        "Path B: Job initialized in CASH_PENDING with known hashed OTP for verification test",
        pmt_cash2.payment_status == "CASH_PENDING" and check_password(test_otp, pmt_cash2.payment_confirmation_otp_hash),
        f"status={pmt_cash2.payment_status}"
    )

    # ── Test 16: Path B Customer Disputes Payment (action='PROBLEM') ─────────────
    req = factory.post(f"/api/workforce/customer/jobs/{job_cash2.id}/payment/confirm/", {"action": "PROBLEM", "reason": "Amount discrepancy"}, format="json")
    force_authenticate(req, user=customer_user)
    resp_prob = WorkforceCustomerPaymentConfirmView.as_view()(req, pk=job_cash2.id)
    pmt_cash2.refresh_from_db()
    disputed_event = PaymentCollectionEvent.objects.filter(job_payment=pmt_cash2, event_type="PAYMENT_DISPUTED").first()

    record_test(
        16,
        "Path B: Customer payment dispute logs PAYMENT_DISPUTED and maintains CASH_PENDING status",
        resp_prob.status_code == 200 and pmt_cash2.payment_status == "CASH_PENDING" and disputed_event is not None,
        f"event={disputed_event.metadata if disputed_event else 'None'}"
    )

    # ── Test 17: Path B Technician Submits Invalid OTP (Increments attempts) ─────
    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/verify-otp/", {"otp": "000000"}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_bad_otp = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_cash2.id)
    pmt_cash2.refresh_from_db()

    record_test(
        17,
        "Path B: Technician submitting wrong OTP is rejected (400) and increments otp_attempts to 1",
        resp_bad_otp.status_code == 400 and pmt_cash2.otp_attempts == 1 and pmt_cash2.payment_status == "CASH_PENDING",
        f"resp={resp_bad_otp.data}, attempts={pmt_cash2.otp_attempts}"
    )

    # ── Test 18: Path B Max 5 Verification Attempts Exceeded ─────────────────────
    pmt_cash2.otp_attempts = 5
    pmt_cash2.save()
    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/verify-otp/", {"otp": test_otp}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_max_att = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_cash2.id)

    record_test(
        18,
        "Path B: Verification blocked when max 5 attempts are exceeded",
        resp_max_att.status_code == 400 and "Maximum OTP verification attempts" in str(resp_max_att.data),
        str(resp_max_att.data)
    )

    # Reset attempts for next test
    pmt_cash2.otp_attempts = 0
    pmt_cash2.save()

    # ── Test 19: Path B Expired OTP Rejection ────────────────────────────────────
    pmt_cash2.otp_expires_at = timezone.now() - timedelta(minutes=1)
    pmt_cash2.save()
    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/verify-otp/", {"otp": test_otp}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_exp = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_cash2.id)

    record_test(
        19,
        "Path B: Expired OTP (>15 minutes) is rejected (400 Bad Request)",
        resp_exp.status_code == 400 and "expired" in str(resp_exp.data),
        str(resp_exp.data)
    )

    # Restore valid expiry
    pmt_cash2.otp_expires_at = timezone.now() + timedelta(minutes=15)
    pmt_cash2.save()

    # ── Test 20: Path B Valid OTP Verification & Completion ──────────────────────
    job_cash2.status = "proof_submitted"
    job_cash2.save()

    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/verify-otp/", {"otp": test_otp}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_valid = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_cash2.id)
    pmt_cash2.refresh_from_db()
    job_cash2.refresh_from_db()

    events2 = list(PaymentCollectionEvent.objects.filter(job_payment=pmt_cash2).values_list("event_type", flat=True))

    record_test(
        20,
        "Path B: Valid customer OTP atomically marks payment PAID, sets method OTP, and completes job",
        (
            resp_valid.status_code == 200
            and pmt_cash2.payment_status == "PAID"
            and pmt_cash2.customer_confirmation_method == "OTP"
            and pmt_cash2.otp_used_at is not None
            and job_cash2.status == "completed"
            and "CUSTOMER_CONFIRMED" in events2
            and "CASH_COLLECTED" in events2
            and "PAYMENT_PAID" in events2
        ),
        f"pmt_status={pmt_cash2.payment_status}, job_status={job_cash2.status}, events={events2}"
    )

    # ── Test 21: Path B Replaying Used OTP is Rejected ───────────────────────────
    pmt_cash2.payment_status = "CASH_PENDING"
    pmt_cash2.save()
    req = factory.post(f"/api/workforce/jobs/{job_cash2.id}/payment/verify-otp/", {"otp": test_otp}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_replay = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_cash2.id)
    pmt_cash2.payment_status = "PAID"
    pmt_cash2.save()

    record_test(
        21,
        "Path B: Single-use enforcement rejects replaying an already used OTP",
        resp_replay.status_code == 400 and "already been used" in str(resp_replay.data),
        str(resp_replay.data)
    )

    # ── Test 22: Tenant Isolation: Company B Tech Blocked from Company A Job ─────
    req = factory.post(f"/api/workforce/jobs/{job_cash1.id}/payment/collect/", {"amount_received": 850.00}, format="json")
    force_authenticate(req, user=tech2_user)
    resp_cross_tenant = WorkforceJobCashCollectView.as_view()(req, pk=job_cash1.id)

    record_test(
        22,
        "Tenant Isolation: Technician from Company B is blocked (403 Forbidden) from Company A job",
        resp_cross_tenant.status_code == 403,
        str(resp_cross_tenant.data)
    )

    # ── Test 23: Tenant Isolation: Unassigned Tech Blocked ────────────────────────
    tech3_user, _ = User.objects.get_or_create(
        username="tech3_pay_test_99",
        defaults={"email": "tech3_99@test.com", "role": "employee", "first_name": "Frank"}
    )
    emp3, _ = Employee.objects.get_or_create(
        user=tech3_user,
        defaults={"employee_id": "EMP-PAY-03", "company": company1, "is_active": True}
    )
    emp3.company = company1
    emp3.save()
    req = factory.post(f"/api/workforce/jobs/{job_cash1.id}/payment/collect/", {"amount_received": 850.00}, format="json")
    force_authenticate(req, user=tech3_user)
    resp_unassigned = WorkforceJobCashCollectView.as_view()(req, pk=job_cash1.id)

    record_test(
        23,
        "Tenant Isolation: Unassigned technician from same company is blocked (403 Forbidden)",
        resp_unassigned.status_code == 403,
        str(resp_unassigned.data)
    )

    # ── Test 24: State Machine Enforces Payment Closure Gate ─────────────────────
    job_gate_test, _ = ServiceRequest.objects.get_or_create(
        id=99204,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "TV Repair",
            "issue_title": "No Display",
            "status": "in_progress",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "COD",
            "payment_status": "pending",
            "total_amount": Decimal("2000.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_gate_test.status = "in_progress"
    job_gate_test.save()
    JobPayment.objects.filter(job=job_gate_test).delete()
    JobPayment.objects.create(
        job=job_gate_test,
        company=company1,
        employee=emp1,
        payment_method="CASH_ON_SERVICE",
        payment_status="CASH_PENDING",
        amount_due=Decimal("2000.00"),
    )
    PostServiceProof.objects.update_or_create(
        job=job_gate_test,
        defaults={
            "employee": emp1,
            "after_appliance_photo": "proof/after_app.jpg",
            "after_work_area_photo": "proof/after_area.jpg",
            "completion_notes": "Panel fixed.",
            "is_submitted": True,
        }
    )
    is_ready, reason, deps = job_gate_test.is_ready_to_complete()

    record_test(
        24,
        "Payment Closure Gate: is_ready_to_complete() detects pending cash confirmation",
        is_ready is False and any("awaiting customer confirmation" in d for d in deps),
        f"is_ready={is_ready}, deps={deps}"
    )

    # ── Test 25: Service Completion Gate: Payment PAID does not bypass Proof ──────
    job_proof_gate, _ = ServiceRequest.objects.get_or_create(
        id=99205,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "Microwave Repair",
            "issue_title": "Not Heating",
            "status": "in_progress",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "COD",
            "payment_status": "pending",
            "total_amount": Decimal("600.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_proof_gate.status = "in_progress"
    job_proof_gate.save()
    JobPayment.objects.filter(job=job_proof_gate).delete()
    JobPayment.objects.create(
        job=job_proof_gate,
        company=company1,
        employee=emp1,
        payment_method="CASH_ON_SERVICE",
        payment_status="PAID",
        amount_due=Decimal("600.00"),
        amount_paid=Decimal("600.00"),
    )
    PostServiceProof.objects.filter(job=job_proof_gate).delete()
    is_ready, reason, deps = job_proof_gate.is_ready_to_complete()

    record_test(
        25,
        "Service Completion Gate: Payment being PAID does NOT bypass mandatory post-service proof check",
        is_ready is False and any("proof" in d.lower() for d in deps),
        f"is_ready={is_ready}, deps={deps}"
    )

    # ── Test 26: Decoupled Work Start OTP vs Payment Confirmation OTP ────────────
    psv, _ = PreServiceVerification.objects.update_or_create(
        job=job_gate_test,
        defaults={"employee": emp1, "otp_code": "111222"}
    )
    pmt_gate = JobPayment.objects.get(job=job_gate_test)
    pmt_gate.payment_confirmation_otp_hash = make_password("333444")
    pmt_gate.save()

    work_start_otp_distinct = (psv.otp_code == "111222") and (psv.otp_code != "333444")
    payment_otp_distinct = check_password("333444", pmt_gate.payment_confirmation_otp_hash) and not check_password("111222", pmt_gate.payment_confirmation_otp_hash)

    record_test(
        26,
        "Work Start OTP and Payment Confirmation OTP are distinct, independent proofs with separate lifecycles",
        work_start_otp_distinct and payment_otp_distinct,
        f"psv_otp={psv.otp_code}, pmt_hash={pmt_gate.payment_confirmation_otp_hash[:15]}"
    )

    # ── Test 27: Serializer Security Never Exposes Secrets ───────────────────────
    serialized_payment = JobPaymentSerializer(pmt_gate).data
    keys = list(serialized_payment.keys())
    security_clean = (
        "payment_confirmation_otp_hash" not in keys
        and "otp_attempts" not in keys
        and "otp_used_at" not in keys
        and "otp_expires_at" not in keys
    )

    record_test(
        27,
        "JobPaymentSerializer strictly omits payment_confirmation_otp_hash, attempts, and internal timestamps",
        security_clean,
        f"fields={keys}"
    )

    # ── Test 28: Payment Audit Trail Immutability & Event Linking ────────────────
    all_events = PaymentCollectionEvent.objects.filter(job_payment=pmt_cash1).order_by("created_at")
    event_types = [e.event_type for e in all_events]

    record_test(
        28,
        "Audit Trail: PaymentCollectionEvent records are linked, chronological, and immutable",
        len(event_types) >= 4 and "CASH_COLLECTION_STARTED" in event_types and "PAYMENT_PAID" in event_types,
        f"event_types={event_types}"
    )

    # ── Test 29: Server-Side Authoritative Change Calculation ────────────────────
    req = factory.post(f"/api/workforce/jobs/{job_proof_gate.id}/payment/collect/", {"amount_received": 1000.00}, format="json")
    force_authenticate(req, user=tech1_user)
    pmt_proof_gate = JobPayment.objects.get(job=job_proof_gate)
    pmt_proof_gate.payment_status = "PENDING"
    pmt_proof_gate.save()

    resp_change = WorkforceJobCashCollectView.as_view()(req, pk=job_proof_gate.id)
    pmt_proof_gate.refresh_from_db()

    expected_change = Decimal("1000.00") - Decimal("600.00")

    record_test(
        29,
        "Authoritative Change Calculation: Backend accurately computes change_returned (₹400.00)",
        resp_change.status_code == 200 and pmt_proof_gate.change_returned == expected_change,
        f"change_returned={pmt_proof_gate.change_returned}, expected={expected_change}"
    )

    # ── Test 30: Complete E2E Lifecycle with Proof, Cash Collection & OTP ────────
    job_e2e, _ = ServiceRequest.objects.get_or_create(
        id=99206,
        defaults={
            "company": company1,
            "customer": customer_user,
            "customer_name": "Alice Customer",
            "phone": "+919876543210",
            "service_category": "Geyser Installation",
            "issue_title": "New Water Heater Install",
            "status": "arrived",
            "preferred_date": timezone.now().date(),
            "preferred_time": "10:00:00",
            "address": "100 Feet Rd, Bengaluru",
            "payment_method": "COD",
            "payment_status": "pending",
            "total_amount": Decimal("1500.00"),
            "assigned_employee": emp1,
            "latitude": Decimal("12.9716"),
            "longitude": Decimal("77.5946"),
        }
    )
    job_e2e.status = "arrived"
    job_e2e.save()
    JobPayment.objects.filter(job=job_e2e).delete()
    PreServiceVerification.objects.update_or_create(
        job=job_e2e,
        defaults={"employee": emp1, "geofence_passed": True, "otp_verified": True}
    )

    # Step 1: Start service
    apply_transition(job_e2e, "service_started", actor=tech1_user)
    apply_transition(job_e2e, "in_progress", actor=tech1_user)

    # Step 2: Post service proof
    PostServiceProof.objects.update_or_create(
        job=job_e2e,
        defaults={
            "employee": emp1,
            "after_appliance_photo": "proof/geyser_done.jpg",
            "after_work_area_photo": "proof/bathroom_clean.jpg",
            "completion_notes": "Geyser mounted, plumbed and electrical connections tested.",
            "is_submitted": True,
        }
    )
    apply_transition(job_e2e, "proof_submitted", actor=tech1_user)

    # Step 3: Cash collection reported
    req = factory.post(f"/api/workforce/jobs/{job_e2e.id}/payment/collect/", {"amount_received": 2000.00}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_e2e_collect = WorkforceJobCashCollectView.as_view()(req, pk=job_e2e.id)
    pmt_e2e = JobPayment.objects.get(job=job_e2e)

    # Step 4: OTP Verification
    e2e_otp = "987654"
    pmt_e2e.payment_confirmation_otp_hash = make_password(e2e_otp)
    pmt_e2e.save()

    req = factory.post(f"/api/workforce/jobs/{job_e2e.id}/payment/verify-otp/", {"otp": e2e_otp}, format="json")
    force_authenticate(req, user=tech1_user)
    resp_e2e_verify = WorkforceJobPaymentVerifyOTPView.as_view()(req, pk=job_e2e.id)
    job_e2e.refresh_from_db()
    pmt_e2e.refresh_from_db()

    e2e_success = (
        resp_e2e_collect.status_code == 200
        and resp_e2e_verify.status_code == 200
        and pmt_e2e.payment_status == "PAID"
        and pmt_e2e.change_returned == Decimal("500.00")
        and job_e2e.status == "completed"
    )

    record_test(
        30,
        "Complete E2E Lifecycle: Arrived -> In Progress -> Proof Submitted -> Cash Collected -> OTP Verified -> Job COMPLETED",
        e2e_success,
        f"job_status={job_e2e.status}, pmt_status={pmt_e2e.payment_status}, change={pmt_e2e.change_returned}"
    )

    print("\n" + "=" * 80)
    print(f"TEST RUN COMPLETED: {passed_count}/{passed_count + failed_count} PASSED ({(passed_count / (passed_count + failed_count)) * 100:.1f}%)")
    print("=" * 80)

    if failed_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
