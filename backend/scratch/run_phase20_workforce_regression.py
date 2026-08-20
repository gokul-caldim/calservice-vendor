import os
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User
from employees.models import Employee
from rest_framework_simplejwt.tokens import RefreshToken

print("============================================================")
print("PHASE 20 — FULL WORKFORCE REGRESSION VERIFICATION SUITE")
print("============================================================")

client = APIClient()

# 1. Admin Authentication
login_res = client.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")
assert login_res.status_code == 200, f"Admin login failed: {login_res.data}"
admin_token = login_res.data["access_token"]
admin_client = APIClient()
admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}", HTTP_HOST="localhost")

# 2. Technician Authentication
tech_emp = Employee.objects.filter(is_active=True, user__is_active=True).select_related("user", "company").first()
assert tech_emp and tech_emp.user, "No active technician found"
ref = RefreshToken.for_user(tech_emp.user)
ref["role"] = "employee"
if tech_emp.company_id:
    ref["company_id"] = tech_emp.company_id
tech_token = str(ref.access_token)
tech_client = APIClient()
tech_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tech_token}", HTTP_HOST="localhost")

tests = [
    # A. Auth & Profile
    ("Admin /auth/me/", lambda: admin_client.get("/api/auth/me/")),
    ("Technician /auth/me/", lambda: tech_client.get("/api/auth/me/")),
    ("Technician Onboarding Profile", lambda: tech_client.get("/api/workforce/onboarding/me/")),
    
    # B. Jobs & Dispatch
    ("Admin Jobs List", lambda: admin_client.get("/api/workforce/jobs/")),
    ("Technician Jobs List", lambda: tech_client.get("/api/workforce/jobs/")),
    ("Service Catalog", lambda: tech_client.get("/api/workforce/catalog/")),
    ("Dispatch Eligible Technicians", lambda: admin_client.get("/api/workforce/dispatch/eligible-technicians/")),
    
    # C. Operations & Tracking
    ("Fleet Map", lambda: admin_client.get("/api/workforce/presence/fleet-map/")),
    ("Time Tracking Status", lambda: tech_client.get("/api/workforce/time-tracking/")),
    ("Notifications List", lambda: tech_client.get("/api/workforce/notifications/")),
    ("Leave Balance & Requests", lambda: tech_client.get("/api/workforce/leaves/")),
    ("My Skills", lambda: tech_client.get("/api/workforce/skills/me/")),
    ("My Schedule", lambda: tech_client.get("/api/workforce/schedules/me/")),
    ("Compliance Requirements", lambda: admin_client.get("/api/workforce/compliance/requirements/")),
    
    # D. Admin Features
    ("Admin Applications List", lambda: admin_client.get("/api/workforce/admin/applications/")),
    ("Admin Payroll List", lambda: admin_client.get("/api/workforce/payroll/periods/")),
    ("Admin Pending Services", lambda: admin_client.get("/api/workforce/admin/services/pending-requests/")),
    ("Admin Pending Extensions", lambda: admin_client.get("/api/workforce/admin/extensions/pending/")),
    ("Admin Change Requests", lambda: admin_client.get("/api/workforce/admin/change-requests/")),
    ("Reports Summary", lambda: admin_client.get("/api/workforce/reports/")),
]

passed = 0
for name, runner in tests:
    try:
        t0 = time.time()
        resp = runner()
        dur = int((time.time() - t0) * 1000)
        status_code = resp.status_code
        if status_code in [200, 201, 204]:
            print(f"[PASS] {name:<35} -> HTTP {status_code} ({dur}ms)")
            passed += 1
        else:
            print(f"[FAIL] {name:<35} -> HTTP {status_code} ({dur}ms) - {getattr(resp, 'data', resp.content)}")
    except Exception as e:
        print(f"[FAIL] {name:<35} -> Exception: {e}")

print(f"\n============================================================")
print(f"PHASE 20 SUMMARY: {passed}/{len(tests)} TESTS PASSED ({int(passed/len(tests)*100)}%)")
print("============================================================")
assert passed == len(tests), f"Only {passed}/{len(tests)} passed in Phase 20"
