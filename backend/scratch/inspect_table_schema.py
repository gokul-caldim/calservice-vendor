import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'service_requests_servicerequest'
        ORDER BY ordinal_position;
    """)
    for row in cursor.fetchall():
        print(f"Col: {row[0]:<30} Type: {row[1]:<20} Nullable: {row[2]:<6} Default: {row[3]}")
