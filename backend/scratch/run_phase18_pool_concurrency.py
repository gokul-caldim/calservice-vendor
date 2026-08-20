import os
import sys
import threading
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

# Admin login
client_auth = APIClient()
login_res = client_auth.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")
admin_token = login_res.data.get("access_token")
assert login_res.status_code == 200 and admin_token, f"Admin login failed: {login_res.data}"

# Find active technician user
tech_emp = Employee.objects.filter(is_active=True, user__is_active=True).select_related("user").first()
tech_user = tech_emp.user if tech_emp else None
tech_token = None
if tech_user:
    from rest_framework_simplejwt.tokens import RefreshToken
    ref = RefreshToken.for_user(tech_user)
    ref["role"] = "employee"
    if tech_emp.company_id:
        ref["company_id"] = tech_emp.company_id
    tech_token = str(ref.access_token)

endpoints = [
    ("POST", "/api/auth/login/", {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"}, None),
    ("GET", "/api/auth/me/", None, admin_token),
    ("GET", "/api/workforce/jobs/", None, admin_token),
    ("GET", "/api/workforce/notifications/", None, admin_token),
    ("GET", "/api/workforce/time-tracking/", None, tech_token or admin_token),
    ("GET", "/api/workforce/presence/status/", None, tech_token or admin_token),
]

def run_pool_test(concurrency_level):
    results = []
    
    def worker(worker_id):
        c = APIClient()
        method, path, payload, token = endpoints[worker_id % len(endpoints)]
        headers = {"HTTP_HOST": "localhost"}
        if token:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
            
        t0 = time.time()
        try:
            if method == "POST":
                resp = c.post(path, payload, format="json", **headers)
            else:
                resp = c.get(path, **headers)
            t1 = time.time()
            results.append({
                "worker": worker_id,
                "status": resp.status_code,
                "duration_ms": int((t1 - t0) * 1000),
                "path": path,
                "success": resp.status_code in [200, 201, 204]
            })
        except Exception as e:
            t1 = time.time()
            results.append({
                "worker": worker_id,
                "status": 0,
                "duration_ms": int((t1 - t0) * 1000),
                "path": path,
                "error": str(e),
                "success": False
            })

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(concurrency_level)]
    t_start = time.time()
    for t in threads: t.start()
    for t in threads: t.join()
    t_total = int((time.time() - t_start) * 1000)

    successes = sum(1 for r in results if r["success"])
    failures = len(results) - successes
    avg_lat = int(sum(r["duration_ms"] for r in results) / len(results)) if results else 0
    max_lat = max(r["duration_ms"] for r in results) if results else 0

    print(f"Concurrency {concurrency_level:2d}: {successes}/{concurrency_level} Success (Failures: {failures}) | Total Time: {t_total}ms | Avg Latency: {avg_lat}ms | Max: {max_lat}ms")
    if failures > 0:
        for r in results:
            if not r["success"]:
                print(f"   [-] Worker {r['worker']} on {r['path']} -> status={r['status']}, error={r.get('error')}")
    return failures == 0

print("=== PHASE 18: CONTROLLED DATABASE CONNECTION POOL TEST ===")
for level in [10, 15, 20, 25, 30]:
    ok = run_pool_test(level)
    assert ok, f"Concurrency test failed at level {level}"

print("\n=== ALL CONCURRENCY LEVELS (10, 15, 20, 25, 30): 100% PASS ===")
