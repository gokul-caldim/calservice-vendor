import os
import sys
import threading
import time
import urllib.request
import urllib.error
import json
from pathlib import Path
from unittest.mock import patch

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User
from django.db import OperationalError

print("============================================================")
print("PHASE 15 — ADMIN AUTHENTICATION REGRESSION TEST SUITE")
print("============================================================")

client = APIClient()

# Identify test admin credentials from environment or verified account
TEST_ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin01@caltrack.io")
TEST_ADMIN_USERNAME = os.getenv("TEST_ADMIN_USERNAME", "caltrack_admin_01")
TEST_ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "AdminSecure123!")

# 1. Valid Admin Login (HTTP 200)
res1 = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
print(f"1. Valid Admin Login (Email):       HTTP {res1.status_code} (code={res1.data.get('message')}) - Token: {bool(res1.data.get('access_token'))}")
assert res1.status_code == 200 and res1.data.get("access_token"), f"Test 1 failed: {res1.data}"

# 2. Wrong Password (HTTP 401 INVALID_CREDENTIALS)
res2 = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL, "password": "WrongPassword999!"}, format="json", HTTP_HOST="localhost")
print(f"2. Wrong Password:                  HTTP {res2.status_code} (code={res2.data.get('code')})")
assert res2.status_code == 401 and res2.data.get("code") == "INVALID_CREDENTIALS", f"Test 2 failed: {res2.data}"

# 3. Unknown Email (HTTP 401 INVALID_CREDENTIALS)
res3 = client.post("/api/auth/login/", {"identifier": "unknown_admin_999@caltrack.io", "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
print(f"3. Unknown Email:                   HTTP {res3.status_code} (code={res3.data.get('code')})")
assert res3.status_code == 401 and res3.data.get("code") == "INVALID_CREDENTIALS", f"Test 3 failed: {res3.data}"

# 4. Username Login (HTTP 200)
res4 = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_USERNAME, "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
print(f"4. Valid Admin Login (Username):    HTTP {res4.status_code} (code={res4.data.get('message')}) - Token: {bool(res4.data.get('access_token'))}")
assert res4.status_code == 200 and res4.data.get("access_token"), f"Test 4 failed: {res4.data}"

# 5. Uppercase Email (HTTP 200)
res5 = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL.upper(), "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
print(f"5. Uppercase Email:                 HTTP {res5.status_code} (code={res5.data.get('message')}) - Token: {bool(res5.data.get('access_token'))}")
assert res5.status_code == 200 and res5.data.get("access_token"), f"Test 5 failed: {res5.data}"

# 6. Whitespace Email (HTTP 200)
res6 = client.post("/api/auth/login/", {"identifier": f"   {TEST_ADMIN_EMAIL}   ", "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
print(f"6. Whitespace Email:                HTTP {res6.status_code} (code={res6.data.get('message')}) - Token: {bool(res6.data.get('access_token'))}")
assert res6.status_code == 200 and res6.data.get("access_token"), f"Test 6 failed: {res6.data}"

# 7. Inactive Account Check (HTTP 403 ACCOUNT_INACTIVE)
inactive_user = User.objects.filter(is_active=False).exclude(email='').first()
if inactive_user and inactive_user.email:
    res7 = client.post("/api/auth/login/", {"identifier": inactive_user.email, "password": "AnyPassword123!"}, format="json", HTTP_HOST="localhost")
    print(f"7. Inactive Account:                HTTP {res7.status_code} (code={res7.data.get('code')})")
    assert res7.status_code == 403 and res7.data.get("code") == "ACCOUNT_INACTIVE", f"Test 7 failed: {res7.data}"
else:
    print("7. Inactive Account:                SKIPPED (no inactive user with email in test db)")

# 8. Database Failure Simulation (HTTP 503 DB_UNAVAILABLE)
with patch("accounts.models.User.objects.filter", side_effect=OperationalError("Connection pool exhausted")):
    res8 = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
    print(f"8. Database Failure Simulation:     HTTP {res8.status_code} (code={res8.data.get('code')})")
    assert res8.status_code == 503 and res8.data.get("code") == "DB_UNAVAILABLE", f"Test 8 failed: {res8.data}"

# 9. 20 Consecutive Valid Logins
seq_pass = 0
for i in range(20):
    r = client.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
    if r.status_code == 200 and r.data.get("access_token"):
        seq_pass += 1
print(f"9. 20 Consecutive Valid Logins:     {seq_pass}/20 PASSED ({int(seq_pass/20*100)}%)")
assert seq_pass == 20, f"Test 9 failed: only {seq_pass}/20 passed"

# 10. 10 Concurrent Valid Logins
concurrent_results = []
def worker(w_id):
    c = APIClient()
    r = c.post("/api/auth/login/", {"identifier": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}, format="json", HTTP_HOST="localhost")
    concurrent_results.append((w_id, r.status_code, r.data.get("code") or "SUCCESS"))

threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
t0 = time.time()
for t in threads: t.start()
for t in threads: t.join()
dur = int((time.time() - t0) * 1000)
concurrent_pass = sum(1 for _, s, _ in concurrent_results if s == 200)
print(f"10. 10 Concurrent Valid Logins:     {concurrent_pass}/10 PASSED ({dur}ms)")
assert concurrent_pass == 10, f"Test 10 failed: {concurrent_results}"

print("\n============================================================")
print("ALL 10 PHASE 15 REGRESSION SCENARIOS PASSED (100%)")
print("============================================================")
