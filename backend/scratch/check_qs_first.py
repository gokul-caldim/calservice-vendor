import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
from django.db import models

ident = "admin01@caltrack.io"
pwd = "AdminPass123!"

qs = User.objects.filter(models.Q(email__iexact=ident) | models.Q(username__iexact=ident))
print(f"qs count: {qs.count()}")
for u in qs:
    print(f"User: id={u.id}, username='{u.username}', email='{u.email}', active={u.is_active}")
    print(f"Password in DB: {u.password}")
    print(f"check_password('{pwd}') -> {u.check_password(pwd)}")

u_first = qs.first()
print(f"u_first: {u_first}")
print(f"u_first.check_password('{pwd}') -> {u_first.check_password(pwd)}")
