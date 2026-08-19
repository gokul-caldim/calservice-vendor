import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
from django.contrib.auth.hashers import check_password

u = User.objects.get(id=18)
print("User 18:", u.username, u.email, u.password)

candidates = [
    "Calservice@2026",
    "Caltrack@2026",
    "Calservices@2026",
    "Admin@123",
    "admin123",
    "Admin123!",
    "Password123!",
    "SecurePass123!",
    "AuditAdmin123!",
    "AdminPass123!",
    "Workforce@2026",
    "admin",
    "password",
    "secret",
    "calservices",
    "123456",
    "12345678",
    "calservice@2026",
    "calservices@2026",
    "caltrack@2026",
    "Admin",
    "ADMIN",
    "Admin@2026",
    "Calservice2026",
    "Calservice@2025",
]

for p in candidates:
    res1 = u.check_password(p)
    res2 = check_password(p, u.password)
    print(f"Testing '{p}': u.check_password={res1}, check_password={res2}")
