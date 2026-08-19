import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection, OperationalError, DatabaseError
from accounts.models import User
from employees.models import Employee

print("=== AUDITING AUTHENTICATION CHAIN FAILURE POINTS ===")

# Test 1: Inactive user shadowing
print("\n1. Inactive User Shadowing Check:")
inactive_matching = User.objects.filter(is_active=False)
print(f"Total inactive users in DB: {inactive_matching.count()}")
for u in inactive_matching[:10]:
    # Check if any active user shares the email or username
    active_shares = User.objects.filter(is_active=True).filter(
        django.db.models.Q(email__iexact=u.email) | django.db.models.Q(username__iexact=u.username)
    ).exclude(id=u.id)
    if active_shares.exists():
        print(f"  [ALERT] Inactive user #{u.id} ({u.username}, {u.email}) shares identity with active user: {list(active_shares.values('id', 'username', 'email'))}")

# Test 2: Database Connection health across queries
print("\n2. Database Connection Check:")
with connection.cursor() as cursor:
    cursor.execute("SELECT 1;")
    row = cursor.fetchone()
    print(f"  Direct DB Query OK: {row}")

# Test 3: Check all active Admin / Manager users in DB
print("\n3. Active Admin / Manager / Staff users in DB:")
admin_users = User.objects.filter(django.db.models.Q(role__in=['admin', 'manager']) | django.db.models.Q(is_superuser=True) | django.db.models.Q(is_staff=True))
for a in admin_users:
    print(f"  User #{a.id}: username='{a.username}', email='{a.email}', role='{a.role}', is_active={a.is_active}, super={a.is_superuser}, usable_pwd={a.has_usable_password()}, company_id={a.company_id}")

