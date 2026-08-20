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
from django.db import connection

results = []

def login_worker(worker_id):
    client = APIClient()
    try:
        t0 = time.time()
        resp = client.post("/api/auth/login/", {
            "identifier": "admin01@caltrack.io",
            "password": "AdminSecure123!"
        }, format="json", HTTP_HOST="localhost")
        t1 = time.time()
        
        status_code = resp.status_code
        data = resp.data if hasattr(resp, "data") else resp.content.decode()
        
        token = resp.data.get("access_token") if status_code == 200 else None
        me_status = None
        if token:
            me_resp = client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_HOST="localhost")
            me_status = me_resp.status_code
            
        results.append({
            "worker": worker_id,
            "login_status": status_code,
            "me_status": me_status,
            "duration_ms": int((t1 - t0) * 1000),
            "data": data
        })
    except Exception as e:
        results.append({
            "worker": worker_id,
            "exception": str(e)
        })

print("=== RUNNING 15 CONCURRENT ADMIN LOGIN REQUESTS ===")
threads = []
for i in range(15):
    t = threading.Thread(target=login_worker, args=(i,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

print(f"\nCompleted {len(results)} requests:")
success_count = sum(1 for r in results if r.get("login_status") == 200)
fail_count = len(results) - success_count
print(f"Success: {success_count}, Failed: {fail_count}")
for r in results:
    print(f"  Worker {r.get('worker')}: login_status={r.get('login_status')}, me_status={r.get('me_status')}, duration={r.get('duration_ms')}ms, error={r.get('data') if r.get('login_status') != 200 else 'None'}")
