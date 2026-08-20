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

passwords = set()
for py_path in glob.glob(str(BASE_DIR / "**/*.py"), recursive=True):
    try:
        with open(py_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            import re
            found = re.findall(r'["\']([^"\']{4,40})["\']', content)
            for p in found:
                passwords.add(p)
    except Exception:
        pass

print(f"Extracted {len(passwords)} candidates from all files.")

for uid in [7519, 7575, 7584, 7593, 7602, 18, 36, 31, 7650]:
    u = User.objects.filter(id=uid).first()
    if not u:
        continue
    matched = []
    for p in passwords:
        try:
            if u.check_password(p):
                matched.append(p)
        except Exception:
            pass
    print(f"User #{u.id} ({u.username} | {u.email}): matched={matched}")
