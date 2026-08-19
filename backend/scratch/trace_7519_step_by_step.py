import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from accounts.models import User
from django.db import models

factory = APIRequestFactory()
req = factory.post("/api/auth/login/", data={
    "identifier": "admin01@caltrack.io",
    "password": "AuditAdmin123!"
}, format="json")

identifier = (
    req.data.get("identifier")
    or req.data.get("username")
    or req.data.get("email")
    or req.data.get("employee_id")
    or ""
).strip()
password = str(req.data.get("password") or "")

print(f"identifier: '{identifier}'")
print(f"password: '{password}'")

# Q filter in LoginView:
q = models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier)
user = User.objects.filter(q).first()
print(f"User from filter(q).first(): {user}")
if user:
    print(f"User id: {user.id}")
    print(f"User username: {user.username}")
    print(f"User email: {user.email}")
    print(f"User password hash: {user.password}")
    print(f"user.check_password('{password}') -> {user.check_password(password)}")
    print(f"user.is_active -> {user.is_active}")
