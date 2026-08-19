import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User

test_passwords = [
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
]

print("=== CHECKING USERS PASSWORD MATCHES ===")
active_users = User.objects.filter(is_active=True)
for u in active_users:
    matched = None
    for p in test_passwords:
        if u.check_password(p):
            matched = p
            break
    print(f"User #{u.id} ({u.username} | {u.email} | role={u.role}): matched={matched or 'UNKNOWN'}")
