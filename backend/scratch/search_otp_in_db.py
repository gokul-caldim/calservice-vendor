import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workforce_core.settings")
django.setup()

from django.db import connection

def search_value(val):
    print(f"Searching database for '{val}'...")
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (data_type LIKE '%char%' OR data_type LIKE '%text%' OR data_type LIKE '%json%');
        """)
        text_cols = cursor.fetchall()
        
        found = False
        for table, col in text_cols:
            try:
                cursor.execute(f'SELECT count(*), min("{col}") FROM "{table}" WHERE "{col}"::text LIKE %s;', [f'%{val}%'])
                cnt, sample = cursor.fetchone()
                if cnt > 0:
                    found = True
                    print(f"  -> FOUND in Table [{table}], Column [{col}] (Rows: {cnt}): {sample}")
            except Exception:
                pass
        if not found:
            print("  -> Not found in any column.")

if __name__ == "__main__":
    search_value("837469")
    search_value("595833")
    search_value("2205")
