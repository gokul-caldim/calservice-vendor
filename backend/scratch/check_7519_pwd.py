import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User

u = User.objects.get(id=7519)
print("User 7519 username:", u.username, "email:", u.email)

candidates = [
    "SecurePass123!",
    "AdminPass123!",
    "AuditAdmin123!",
    "Admin@123",
    "Password123!",
    "Calservice@2026",
    "Caltrack@2026",
    "Admin123!",
    "admin123",
    "admin",
]

for p in candidates:
    if u.check_password(p):
        print(f"MATCHED PASSWORD FOR 7519: '{p}'")
        break
else:
    print("NO MATCH for 7519")
