import urllib.request
import urllib.error
import json

def test_login_with_stale_bearer(url):
    data = json.dumps({"identifier": "admin01@caltrack.io", "password": "AdminSecure123!"}).encode('utf-8')
    # Attach a stale/invalid Authorization Bearer token (simulating what client.js was doing when localStorage had an expired token)
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDB9.invalid_signature'
    }
    req = urllib.request.Request(url, data=data, headers=headers)
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

print("=== TESTING LOGIN WITH STALE BEARER HEADER ===")
test_login_with_stale_bearer("http://127.0.0.1:8001/api/auth/login/")
test_login_with_stale_bearer("http://localhost:5176/api/auth/login/")
