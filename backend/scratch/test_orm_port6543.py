import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Test with DB_PORT=6543
os.environ["DB_PORT"] = "6543"
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')

import django
django.setup()

from django.db import connection, transaction
from accounts.models import User
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.models import WorkforceEventLog

print("=== TESTING DJANGO ORM ON SUPABASE TRANSACTION POOLER (PORT 6543) ===")

# 1. Simple query
count_users = User.objects.count()
print(f"1. User count: {count_users}")

# 2. Complex query with select_related, prefetch_related, annotate
emps = Employee.objects.select_related("user", "company").all()[:5]
print(f"2. Loaded {len(emps)} employees with select_related")

# 3. Transaction atomic block
with transaction.atomic():
    u = User.objects.filter(is_active=True).first()
    print(f"3. Inside transaction.atomic(): loaded user #{u.id}")

# 4. Row locking (select_for_update) inside atomic transaction
with transaction.atomic():
    u_locked = User.objects.select_for_update().filter(id=u.id).first()
    print(f"4. Inside select_for_update(): locked user #{u_locked.id}")

# 5. Raw SQL execution
with connection.cursor() as cursor:
    cursor.execute("SELECT current_user, current_database(), inet_server_port();")
    row = cursor.fetchone()
    print(f"5. Raw SQL executed: {row}")

# 6. Event log creation and query
with transaction.atomic():
    ev = WorkforceEventLog.objects.create(
        event_type="TEST_POOLER_6543",
        payload={"test": True, "port": 6543},
        user_id=u.id
    )
    print(f"6. Created event log #{ev.id}")
    # clean up test log
    ev.delete()
    print("   Deleted test event log.")

print("\n=== ALL DJANGO ORM CAPABILITIES ON PORT 6543: PASS ===")
