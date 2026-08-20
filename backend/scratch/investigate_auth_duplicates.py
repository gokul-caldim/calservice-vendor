import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import models
from accounts.models import User
from employees.models import Employee

identifiers = [
    'admin@calservices.com',
    'calservices05@gmail.com',
    'admin01@caltrack.io',
    'caltrack_admin_01',
    'admin@caltrack.com',
    'tech01@calservices.com',
    'admin',
    'manager',
    'manager@calservices.com',
]

print("=== IDENTIFIER RESOLUTION TEST ===")
for ident in identifiers:
    qs = list(User.objects.filter(models.Q(email__iexact=ident) | models.Q(username__iexact=ident)).values('id', 'username', 'email', 'is_active', 'role', 'is_superuser'))
    print(f"\nIdentifier: '{ident}' -> found {len(qs)} users:")
    for u in qs:
        print(f"   ID: {u['id']} | username: {u['username']} | email: {u['email']} | role: {u['role']} | superuser: {u['is_superuser']} | active: {u['is_active']}")

print("\n=== ALL DUPLICATE EMAILS OR USERNAMES ===")
from django.db.models import Count
dup_emails = User.objects.values('email').annotate(c=Count('id')).filter(c__gt=1, email__isnull=False).exclude(email='')
print(f"Duplicate emails ({len(dup_emails)}):")
for d in dup_emails[:20]:
    print(f"  Email: {d['email']} (count: {d['c']})")
    for u in User.objects.filter(email__iexact=d['email']):
        print(f"    -> ID: {u.id}, username: {u.username}, is_active: {u.is_active}, role: {u.role}")

dup_users = User.objects.values('username').annotate(c=Count('id')).filter(c__gt=1)
print(f"\nDuplicate usernames ({len(dup_users)}):")
for d in dup_users:
    print(f"  Username: {d['username']} (count: {d['c']})")
