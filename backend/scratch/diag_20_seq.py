import urllib.request
import urllib.error
import json
import time

url = "http://127.0.0.1:8001/api/auth/login/"
payload = {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"}

print("=== 20 SEQUENTIAL LOGINS DIAGNOSTIC ===")
for i in range(20):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            dur = int((time.time() - t0)*1000)
            print(f"Request #{i+1:2d}: HTTP {resp.status} (dur={dur}ms) - access_token: {bool(body.get('access_token'))}")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode('utf-8'))
        dur = int((time.time() - t0)*1000)
        print(f"Request #{i+1:2d}: HTTP {e.code} (dur={dur}ms) - body: {body}")
    except Exception as ex:
        dur = int((time.time() - t0)*1000)
        print(f"Request #{i+1:2d}: EXCEPTION (dur={dur}ms) - {ex}")
