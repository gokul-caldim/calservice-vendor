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

def run_full_login_flow(identifier, password, label):
    print(f"\n==========================================")
    print(f"RUNNING FULL LOGIN FLOW FOR: {label}")
    print(f"Identifier: '{identifier}'")
    print(f"==========================================")

    # Step 1: POST /api/auth/login/
    login_req = factory.post("/api/auth/login/", data={
        "identifier": identifier,
        "email": identifier,
        "username": identifier,
        "password": password
    }, format="json")

    login_view = LoginView.as_view()
    login_resp = login_view(login_req)

    print(f"[1. LOGIN RESPONSE] Status: {login_resp.status_code}")
    print(f"[1. LOGIN RESPONSE] Body: {login_resp.data}")

    if login_resp.status_code != 200:
        print("[-] Login failed at step 1.")
        return

    access_token = login_resp.data.get("access_token")
    refresh_token = login_resp.data.get("refresh_token")
    user_info = login_resp.data.get("user")

    # Step 2: GET /api/auth/me/
    me_req = factory.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {access_token}")
    me_view = MeView.as_view()
    me_resp = me_view(me_req)

    print(f"[2. ME RESPONSE] Status: {me_resp.status_code}")
    print(f"[2. ME RESPONSE] Body: {me_resp.data}")

    # Step 3: POST /api/auth/refresh/
    ref_req = factory.post("/api/auth/refresh/", data={"refresh_token": refresh_token}, format="json")
    ref_view = WorkforceRefreshView.as_view()
    ref_resp = ref_view(ref_req)

    print(f"[3. REFRESH RESPONSE] Status: {ref_resp.status_code}")
    print(f"[3. REFRESH RESPONSE] Body: {ref_resp.data}")

# Test 7519 with exact email, uppercase email, username, with spaces
run_full_login_flow("admin01@caltrack.io", "SecurePass123!", "Admin 7519 Exact Email")
run_full_login_flow("ADMIN01@CALTRACK.IO", "SecurePass123!", "Admin 7519 Uppercase Email")
run_full_login_flow("caltrack_admin_01", "SecurePass123!", "Admin 7519 Username")
run_full_login_flow("  caltrack_admin_01  ", "SecurePass123!", "Admin 7519 Username with spaces")
