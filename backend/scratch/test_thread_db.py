import os
import sys
import threading
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection, connections
from accounts.models import User

print("=== TESTING THREADED DB QUERIES ===")

errors = []

def thread_query(i):
    try:
        # In multi-threaded python, each thread gets its own db connection from Django
        u = User.objects.filter(is_active=True, email__iexact="admin01@caltrack.io").first()
        # close connection for thread
        connections.close_all()
    except Exception as e:
        errors.append((i, type(e).__name__, str(e)))

threads = [threading.Thread(target=thread_query, args=(i,)) for i in range(15)]
for t in threads: t.start()
for t in threads: t.join()

print(f"Total errors: {len(errors)}")
for err in errors:
    print(f"  [-] Thread {err[0]}: {err[1]} -> {err[2]}")
