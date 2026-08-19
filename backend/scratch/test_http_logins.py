import urllib.request
import urllib.error
import json

def test_login(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            print(f"[{url}] HTTP {resp.status}: {body[:200]}")
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"[{url}] HTTP {e.code}: {body}")
        return e.code, body
    except Exception as ex:
        print(f"[{url}] Connection Error: {ex}")
        return 0, str(ex)

print("=== TESTING HTTP 127.0.0.1:8001 ===")
test_login("http://127.0.0.1:8001/api/auth/login/", {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"})
test_login("http://127.0.0.1:8001/api/auth/login/", {"identifier": "admin", "password": "AdminSecure123!"})
test_login("http://127.0.0.1:8001/api/auth/login/", {"identifier": "caltrack_admin_01", "password": "AdminSecure123!"})
test_login("http://127.0.0.1:8001/api/auth/login/", {"identifier": "calservices05@gmail.com", "password": "AdminSecure123!"})

print("\n=== TESTING HTTP localhost:5176 (VITE PROXY) ===")
test_login("http://localhost:5176/api/auth/login/", {"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"})
test_login("http://localhost:5176/api/auth/login/", {"identifier": "admin", "password": "AdminSecure123!"})
test_login("http://localhost:5176/api/auth/login/", {"identifier": "caltrack_admin_01", "password": "AdminSecure123!"})
test_login("http://localhost:5176/api/auth/login/", {"identifier": "calservices05@gmail.com", "password": "AdminSecure123!"})
