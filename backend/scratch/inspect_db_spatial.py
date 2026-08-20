import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name LIKE '%postgis%';")
    print("PostGIS Extensions:", cursor.fetchall())
    
    cursor.execute("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('accounts_user', 'employees_employee', 'workforce_job_offer', 'service_requests_servicerequest') ORDER BY table_name, column_name;")
    for row in cursor.fetchall():
        print(f"Table {row[0]}: col {row[1]} -> {row[2]}")
