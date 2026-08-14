import os
import django
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from workforce_api.models import WorkforceJobOffer

User = get_user_model()
u = User.objects.filter(role="employee").first() or User.objects.first()

client = APIClient()
client.force_authenticate(user=u)

try:
    print(f"Testing GET /api/workforce/jobs/ for user: {u.username} (role: {u.role})")
    resp = client.get("/api/workforce/jobs/")
    print(f"Status code: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Error data: {resp.data}")
except Exception as e:
    print("EXCEPTION OCCURRED:")
    traceback.print_exc()
