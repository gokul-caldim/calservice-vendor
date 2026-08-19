import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from accounts.models import User

users = list(User.objects.filter(is_active=True))
print(f"Total active users: {len(users)}")

for u in users:
    pass_hash = u.password or ""
    if pass_hash.startswith("!"):
        print(f"User #{u.id} ({u.username} | {u.role}): UNUSABLE PASSWORD ({pass_hash[:15]})")
    elif not pass_hash:
        print(f"User #{u.id} ({u.username} | {u.role}): EMPTY PASSWORD")
    else:
        # It's a valid pbkdf2 hash
        algo, iterations, salt, hash_val = pass_hash.split("$")[:4] if pass_hash.count("$") >= 3 else (pass_hash, "", "", "")
        print(f"User #{u.id} ({u.username} | {u.email} | {u.role}): algo={algo}, iter={iterations}")
