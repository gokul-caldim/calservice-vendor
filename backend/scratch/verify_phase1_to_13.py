import os
import sys
import threading
import time
import urllib.request
import urllib.error
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.conf import settings
from django.db import connection
from accounts.models import User

print("============================================================")
print("PHASE 4 & 10: RUNTIME DATABASE & POOLER CONFIGURATION AUDIT")
print("============================================================")

db_conf = settings.DATABASES['default']
print(f"DB Engine:                    {db_conf.get('ENGINE')}")
print(f"DB Host:                      {db_conf.get('HOST')}")
print(f"DB Port:                      {db_conf.get('PORT')}")
print(f"DB Conn Max Age:              {db_conf.get('CONN_MAX_AGE')}")
print(f"Disable Server Side Cursors:  {db_conf.get('DISABLE_SERVER_SIDE_CURSORS')}")
print(f"Options:                      {db_conf.get('OPTIONS', {}).get('options')}")

with connection.cursor() as cursor:
    cursor.execute("SELECT current_database(), current_user, inet_server_port();")
    db_name, db_user, srv_port = cursor.fetchone()
    print(f"Connected Database:           {db_name}")
    print(f"Connected User:               {db_user}")
    print(f"Server Port:                  {srv_port}")

print("\n============================================================")
print("PHASE 9: USER PASSWORD & ACCOUNT AUDIT")
print("============================================================")

admin_user = User.objects.filter(email='admin01@caltrack.io').first()
assert admin_user is not None, "Admin user admin01@caltrack.io not found"
print(f"User ID:                      {admin_user.id}")
print(f"Username:                     {admin_user.username}")
print(f"Email:                        {admin_user.email}")
print(f"Is Active:                    {admin_user.is_active}")
print(f"Role:                         {admin_user.role}")
print(f"Company ID:                   {admin_user.company_id}")
print(f"Has Usable Password:          {admin_user.has_usable_password()}")
print(f"Password Check (Valid):       {admin_user.check_password('AdminSecure123!')}")
print(f"Password Check (Wrong):       {admin_user.check_password('WrongPasswordXYZ')}")

print("\n============================================================")
print("PHASE 11: HTTP ENDPOINT VERIFICATION (5176 & 8001)")
print("============================================================")

def http_post(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode('utf-8'))
        return e.code, body
    except Exception as ex:
        return 0, {"error": str(ex)}

base_urls = ["http://127.0.0.1:8001/api/auth/login/", "http://localhost:5176/api/auth/login/"]

for base in base_urls:
    print(f"\n--- Testing Endpoint: {base} ---")
    # 1. Valid Admin Login
    s, b = http_post(base, {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"})
    print(f"1. Valid Login:               HTTP {s} (code={b.get('message') or b.get('code')}) - Access Token: {bool(b.get('access_token'))}")
    assert s == 200 and b.get("access_token"), f"Valid login failed: {b}"

    # 2. Wrong Password
    s, b = http_post(base, {"identifier": "admin01@caltrack.io", "password": "WrongPassword999!"})
    print(f"2. Wrong Password:            HTTP {s} (code={b.get('code')})")
    assert s == 401 and b.get("code") == "INVALID_CREDENTIALS", f"Expected 401 INVALID_CREDENTIALS, got {s}: {b}"

    # 3. Unknown Account
    s, b = http_post(base, {"identifier": "unknown_admin_999@caltrack.io", "password": "AdminSecure123!"})
    print(f"3. Unknown User:              HTTP {s} (code={b.get('code')})")
    assert s == 401 and b.get("code") == "INVALID_CREDENTIALS", f"Expected 401 INVALID_CREDENTIALS, got {s}: {b}"

    # 4. Uppercase Email
    s, b = http_post(base, {"identifier": "ADMIN01@CALTRACK.IO", "password": "AdminSecure123!"})
    print(f"4. Uppercase Email:           HTTP {s} (code={b.get('message') or b.get('code')})")
    assert s == 200 and b.get("access_token"), f"Uppercase email failed: {b}"

    # 5. Whitespace Email
    s, b = http_post(base, {"identifier": "   admin01@caltrack.io   ", "password": "AdminSecure123!"})
    print(f"5. Whitespace Email:          HTTP {s} (code={b.get('message') or b.get('code')})")
    assert s == 200 and b.get("access_token"), f"Whitespace email failed: {b}"

    # 6. Missing Credentials
    s, b = http_post(base, {"identifier": "", "password": ""})
    print(f"6. Missing Credentials:       HTTP {s} (code={b.get('code')})")
    assert s == 400 and b.get("code") == "CREDENTIALS_REQUIRED", f"Expected 400 CREDENTIALS_REQUIRED, got {s}: {b}"

print("\n============================================================")
print("PHASE 12: REPEATED & CONCURRENT LOGIN STABILITY TEST")
print("============================================================")

# 20 Sequential Logins
seq_passed = 0
for i in range(20):
    s, b = http_post("http://127.0.0.1:8001/api/auth/login/", {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"})
    if s == 200 and b.get("access_token"):
        seq_passed += 1
    else:
        print(f"[-] Sequential #{i+1} failed: status={s}, body={b}")
print(f"20 Sequential Logins:         {seq_passed}/20 PASSED ({int(seq_passed/20*100)}%)")
assert seq_passed == 20

def run_concurrent_logins(count):
    results = []
    def worker():
        s, b = http_post("http://127.0.0.1:8001/api/auth/login/", {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"})
        results.append((s, b.get("code") or "SUCCESS"))
    threads = [threading.Thread(target=worker) for _ in range(count)]
    t0 = time.time()
    for t in threads: t.start()
    for t in threads: t.join()
    dur = int((time.time() - t0) * 1000)
    success = sum(1 for s, _ in results if s == 200)
    print(f"{count:2d} Concurrent Logins:         {success}/{count} PASSED ({dur}ms)")
    assert success == count, f"Concurrent logins failed: {results}"

run_concurrent_logins(10)
run_concurrent_logins(30)

print("\n============================================================")
print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH 100% PASS RATE")
print("============================================================")
