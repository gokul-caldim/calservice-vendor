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

identifier = "admin"
password = "Calservice@2026"

print(f"1. Identifier = '{identifier}', Password = '{password}'")

# Look up user by email, username, mobile number, phone, or employee ID
user = User.objects.filter(
    models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier)
).first()

print(f"2. User from Q(email | username): {user}")
if user:
    print(f"   User id: {user.id}, username: {user.username}, email: {user.email}, password hash: {user.password}")
    print(f"   check_password returned: {user.check_password(password)}")
    print(f"   is_active: {user.is_active}")

if not user:
    try:
        user = User.objects.filter(mobile_number=identifier).first()
        print(f"3. User from mobile_number: {user}")
    except Exception as e:
        print(f"3. Error: {e}")

if not user:
    try:
        user = User.objects.filter(phone=identifier).first()
        print(f"4. User from phone: {user}")
    except Exception as e:
        print(f"4. Error: {e}")

if not user:
    try:
        emp = Employee.objects.filter(employee_id__iexact=identifier).select_related("user").first()
        print(f"5. Emp from employee_id: {emp}")
        if emp and emp.user:
            user = emp.user
    except Exception as e:
        print(f"5. Error: {e}")

print(f"6. Final user: {user}")
if not user or not user.check_password(password):
    print("7. FAILED CHECK: not user or not user.check_password(password) is TRUE!")
else:
    print("7. PASSED CHECK!")
