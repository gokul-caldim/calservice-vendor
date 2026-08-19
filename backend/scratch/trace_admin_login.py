import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
from employees.models import Employee
from django.db import models
from rest_framework.test import APIRequestFactory
from accounts.views import LoginView
import json

factory = APIRequestFactory()

request = factory.post("/api/auth/login/", data={
    "identifier": "admin",
    "password": "Calservice@2026"
}, format="json")

view = LoginView.as_view()
response = view(request)
print("APIRequestFactory response status:", response.status_code)
print("APIRequestFactory response data:", response.data)

request2 = factory.post("/api/auth/login/", data={
    "identifier": "calservices05@gmail.com",
    "password": "Calservice@2026"
}, format="json")
response2 = view(request2)
print("Email response status:", response2.status_code)
print("Email response data:", response2.data)
