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

u = User.objects.get(id=7519)
for p in passwords:
    if u.check_password(p):
        print(f"EXACT MATCH FOR 7519: '{p}'")
