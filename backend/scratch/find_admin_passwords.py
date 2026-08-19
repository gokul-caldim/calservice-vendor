import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User
import glob

# Search in all python test scripts in repo for passwords
passwords = set([
    "AuditAdmin123!",
    "AuditEmpPass123!",
    "AuditEmpPass456!",
    "SecurePass123!",
    "TestPassword123!",
    "AdminPass123!",
    "Password123!",
    "Admin@123",
    "admin123",
    "Admin123!",
    "Calservice@2026",
    "Caltrack@2026",
    "Caldim@2026",
    "TechPass123!",
    "Employee123!",
])

for py_path in glob.glob(str(BASE_DIR / "**/*.py"), recursive=True):
    try:
        with open(py_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            import re
            found = re.findall(r'password["\']?\s*[:=]\s*["\']([^"\']+)["\']', content, re.IGNORECASE)
            for p in found:
                if len(p) >= 4 and not p.startswith("{") and not p.startswith("pbkdf2"):
                    passwords.add(p)
            found2 = re.findall(r'set_password\(["\']([^"\']+)["\']\)', content)
            for p in found2:
                passwords.add(p)
    except Exception:
        pass

print(f"Collected {len(passwords)} unique test passwords from codebase: {passwords}")

active_admins = User.objects.filter(role__in=['admin', 'manager', 'ADMIN']) | User.objects.filter(is_superuser=True)
for u in active_admins.filter(is_active=True):
    matched = None
    for p in passwords:
        if u.check_password(p):
            matched = p
            break
    print(f"Active Admin User #{u.id} ({u.username} | {u.email}): MATCHED = {matched}")
