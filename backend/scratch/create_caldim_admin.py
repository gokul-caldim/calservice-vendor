import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
from companies.models import Company
from employees.models import Employee

# Choose Company #1 (Calservices)
primary_company = Company.objects.filter(id=1).first()

email = "admin@caldim.in"
username = "admin@caldim.in"

user = User.objects.filter(email__iexact=email).first()
if not user:
    user = User.objects.filter(username__iexact=username).first()

if not user:
    user = User(
        username=username,
        email=email,
        first_name="Caldim",
        last_name="Admin",
        role="admin",
        is_active=True,
        is_staff=True,
        is_superuser=True,
        company=primary_company,
    )
else:
    user.email = email
    user.username = username
    user.role = "admin"
    user.is_active = True
    user.is_staff = True
    user.is_superuser = True
    user.company = primary_company

user.set_password("Caldim@2026")
user.save()
print(f"[USER SAVED] ID={user.id}, email='{user.email}', username='{user.username}', role='{user.role}', is_active={user.is_active}, company_id={user.company_id}")

# Create or update Employee profile for this admin user
employee = Employee.objects.filter(user=user).first()
if not employee:
    emp_code = f"ADM-{user.id:04d}"
    employee = Employee.objects.create(
        user=user,
        company=primary_company,
        employee_id=emp_code,
        title="System Administrator",
        department="Operations",
        service_roles=["admin", "manager"],
        allow_all_locations=True,
    )
    print(f"[EMPLOYEE CREATED] ID={employee.id}, employee_id='{employee.employee_id}', company_id={employee.company_id}")
else:
    employee.company = primary_company
    employee.title = "System Administrator"
    employee.service_roles = ["admin", "manager"]
    employee.allow_all_locations = True
    employee.save()
    print(f"[EMPLOYEE UPDATED] ID={employee.id}, employee_id='{employee.employee_id}', company_id={employee.company_id}")

assert user.check_password("Caldim@2026") is True, "Password check failed"
print("PASSWORD VERIFICATION: SUCCESS (check_password=True)")
