import urllib.request
import urllib.error
import json
import threading
import time

def test_concurrent(n):
    results = []
    def worker(i):
        url = "http://127.0.0.1:8001/api/auth/login/"
        data = json.dumps({"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                results.append((i, resp.status, body, int((time.time() - t0)*1000)))
        except urllib.error.HTTPError as e:
            body = json.loads(e.read().decode('utf-8'))
            results.append((i, e.code, body, int((time.time() - t0)*1000)))
        except Exception as ex:
            results.append((i, 0, {"error": str(ex)}, int((time.time() - t0)*1000)))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    t_start = time.time()
    for t in threads: t.start()
    for t in threads: t.join()
    t_total = int((time.time() - t_start)*1000)

    print(f"\n--- {n} Concurrent Requests (Total: {t_total}ms) ---")
    successes = sum(1 for r in results if r[1] == 200)
    print(f"Success: {successes}/{n}")
    for r in results:
        if r[1] != 200:
            print(f"  [-] Worker {r[0]} status={r[1]}, body={r[2]}, duration={r[3]}ms")
        else:
            print(f"  [+] Worker {r[0]} status=200, duration={r[3]}ms")

print("=== TESTING CONCURRENCY WITH DETAILS ===")
test_concurrent(10)
test_concurrent(15)
