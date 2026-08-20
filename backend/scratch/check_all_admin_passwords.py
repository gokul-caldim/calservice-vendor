import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User

passwords_to_try = [
    "AdminSecure123!",
    "admin123",
    "Admin@123",
    "Admin123!",
    "Calservice@2026",
    "password",
    "123456",
    "admin",
    "Admin@2026",
    "Caltrack@2026",
    "CaltrackAdmin123!",
    "Caltrack123!",
    "Caltrack@123",
    "calservices@123",
    "CalServices@123",
    "CalServices123!",
    "Calservice123!",
    "admin#123",
    "admin_2026",
    "Admin_2026!",
    "Admin!2026",
]

admin_users = list(User.objects.filter(role__in=['admin', 'manager']).order_by('id'))
print(f"Checking {len(admin_users)} admin/manager accounts against password list:")

for u in admin_users:
    found = False
    for pwd in passwords_to_try:
        if u.check_password(pwd):
            print(f"[MATCH] User #{u.id:5d} | username='{u.username}' | email='{u.email}' | role='{u.role}' | is_active={u.is_active} | password matches: '{pwd}'")
            found = True
    if not found:
        print(f"[NO MATCH] User #{u.id:5d} | username='{u.username}' | email='{u.email}' | role='{u.role}' | is_active={u.is_active}")
