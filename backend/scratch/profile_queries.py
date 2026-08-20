import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from django.test.utils import CaptureQueriesContext
from django.db import connection
from workforce_api.views import WorkforceDispatchEligibleListView
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from service_requests.models import ServiceRequest

User = get_user_model()
admin_user = User.objects.filter(username="admin_20km_spatial@caltrack.io").first()
job = ServiceRequest.objects.filter(request_id__startswith="SR-20K-").first()

factory = APIRequestFactory()
view = WorkforceDispatchEligibleListView.as_view()
req = factory.get(f"/api/workforce/dispatch/eligible-technicians/?job_id={job.id}&radius_km=20")
force_authenticate(req, user=admin_user)

with CaptureQueriesContext(connection) as ctx:
    resp = view(req)

print(f"Total queries: {len(ctx.captured_queries)}")
for i, q in enumerate(ctx.captured_queries[:15]):
    print(f"Query {i+1}: {q['sql'][:120]}...")
