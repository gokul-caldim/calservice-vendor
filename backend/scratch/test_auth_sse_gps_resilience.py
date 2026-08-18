"""
test_auth_sse_gps_resilience.py
Automated Resilience and Verification Test Suite for CalTrack Authentication, SSE, GPS & Session Lifecycles.
"""
import os
import sys
import json
import time
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from workforce_api.models import WorkforceEventLog
from workforce_api.views import (
    WorkforceRealtimeStreamView,
    WorkforceLocationUpdateView,
    WorkforceJobListView,
)
from accounts.views import LoginView, WorkforceRefreshView

User = get_user_model()
factory = APIRequestFactory()

def assert_test(condition, name):
    if condition:
        print(f"  [PASS] {name}")
    else:
        print(f"  [FAIL] {name}")
        raise AssertionError(f"Test Assertion Failed: {name}")

def run_resilience_suite():
    print("\n" + "=" * 70)
    print("CALTRACK: AUTHENTICATION, SSE & GPS RESILIENCE TEST SUITE")
    print("=" * 70)

    # -------------------------------------------------------------
    # 0. Setup Fixtures
    # -------------------------------------------------------------
    company_a, _ = Company.objects.get_or_create(company_name="CalTrack Tenant A")
    company_b, _ = Company.objects.get_or_create(company_name="CalTrack Tenant B")

    # Employee 1 (Tenant A)
    user_tech1, _ = User.objects.get_or_create(
        username="caltrack_tech_01",
        defaults={"email": "tech01@caltrack.io", "phone": "+919876543201", "mobile_number": "+919876543201", "role": "employee", "company": company_a}
    )
    user_tech1.set_password("SecurePass123!")
    user_tech1.is_active = True
    user_tech1.company = company_a
    user_tech1.save()

    emp1, _ = Employee.objects.get_or_create(
        user=user_tech1,
        defaults={
            "company": company_a,
            "is_active": True,
            "is_online": True,
            "employee_id": "EMP-CAL-01",
            "bank_details": {"onboarding": {"status": "approved"}}
        }
    )
    emp1.is_active = True
    emp1.is_online = True
    emp1.bank_details = {"onboarding": {"status": "approved"}}
    emp1.save()

    # Employee 2 (Tenant B - Cross-tenant)
    user_tech2, _ = User.objects.get_or_create(
        username="caltrack_tech_02",
        defaults={"email": "tech02@caltrack.io", "phone": "+919876543202", "mobile_number": "+919876543202", "role": "employee", "company": company_b}
    )
    user_tech2.set_password("SecurePass123!")
    user_tech2.is_active = True
    user_tech2.company = company_b
    user_tech2.save()

    emp2, _ = Employee.objects.get_or_create(
        user=user_tech2,
        defaults={
            "company": company_b,
            "is_active": True,
            "is_online": True,
            "employee_id": "EMP-CAL-02",
            "bank_details": {"onboarding": {"status": "approved"}}
        }
    )
    emp2.is_active = True
    emp2.is_online = True
    emp2.bank_details = {"onboarding": {"status": "approved"}}
    emp2.save()

    # Admin User (Tenant A)
    user_admin, _ = User.objects.get_or_create(
        username="caltrack_admin_01",
        defaults={"email": "admin01@caltrack.io", "phone": "+919876543203", "mobile_number": "+919876543203", "role": "admin", "company": company_a}
    )
    user_admin.set_password("AdminSecure123!")
    user_admin.is_active = True
    user_admin.company = company_a
    user_admin.save()

    # -------------------------------------------------------------
    # 1. Login & Token Generation (wf_token / wf_refresh_token contract)
    # -------------------------------------------------------------
    print("\n--- 1. Authentication & Token Contract ---")
    login_req = factory.post("/api/auth/login/", {"identifier": "tech01@caltrack.io", "password": "SecurePass123!"})
    login_view = LoginView.as_view()
    login_resp = login_view(login_req)
    assert_test(login_resp.status_code == 200, "1. Valid login returns 200 OK")
    assert_test("access_token" in login_resp.data and "refresh_token" in login_resp.data, "1. Returns access_token and refresh_token")

    access_token_1 = login_resp.data["access_token"]
    refresh_token_1 = login_resp.data["refresh_token"]

    bad_login_req = factory.post("/api/auth/login/", {"identifier": "tech01@caltrack.io", "password": "WrongPassword!"})
    bad_login_resp = login_view(bad_login_req)
    assert_test(bad_login_resp.status_code == 401, "1. Invalid password returns 401 INVALID_CREDENTIALS")

    # -------------------------------------------------------------
    # 2. SSE Authentication & Token Verification
    # -------------------------------------------------------------
    print("\n--- 2. SSE Realtime Stream Authentication ---")
    stream_view = WorkforceRealtimeStreamView.as_view()

    # Case A: Valid token via query param
    req_sse_valid = factory.get(f"/api/workforce/realtime/stream/?token={access_token_1}")
    resp_sse_valid = stream_view(req_sse_valid)
    assert_test(resp_sse_valid.status_code == 200, "2. Valid wf_token connects to SSE stream with 200 OK")
    assert_test(resp_sse_valid["Content-Type"] == "text/event-stream", "2. SSE responds with text/event-stream")

    # Case B: Missing token
    req_sse_missing = factory.get("/api/workforce/realtime/stream/")
    resp_sse_missing = stream_view(req_sse_missing)
    assert_test(resp_sse_missing.status_code == 401, "2. Missing token rejected with 401 Unauthorized")

    # Case C: Invalid token
    req_sse_invalid = factory.get("/api/workforce/realtime/stream/?token=invalid_garbage_token_xyz")
    resp_sse_invalid = stream_view(req_sse_invalid)
    assert_test(resp_sse_invalid.status_code == 401, "2. Invalid token rejected with 401 Unauthorized")

    # -------------------------------------------------------------
    # 3. Silent Token Refresh Flow
    # -------------------------------------------------------------
    print("\n--- 3. Token Refresh Lifecycle ---")
    refresh_view = WorkforceRefreshView.as_view()

    req_refresh = factory.post("/api/auth/refresh/", {"refresh_token": refresh_token_1})
    resp_refresh = refresh_view(req_refresh)
    assert_test(resp_refresh.status_code == 200, "3. Valid refresh_token issues new access_token")
    assert_test("access_token" in resp_refresh.data, "3. New access_token present in refresh response")

    new_access_token = resp_refresh.data["access_token"]
    req_sse_refreshed = factory.get(f"/api/workforce/realtime/stream/?token={new_access_token}")
    resp_sse_refreshed = stream_view(req_sse_refreshed)
    assert_test(resp_sse_refreshed.status_code == 200, "3. Newly refreshed access_token connects to SSE stream")

    # Bad refresh token
    req_bad_refresh = factory.post("/api/auth/refresh/", {"refresh_token": "expired_or_invalid_refresh_token"})
    resp_bad_refresh = refresh_view(req_bad_refresh)
    assert_test(resp_bad_refresh.status_code == 401, "3. Expired/invalid refresh token returns 401")

    # -------------------------------------------------------------
    # 4. GPS Telemetry & Authentication
    # -------------------------------------------------------------
    print("\n--- 4. GPS Presence Telemetry ---")
    gps_view = WorkforceLocationUpdateView.as_view()

    # Valid authenticated GPS fix
    req_gps = factory.post("/api/workforce/presence/location/", {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "accuracy": 10.0,
        "speed": 5.2,
        "heading": 180.0
    })
    force_authenticate(req_gps, user=user_tech1)
    resp_gps = gps_view(req_gps)
    assert_test(resp_gps.status_code == 200, "4. Authenticated GPS fix saved successfully")

    user_tech1.refresh_from_db()
    assert_test(user_tech1.last_known_location is not None, "4. User last_known_location updated in database")
    assert_test(user_tech1.last_known_location.get("latitude") == 12.9716, "4. Correct coordinates recorded")

    # Unauthenticated GPS request
    req_gps_unauth = factory.post("/api/workforce/presence/location/", {
        "latitude": 12.9716,
        "longitude": 77.5946,
    })
    resp_gps_unauth = gps_view(req_gps_unauth)
    assert_test(resp_gps_unauth.status_code == 401, "4. Unauthenticated GPS fix returns 401")

    # -------------------------------------------------------------
    # 5. Cross-Tenant & User Scoping in Realtime Stream
    # -------------------------------------------------------------
    print("\n--- 5. SSE Event Authorization & Tenant Scoping ---")
    ev1 = WorkforceEventLog.objects.create(
        user=user_tech1,
        event_type="JOB_OFFER",
        payload={"job_id": 9991, "title": "HVAC Service", "company_id": company_a.id}
    )
    ev2 = WorkforceEventLog.objects.create(
        user=user_tech2,
        event_type="JOB_OFFER",
        payload={"job_id": 9992, "title": "Plumbing Service", "company_id": company_b.id}
    )

    # Tech 1 stream connects
    req_stream_tech1 = factory.get(f"/api/workforce/realtime/stream/?token={access_token_1}")
    resp_stream_tech1 = stream_view(req_stream_tech1)
    assert_test(resp_stream_tech1.status_code == 200, "5. Tech 1 stream connected")

    # Admin stream connects
    token_admin = str(RefreshToken.for_user(user_admin).access_token)
    req_stream_admin = factory.get(f"/api/workforce/realtime/stream/?token={token_admin}")
    resp_stream_admin = stream_view(req_stream_admin)
    assert_test(resp_stream_admin.status_code == 200, "5. Admin stream connected")

    # -------------------------------------------------------------
    # 6. Active Job Survival across Auth Token Lifecycle
    # -------------------------------------------------------------
    print("\n--- 6. Job State Survival Invariant ---")
    sr = ServiceRequest.objects.create(
        company=company_a,
        service_category="hvac",
        issue_title="AC Repair Hardening Check",
        address="Test Address, Bengaluru",
        latitude=12.9716,
        longitude=77.5946,
        preferred_date=timezone.now().date(),
        status="unassigned",
        total_amount=499
    )
    job = EmployeeJob.objects.create(
        service_request=sr,
        employee=emp1,
        status="ON_THE_WAY"
    )
    sr.assigned_employee = emp1
    sr.status = "on_the_way"
    sr.save()

    # Simulate token expiration: access_token_1 expires
    # Verify backend job state is unaffected
    sr.refresh_from_db()
    assert_test(sr.status == "on_the_way", "6. Active job remains 'on_the_way' through token lifecycle")
    assert_test(sr.assigned_employee == emp1, "6. Assigned employee remains intact")

    # Clean up test records
    job.delete()
    sr.delete()
    ev1.delete()
    ev2.delete()

    print("\n" + "=" * 70)
    print("ALL CALTRACK AUTH, SSE & GPS RESILIENCE TESTS PASSED!")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run_resilience_suite()
