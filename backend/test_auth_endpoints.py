"""
Test script to verify direct Django auth (port 8000) and Vite proxy auth (port 3000).
"""
import requests

def test_auth():
    payload = {
        "username": "admin",
        "password": "SecurePass123!"
    }

    print("=" * 60)
    print("TESTING DIRECT DJANGO BACKEND AUTH (port 8000)...")
    try:
        r1 = requests.post("http://127.0.0.1:8000/api/auth/token/", json=payload, timeout=5)
        print(f"Direct status: {r1.status_code}")
        if r1.status_code == 200:
            print("[OK] Direct auth SUCCESS! Received access & refresh tokens.")
            access_token = r1.json().get("access")
            
            # Test protected endpoints with access_token
            headers = {"Authorization": f"Bearer {access_token}"}
            print("\nTESTING PROTECTED ENDPOINTS WITH ACCESS TOKEN:")
            
            r_cases = requests.get("http://127.0.0.1:8000/api/cases/", headers=headers, timeout=5)
            print(f"GET /api/cases/ status: {r_cases.status_code}")

            r_docs = requests.get("http://127.0.0.1:8000/api/documents/", headers=headers, timeout=5)
            print(f"GET /api/documents/ status: {r_docs.status_code}")

            r_audit = requests.get("http://127.0.0.1:8000/api/audit/verify/", headers=headers, timeout=5)
            print(f"GET /api/audit/verify/ status: {r_audit.status_code}")

            r_ai = requests.get("http://127.0.0.1:8000/api/ai/providers/", headers=headers, timeout=5)
            print(f"GET /api/ai/providers/ status: {r_ai.status_code}")
        else:
            print(f"Direct auth failed: {r1.text}")
    except Exception as e:
        print(f"Direct auth exception: {e}")

    print("\n" + "=" * 60)
    print("TESTING VITE PROXY AUTH (port 3000)...")
    try:
        r2 = requests.post("http://127.0.0.1:3000/api/auth/token/", json=payload, timeout=5)
        print(f"Proxy status: {r2.status_code}")
        if r2.status_code == 200:
            print("[OK] Vite proxy auth SUCCESS!")
        else:
            print(f"Proxy auth failed: {r2.status_code} - {r2.text}")
    except Exception as e:
        print(f"Proxy auth exception: {e}")
    print("=" * 60)

if __name__ == "__main__":
    test_auth()
