import os
import sys
import django
from decimal import Decimal
from datetime import timedelta

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import ValidationError

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from service_requests.state_machine import apply_transition
from workforce_api.models import (
    JobPayment,
    PaymentCollectionEvent,
    PostServiceProof,
    PreServiceVerification,
)
from time_tracking.models import TimeLog
from workforce_api.views import (
    WorkforceJobCashCollectView,
    WorkforceJobPaymentVerifyOTPView,
    WorkforceCustomerPaymentConfirmView,
    WorkforceJobProofView,
)

User = get_user_model()
factory = APIRequestFactory()


def run_tests():
    print("=" * 80)
    print("CALTRACK — CRITICAL PAYMENT & COMPLETION INTEGRITY VERIFICATION SUITE")
    print("=" * 80)

    # 1. Setup Test Fixtures
    ts = int(timezone.now().timestamp())
    company, _ = Company.objects.get_or_create(
        company_name=f"Integrity Test Co {ts}",
        defaults={"is_active": True}
    )

    tech_user, _ = User.objects.get_or_create(
        username=f"tech_integrity_{ts}",
        defaults={"email": f"tech_{ts}@test.com", "phone": f"+9198{ts % 100000000:08d}", "role": "EMPLOYEE"}
    )
    tech_user.set_password("password123")
    tech_user.save()

    emp, _ = Employee.objects.get_or_create(
        user=tech_user,
        defaults={
            "company": company,
            "employee_id": f"EMP{ts % 100000}",
            "bank_details": {"onboarding": {"status": "approved"}}
        }
    )
    emp.bank_details = {"onboarding": {"status": "approved"}}
    emp.save()

    customer_user, _ = User.objects.get_or_create(
        username=f"cust_integrity_{ts}",
        defaults={"email": f"cust_{ts}@test.com", "phone": f"+9197{ts % 100000000:08d}", "role": "CUSTOMER"}
    )
    customer_user.set_password("password123")
    customer_user.save()

    # Create active time log for employee
    TimeLog.objects.create(
        employee=emp,
        company=company,
        work_date=timezone.now().date(),
        clock_in=timezone.now() - timedelta(hours=2),
        clock_out=None,
    )

    # -------------------------------------------------------------------------
    # TEST 1: Cash Collection MUST NEVER set PAID directly
    # -------------------------------------------------------------------------
    print("\n[TEST 1] WorkforceJobCashCollectView MUST transition CASH_ON_SERVICE -> CASH_PENDING (never PAID)")
    job1 = ServiceRequest.objects.create(
        company=company,
        customer=customer_user,
        assigned_employee=emp,
        preferred_date=timezone.now().date(),
        status="in_progress",
        total_amount=Decimal("450.00"),
        payment_method="COD",
        payment_status="pending",
    )
    EmployeeJob.objects.create(
        service_request=job1,
        employee=emp,
        status="IN_PROGRESS"
    )

    # Technician collects Rs. 500 for a Rs. 450 job
    req = factory.post(
        f"/workforce/jobs/{job1.id}/payment/collect/",
        {"amount_received": "500.00"},
        format="json"
    )
    req.user = tech_user
    resp = WorkforceJobCashCollectView.as_view()(req, pk=job1.id)

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
    assert resp.data.get("payment_status") == "CASH_PENDING", f"Expected CASH_PENDING, got {resp.data.get('payment_status')}"
    assert Decimal(str(resp.data.get("change_returned"))) == Decimal("50.00"), f"Expected Rs. 50.00 change, got {resp.data.get('change_returned')}"

    # Verify DB State
    job1.refresh_from_db()
    pmt1 = JobPayment.objects.get(job=job1)

    assert pmt1.payment_status == JobPayment.PaymentStatus.CASH_PENDING, f"DB payment_status must be CASH_PENDING, got {pmt1.payment_status}"
    assert pmt1.amount_paid == Decimal("0.00"), f"DB amount_paid must be 0.00, got {pmt1.amount_paid}"
    assert pmt1.amount_received == Decimal("500.00"), f"DB amount_received must be 500.00, got {pmt1.amount_received}"
    assert pmt1.change_returned == Decimal("50.00"), f"DB change_returned must be 50.00, got {pmt1.change_returned}"
    assert pmt1.otp_used_at is None, "otp_used_at must be None"
    assert pmt1.payment_confirmation_otp_hash is not None, "payment_confirmation_otp_hash must be set"
    assert pmt1.otp_expires_at is not None, "otp_expires_at must be set"
    assert job1.status == "in_progress", f"Job status must remain in_progress, got {job1.status}"

    # Verify CASH_REPORTED audit event
    audit_evt = PaymentCollectionEvent.objects.filter(job_payment=pmt1, event_type="CASH_REPORTED").first()
    assert audit_evt is not None, "CASH_REPORTED audit event must exist"
    print("  [PASS] PASSED: Cash collection generated OTP, calculated change Rs. 50.00, and moved strictly to CASH_PENDING (not PAID, not completed).")

    # -------------------------------------------------------------------------
    # TEST 2: Underpayment Rejection
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Underpayment Rejection Validation")
    job_under = ServiceRequest.objects.create(
        company=company,
        customer=customer_user,
        assigned_employee=emp,
        preferred_date=timezone.now().date(),
        status="in_progress",
        total_amount=Decimal("1000.00"),
        payment_method="COD",
        payment_status="pending",
    )
    req_under = factory.post(
        f"/workforce/jobs/{job_under.id}/payment/collect/",
        {"amount_received": "800.00"},
        format="json"
    )
    req_under.user = tech_user
    resp_under = WorkforceJobCashCollectView.as_view()(req_under, pk=job_under.id)
    assert resp_under.status_code == 400, f"Expected 400 for underpayment, got {resp_under.status_code}"
    print("  [PASS] PASSED: Underpayment Rs. 800 vs Rs. 1000 properly rejected with HTTP 400.")

    # -------------------------------------------------------------------------
    # TEST 3: is_ready_to_complete() Fails Closed While CASH_PENDING
    # -------------------------------------------------------------------------
    print("\n[TEST 3] is_ready_to_complete() and apply_transition() must fail closed during CASH_PENDING")
    is_ready, reason, deps = job1.is_ready_to_complete()
    assert not is_ready, "Job must NOT be ready to complete while payment is CASH_PENDING"
    print(f"  [PASS] is_ready_to_complete() returned is_ready=False. Reason: {reason}")

    try:
        apply_transition(job1, "completed", actor=tech_user)
        assert False, "apply_transition must raise ValidationError when payment is not PAID"
    except ValidationError as ve:
        print(f"  [PASS] apply_transition correctly blocked transition to COMPLETED: {ve}")

    # -------------------------------------------------------------------------
    # TEST 4: OTP Verification Path (WorkforceJobPaymentVerifyOTPView)
    # -------------------------------------------------------------------------
    print("\n[TEST 4] OTP Verification Path transitions CASH_PENDING -> PAID")
    from workforce_api.models import WorkforceNotification
    notif = WorkforceNotification.objects.filter(recipient=customer_user, notification_type="PAYMENT_CONFIRMATION_OTP").latest("created_at")
    import re
    otp_match = re.search(r"\b(\d{6})\b", notif.message)
    assert otp_match, f"OTP not found in notification message: {notif.message}"
    valid_otp = otp_match.group(1)
    print(f"  Found generated customer OTP: {valid_otp}")

    # Test Invalid OTP
    req_bad_otp = factory.post(f"/workforce/jobs/{job1.id}/payment/verify-otp/", {"otp": "000000"}, format="json")
    req_bad_otp.user = tech_user
    resp_bad_otp = WorkforceJobPaymentVerifyOTPView.as_view()(req_bad_otp, pk=job1.id)
    assert resp_bad_otp.status_code == 400, f"Expected 400 for bad OTP, got {resp_bad_otp.status_code}"
    assert "Invalid payment confirmation OTP" in resp_bad_otp.data.get("error")

    # Test Valid OTP
    # First submit post service proof
    proof1, _ = PostServiceProof.objects.get_or_create(job=job1, defaults={"employee": emp})
    proof1.is_submitted = True
    proof1.completion_notes = "Service completed and verified."
    proof1.save()
    job1.status = "proof_submitted"
    job1.save()

    req_good_otp = factory.post(f"/workforce/jobs/{job1.id}/payment/verify-otp/", {"otp": valid_otp}, format="json")
    req_good_otp.user = tech_user
    resp_good_otp = WorkforceJobPaymentVerifyOTPView.as_view()(req_good_otp, pk=job1.id)

    assert resp_good_otp.status_code == 200, f"Expected 200, got {resp_good_otp.status_code}: {resp_good_otp.data}"
    assert resp_good_otp.data.get("payment_status") == "PAID"
    assert resp_good_otp.data.get("job_status") == "completed"

    pmt1.refresh_from_db()
    job1.refresh_from_db()
    assert pmt1.payment_status == JobPayment.PaymentStatus.PAID
    assert pmt1.amount_paid == pmt1.amount_due
    assert pmt1.otp_used_at is not None
    assert pmt1.customer_confirmation_method == "OTP"
    assert job1.status == "completed"
    print("  [PASS] PASSED: Valid OTP verified, payment marked PAID, and job cleanly completed.")

    # -------------------------------------------------------------------------
    # TEST 5: Customer Direct Confirmation Path (WorkforceCustomerPaymentConfirmView)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Customer Direct Confirmation Path")
    job2 = ServiceRequest.objects.create(
        company=company,
        customer=customer_user,
        assigned_employee=emp,
        preferred_date=timezone.now().date(),
        status="in_progress",
        total_amount=Decimal("750.00"),
        payment_method="COD",
        payment_status="pending",
    )
    EmployeeJob.objects.create(service_request=job2, employee=emp, status="IN_PROGRESS")

    # Technician reports cash
    req_col2 = factory.post(f"/workforce/jobs/{job2.id}/payment/collect/", {"amount_received": "750.00"}, format="json")
    req_col2.user = tech_user
    resp_col2 = WorkforceJobCashCollectView.as_view()(req_col2, pk=job2.id)
    assert resp_col2.status_code == 200
    assert resp_col2.data.get("payment_status") == "CASH_PENDING"

    # Add proof
    proof2, _ = PostServiceProof.objects.get_or_create(job=job2, defaults={"employee": emp})
    proof2.is_submitted = True
    proof2.completion_notes = "Clean repair completed."
    proof2.save()
    job2.status = "proof_submitted"
    job2.save()

    # Customer directly confirms
    req_conf = factory.post(f"/workforce/customer/jobs/{job2.id}/payment/confirm/", {"action": "CONFIRM"}, format="json")
    req_conf.user = customer_user
    resp_conf = WorkforceCustomerPaymentConfirmView.as_view()(req_conf, pk=job2.id)

    assert resp_conf.status_code == 200, f"Expected 200, got {resp_conf.status_code}: {resp_conf.data}"
    assert resp_conf.data.get("payment_status") == "PAID"
    assert resp_conf.data.get("job_status") == "completed"

    pmt2 = JobPayment.objects.get(job=job2)
    job2.refresh_from_db()
    assert pmt2.payment_status == JobPayment.PaymentStatus.PAID
    assert pmt2.customer_confirmation_method == "DIRECT_CONFIRMATION"
    assert job2.status == "completed"
    print("  [PASS] PASSED: Customer direct confirmation transitioned payment to PAID and closed job.")

    # -------------------------------------------------------------------------
    # TEST 6: Elimination of Force-Completion Fallbacks (Failing Closed)
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Fail-Closed Integrity: No Force-Completion Fallback")
    job3 = ServiceRequest.objects.create(
        company=company,
        customer=customer_user,
        assigned_employee=emp,
        preferred_date=timezone.now().date(),
        status="in_progress",
        total_amount=Decimal("300.00"),
        payment_method="COD",
        payment_status="pending",
    )
    EmployeeJob.objects.create(service_request=job3, employee=emp, status="IN_PROGRESS")

    # Collect cash
    req_col3 = factory.post(f"/workforce/jobs/{job3.id}/payment/collect/", {"amount_received": "300.00"}, format="json")
    req_col3.user = tech_user
    WorkforceJobCashCollectView.as_view()(req_col3, pk=job3.id)

    # Note: PostServiceProof is NOT submitted for job3!
    # Direct confirmation should succeed for payment (PAID), but job completion transition must fail closed and NOT force completed!
    req_conf3 = factory.post(f"/workforce/customer/jobs/{job3.id}/payment/confirm/", {"action": "CONFIRM"}, format="json")
    req_conf3.user = customer_user
    resp_conf3 = WorkforceCustomerPaymentConfirmView.as_view()(req_conf3, pk=job3.id)

    assert resp_conf3.status_code == 200
    assert resp_conf3.data.get("payment_status") == "PAID"
    job3.refresh_from_db()
    assert job3.status == "in_progress", f"Job status must remain 'in_progress' because proof was missing (got '{job3.status}')"
    print("  [PASS] PASSED: Payment marked PAID, but job status was NOT force-completed when proof was missing. Failed closed safely.")

    # -------------------------------------------------------------------------
    # TEST 7: Online Prepaid Bookings Reject Cash Collection
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Online Prepaid Bookings Reject Cash Collection")
    job_online = ServiceRequest.objects.create(
        company=company,
        customer=customer_user,
        assigned_employee=emp,
        preferred_date=timezone.now().date(),
        status="in_progress",
        total_amount=Decimal("900.00"),
        payment_method="ONLINE",
        payment_status="paid",
    )
    JobPayment.objects.create(
        job=job_online,
        company=company,
        employee=emp,
        payment_method=JobPayment.PaymentMethod.ONLINE,
        payment_status=JobPayment.PaymentStatus.PAID,
        amount_due=Decimal("900.00"),
        amount_paid=Decimal("900.00"),
    )

    req_online_cash = factory.post(f"/workforce/jobs/{job_online.id}/payment/collect/", {"amount_received": "900.00"}, format="json")
    req_online_cash.user = tech_user
    resp_online_cash = WorkforceJobCashCollectView.as_view()(req_online_cash, pk=job_online.id)
    assert resp_online_cash.status_code == 400
    assert "Cannot collect cash for online payment booking" in resp_online_cash.data.get("error")
    print("  [PASS] PASSED: Cash collection on ONLINE booking correctly rejected with HTTP 400.")

    print("\n" + "=" * 80)
    print("ALL CALTRACK PAYMENT & COMPLETION INTEGRITY TESTS PASSED 100%!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
