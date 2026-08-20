"""
backend/test_registration_status_and_routing.py
Comprehensive test suite for registration status resolution and backend routing guarantees.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.conf import settings
if "testserver" not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append("testserver")
if "localhost" not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append("localhost")

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory
from employees.models import Employee
from companies.models import Company, Region
from workforce_api.services.registration import (
    get_employee_registration_status,
    get_employee_onboarding_dict,
    is_employee_approved,
    REGISTRATION_STATUS_APPROVED,
    REGISTRATION_STATUS_SUBMITTED,
    REGISTRATION_STATUS_CORRECTION_REQUIRED,
    REGISTRATION_STATUS_REJECTED,
    REGISTRATION_STATUS_IN_PROGRESS,
    REGISTRATION_STATUS_NOT_STARTED,
)
from workforce_api.serializers import WorkforceEmployeeProfileSerializer

User = get_user_model()


def run_tests():
    print("=========================================================================")
    print("      TEST SUITE: REGISTRATION STATUS RESOLUTION & BACKEND ROUTING       ")
    print("=========================================================================")

    # Setup test company
    region = Region.objects.first()
    if not region:
        region = Region.objects.create(code="US", name="United States")
    company, _ = Company.objects.get_or_create(
        display_id="COMP-TEST-ROUTING",
        defaults={"company_name": "Test Routing Company", "region": region}
    )

    # 1. Test Admin User Status
    admin_user, _ = User.objects.get_or_create(
        username="test_admin_routing_user",
        defaults={
            "email": "admin_routing@caltrack.io",
            "role": "admin",
            "is_active": True,
            "company": company,
        }
    )
    admin_status = get_employee_registration_status(admin_user)
    assert admin_status == REGISTRATION_STATUS_APPROVED, f"Expected admin status 'approved', got {admin_status}"
    print("[PASS] Test 1: Admin status resolves to 'approved'")

    # 2. Test Incomplete / Not Started Employee
    inc_user, _ = User.objects.get_or_create(
        username="test_inc_routing_user",
        defaults={
            "email": "inc_routing@caltrack.io",
            "role": "employee",
            "is_active": True,
            "company": company,
        }
    )
    inc_emp, _ = Employee.objects.get_or_create(
        user=inc_user,
        defaults={
            "employee_id": "EMP-INC-001",
            "company": company,
            "bank_details": {"onboarding": {"status": "not_started", "step": 1}},
        }
    )
    inc_emp.bank_details = {"onboarding": {"status": "not_started", "step": 1}}
    inc_emp.save()
    inc_status = get_employee_registration_status(inc_emp)
    assert inc_status == REGISTRATION_STATUS_NOT_STARTED, f"Expected incomplete status 'not_started', got {inc_status}"
    print("[PASS] Test 2: Incomplete employee status resolves to 'not_started'")

    # 3. Test In-Progress Employee
    inc_emp.bank_details = {"onboarding": {"status": "in_progress", "step": 3}}
    inc_emp.save()
    in_prog_status = get_employee_registration_status(inc_emp)
    assert in_prog_status == REGISTRATION_STATUS_IN_PROGRESS, f"Expected 'in_progress', got {in_prog_status}"
    print("[PASS] Test 3: In-progress employee status resolves to 'in_progress'")

    # 4. Test Submitted / Under Review Employee
    sub_user, _ = User.objects.get_or_create(
        username="test_sub_routing_user",
        defaults={
            "email": "sub_routing@caltrack.io",
            "role": "employee",
            "is_active": True,
            "company": company,
        }
    )
    sub_emp, _ = Employee.objects.get_or_create(
        user=sub_user,
        defaults={
            "employee_id": "EMP-SUB-001",
            "company": company,
            "bank_details": {"onboarding": {"status": "submitted", "step": 7}},
        }
    )
    sub_emp.bank_details = {"onboarding": {"status": "submitted", "step": 7}}
    sub_emp.save()
    sub_status = get_employee_registration_status(sub_emp)
    assert sub_status == REGISTRATION_STATUS_SUBMITTED, f"Expected 'submitted', got {sub_status}"
    assert not is_employee_approved(sub_emp), "Submitted employee should not be approved"
    print("[PASS] Test 4: Submitted employee status resolves to 'submitted'")

    # 5. Test Correction Required Employee
    corr_user, _ = User.objects.get_or_create(
        username="test_corr_routing_user",
        defaults={
            "email": "corr_routing@caltrack.io",
            "role": "employee",
            "is_active": True,
            "company": company,
        }
    )
    corr_emp, _ = Employee.objects.get_or_create(
        user=corr_user,
        defaults={
            "employee_id": "EMP-CORR-001",
            "company": company,
            "bank_details": {"onboarding": {"status": "correction_required", "correction_notes": "Re-upload ID"}},
        }
    )
    corr_emp.bank_details = {"onboarding": {"status": "correction_required", "correction_notes": "Re-upload ID"}}
    corr_emp.save()
    corr_status = get_employee_registration_status(corr_emp)
    assert corr_status == REGISTRATION_STATUS_CORRECTION_REQUIRED, f"Expected 'correction_required', got {corr_status}"
    print("[PASS] Test 5: Correction required employee status resolves to 'correction_required'")

    # 6. Test Approved Employee
    app_user, _ = User.objects.get_or_create(
        username="test_app_routing_user",
        defaults={
            "email": "app_routing@caltrack.io",
            "role": "employee",
            "is_active": True,
            "company": company,
        }
    )
    app_user.set_password("SecurePassword123!")
    app_user.save()
    app_emp, _ = Employee.objects.get_or_create(
        user=app_user,
        defaults={
            "employee_id": "EMP-APP-001",
            "company": company,
            "bank_details": {"onboarding": {"status": "approved", "approved_by": "admin"}},
        }
    )
    app_emp.bank_details = {"onboarding": {"status": "approved", "approved_by": "admin"}}
    app_emp.save()
    app_status = get_employee_registration_status(app_emp)
    assert app_status == REGISTRATION_STATUS_APPROVED, f"Expected 'approved', got {app_status}"
    assert is_employee_approved(app_emp), "Approved employee should return is_employee_approved=True"
    print("[PASS] Test 6: Approved employee status resolves to 'approved'")

    # 7. Test Serializer outputs canonical registration_status
    ser_data = WorkforceEmployeeProfileSerializer(app_emp).data
    assert ser_data.get("registration_status") == REGISTRATION_STATUS_APPROVED, f"Serializer returned {ser_data.get('registration_status')}"
    print("[PASS] Test 7: WorkforceEmployeeProfileSerializer returns canonical registration_status='approved'")

    # 8. Test /api/auth/login/ returns registration_status
    client = APIClient()
    login_resp = client.post("/api/auth/login/", {
        "identifier": app_user.username,
        "password": "SecurePassword123!",
    }, format="json")
    assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}: {login_resp.data}"
    user_data = login_resp.data.get("user", {})
    assert user_data.get("registration_status") == REGISTRATION_STATUS_APPROVED, f"Login payload registration_status was {user_data.get('registration_status')}"
    print("[PASS] Test 8: /api/auth/login/ returns registration_status in user payload")

    # 9. Test /api/auth/me/ returns registration_status
    client.force_authenticate(user=app_user)
    me_resp = client.get("/api/auth/me/")
    assert me_resp.status_code == 200, f"Me endpoint failed: {me_resp.data}"
    assert me_resp.data.get("registration_status") == REGISTRATION_STATUS_APPROVED, f"Me payload registration_status was {me_resp.data.get('registration_status')}"
    print("[PASS] Test 9: /api/auth/me/ returns registration_status in payload")

    # 10. Test /api/workforce/profile/me/ PATCH updates preferences without changing APPROVED status
    patch_resp = client.patch("/api/workforce/profile/me/", {
        "phone": "+1 555-0199",
        "bio": "Updated Master Technician bio",
        "timezone": "America/Los_Angeles",
    }, format="json")
    assert patch_resp.status_code == 200, f"Profile patch failed: {patch_resp.data}"
    app_emp.refresh_from_db()
    status_after_patch = get_employee_registration_status(app_emp)
    assert status_after_patch == REGISTRATION_STATUS_APPROVED, f"Expected status to remain 'approved', but became {status_after_patch}"
    print("[PASS] Test 10: Profile preferences patch preserves 'approved' status")

    # 11. Test /api/workforce/profile/me/ PATCH blocks direct modification of controlled fields
    blocked_patch = client.patch("/api/workforce/profile/me/", {
        "first_name": "NewNameWithoutApproval",
    }, format="json")
    assert blocked_patch.status_code == 400, "Controlled field should be blocked from direct editing"
    assert blocked_patch.data.get("requires_change_request") is True, "Controlled field edit should signal requires_change_request"
    print("[PASS] Test 11: Controlled identity fields correctly blocked from direct modification")

    print("\n=========================================================================")
    print("          ALL 11 BACKEND REGISTRATION STATUS TESTS PASSED!              ")
    print("=========================================================================")


if __name__ == "__main__":
    run_tests()
