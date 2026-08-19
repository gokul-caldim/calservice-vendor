import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from accounts.views import LoginView, MeView, WorkforceRefreshView
from accounts.models import User
import json

factory = APIRequestFactory()

def test_login(identifier, password):
    print(f"\n--- Testing Login: identifier='{identifier}' ---")
    req = factory.post("/api/auth/login/", data={
        "identifier": identifier,
        "password": password
    }, format="json")
    resp = LoginView.as_view()(req)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.data}")
    return resp

# Test 1: Active Admin with AuditAdmin123!
resp = test_login("admin01@caltrack.io", "AuditAdmin123!")
if resp.status_code == 200:
    access_token = resp.data["access_token"]
    me_req = factory.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {access_token}")
    me_resp = MeView.as_view()(me_req)
    print(f"/api/auth/me/ Status: {me_resp.status_code}")
    print(f"/api/auth/me/ Response: {me_resp.data}")

# Test 2: Username login
test_login("caltrack_admin_01", "AuditAdmin123!")

# Test 3: Uppercase / Mixed case
test_login("ADMIN01@CALTRACK.IO", "AuditAdmin123!")
test_login("CalTrack_Admin_01", "AuditAdmin123!")

# Test 4: Trailing / Leading spaces
test_login("  admin01@caltrack.io  ", "AuditAdmin123!")
test_login("  caltrack_admin_01  ", "AuditAdmin123!")
