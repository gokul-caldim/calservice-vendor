import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from rest_framework.test import APIClient

client = APIClient()
res12 = client.get("/api/workforce/realtime/stream/", HTTP_HOST="localhost")
print("Status:", res12.status_code)
print("Content:", res12.content)
print("Data:", getattr(res12, "data", None))
