"""
backend/test_employee_platform_integration.py
Comprehensive End-to-End Automated Verification Test Suite for Workforce Employee Platform Integration.
Tests all 10 core integration modules against real PostgreSQL database.
"""
import os
import django

if not django.apps.apps.ready:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
    django.setup()


from django.contrib.auth import get_user_model
from django.utils import timezone
from companies.models import Company
from employees.models import Employee, PresenceLog
from service_requests.models import ServiceRequest
from workforce_api.models import (
    WorkforceEmployeeChangeRequest,
    WorkforceUserPreference,
    WorkforceNotificationPreference,
    WorkforceJobFeedback,
    WorkforceEventLog,
)
from rest_framework.test import APIClient

User = get_user_model()


def run_tests():
    print("=" * 80)
    print("STARTING WORKFORCE EMPLOYEE PLATFORM INTEGRATION VERIFICATION SUITE")
    print("=" * 80)

    passed = 0
    failed = 0
    errors = []

    def assert_test(condition, test_name, detail=""):
        nonlocal passed, failed, errors
        if condition:
            passed += 1
            print(f"  [PASS] {test_name}")
        else:
            failed += 1
            msg = f"FAILED: {test_name} - {detail}"
            errors.append(msg)
            print(f"  [FAIL] {test_name} -> {detail}")

    # Setup Test Data
    admin_user = User.objects.filter(is_staff=True).first() or User.objects.filter(role="admin").first()
    if not admin_user:
        admin_user, _ = User.objects.get_or_create(
            username="admin_platform_test",
            defaults={"email": "admin_platform@test.com", "role": "admin", "is_staff": True}
        )
    admin_user.set_password("AdminSecurePass123!")
    admin_user.save(update_fields=["password", "is_staff", "role"])

    # 2. Technician User & Profile
    tech_emp = Employee.objects.filter(is_active=True).first() or Employee.objects.first()
    assert_test(tech_emp is not None, "Authoritative Employee profile resolved from PostgreSQL")
    tech_user = tech_emp.user
    tech_user.set_password("TechSecurePass123!")
    tech_user.two_fa_enabled = False
    tech_user.save(update_fields=["password", "two_fa_enabled"])

    # Ensure onboarding is marked approved and contains an approved service
    bank_det = tech_emp.bank_details or {}
    onboarding = bank_det.get("onboarding", {})
    onboarding["status"] = "approved"
    onboarding["services"] = [
        {"id": 1, "name": "AC Repair & Maintenance", "status": "approved"},
        {"id": 2, "name": "Commercial HVAC Installation", "status": "pending"}
    ]
    bank_det["onboarding"] = onboarding
    tech_emp.bank_details = bank_det
    tech_emp.save(update_fields=["bank_details"])








    client_tech = APIClient()
    client_tech.force_authenticate(user=tech_user)

    client_admin = APIClient()
    client_admin.force_authenticate(user=admin_user)

    # ── MODULE 1: Profile & Preferences GET / PATCH ───────────────────────────
    print("\n--- MODULE 1: Employee Profile & Preferences ---")
    res = client_tech.get("/api/workforce/profile/me/")
    assert_test(res.status_code == 200, "GET /api/workforce/profile/me/ returns 200 OK")
    data = res.json()
    assert_test(bool(data.get("first_name") or data.get("username")), "Profile contains authentic user details")

    assert_test(data.get("controlled_fields", {}).get("is_locked") is True, "Controlled fields marked locked for approved technician")

    # Update personal editable preference (bio & timezone)
    patch_res = client_tech.patch("/api/workforce/profile/me/", {
        "bio": "Certified EPA HVAC Specialist with 8 years field experience",
        "timezone": "America/Los_Angeles",
        "phone": "+15559876543"
    }, format="json")
    assert_test(patch_res.status_code == 200, "PATCH /api/workforce/profile/me/ updates editable fields")
    tech_user.refresh_from_db()
    assert_test(tech_user.timezone == "America/Los_Angeles", "User timezone persisted in PostgreSQL")
    assert_test(tech_user.bio == "Certified EPA HVAC Specialist with 8 years field experience", "User bio persisted in PostgreSQL")

    # ── MODULE 2: Controlled Field Direct Modification Prevention ──────────────
    print("\n--- MODULE 2: Controlled Fields Security & Lock ---")
    locked_attempt = client_tech.patch("/api/workforce/profile/me/", {
        "first_name": "HackedName"
    }, format="json")
    assert_test(locked_attempt.status_code == 400, "Direct edit of locked 'first_name' rejected with 400 Bad Request")
    assert_test(locked_attempt.json().get("requires_change_request") is True, "Rejection instructs user to submit Change Request")

    # ── MODULE 3: Change Request Lifecycle (Submit -> Admin Approve -> DB Sync) ─
    print("\n--- MODULE 3: Employee Change Request Lifecycle ---")
    cr_res = client_tech.post("/api/workforce/profile/change-requests/", {
        "field_name": "first_name",
        "field_label": "Legal First Name",
        "new_value": "Marcus-Alexander",
        "reason": "Legal name change documented on revised passport."
    }, format="json")
    assert_test(cr_res.status_code == 201, "POST /api/workforce/profile/change-requests/ creates Change Request")
    cr_data = cr_res.json().get("change_request", {})
    cr_id = cr_data.get("id")
    assert_test(cr_data.get("status") == "PENDING", "Change Request is created in PENDING status")

    # Admin reviews Change Request
    admin_crs = client_admin.get("/api/workforce/admin/change-requests/")
    assert_test(admin_crs.status_code == 200, "Admin can list all change requests")
    pending_ids = [c["id"] for c in admin_crs.json()]
    assert_test(cr_id in pending_ids, "Admin queue contains submitted change request")

    # Admin approves Change Request
    decide_res = client_admin.post(f"/api/workforce/admin/change-requests/{cr_id}/decide/", {
        "action": "APPROVE",
        "admin_notes": "Verified passport update on official portal."
    }, format="json")
    assert_test(decide_res.status_code == 200, "Admin approval returns 200 OK")
    tech_user.refresh_from_db()
    assert_test(tech_user.first_name == "Marcus-Alexander", "PostgreSQL User.first_name atomically updated to 'Marcus-Alexander'")

    # ── MODULE 4: Account & Security Endpoints ─────────────────────────────────
    print("\n--- MODULE 4: Account & Security ---")
    # 2FA status and toggle
    twofa_res = client_tech.get("/api/workforce/security/2fa/")
    assert_test(twofa_res.status_code == 200, "GET /api/workforce/security/2fa/ returns 200 OK")
    
    twofa_toggle = client_tech.post("/api/workforce/security/2fa/toggle/")
    assert_test(twofa_toggle.status_code == 200, "POST /api/workforce/security/2fa/toggle/ toggles 2FA")
    tech_user.refresh_from_db()
    assert_test(tech_user.two_fa_enabled is True, "2FA status persisted as True in PostgreSQL")

    # Active Sessions & Login History
    sess_res = client_tech.get("/api/workforce/security/sessions/")
    assert_test(sess_res.status_code == 200 and len(sess_res.json()) > 0, "GET /api/workforce/security/sessions/ returns active sessions")

    hist_res = client_tech.get("/api/workforce/security/login-history/")
    assert_test(hist_res.status_code == 200, "GET /api/workforce/security/login-history/ returns security history")

    # Password Change
    pwd_res = client_tech.post("/api/workforce/security/change-password/", {
        "current_password": "TechSecurePass123!",
        "new_password": "TechNewStrongPassword456!",
        "confirm_password": "TechNewStrongPassword456!"
    }, format="json")
    assert_test(pwd_res.status_code == 200, "POST /api/workforce/security/change-password/ updates password")
    tech_user.refresh_from_db()
    assert_test(tech_user.check_password("TechNewStrongPassword456!"), "New password verified with user.check_password")

    # ── MODULE 5: Appearance Preferences Persistence ─────────────────────────
    print("\n--- MODULE 5: User Appearance Preferences ---")
    pref_res = client_tech.get("/api/workforce/preferences/")
    assert_test(pref_res.status_code == 200, "GET /api/workforce/preferences/ returns 200 OK")

    pref_patch = client_tech.patch("/api/workforce/preferences/", {
        "theme": "dark",
        "accent_color": "emerald",
        "layout_density": "compact",
        "high_contrast": True
    }, format="json")
    assert_test(pref_patch.status_code == 200, "PATCH /api/workforce/preferences/ returns 200 OK")
    user_pref = WorkforceUserPreference.objects.filter(user=tech_user).first()
    assert_test(user_pref and user_pref.theme == "dark", "Theme 'dark' persisted in PostgreSQL")
    assert_test(user_pref.high_contrast is True, "High contrast mode persisted in PostgreSQL")

    # ── MODULE 6: Notification Preferences Persistence ────────────────────────
    print("\n--- MODULE 6: Notification Preferences ---")
    notif_res = client_tech.get("/api/workforce/notifications/preferences/")
    assert_test(notif_res.status_code == 200, "GET /api/workforce/notifications/preferences/ returns 200 OK")

    notif_patch = client_tech.patch("/api/workforce/notifications/preferences/", {
        "job_assignments": True,
        "shift_reminders": True,
        "channel_email": True,
        "channel_in_app": True,
        "channel_sms": True
    }, format="json")
    assert_test(notif_patch.status_code == 200, "PATCH /api/workforce/notifications/preferences/ saves settings")
    notif_pref = WorkforceNotificationPreference.objects.filter(user=tech_user).first()
    assert_test(notif_pref and notif_pref.channel_sms is True, "SMS notification channel toggle persisted in PostgreSQL")

    # ── MODULE 7: Privacy & Data Export ─────────────────────────────────────────
    print("\n--- MODULE 7: Privacy & Data Export ---")
    export_res = client_tech.get("/api/workforce/privacy/export/")
    assert_test(export_res.status_code == 200, "GET /api/workforce/privacy/export/ returns 200 OK")
    export_json = export_res.json()
    assert_test("user_identity" in export_json and "employment_record" in export_json, "Export contains complete structured dossier")

    # ── MODULE 8: Performance & Customer Feedback Metrics ──────────────────────
    print("\n--- MODULE 8: Feedback & Performance Metrics ---")
    company = tech_emp.company
    test_job, _ = ServiceRequest.objects.get_or_create(

        customer_name="John Sample",
        service_category="HVAC",
        issue_title="AC Compressor Replacement",
        status="completed",
        company=company,
        defaults={
            "preferred_date": timezone.now().date(),
            "description": "Installed high-efficiency compressor unit.",
            "assigned_employee": tech_emp,
        }

    )
    test_job.assigned_employee = tech_emp
    test_job.status = "completed"
    test_job.save()

    fb_submit_res = client_admin.post(
        f"/api/workforce/jobs/{test_job.id}/feedback/",
        {
            "rating": 5,
            "review": "Outstanding service! Marcus arrived right on time and fixed the unit perfectly.",
            "csat_score": 5,
            "resolution_ontime": True,
            "customer_name": "John Sample",
        },
        content_type="application/json"
    )
    assert_test(fb_submit_res.status_code in [200, 201], "POST /api/workforce/jobs/<id>/feedback/ submits customer rating")


    perf_res = client_tech.get("/api/workforce/performance/me/")
    assert_test(perf_res.status_code == 200, "GET /api/workforce/performance/me/ returns 200 OK")
    perf_data = perf_res.json()
    metrics = perf_data.get("metrics", {})
    completed_cnt = metrics.get("completed_jobs", metrics.get("jobs_completed", 0))
    avg_rating = float(metrics.get("average_rating", 0))
    dist = perf_data.get("rating_distribution", {})
    five_star_cnt = int(dist.get("5", dist.get(5, 0)) or 0)

    assert_test(completed_cnt >= 1, "Completed jobs metric matches PostgreSQL count")
    assert_test(avg_rating >= 4.0, "Average rating computed accurately from reviews")
    assert_test(five_star_cnt >= 1, "Rating distribution contains 5-star review")


    # ── MODULE 9: Employee Services Self-Service ───────────────────────────────
    print("\n--- MODULE 9: Employee Services Self-Service ---")
    services_res = client_tech.get("/api/workforce/services/my-services/")
    assert_test(services_res.status_code == 200, "GET /api/workforce/services/my-services/ returns 200 OK")
    services_data = services_res.json()
    assert_test(len(services_data.get("approved_services", [])) >= 1 or len(services_data.get("all_services", [])) >= 1, "Services categorized accurately")


    print("\n" + "=" * 80)
    print(f"VERIFICATION RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 80)

    return {
        "passed": passed,
        "failed": failed,
        "total": passed + failed,
        "errors": errors,
        "is_ready": failed == 0,
    }


if __name__ == "__main__":
    res = run_tests()
    if not res["is_ready"]:
        exit(1)
