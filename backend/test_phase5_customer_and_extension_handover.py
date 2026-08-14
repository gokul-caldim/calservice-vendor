"""
backend/test_phase5_customer_and_extension_handover.py
Comprehensive verification suite for Workforce Customer & Extension Handover.
"""
import os
import sys
import secrets
from decimal import Decimal
import django
from datetime import timedelta


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from service_requests.models import ServiceRequest
from service_requests.state_machine import apply_transition
from companies.models import Company
from employees.models import Employee
from workforce_api.models import (
    PreServiceVerification,
    PostServiceProof,
    WorkforceWorkExtension,
    WorkforceSupplementalInvoice,
    WorkforceJobReschedule,
    WorkforceSkill,
)
from workforce_api.views import (
    WorkforceCustomerJobOTPView,
    WorkforceAdminExtensionDecideView,
    WorkforceCustomerExtensionDetailView,
    WorkforceCustomerExtensionDecideView,
    WorkforceTokenExtensionDecideView,
    WorkforceAdminAssignSpecialistView,
    WorkforceExtensionProgressView,
    WorkforceCreateSupplementalInvoiceView,
    WorkforcePaySupplementalInvoiceView,
    WorkforceJobRescheduleView,
    WorkforceCustomerRescheduleResponseView,
)

User = get_user_model()
factory = APIRequestFactory()


