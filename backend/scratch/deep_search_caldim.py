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

print("=== ALL USERS IN DATABASE WITH EMAIL CONTAINING 'caldim' OR 'caltrack' OR 'admin' ===")
users = list(User.objects.all().order_by('id'))
print(f"Total Users in DB: {len(users)}")

print("\n--- Users containing 'caldim' in any field ---")
for u in users:
    fields = f"{u.id} {u.username} {u.email} {u.mobile_number} {u.phone} {u.first_name} {u.last_name}"
    if "caldim" in fields.lower():
        print(f"ID={u.id:5d} | username='{u.username}' | email='{u.email}' | role='{u.role}' | is_active={u.is_active} | is_staff={u.is_staff} | is_superuser={u.is_superuser} | company_id={u.company_id} | usable_pwd={u.has_usable_password()}")

print("\n--- All ACTIVE Users with role='admin' or is_superuser=True or is_staff=True ---")
for u in users:
    if u.is_active and (u.role == 'admin' or u.is_superuser or u.is_staff or 'admin' in (u.username or '').lower() or 'admin' in (u.email or '').lower()):
        print(f"ID={u.id:5d} | username='{u.username}' | email='{u.email}' | role='{u.role}' | is_active={u.is_active} | is_staff={u.is_staff} | is_superuser={u.is_superuser} | company_id={u.company_id}")

print("\n--- Searching Employee table for caldim / admin ---")
for emp in Employee.objects.all().select_related('user'):
    emp_str = f"{emp.id} {emp.employee_id} {emp.company_id} {getattr(emp.user, 'email', '')} {getattr(emp.user, 'username', '')}"
    if "caldim" in emp_str.lower() or "admin" in emp_str.lower():
        print(f"Employee ID={emp.id} | employee_id='{emp.employee_id}' | company_id={emp.company_id} | user_id={getattr(emp.user, 'id', None)} | user_email='{getattr(emp.user, 'email', None)}'")
