import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from django.db import connection

print("=== RAW SQL SEARCH ACROSS DATABASE FOR 'admin@caldim.in' ===")
with connection.cursor() as cursor:
    # 1. Search in accounts_user
    cursor.execute("SELECT id, username, email, is_active, is_staff, is_superuser, role, company_id, password FROM accounts_user WHERE email ILIKE '%admin@caldim.in%' OR username ILIKE '%admin@caldim.in%';")
    rows = cursor.fetchall()
    print(f"accounts_user rows matching 'admin@caldim.in': {len(rows)}")
    for r in rows:
        print(f"  ID={r[0]}, username='{r[1]}', email='{r[2]}', active={r[3]}, staff={r[4]}, superuser={r[5]}, role='{r[6]}', company_id={r[7]}")

    # 2. Search in all text columns across all tables in public schema
    cursor.execute("""
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND data_type IN ('character varying', 'text', 'character');
    """)
    cols = cursor.fetchall()
    print(f"\nSearching {len(cols)} text columns across all tables in public schema for 'admin@caldim.in'...")
    matches = []
    for tbl, col in cols:
        try:
            cursor.execute(f'SELECT "{col}" FROM "{tbl}" WHERE "{col}"::text ILIKE %s LIMIT 5;', ['%admin@caldim.in%'])
            res = cursor.fetchall()
            if res:
                matches.append((tbl, col, res))
        except Exception as e:
            pass

    print(f"Found in other tables: {len(matches)}")
    for tbl, col, res in matches:
        print(f"  Table: {tbl}, Column: {col} -> {res}")

    # 3. Check all accounts_user with email domain @caldim.in
    cursor.execute("SELECT id, username, email, is_active, is_staff, is_superuser, role, company_id FROM accounts_user WHERE email ILIKE '%@caldim.in%' ORDER BY id;")
    caldim_users = cursor.fetchall()
    print(f"\nAll accounts_user with '@caldim.in' ({len(caldim_users)} found):")
    for r in caldim_users:
        print(f"  ID={r[0]:5d} | username='{r[1]}' | email='{r[2]}' | active={r[3]} | staff={r[4]} | superuser={r[5]} | role='{r[6]}' | company_id={r[7]}")
