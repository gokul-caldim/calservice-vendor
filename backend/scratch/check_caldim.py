import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User

u = User.objects.get(id=18)
print("User 18 username:", u.username, "email:", u.email)
print("Checking 'Caldim@2026':", u.check_password("Caldim@2026"))
print("Checking 'Calservice@2026':", u.check_password("Calservice@2026"))
print("Checking 'Calservices@2026':", u.check_password("Calservices@2026"))
