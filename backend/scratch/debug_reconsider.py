import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.utils import timezone
from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.services.workload import get_employee_active_job
from workforce_api.services.automatic_dispatch import (
    reconsider_jobs_for_employee,
    check_candidate_eligibility,
    dispatch_job,
    DISPATCHABLE_STATUSES,
)

emp = Employee.objects.get(id=2)
print("Employee #2 status:")
print(f"is_active: {emp.is_active}")
print(f"is_online: {emp.is_online}")
print(f"current_availability: {emp.current_availability}")
print(f"active_job: {get_employee_active_job(emp)}")

now = timezone.now()
sr = ServiceRequest.objects.create(
    company=emp.company,
    customer_name="Test SR Debug",
    phone="9876543210",
    service_category="hvac",
    issue_title="AC Repair & Diagnostics",
    address="123 Test St",
    preferred_date=now.date(),
    latitude=12.9720,
    longitude=77.5950,
    status="confirmed",
    assigned_employee=None,
    otp_attempt_count=0,
    otp_hash="",
)

try:
    print("\nAttempting dispatch_job(sr):")
    success, msg = dispatch_job(sr)
    print(f"dispatch_job result: success={success}, msg='{msg}'")
    
    print("\nAttempting reconsider_jobs_for_employee(emp):")
    cnt = reconsider_jobs_for_employee(emp)
    print(f"reconsider_jobs_for_employee result: cnt={cnt}")
finally:
    sr.delete()
