import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from workforce_api.models import WorkforceEventLog, WorkforceJobOffer
from service_requests.models import ServiceRequest, EmployeeJob

print("=== RECENT EVENT LOGS ===")
for ev in WorkforceEventLog.objects.order_by('-created_at')[:25]:
    print(f"[{ev.created_at}] Event: {ev.event_type} | User: {ev.user} | Payload: {ev.payload}")

print("\n=== RECENT JOB OFFERS ===")
for off in WorkforceJobOffer.objects.order_by('-id')[:10]:
    print(f"Offer #{off.id} | Job #{off.job_id} | Emp #{off.employee_id} | Status: {off.status} | Reason: {off.rejection_reason}")
