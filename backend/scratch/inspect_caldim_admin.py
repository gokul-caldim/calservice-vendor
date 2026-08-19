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
from django.db import connection

print("============================================================")
print("1. RUNTIME DATABASE CONFIGURATION")
print("============================================================")
db_conf = settings.DATABASES['default']
print(f"DATABASE HOST: {db_conf.get('HOST')}")
print(f"DATABASE PORT: {db_conf.get('PORT')}")
print(f"DATABASE NAME: {db_conf.get('NAME')}")

with connection.cursor() as cursor:
    cursor.execute("SELECT current_database(), current_user, inet_server_port();")
    db_name, db_user, srv_port = cursor.fetchone()
    print(f"Connected DB:  {db_name} (User: {db_user}, Server Port: {srv_port})")

print("\n============================================================")
print("2. SEARCH FOR ALL RECORDS MATCHING 'admin@caldim.in' OR 'caldim'")
print("============================================================")

exact_email_matches = list(User.objects.filter(email__iexact="admin@caldim.in").order_by('id'))
exact_username_matches = list(User.objects.filter(username__iexact="admin@caldim.in").order_by('id'))
caldim_matches = list(User.objects.filter(email__icontains="caldim").order_by('id'))

print(f"Exact email matches (email__iexact='admin@caldim.in'): {len(exact_email_matches)}")
for u in exact_email_matches:
    print(f"  ID:           {u.id}")
    print(f"  email:        {u.email}")
    print(f"  username:     {u.username}")
    print(f"  is_active:    {u.is_active}")
    print(f"  is_staff:     {u.is_staff}")
    print(f"  is_superuser: {u.is_superuser}")
    print(f"  role:         {u.role}")
    print(f"  company_id:   {u.company_id}")
    print(f"  has_password: {u.has_usable_password()}")

print(f"\nExact username matches (username__iexact='admin@caldim.in'): {len(exact_username_matches)}")
for u in exact_username_matches:
    print(f"  ID:           {u.id}")
    print(f"  email:        {u.email}")
    print(f"  username:     {u.username}")
    print(f"  is_active:    {u.is_active}")
    print(f"  is_staff:     {u.is_staff}")
    print(f"  is_superuser: {u.is_superuser}")
    print(f"  role:         {u.role}")
    print(f"  company_id:   {u.company_id}")

print(f"\nAll Users with 'caldim' in email ({len(caldim_matches)} found):")
for u in caldim_matches:
    print(f"  ID={u.id:5d} | email='{u.email}' | username='{u.username}' | role='{u.role}' | is_active={u.is_active} | is_superuser={u.is_superuser} | company_id={u.company_id}")

print("\n============================================================")
print("3. CHECK ALL PASSWORDS ON admin@caldim.in / caldim matching users")
print("============================================================")

candidate_passwords = [
    "AdminSecure123!",
    "admin123",
    "Admin@123",
    "Admin123!",
    "Calservice@2026",
    "Caldim@2026",
    "caldim@2026",
    "caldim123",
    "Caldim123!",
    "Caldim@123",
    "admin",
    "password",
    "123456",
    "Admin@2026",
    "Caltrack@2026",
    "CaltrackAdmin123!",
    "Caltrack123!",
    "Caltrack@123",
    "calservices@123",
    "CalServices@123",
    "CalServices123!",
    "Calservice123!",
    "admin_old",
    "admin#123",
]

all_to_check = set(exact_email_matches + exact_username_matches + caldim_matches)
for u in sorted(all_to_check, key=lambda x: x.id):
    matched_pwd = None
    for p in candidate_passwords:
        if u.check_password(p):
            matched_pwd = True
            break
    print(f"User #{u.id:5d} ('{u.username}', '{u.email}', active={u.is_active}, role='{u.role}'): PASSWORD_CHECK_ANY_CANDIDATE = {bool(matched_pwd)}")
