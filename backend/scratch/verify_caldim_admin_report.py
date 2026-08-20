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
print("VERIFICATION FOR admin@caldim.in")
print("============================================================")

db_conf = settings.DATABASES['default']
print(f"DATABASE HOST: {db_conf.get('HOST')}")
print(f"DATABASE PORT: {db_conf.get('PORT')}")
print(f"DATABASE NAME: {db_conf.get('NAME')}")

matched_user = User.objects.filter(email__iexact="admin@caldim.in").first()
if not matched_user:
    matched_user = User.objects.filter(username__iexact="admin@caldim.in").first()

if matched_user:
    print(f"USER ID:       {matched_user.id}")
    print(f"EMAIL:         {matched_user.email}")
    print(f"USERNAME:      {matched_user.username}")
    print(f"IS_ACTIVE:     {matched_user.is_active}")
    print(f"IS_STAFF:      {matched_user.is_staff}")
    print(f"IS_SUPERUSER:  {matched_user.is_superuser}")
    print(f"ROLE:          {matched_user.role}")
    print(f"COMPANY_ID:    {matched_user.company_id}")
    pwd_check = matched_user.check_password(os.getenv("TEST_ADMIN_PASSWORD", "AdminSecure123!"))
    print(f"PASSWORD_CHECK = {'TRUE' if pwd_check else 'FALSE'}")
else:
    print("USER RECORD:   NOT FOUND in runtime database for 'admin@caldim.in'")
    print("PASSWORD_CHECK = FALSE")
