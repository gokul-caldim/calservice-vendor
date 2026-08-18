import os
import sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection

with connection.cursor() as c:
    c.execute("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'service_requests_servicerequest' ORDER BY ordinal_position;")
    cols = c.fetchall()
    for col in cols:
        print(col)
