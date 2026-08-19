import psycopg2
import threading
import time

def test_concurrent(port, n_threads=30):
    results = []
    def worker(i):
        try:
            conn = psycopg2.connect(
                dbname="postgres",
                user="postgres.zqghatybqkztzgjmmlpl",
                password="Calservice@2026",
                host="aws-0-ap-south-1.pooler.supabase.com",
                port=port,
                sslmode="require"
            )
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM accounts_user;")
                res = cur.fetchone()
            conn.close()
            results.append((i, True, res))
        except Exception as e:
            results.append((i, False, str(e)))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n_threads)]
    t0 = time.time()
    for t in threads: t.start()
    for t in threads: t.join()
    t1 = time.time()

    successes = sum(1 for r in results if r[1])
    failures = sum(1 for r in results if not r[1])
    print(f"\n--- Port {port} with {n_threads} concurrent threads ({int((t1-t0)*1000)}ms) ---")
    print(f"Successes: {successes}, Failures: {failures}")
    if failures > 0:
        print(f"Sample failure: {[r[2] for r in results if not r[1]][0]}")

print("=== CONCURRENCY BENCHMARK: PORT 5432 vs PORT 6543 ===")
test_concurrent(5432, 25)
test_concurrent(6543, 25)
