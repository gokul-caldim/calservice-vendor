import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from employees.models import Employee
from workforce_api.views import WorkforceJobListView
from rest_framework.test import APIRequestFactory, force_authenticate

emp = Employee.objects.get(id=408)
user = emp.user
factory = APIRequestFactory()
req = factory.get('/api/workforce/jobs/?status=all')
force_authenticate(req, user=user)
view = WorkforceJobListView.as_view()
res = view(req)
print(f"Jobs count returned for Emp {emp.id}: {len(res.data)}")
for j in res.data:
    print(f"Job {j['id']}: status={j['status']} active_offer={j['active_offer']}")
