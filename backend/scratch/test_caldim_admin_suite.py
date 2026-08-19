import os
import sys
import json
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

def http_req(url, method="GET", payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode("utf-8"))
        return e.code, body
    except Exception as ex:
        return 0, {"error": str(ex)}

print("============================================================")
print("TESTING admin@caldim.in AUTHENTICATION SUITE")
print("============================================================")

email = "admin@caldim.in"
password = "Caldim@2026"

# 1. Login via port 8001
s, b = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": email, "password": password})
print(f"1. Login via Backend (8001):          HTTP {s} - code='{b.get('message') or b.get('code')}' - access_token: {bool(b.get('access_token'))}")
assert s == 200 and b.get("access_token"), f"Port 8001 login failed: {b}"
access_token = b["access_token"]
user_data = b["user"]
print(f"   User Object: id={user_data.get('id')}, role='{user_data.get('role')}', company={user_data.get('company')}")
assert user_data.get("role") == "admin", f"Role must be admin, got: {user_data}"

# 2. Login via Vite Proxy (port 5176)
s2, b2 = http_req("http://localhost:5176/api/auth/login/", method="POST", payload={"identifier": email, "password": password})
print(f"2. Login via Frontend Proxy (5176):   HTTP {s2} - code='{b2.get('message') or b2.get('code')}' - access_token: {bool(b2.get('access_token'))}")
assert s2 == 200 and b2.get("access_token"), f"Port 5176 login failed: {b2}"

# 3. GET /api/auth/me/
s3, b3 = http_req("http://127.0.0.1:8001/api/auth/me/", method="GET", token=access_token)
print(f"3. GET /api/auth/me/:                 HTTP {s3} - user={b3.get('user', {}).get('email')} - role={b3.get('user', {}).get('role')}")
assert s3 == 200, f"/auth/me failed: {b3}"

# 4. Wrong Password Check
s4, b4 = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": email, "password": "WrongPassword999!"})
print(f"4. Wrong Password:                    HTTP {s4} - code='{b4.get('code')}'")
assert s4 == 401 and b4.get("code") == "INVALID_CREDENTIALS", f"Expected 401, got {s4}: {b4}"

# 5. Uppercase email
s5, b5 = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": email.upper(), "password": password})
print(f"5. Uppercase Email:                   HTTP {s5} - access_token: {bool(b5.get('access_token'))}")
assert s5 == 200 and b5.get("access_token"), f"Uppercase email failed: {b5}"

# 6. Whitespace email
s6, b6 = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": f"  {email}  ", "password": password})
print(f"6. Whitespace Email:                  HTTP {s6} - access_token: {bool(b6.get('access_token'))}")
assert s6 == 200 and b6.get("access_token"), f"Whitespace email failed: {b6}"

# 7. 20 Consecutive Valid Logins
seq_pass = 0
for i in range(20):
    s_seq, b_seq = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": email, "password": password})
    if s_seq == 200 and b_seq.get("access_token"):
        seq_pass += 1
print(f"7. 20 Consecutive Logins:             {seq_pass}/20 PASSED (100%)")
assert seq_pass == 20, f"Sequential test failed: {seq_pass}/20"

# 8. 10 Concurrent Valid Logins
conc_results = []
def worker():
    s_c, b_c = http_req("http://127.0.0.1:8001/api/auth/login/", method="POST", payload={"identifier": email, "password": password})
    conc_results.append((s_c, b_c.get("code") or "SUCCESS"))

threads = [threading.Thread(target=worker) for _ in range(10)]
t0 = time.time()
for t in threads: t.start()
for t in threads: t.join()
dur = int((time.time() - t0)*1000)
conc_pass = sum(1 for s_c, _ in conc_results if s_c == 200)
print(f"8. 10 Concurrent Logins:              {conc_pass}/10 PASSED ({dur}ms)")
assert conc_pass == 10, f"Concurrent test failed: {conc_results}"

print("\n============================================================")
print("ALL SUITE TESTS FOR admin@caldim.in PASSED (100%)")
print("============================================================")
