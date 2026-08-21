import os
import sys
import json
from decimal import Decimal

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()

from employees.models import Employee
from companies.models import Company
from service_requests.models import ServiceRequest
from workforce_api.models import (
    PostServiceProof,
    JobPayment,
    PaymentCollectionEvent,
)
from workforce_api.views import WorkforceJobCashCollectView, WorkforceJobPaymentVerifyOTPView


import uuid

class CashCollectionNoOtpTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.company = Company.objects.filter(is_active=True).first() or Company.objects.create(company_name="Test Company", is_active=True)
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"tech_cash_{unique_id}",
            email=f"tech_cash_{unique_id}@example.com",
            password="password123",
            role="employee",
        )
        self.emp = Employee.objects.create(
            user=self.user,
            company=self.company,
            employee_id=f"EMP-{unique_id[:6].upper()}",
            phone=f"98{unique_id[:8]}",
            bank_details={"onboarding": {"status": "approved"}},
        )
        self.job = ServiceRequest.objects.create(
            company=self.company,
            assigned_employee=self.emp,
            status="proof_submitted",
            total_amount=Decimal("999.00"),
            payment_method="cash",
            payment_status="pending",
            preferred_date=timezone.localdate(),
            preferred_time="10:00 AM",
            service_category="Appliances",
            issue_title="AC Repair",
        )
        # Create after-service proof
        self.proof = PostServiceProof.objects.create(
            job=self.job,
            employee=self.emp,
            after_presence_photo="proofs/after_presence.jpg",
            is_submitted=True,
        )

    def test_cash_collection_directly_marks_paid_and_completes_job(self):
        req = self.factory.post(
            f"/workforce/jobs/{self.job.id}/payment/collect/",
            {"amount_received": "1000.00"},
            format="json",
        )
        force_authenticate(req, user=self.user)
        view = WorkforceJobCashCollectView.as_view()
        resp = view(req, pk=self.job.id)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["payment_status"], "PAID")
        self.assertEqual(resp.data["job_status"], "completed")
        self.assertEqual(resp.data["amount_due"], "999.00")
        self.assertEqual(resp.data["amount_received"], "1000.00")
        self.assertEqual(resp.data["change_returned"], "1.00")

        # Verify database record
        pmt = JobPayment.objects.get(job=self.job)
        self.assertEqual(pmt.payment_status, JobPayment.PaymentStatus.PAID)
        self.assertEqual(pmt.amount_paid, Decimal("999.00"))
        self.assertIsNone(pmt.payment_confirmation_otp_hash)

        # Verify job is completed
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "completed")
        self.assertEqual(self.job.payment_status, "paid")

        # Verify audit events
        events = list(PaymentCollectionEvent.objects.filter(job_payment=pmt).values_list("event_type", flat=True))
        self.assertIn("CASH_COLLECTED", events)
        self.assertIn("PAYMENT_PAID", events)

    def test_cash_collection_from_in_progress_completes_job(self):
        unique_id = uuid.uuid4().hex[:8]
        job_in_progress = ServiceRequest.objects.create(
            company=self.company,
            assigned_employee=self.emp,
            status="in_progress",
            total_amount=Decimal("499.00"),
            payment_method="cash",
            payment_status="pending",
            preferred_date=timezone.localdate(),
            preferred_time="11:00 AM",
            service_category="Appliances",
            issue_title="Fan Repair",
        )
        req = self.factory.post(
            f"/workforce/jobs/{job_in_progress.id}/payment/collect/",
            {"amount_received": "500.00"},
            format="json",
        )
        force_authenticate(req, user=self.user)
        view = WorkforceJobCashCollectView.as_view()
        resp = view(req, pk=job_in_progress.id)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["payment_status"], "PAID")
        self.assertEqual(resp.data["job_status"], "completed")

        job_in_progress.refresh_from_db()
        self.assertEqual(job_in_progress.status, "completed")
        self.assertEqual(job_in_progress.payment_status, "paid")

    def test_legacy_verify_otp_view_safe_deprecated_response(self):
        req = self.factory.post(
            f"/workforce/jobs/{self.job.id}/payment/verify-otp/",
            {"otp": "123456"},
            format="json",
        )
        force_authenticate(req, user=self.user)
        view = WorkforceJobPaymentVerifyOTPView.as_view()
        resp = view(req, pk=self.job.id)

        self.assertEqual(resp.status_code, 200)
        self.assertIn("no longer required", resp.data["message"])


if __name__ == "__main__":
    import unittest
    suite = unittest.TestLoader().loadTestsFromTestCase(CashCollectionNoOtpTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
    print("\nALL CASH COLLECTION NO-OTP TESTS PASSED PERFECTLY!")
