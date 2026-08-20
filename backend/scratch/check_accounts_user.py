import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
import django
django.setup()
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts_user' ORDER BY column_name;")
    for row in cursor.fetchall():
        print(f"accounts_user: {row[0]} ({row[1]})")
