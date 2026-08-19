import os
import sys
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import (
    WorkforceJobOffer,
    JobPayment,
    WorkforceWorkExtension,
    WorkforcePayPeriod,
    WorkforceEmployeeChangeRequest,
    WorkforceSkill,
    WorkforceEmployeeSkill,
    WorkforceComplianceRequirement,
    WorkforceEmployeeCompliance,
)
from workforce_api.views import (
    WorkforceAdminApplicationDetailView,
    WorkforceAdminDocumentVerifyView,
    WorkforceAdminServiceDecideView,
    WorkforceAdminRequestCorrectionView,
    WorkforceAdminApproveApplicationView,
    WorkforceJobTransitionView,
    WorkforceJobProofView,
    WorkforceJobPaymentDetailView,
    WorkforceJobCashCollectView,
    WorkforceJobPaymentVerifyOTPView,
    WorkforceJobAcceptOfferView,
    WorkforceJobCancelAssignmentView,
    WorkforceJobRejectOfferView,
    WorkforceDispatchEligibleListView,
    WorkforceAdminExtensionDecideView,
    WorkforceAdminPendingExtensionsListView,
    WorkforceAdminAssignSpecialistView,
    WorkforceLeaveListView,
    WorkforceAdminLeaveDecideView,
    WorkforceFleetMapView,
    WorkforceJobLiveTrackingView,
    WorkforceSkillManageView,
    WorkforceEmployeeSkillAssignView,
    WorkforceComplianceRequirementView,
    WorkforceEmployeeComplianceView,
    WorkforceAdminPayrollListView,
    WorkforceAdminPayrollProcessView,
    WorkforceReportsView,
    WorkforceAdminChangeRequestsListView,
    WorkforceAdminChangeRequestDecideView,
    WorkforceAdminLocationToggleView,
    WorkforceAdminLocationAssignEmployeeView,
)
from workforce_api.services.automatic_dispatch import get_eligible_candidates, dispatch_job

User = get_user_model()
factory = APIRequestFactory()


