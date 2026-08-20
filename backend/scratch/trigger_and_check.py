import urllib.request
import urllib.error
import json
import threading
import time

def worker(i):
    url = "http://127.0.0.1:8001/api/auth/login/"
    data = json.dumps({"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            pass
    except urllib.error.HTTPError as e:
        pass
    except Exception:
        pass

# Trigger concurrent requests to log the exact DB error in Django server
threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
for t in threads: t.start()
for t in threads: t.join()
