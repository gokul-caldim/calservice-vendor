import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from accounts.views import LoginView
from accounts.models import User
from django.db import models

factory = APIRequestFactory()
request = factory.post("/api/auth/login/", {
    "identifier": "admin01@caltrack.io",
    "password": "AuditAdmin123!"
}, format="json", HTTP_HOST="localhost")

# DRF initialize_request
view = LoginView()
drf_request = view.initialize_request(request)
print("drf_request.data:", drf_request.data)

identifier = (
    drf_request.data.get("identifier")
    or drf_request.data.get("username")
    or drf_request.data.get("email")
    or drf_request.data.get("employee_id")
    or ""
).strip()
password = str(drf_request.data.get("password") or "")

print(f"Extracted identifier: '{identifier}', password: '{password}'")

# Look up user
user = User.objects.filter(
    models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier)
).first()

print("Found user:", user)
if user:
    print("User id:", user.id)
    print("User email:", user.email)
    print("User username:", user.username)
    print("User password:", user.password)
    print("user.check_password(password):", user.check_password(password))
    print("user.is_active:", user.is_active)
    print("user.role:", getattr(user, "role", None))
    print("user.company_id:", getattr(user, "company_id", None))

response = view.post(drf_request)
print("View post response status:", response.status_code)
print("View post response data:", response.data)
