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

from rest_framework.test import APIRequestFactory
from accounts.views import LoginView

factory = APIRequestFactory()
view = LoginView.as_view()

results = []

def call_view(i):
    request = factory.post(
        "/api/auth/login/",
        {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"},
        format="json"
    )
    t0 = time.time()
    resp = view(request)
    dur = int((time.time() - t0)*1000)
    results.append((i, resp.status_code, resp.data, dur))

threads = [threading.Thread(target=call_view, args=(i,)) for i in range(15)]
for t in threads: t.start()
for t in threads: t.join()

print(f"Direct View Execution across 15 threads:")
for r in results:
    print(f"  Worker {r[0]:2d}: status={r[1]}, code={r[2].get('code') or r[2].get('message')}, dur={r[3]}ms")
