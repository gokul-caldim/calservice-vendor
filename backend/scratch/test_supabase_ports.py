import psycopg2
import os

print("=== TESTING SUPABASE POOLER PORTS ===")

# Test 1: Port 5432 (Session Mode)
try:
    conn5432 = psycopg2.connect(
        dbname="postgres",
        user="postgres.zqghatybqkztzgjmmlpl",
        password="Calservice@2026",
        host="aws-0-ap-south-1.pooler.supabase.com",
        port=5432,
        sslmode="require"
    )
    print("[PORT 5432] Connected successfully in Session mode")
    conn5432.close()
except Exception as e:
    print(f"[PORT 5432] Connection failed: {e}")

# Test 2: Port 6543 (Transaction Mode)
try:
    conn6543 = psycopg2.connect(
        dbname="postgres",
        user="postgres.zqghatybqkztzgjmmlpl",
        password="Calservice@2026",
        host="aws-0-ap-south-1.pooler.supabase.com",
        port=6543,
        sslmode="require"
    )
    print("[PORT 6543] Connected successfully in Transaction mode")
    with conn6543.cursor() as cur:
        cur.execute("SELECT count(*) FROM accounts_user;")
        row = cur.fetchone()
        print(f"[PORT 6543] Executed query successfully: {row}")
    conn6543.close()
except Exception as e:
    print(f"[PORT 6543] Connection failed: {e}")