def run_tests():
    print("=" * 80)
    print("RUNNING PHASE 1 MULTI-TENANT ISOLATION AND AUTHORIZATION TEST SUITE")
    print("=" * 80)

    ts = int(timezone.now().timestamp())

    # 1. Setup Tenants (Vendors)
    vendor_a = Company.objects.create(
        company_name=f"Vendor Alpha {ts}",
        display_id=f"VEND-A-{ts}",
        is_active=True,
    )
    vendor_b = Company.objects.create(
        company_name=f"Vendor Beta {ts}",
        display_id=f"VEND-B-{ts}",
        is_active=True,
    )

    # 2. Setup Admin Users
    admin_a_user = User.objects.create_user(
        username=f"admin_a_{ts}",
        email=f"admin_a_{ts}@vendor-alpha.com",
        password="TestPassword123!",
        role="admin",
        company=vendor_a,
    )
    admin_b_user = User.objects.create_user(
        username=f"admin_b_{ts}",
        email=f"admin_b_{ts}@vendor-beta.com",
        password="TestPassword123!",
        role="admin",
        company=vendor_b,
    )
    admin_unassigned = User.objects.create_user(
        username=f"admin_unassigned_{ts}",
        email=f"unassigned_{ts}@calservice.com",
        password="TestPassword123!",
        role="admin",
        company=None,
    )
    platform_admin = User.objects.create_superuser(
        username=f"superadmin_{ts}",
        email=f"superadmin_{ts}@platform.com",
        password="SuperPassword123!",
    )

    # 3. Setup Technicians
    tech_a_user = User.objects.create_user(
        username=f"tech_a_{ts}",
        email=f"tech_a_{ts}@vendor-alpha.com",
        password="TestPassword123!",
        role="employee",
        company=vendor_a,
    )
    tech_a = Employee.objects.create(
        user=tech_a_user,
        company=vendor_a,
        employee_id=f"EMP-A-{ts}",
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "approved",
                "services": [{"id": 1, "name": "AC Repair", "status": "approved"}],
                "documents": {"aadhaar": {"status": "approved"}},
            },
            "leaves": [{"id": 1, "status": "submitted", "leave_type": "Sick Leave"}],
        },
    )

    tech_b_user = User.objects.create_user(
        username=f"tech_b_{ts}",
        email=f"tech_b_{ts}@vendor-beta.com",
        password="TestPassword123!",
        role="employee",
        company=vendor_b,
    )
    tech_b = Employee.objects.create(
        user=tech_b_user,
        company=vendor_b,
        employee_id=f"EMP-B-{ts}",
        is_active=True,
        is_online=True,
        current_availability="available",
        bank_details={
            "onboarding": {
                "status": "submitted",
                "services": [{"id": 2, "name": "Plumbing", "status": "pending"}],
                "documents": {"aadhaar": {"status": "submitted"}},
            },
            "leaves": [{"id": 1, "status": "submitted", "leave_type": "Casual Leave"}],
        },
    )

    # 4. Setup Jobs
    customer_user = User.objects.create_user(
        username=f"customer_{ts}",
        email=f"customer_{ts}@customer.com",
        password="CustomerPassword123!",
        role="customer",
    )
    job_a = ServiceRequest.objects.create(
        request_id=f"JOB-A-{ts}",
        customer=customer_user,
        company=vendor_a,
        service_category="AC Repair",
        status="assigned",
        assigned_employee=tech_a,
        total_amount=Decimal("1500.00"),
    )
    job_b = ServiceRequest.objects.create(
        request_id=f"JOB-B-{ts}",
        customer=customer_user,
        company=vendor_b,
        service_category="Plumbing",
        status="assigned",
        assigned_employee=tech_b,
        total_amount=Decimal("2000.00"),
    )

    passed_tests = 0
    total_tests = 0

    def assert_test(condition, name, details=""):
        nonlocal passed_tests, total_tests
        total_tests += 1
        if condition:
            passed_tests += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name} - {details}")
            raise AssertionError(f"Test failed: {name}. Details: {details}")

    print("\n--- TEST 1: Fail-Closed Tenant Context for Unassigned Admin ---")
    req = factory.get("/workforce/admin/applications/pending/")
    force_authenticate(req, user=admin_unassigned)
    res = WorkforceAdminApplicationDetailView().get(req, pk=tech_a.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "TENANT_REQUIRED",
                "Unassigned Admin cannot query technician without company context")

    print("\n--- TEST 2: Cross-Tenant Admin Application Detail View Access Blocked ---")
    req = factory.get(f"/workforce/admin/applications/{tech_b.id}/")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminApplicationDetailView().get(req, pk=tech_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot view Tech B application details")

    print("\n--- TEST 3: Cross-Tenant Document Verification Blocked ---")
    req = factory.post(f"/workforce/admin/applications/{tech_b.id}/verify-document/", {"category": "aadhaar", "action": "approve"}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminDocumentVerifyView().post(req, pk=tech_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot verify documents for Tech B")

    print("\n--- TEST 4: Cross-Tenant Service Decision Blocked ---")
    req = factory.post(f"/workforce/admin/candidates/{tech_b.id}/services/2/decide/", {"action": "approve"}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminServiceDecideView().post(req, pk=tech_b.id, service_id=2)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot decide services for Tech B")

    print("\n--- TEST 5: Cross-Tenant Application Approval Blocked ---")
    req = factory.post(f"/workforce/admin/applications/{tech_b.id}/approve/", {}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminApproveApplicationView().post(req, pk=tech_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot approve candidate Tech B")

    print("\n--- TEST 6: Cross-Tenant Technician Job Acceptance Blocked ---")
    req = factory.post(f"/workforce/jobs/{job_b.id}/accept/", {}, format="json")
    force_authenticate(req, user=tech_a_user)
    res = WorkforceJobAcceptOfferView().post(req, pk=job_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Tech A cannot accept Job B from Vendor B")

    print("\n--- TEST 7: Cross-Tenant Cash Collection Blocked ---")
    req = factory.post(f"/workforce/jobs/{job_b.id}/payment/cash-collect/", {"amount": "2000.00"}, format="json")
    force_authenticate(req, user=tech_a_user)
    res = WorkforceJobCashCollectView().post(req, pk=job_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") in ["CROSS_TENANT_FORBIDDEN", None],
                "Tech A cannot record cash collection for Job B")

    print("\n--- TEST 8: Cross-Tenant Admin Work Extension Decision Blocked ---")
    ext_b = WorkforceWorkExtension.objects.create(
        job=job_b,
        technician=tech_b,
        company=vendor_b,
        title="Pipe Replacement",
        reason="Broken pipe",
        requested_amount=500.0,
        status="REQUESTED",
    )
    req = factory.post(f"/workforce/admin/jobs/{job_b.id}/extensions/{ext_b.id}/decide/", {"action": "APPROVED"}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminExtensionDecideView().post(req, pk=job_b.id, ext_id=ext_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot decide extension on Job B")

    print("\n--- TEST 9: Cross-Tenant Specialist Assignment Blocked ---")
    ext_b.status = "PENDING_ASSIGNMENT"
    ext_b.requires_specialist = True
    ext_b.save()
    req = factory.post(f"/workforce/admin/jobs/{job_b.id}/extensions/{ext_b.id}/assign-specialist/", {"specialist_employee_id": tech_a.id}, format="json")
    force_authenticate(req, user=admin_b_user)
    res = WorkforceAdminAssignSpecialistView().post(req, pk=job_b.id, ext_id=ext_b.id)
    assert_test(res.status_code == status.HTTP_400_BAD_REQUEST and res.data.get("code") == "CROSS_TENANT_ASSIGNMENT_FORBIDDEN",
                "Vendor B Admin cannot assign Tech A (from Vendor A) as specialist to Job B")

    print("\n--- TEST 10: Cross-Tenant Leave Decision Blocked ---")
    req = factory.post(f"/workforce/admin/leaves/{tech_b.id}/1/decide/", {"action": "approve"}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminLeaveDecideView().post(req, emp_id=tech_b.id, leave_id=1)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot decide leave request of Tech B")

    print("\n--- TEST 11: Cross-Tenant Payroll Processing Blocked ---")
    period_b = WorkforcePayPeriod.objects.create(
        company=vendor_b,
        name=f"Period Beta {ts}",
        start_date=timezone.now().date(),
        end_date=timezone.now().date(),
        status="DRAFT",
    )
    req = factory.post(f"/workforce/admin/payroll/{period_b.id}/process/", {}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminPayrollProcessView().post(req, period_id=period_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot process payroll for Vendor B")

    print("\n--- TEST 12: Cross-Tenant Change Request Decision Blocked ---")
    cr_b = WorkforceEmployeeChangeRequest.objects.create(
        employee=tech_b,
        company=vendor_b,
        field_name="first_name",
        field_label="First Name",
        old_value="Beta",
        new_value="BetaUpdated",
        reason="Legal name change",
        status="PENDING",
    )
    req = factory.post(f"/workforce/admin/change-requests/{cr_b.id}/decide/", {"action": "APPROVE"}, format="json")
    force_authenticate(req, user=admin_a_user)
    res = WorkforceAdminChangeRequestDecideView().post(req, pk=cr_b.id)
    assert_test(res.status_code == status.HTTP_403_FORBIDDEN and res.data.get("code") == "CROSS_TENANT_FORBIDDEN",
                "Admin A cannot decide Change Request of Tech B")

    print("\n--- TEST 13: Superuser Cross-Tenant Capability ---")
    req = factory.get(f"/workforce/admin/applications/{tech_b.id}/")
    force_authenticate(req, user=platform_admin)
    res = WorkforceAdminApplicationDetailView().get(req, pk=tech_b.id)
    assert_test(res.status_code == status.HTTP_200_OK,
                "Platform Superadmin has cross-tenant audit access to Tech B application")

    print("\n--- TEST 14: Automatic Dispatch Tenant Isolation ---")
    # Verify get_eligible_candidates for Job A only returns Tech A and NEVER Tech B
    candidates_job_a = get_eligible_candidates(job_a)
    candidate_ids_a = [c.id for c in candidates_job_a]
    assert_test(tech_a.id in candidate_ids_a and tech_b.id not in candidate_ids_a,
                "Automatic Dispatch candidate pool for Job A contains Tech A and strictly excludes Tech B")

    print("\n--- TEST 15: Automatic Dispatch Dispatches Strictly Within Tenant ---")
    dispatch_success, dispatch_msg = dispatch_job(job_a)
    job_a.refresh_from_db()
    offers_a = WorkforceJobOffer.objects.filter(job=job_a)
    offered_emp_ids = [o.employee_id for o in offers_a]
    assert_test(tech_b.id not in offered_emp_ids,
                "Automatic dispatch creates job offers strictly for Vendor A employees, never Vendor B")

    print("\n" + "=" * 80)
    print(f"ALL {passed_tests}/{total_tests} PHASE 1 TENANT HARDENING TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
