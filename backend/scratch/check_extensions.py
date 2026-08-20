import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name LIKE '%postgis%';")
    res = cursor.fetchall()
    print("PostGIS Extensions Found:", res)
    cursor.execute("SELECT extname, extversion FROM pg_extension;")
    print("Installed Extensions in DB:", cursor.fetchall())
