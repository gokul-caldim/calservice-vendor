import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.test import RequestFactory
from accounts.views import LoginView, MeView, WorkforceRefreshView
from accounts.models import User
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
import json

factory = RequestFactory()

def test_login_and_me(identifier, password, label=""):
    print(f"\n==========================================")
    print(f"TESTING: {label} (identifier='{identifier}')")
    print(f"==========================================")

    # 1. POST /api/auth/login/
    login_req = factory.post("/api/auth/login/", data=json.dumps({
        "identifier": identifier,
        "email": identifier,
        "username": identifier,
        "password": password
    }), content_type="application/json")

    login_view = LoginView.as_view()
    login_resp = login_view(login_req)

    print(f"[LOGIN] Status: {login_resp.status_code}")
    print(f"[LOGIN] Response Data: {login_resp.data}")

    if login_resp.status_code != 200:
        print(f"[-] LOGIN FAILED: {login_resp.data}")
        return

    access_token = login_resp.data.get("access_token")
    refresh_token = login_resp.data.get("refresh_token")

    print(f"[TOKEN] Access Token (len={len(access_token)}): {access_token[:30]}...")
    try:
        decoded_access = AccessToken(access_token)
        print(f"[TOKEN] Decoded Access Claims: {dict(decoded_access)}")
    except Exception as e:
        print(f"[-] Access token decoding failed: {e}")

    # 2. GET /api/auth/me/ with Bearer token
    me_req = factory.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {access_token}")
    me_view = MeView.as_view()
    me_resp = me_view(me_req)

    print(f"[ME] Status: {me_resp.status_code}")
    print(f"[ME] Response Data: {me_resp.data}")

    # 3. POST /api/auth/refresh/
    refresh_req = factory.post("/api/auth/refresh/", data=json.dumps({
        "refresh_token": refresh_token
    }), content_type="application/json")
    refresh_view = WorkforceRefreshView.as_view()
    refresh_resp = refresh_view(refresh_req)
    print(f"[REFRESH] Status: {refresh_resp.status_code}")
    print(f"[REFRESH] Response Data: {refresh_resp.data}")

test_login_and_me("admin", "Calservice@2026", "Admin by username 'admin'")
test_login_and_me("calservices05@gmail.com", "Calservice@2026", "Admin by email 'calservices05@gmail.com'")
test_login_and_me("ADMIN", "Calservice@2026", "Admin uppercase 'ADMIN'")
test_login_and_me("  admin  ", "Calservice@2026", "Admin with spaces '  admin  '")
test_login_and_me("calservices05@gmail.com", "WrongPassword!", "Admin with wrong password")