def run_tests():
    passed = 0
    failed = 0
    details = []

    def record_pass(name, msg=""):
        nonlocal passed
        passed += 1
        details.append({"test": name, "status": "PASS", "message": msg})
        print(f" [PASS] {name} {f'-- {msg}' if msg else ''}")

    def record_fail(name, err):
        nonlocal failed
        failed += 1
        details.append({"test": name, "status": "FAIL", "error": str(err)})
        print(f" [FAIL] {name}: {err}")

    # ─── Setup Shared Test Fixtures ───────────────────────────────────────────
    company, _ = Company.objects.get_or_create(company_name="Customer Handover Services Ltd")

    admin_user, _ = User.objects.get_or_create(username="handover_admin", defaults={"email": "admin@handover.com", "is_staff": True, "is_superuser": True})
    
    cust_user_a, _ = User.objects.get_or_create(username="cust_alice", defaults={"email": "alice@customer.com", "first_name": "Alice", "last_name": "Smith"})
    cust_user_b, _ = User.objects.get_or_create(username="cust_bob", defaults={"email": "bob@customer.com", "first_name": "Bob", "last_name": "Jones"})

    tech_user_a, _ = User.objects.get_or_create(username="tech_john", defaults={"email": "john@tech.com", "first_name": "John", "last_name": "Doe"})
    tech_a, _ = Employee.objects.get_or_create(user=tech_user_a, defaults={"employee_id": "EMP-JOHN-01", "company": company, "is_active": True, "bank_details": {"onboarding": {"status": "approved"}}})

    tech_user_b, _ = User.objects.get_or_create(username="tech_sam_specialist", defaults={"email": "sam@tech.com", "first_name": "Sam", "last_name": "Specialist"})
    tech_b, _ = Employee.objects.get_or_create(user=tech_user_b, defaults={"employee_id": "EMP-SAM-SPEC", "company": company, "is_active": True, "bank_details": {"onboarding": {"status": "approved"}}})


    WorkforceWorkExtension.objects.filter(company=company).delete()

    def create_p5_job(**kwargs):
        req_id = f"SR-P5-{secrets.randbelow(900000)+100000}"
        defaults = {
            "request_id": req_id,
            "company": company,
            "customer": cust_user_a,
            "customer_name": "Alice Smith",
            "phone": "9876543210",
            "preferred_date": timezone.now().date(),
            "status": "arrived",
            "total_amount": Decimal("1000.00"),
            "cart_data": [],
        }
        defaults.update(kwargs)
        return ServiceRequest.objects.create(**defaults)

    # Test 1: Customer obtains correct Work Start OTP with active state
    try:
        job1 = create_p5_job(
            service_category="hvac",
            issue_title="Air Conditioner Noisy Fan",
            address="101 Palm Grove, Bangalore",
            assigned_employee=tech_a,
            status="arrived",
            total_amount=Decimal("1200.00"),
        )

        PreServiceVerification.objects.create(
            job=job1,
            employee=tech_a,
            otp_code="582914",

            otp_generated_at=timezone.now(),
            otp_expires_at=timezone.now() + timedelta(minutes=15),
            otp_attempts=0,
            geofence_passed=True,
        )

        req = factory.get(f"/api/workforce/customer/jobs/{job1.id}/otp/")
        force_authenticate(req, user=cust_user_a)
        res = WorkforceCustomerJobOTPView.as_view()(req, pk=job1.id)

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert res.data["otp_code"] == "582914", f"Expected OTP 582914, got {res.data.get('otp_code')}"
        assert res.data["otp_state"] == "ACTIVE", f"Expected ACTIVE state, got {res.data.get('otp_state')}"
        assert res.data["is_verified"] is False
        record_pass("1. Customer Work Start OTP Delivery Contract", f"OTP {res.data['otp_code']} delivered to customer with ACTIVE state")
    except Exception as e:
        record_fail("1. Customer Work Start OTP Delivery Contract", e)

    # Test 2: Unrelated customer / technician cannot access another customer's OTP
    try:
        req_unauth = factory.get(f"/api/workforce/customer/jobs/{job1.id}/otp/")
        force_authenticate(req_unauth, user=cust_user_b) # Bob trying to view Alice's OTP
        res_unauth = WorkforceCustomerJobOTPView.as_view()(req_unauth, pk=job1.id)

        assert res_unauth.status_code == 403, f"Expected 403 Forbidden for unrelated customer, got {res_unauth.status_code}"

        req_tech = factory.get(f"/api/workforce/customer/jobs/{job1.id}/otp/")
        force_authenticate(req_tech, user=tech_user_a) # Technician trying to view customer OTP
        res_tech = WorkforceCustomerJobOTPView.as_view()(req_tech, pk=job1.id)
        assert res_tech.status_code == 403, f"Expected 403 Forbidden for technician, got {res_tech.status_code}"

        record_pass("2. OTP Security Isolation", "Unrelated customers and technicians are strictly forbidden (403)")
    except Exception as e:
        record_fail("2. OTP Security Isolation", e)

    # Test 3: Customer accepts additional work via authenticated endpoint
    try:
        job2 = create_p5_job(
            service_category="plumbing",
            issue_title="Pipe Joint Leakage",
            address="102 Lake View, Bangalore",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("800.00"),
        )
        ext2 = WorkforceWorkExtension.objects.create(
            job=job2,
            technician=tech_a,
            company=company,
            title="Replace Corroded Valve",
            reason="Heavy corrosion detected during inspection",
            estimated_labor_cost=300.0,
            estimated_materials_cost=450.0,
            requested_amount=750.0,
            approved_amount=700.0,
            final_customer_amount=700.0,
            decision_token="token_alice_test_valve_123",
            decision_expires_at=timezone.now() + timedelta(hours=24),
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        req_accept = factory.post(f"/api/workforce/customer/jobs/{job2.id}/extension/{ext2.id}/decide/", {"action": "ACCEPT"}, format="json")
        force_authenticate(req_accept, user=cust_user_a)
        res_accept = WorkforceCustomerExtensionDecideView.as_view()(req_accept, pk=job2.id, ext_id=ext2.id)

        assert res_accept.status_code == 200, f"Expected 200, got {res_accept.status_code}: {res_accept.data}"
        ext2.refresh_from_db()
        job2.refresh_from_db()
        assert ext2.status == WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED
        assert float(job2.total_amount) == 1500.0, f"Expected 1500 (800+700), got {job2.total_amount}"
        record_pass("3. Customer Accepts Extension (Auth)", f"Extension marked CUSTOMER_ACCEPTED; Job total updated to ₹{job2.total_amount}")
    except Exception as e:
        record_fail("3. Customer Accepts Extension (Auth)", e)

    # Test 4: Customer accepts additional work via Decision Token
    try:
        job3 = create_p5_job(
            service_category="electrical",
            issue_title="Short Circuit Main DB",
            address="103 Green Park, Bangalore",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("1000.00"),
        )

        ext3 = WorkforceWorkExtension.objects.create(
            job=job3,
            technician=tech_a,
            company=company,
            title="Replace 32A MCB Breaker",
            reason="Burned contact terminals",
            estimated_labor_cost=250.0,
            estimated_materials_cost=650.0,
            requested_amount=900.0,
            approved_amount=850.0,
            final_customer_amount=850.0,
            decision_token="sec_token_mcb_999",
            decision_expires_at=timezone.now() + timedelta(hours=24),
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        req_token = factory.post("/api/workforce/customer/extension-token/sec_token_mcb_999/decide/", {"action": "ACCEPT"}, format="json")
        res_token = WorkforceTokenExtensionDecideView.as_view()(req_token, token="sec_token_mcb_999")

        assert res_token.status_code == 200, f"Expected 200, got {res_token.status_code}: {res_token.data}"
        ext3.refresh_from_db()
        job3.refresh_from_db()
        assert ext3.status == WorkforceWorkExtension.Status.CUSTOMER_ACCEPTED
        assert float(job3.total_amount) == 1850.0
        record_pass("4. Decision Token Security & Acceptance", f"Extension accepted via token; Job total ₹{job3.total_amount}")
    except Exception as e:
        record_fail("4. Decision Token Security & Acceptance", e)

    # Test 5: Customer declines optional extension (is_critical = False) -> Job stays in_progress
    try:
        job4 = create_p5_job(
            service_category="hvac",
            issue_title="Filter Cleaning",
            address="104 Palm Grove, Bangalore",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("600.00"),
        )
        ext4 = WorkforceWorkExtension.objects.create(
            job=job4,
            technician=tech_a,
            company=company,
            title="Optional Duct Fragrance Treatment",
            reason="Mild scent enhancement",
            estimated_labor_cost=100.0,
            estimated_materials_cost=200.0,
            requested_amount=300.0,
            approved_amount=300.0,
            final_customer_amount=300.0,
            is_critical=False,
            decision_token="token_fragrance_opt",
            decision_expires_at=timezone.now() + timedelta(hours=24),
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        req_dec = factory.post(f"/api/workforce/customer/jobs/{job4.id}/extension/{ext4.id}/decide/", {"action": "DECLINE", "reason": "Not needed at this time"}, format="json")
        force_authenticate(req_dec, user=cust_user_a)
        res_dec = WorkforceCustomerExtensionDecideView.as_view()(req_dec, pk=job4.id, ext_id=ext4.id)

        assert res_dec.status_code == 200
        ext4.refresh_from_db()
        job4.refresh_from_db()
        assert ext4.status == WorkforceWorkExtension.Status.CUSTOMER_DECLINED
        assert job4.status == "in_progress", f"Expected job in_progress, got {job4.status}"
        assert float(job4.total_amount) == 600.0, "Commercial amount must remain untouched"
        record_pass("5. Customer Declines Optional Extension", "Extension CUSTOMER_DECLINED; Original Job continues IN_PROGRESS")
    except Exception as e:
        record_fail("5. Customer Declines Optional Extension", e)

    # Test 6: Customer declines critical extension (is_critical = True) -> Job moves to unable_to_complete
    try:
        job5 = create_p5_job(
            service_category="electrical",
            issue_title="Power Fluctuation",
            address="105 Palm Grove, Bangalore",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("700.00"),
        )
        ext5 = WorkforceWorkExtension.objects.create(
            job=job5,
            technician=tech_a,
            company=company,
            title="Critical Grounding Wire Replacement",
            reason="High risk of electrical shock",
            estimated_labor_cost=400.0,
            estimated_materials_cost=500.0,
            requested_amount=900.0,
            approved_amount=900.0,
            final_customer_amount=900.0,
            is_critical=True,
            decision_token="token_grounding_crit",
            decision_expires_at=timezone.now() + timedelta(hours=24),
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        req_crit_dec = factory.post(f"/api/workforce/customer/jobs/{job5.id}/extension/{ext5.id}/decide/", {"action": "DECLINE", "reason": "Too expensive"}, format="json")
        force_authenticate(req_crit_dec, user=cust_user_a)
        res_crit_dec = WorkforceCustomerExtensionDecideView.as_view()(req_crit_dec, pk=job5.id, ext_id=ext5.id)

        assert res_crit_dec.status_code == 200
        ext5.refresh_from_db()
        job5.refresh_from_db()
        assert ext5.status == WorkforceWorkExtension.Status.CUSTOMER_DECLINED
        assert job5.status == "unable_to_complete", f"Expected job unable_to_complete, got {job5.status}"
        assert "[UNABLE_TO_COMPLETE]" in job5.description
        record_pass("6. Customer Declines Critical Extension", "Critical decline transitions job to UNABLE_TO_COMPLETE with audit note")
    except Exception as e:
        record_fail("6. Customer Declines Critical Extension", e)

    # Test 7: Duplicate customer decision rejected with 409 Conflict
    try:
        req_dup = factory.post(f"/api/workforce/customer/jobs/{job2.id}/extension/{ext2.id}/decide/", {"action": "DECLINE"}, format="json")
        force_authenticate(req_dup, user=cust_user_a)
        res_dup = WorkforceCustomerExtensionDecideView.as_view()(req_dup, pk=job2.id, ext_id=ext2.id)

        assert res_dup.status_code == 409, f"Expected 409 Conflict on duplicate decision, got {res_dup.status_code}"
        assert res_dup.data.get("code") == "DECISION_ALREADY_RECORDED"
        record_pass("7. Decision Idempotency & One-Time Gate", "Subsequent or contradictory decision rejected with 409 Conflict")
    except Exception as e:
        record_fail("7. Decision Idempotency & One-Time Gate", e)

    # Test 8: Expired decision rejected with 400 Bad Request
    try:
        job6 = create_p5_job(
            service_category="hvac",
            issue_title="Expired Test Case",
            address="106 Palm Grove",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("500.00"),
        )
        ext6 = WorkforceWorkExtension.objects.create(
            job=job6,
            technician=tech_a,
            company=company,
            title="Expired Extension",
            reason="Testing expiration",
            requested_amount=500.0,
            approved_amount=500.0,
            final_customer_amount=500.0,
            decision_token="token_expired_123",
            decision_expires_at=timezone.now() - timedelta(minutes=10), # Expired in past
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        req_exp = factory.post(f"/api/workforce/customer/jobs/{job6.id}/extension/{ext6.id}/decide/", {"action": "ACCEPT"}, format="json")
        force_authenticate(req_exp, user=cust_user_a)
        res_exp = WorkforceCustomerExtensionDecideView.as_view()(req_exp, pk=job6.id, ext_id=ext6.id)

        assert res_exp.status_code == 400, f"Expected 400 Bad Request, got {res_exp.status_code}"
        assert res_exp.data.get("code") == "DECISION_EXPIRED"
        record_pass("8. Expired Decision Handling", "Decision after expiration timestamp rejected with DECISION_EXPIRED")
    except Exception as e:
        record_fail("8. Expired Decision Handling", e)

    # Test 9: Specialist Extension Referral Workflow
    try:
        job7 = create_p5_job(
            service_category="appliance_repair",
            issue_title="Refrigerator Compressor Failure",
            address="107 Palm Grove",
            assigned_employee=tech_a,
            status="in_progress",
            total_amount=Decimal("1500.00"),
        )
        ext7 = WorkforceWorkExtension.objects.create(
            job=job7,
            technician=tech_a,
            company=company,
            title="Inverter PCB & Micro-Soldering Specialist",
            reason="Burnt inverter chip requires micro-soldering technician",
            estimated_labor_cost=800.0,
            estimated_materials_cost=1200.0,
            requested_amount=2000.0,
            approved_amount=1900.0,
            final_customer_amount=1900.0,
            requires_specialist=True,
            decision_token="token_pcb_spec",
            decision_expires_at=timezone.now() + timedelta(hours=24),
            status=WorkforceWorkExtension.Status.ADMIN_APPROVED,
        )

        # Customer accepts specialist extension
        req_spec_acc = factory.post(f"/api/workforce/customer/jobs/{job7.id}/extension/{ext7.id}/decide/", {"action": "ACCEPT"}, format="json")
        force_authenticate(req_spec_acc, user=cust_user_a)
        res_spec_acc = WorkforceCustomerExtensionDecideView.as_view()(req_spec_acc, pk=job7.id, ext_id=ext7.id)

        assert res_spec_acc.status_code == 200
        ext7.refresh_from_db()
        job7.refresh_from_db()
        assert ext7.status == WorkforceWorkExtension.Status.PENDING_ASSIGNMENT
        assert job7.status == "follow_up_required", f"Expected follow_up_required, got {job7.status}"
        record_pass("9. Specialist Referral Decision", "Extension set to PENDING_ASSIGNMENT; ServiceRequest transitioned to FOLLOW_UP_REQUIRED")
    except Exception as e:
        record_fail("9. Specialist Referral Decision", e)

    # Test 10: Admin assigns Specialist Technician B -> creates sanitized secondary job
    try:
        req_spec_assign = factory.post(
            f"/api/workforce/admin/jobs/{job7.id}/extension/{ext7.id}/assign-specialist/",
            {"specialist_employee_id": tech_b.id},
            format="json"
        )
        force_authenticate(req_spec_assign, user=admin_user)
        res_spec_assign = WorkforceAdminAssignSpecialistView.as_view()(req_spec_assign, pk=job7.id, ext_id=ext7.id)

        assert res_spec_assign.status_code == 200, f"Expected 200, got {res_spec_assign.status_code}: {res_spec_assign.data}"
        secondary_job_id = res_spec_assign.data["secondary_job_id"]
        secondary_job = ServiceRequest.objects.get(pk=secondary_job_id)

        assert secondary_job.assigned_employee == tech_b
        assert secondary_job.status == "assigned"
        assert secondary_job.cart_data[0]["is_primary"] is False
        assert secondary_job.cart_data[0]["parent_job_id"] == job7.id
        record_pass("10. Specialist Secondary Job Creation", f"Secondary Job #{secondary_job.id} created and assigned to Tech B")
    except Exception as e:
        record_fail("10. Specialist Secondary Job Creation", e)

    # Test 11: Specialist Technician B receives only sanitized specialist task data without Tech A private data
    try:
        secondary_job = ServiceRequest.objects.get(pk=secondary_job_id)
        # Verify Tech B's view does not contain Tech A's internal payroll/bank/performance info
        assert "Specialist Task" in secondary_job.issue_title
        assert "Inverter PCB" in secondary_job.description
        assert "tech_john" not in secondary_job.description
        record_pass("11. Specialist Privacy Isolation", "Tech B only receives sanitized specialist requirements")
    except Exception as e:
        record_fail("11. Specialist Privacy Isolation", e)

    # Test 12 & 13: Authoritative Completion Aggregation (is_ready_to_complete)
    try:
        # Tech A submits proof for primary job
        proof7, _ = PostServiceProof.objects.get_or_create(
            job=job7,
            employee=tech_a,
            defaults={
                "completion_notes": "Primary refrigeration line checked and cleaned.",
                "is_submitted": True,
            }
        )
        proof7.is_submitted = True
        proof7.save()

        # Check is_ready_to_complete while specialist extension is still open
        is_ready, reason, deps = job7.is_ready_to_complete()
        assert not is_ready, "Overall job must NOT be ready to complete while specialist extension/job is unfinished"
        assert any("Secondary specialist job" in d or "Work extension" in d for d in deps)

        # Tech B completes specialist job and resolves extension
        secondary_job.status = "completed"
        secondary_job.save()

        ext7.status = WorkforceWorkExtension.Status.RESOLVED
        ext7.resolved_at = timezone.now()
        ext7.save()

        # Re-evaluate is_ready_to_complete
        is_ready_after, reason_after, _ = job7.is_ready_to_complete()
        assert is_ready_after, f"Overall job should now be ready to complete. Reason: {reason_after}"

        # Apply state transition to completed
        target = apply_transition(job7, "completed", actor=admin_user)
        assert target == "completed"
        assert job7.status == "completed"
        record_pass("12 & 13. Authoritative Completion Aggregation", "Case remains open until all primary & specialist dependencies complete")
    except Exception as e:
        record_fail("12 & 13. Authoritative Completion Aggregation", e)

    # Test 14: 1st Reschedule updates proposed schedule, notifies customer, records audit
    try:
        job8 = create_p5_job(
            service_category="hvac",
            issue_title="AC Blower Replacement",
            preferred_date="2026-08-15",
            total_amount=Decimal("2200.00"),
            status="in_progress",
        )


        req_resched1 = factory.post(
            f"/api/workforce/jobs/{job8.id}/reschedule/",
            {"rescheduled_date": "2026-08-17", "reason": "Awaiting custom blower motor delivery from warehouse", "delay_type": "PARTS_DELAY"},
            format="json"
        )
        force_authenticate(req_resched1, user=admin_user)
        res_resched1 = WorkforceJobRescheduleView.as_view()(req_resched1, pk=job8.id)

        assert res_resched1.status_code == 200
        assert res_resched1.data["delay_count"] == 1
        assert res_resched1.data["escalated_to_support"] is False
        job8.refresh_from_db()
        assert str(job8.preferred_date) == "2026-08-17"
        assert float(job8.total_amount) == 2200.0, "Commercial amounts must remain untouched"
        record_pass("14. 1st Delay Rescheduling Audit", "1st delay successfully reschedules date and records audit")
    except Exception as e:
        record_fail("14. 1st Delay Rescheduling Audit", e)

    # Test 15: 2nd Delay freezes proposed schedule and triggers support escalation
    try:
        req_resched2 = factory.post(
            f"/api/workforce/jobs/{job8.id}/reschedule/",
            {"rescheduled_date": "2026-08-20", "reason": "Courier shipment delayed due to rain", "delay_type": "PARTS_DELAY"},
            format="json"
        )
        force_authenticate(req_resched2, user=admin_user)
        res_resched2 = WorkforceJobRescheduleView.as_view()(req_resched2, pk=job8.id)

        assert res_resched2.status_code == 200
        assert res_resched2.data["delay_count"] == 2
        assert res_resched2.data["escalated_to_support"] is True
        job8.refresh_from_db()
        # Proposed date must be frozen, not silently changed
        assert str(job8.preferred_date) == "2026-08-17"
        assert float(job8.total_amount) == 2200.0
        record_pass("15. 2nd Delay Escalation Guard", "2nd delay freezes proposed date and escalates to customer support")
    except Exception as e:
        record_fail("15. 2nd Delay Escalation Guard", e)

    # Test 16: Idempotent Supplemental Billing Creation & Payment
    try:
        # Create supplemental invoice for ext2
        req_inv1 = factory.post(f"/api/workforce/jobs/{job2.id}/extension/{ext2.id}/create-supplemental-invoice/")
        force_authenticate(req_inv1, user=admin_user)
        res_inv1 = WorkforceCreateSupplementalInvoiceView.as_view()(req_inv1, pk=job2.id, ext_id=ext2.id)

        assert res_inv1.status_code in [200, 201]
        inv_data = res_inv1.data["invoice"]
        inv_id = inv_data["id"]
        assert float(inv_data["amount"]) == 700.0
        assert inv_data["status"] == "ISSUED"

        # Retry invoice creation -> Must be idempotent (returns same invoice, created=False)
        req_inv2 = factory.post(f"/api/workforce/jobs/{job2.id}/extension/{ext2.id}/create-supplemental-invoice/")
        force_authenticate(req_inv2, user=admin_user)
        res_inv2 = WorkforceCreateSupplementalInvoiceView.as_view()(req_inv2, pk=job2.id, ext_id=ext2.id)
        assert res_inv2.data["created"] is False
        assert res_inv2.data["invoice"]["id"] == inv_id

        # Customer pays invoice
        req_pay = factory.post(
            f"/api/workforce/customer/supplemental-invoice/{inv_id}/pay/",
            {"payment_method": "ONLINE", "transaction_id": "TXN_UPI_ALICE_9988"},
            format="json"
        )
        force_authenticate(req_pay, user=cust_user_a)
        res_pay = WorkforcePaySupplementalInvoiceView.as_view()(req_pay, invoice_id=inv_id)

        assert res_pay.status_code == 200
        assert res_pay.data["invoice"]["status"] == "PAID"
        assert res_pay.data["invoice"]["transaction_id"] == "TXN_UPI_ALICE_9988"

        # Original booking invoice / amount is unchanged
        job2.refresh_from_db()
        assert float(job2.total_amount) == 1500.0
        record_pass("16. Idempotent Supplemental Billing & Payment", f"Invoice #{inv_data['invoice_number']} paid; Idempotent on retry; Original booking preserved")
    except Exception as e:
        record_fail("16. Idempotent Supplemental Billing & Payment", e)

    print("\n" + "=" * 60)
    print(f"Phase 5 Verification Suite Completed: {passed} PASSED, {failed} FAILED")
    print("=" * 60)

    return {
        "total": passed + failed,
        "passed": passed,
        "failed": failed,
        "details": details,
    }


if __name__ == "__main__":
    results = run_tests()
    if results["failed"] > 0:
        sys.exit(1)
    sys.exit(0)
