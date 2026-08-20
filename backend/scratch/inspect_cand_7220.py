import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from employees.models import Employee
from service_requests.models import ServiceRequest
from workforce_api.services.automatic_dispatch import check_candidate_eligibility
from workforce_api.views import WorkforceDispatchEligibleListView
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model

User = get_user_model()
emp = Employee.objects.filter(id=7220).first()
job = ServiceRequest.objects.filter(request_id="SR-20K-BEARINGS_TEST").first()

print("Employee:", emp, emp.is_online, emp.current_availability, emp.is_active)
print("User last_known_location:", emp.user.last_known_location)
print("Job:", job, job.service_category, job.latitude, job.longitude)

is_elig, reason, gates = check_candidate_eligibility(emp, job.service_category)
print("Eligibility:", is_elig, reason, gates)

factory = APIRequestFactory()
view = WorkforceDispatchEligibleListView.as_view()
req = factory.get(f"/api/workforce/dispatch/eligible-technicians/?job_id={job.id}&radius_km=20")
admin_user = User.objects.filter(username="admin_20km_spatial@caltrack.io").first()
force_authenticate(req, user=admin_user)
resp = view(req)
for c in resp.data:
    if c["id"] == 7220:
        print("Candidate payload:", c)
