import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User

client = APIClient()

print("Testing with real password: AdminPass123!")

# 1. Login with email
resp1 = client.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AdminPass123!"
}, format="json", HTTP_HOST="localhost")

print("1. Login by Email:", resp1.status_code)
print("   Response Data:", resp1.data)

token1 = resp1.data.get("access_token")

# 2. Call /api/auth/me/ with Bearer token
resp_me = client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token1}", HTTP_HOST="localhost")
print("2. GET /api/auth/me/:", resp_me.status_code)
print("   Response Data:", resp_me.data)

# 3. Login with username
resp2 = client.post("/api/auth/login/", {
    "identifier": "caltrack_admin_01",
    "password": "AdminPass123!"
}, format="json", HTTP_HOST="localhost")
print("3. Login by Username:", resp2.status_code)

# 4. Login with uppercase / mixed case email
resp3 = client.post("/api/auth/login/", {
    "identifier": "ADMIN01@CALTRACK.IO",
    "password": "AdminPass123!"
}, format="json", HTTP_HOST="localhost")
print("4. Login by Uppercase Email:", resp3.status_code)

# 5. Login with spaces
resp4 = client.post("/api/auth/login/", {
    "identifier": "  admin01@caltrack.io  ",
    "password": "AdminPass123!"
}, format="json", HTTP_HOST="localhost")
print("5. Login by Email with spaces:", resp4.status_code)
