import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from service_requests.models import ServiceRequest
from django.db.models import Count

print("=" * 80)
print("SERVICE REQUEST STATUS DISTRIBUTION IN DATABASE")
print("=" * 80)

counts = ServiceRequest.objects.values("status").annotate(count=Count("id")).order_by("-count")
for c in counts:
    print(f"Status '{c['status']}': {c['count']} records")

print("\n--- RECENT SERVICE REQUESTS SAMPLE ---")
for sr in ServiceRequest.objects.all().order_by("-id")[:15]:
    print(f"SR #{sr.id} ({sr.request_id}): status='{sr.status}', category='{sr.service_category}', title='{sr.issue_title}', comp_id={sr.company_id}, assigned_emp_id={sr.assigned_employee_id}, lat={sr.latitude}, lon={sr.longitude}, date={sr.preferred_date}, created_at={sr.created_at}")

print("=" * 80)
