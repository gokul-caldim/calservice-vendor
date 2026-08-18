import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from workforce_api.models import WorkforceEventLog, WorkforceJobOffer
from service_requests.models import ServiceRequest, EmployeeJob

sr460 = ServiceRequest.objects.get(id=460)
print("Job 460:", sr460.__dict__)
print("Offers for 460:", list(WorkforceJobOffer.objects.filter(job_id=460).values()))
print("EmployeeJobs for 460:", list(EmployeeJob.objects.filter(service_request_id=460).values()))
print("Event logs for 460:")
for ev in WorkforceEventLog.objects.filter(payload__job_id=460).order_by('created_at'):
    print(f"  [{ev.created_at}] {ev.event_type} | User: {ev.user} | {ev.payload}")
