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

print("=== AUDIT ALL ADMIN / SUPERUSER / RELEVANT USERS IN DATABASE ===")
users = list(User.objects.all().order_by('id'))
print(f"Total Users in DB: {len(users)}")

admin_users = [u for u in users if u.is_superuser or u.role in ['admin', 'manager'] or 'admin' in (u.email or '').lower() or 'admin' in (u.username or '').lower() or 'calservice' in (u.email or '').lower()]

print(f"\nFound {len(admin_users)} admin/manager/matching user records:")
for u in admin_users:
    print(f"ID={u.id:5d} | Username='{u.username}' | Email='{u.email}' | Role='{u.role}' | IsActive={u.is_active} | IsSuperuser={u.is_superuser} | CompanyID={u.company_id} | PasswordAlgorithm={u.password.split('$')[0] if u.password else 'None'}")

print("\n=== TESTING COMMON ADMIN PASSWORDS ON MATCHING ACCOUNTS ===")
candidate_passwords = [
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
]

for u in admin_users:
    for pwd in candidate_passwords:
        if u.check_password(pwd):
            print(f"[FOUND VALID PASSWORD] User #{u.id} ('{u.username}', '{u.email}', active={u.is_active}, role='{u.role}') MATCHES password: '{pwd}'")
