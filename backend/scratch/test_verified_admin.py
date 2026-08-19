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

print("Testing with real verified password: AdminSecure123!")

# 1. Login with email
resp1 = client.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")

print("1. Login by Email Status:", resp1.status_code)
print("   Response Data:", resp1.data)

token1 = resp1.data.get("access_token")
refresh1 = resp1.data.get("refresh_token")

# 2. Call /api/auth/me/ with Bearer token
resp_me = client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token1}", HTTP_HOST="localhost")
print("2. GET /api/auth/me/ Status:", resp_me.status_code)
print("   Response Data:", resp_me.data)

# 3. Call /api/auth/refresh/
resp_ref = client.post("/api/auth/refresh/", {"refresh_token": refresh1}, format="json", HTTP_HOST="localhost")
print("3. POST /api/auth/refresh/ Status:", resp_ref.status_code)
print("   Response Data:", resp_ref.data)

# 4. Login with username
resp2 = client.post("/api/auth/login/", {
    "identifier": "caltrack_admin_01",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")
print("4. Login by Username Status:", resp2.status_code)
print("   Response Data:", resp2.data)

# 5. Login with uppercase / mixed case email
resp3 = client.post("/api/auth/login/", {
    "identifier": "ADMIN01@CALTRACK.IO",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")
print("5. Login by Uppercase Email Status:", resp3.status_code)

# 6. Login with spaces
resp4 = client.post("/api/auth/login/", {
    "identifier": "  admin01@caltrack.io  ",
    "password": "AdminSecure123!"
}, format="json", HTTP_HOST="localhost")
print("6. Login by Email with spaces Status:", resp4.status_code)
