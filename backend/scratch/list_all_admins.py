import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
from django.conf import settings

print("=== SEARCHING ALL ADMIN USERS ===")
admin_users = list(User.objects.filter(role__in=['admin', 'ADMIN', 'manager', 'MANAGER']).order_by('id'))
print(f"Total admin/manager users in DB: {len(admin_users)}")
for u in admin_users:
    print(f"ID={u.id:5d} | username='{u.username}' | email='{u.email}' | role='{u.role}' | is_active={u.is_active} | is_staff={u.is_staff} | is_superuser={u.is_superuser} | company_id={u.company_id}")
