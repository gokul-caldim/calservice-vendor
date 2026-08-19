import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIClient

client = APIClient()

resp = client.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AuditAdmin123!"
}, format="json", HTTP_HOST="localhost")

print("APIClient JSON POST status:", resp.status_code)
print("APIClient JSON POST data:", resp.data)

resp2 = client.post("/api/auth/login/", {
    "username": "caltrack_admin_01",
    "password": "AuditAdmin123!"
}, format="json", HTTP_HOST="localhost")
print("APIClient username POST status:", resp2.status_code)
print("APIClient username POST data:", resp2.data)
