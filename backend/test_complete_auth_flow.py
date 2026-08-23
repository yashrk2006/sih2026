"""
Comprehensive test script for valid and invalid credentials against both Django (8000) and Vite Proxy (3000).
"""
import requests

def run_tests():
    valid_payload = {
        "username": "admin",
        "password": "SecurePass123!"
    }
    invalid_payload = {
        "username": "admin",
        "password": "WrongPassword999!"
    }

    print("=" * 70)
    print("1. TESTING VALID CREDENTIALS DIRECT (port 8000)...")
    r1 = requests.post("http://127.0.0.1:8000/api/auth/token/", json=valid_payload, timeout=5)
    print(f"Status: {r1.status_code}")
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
    tokens = r1.json()
    assert "access" in tokens and "refresh" in tokens
    print("[PASS] Valid credentials returned 200 + access and refresh JWT tokens.")

    print("\n2. TESTING INVALID CREDENTIALS DIRECT (port 8000)...")
    r2 = requests.post("http://127.0.0.1:8000/api/auth/token/", json=invalid_payload, timeout=5)
    print(f"Status: {r2.status_code}")
    assert r2.status_code == 401, f"Expected 401, got {r2.status_code}"
    print(f"[PASS] Invalid credentials returned 401 Unauthorized: {r2.json()}")

    print("\n3. TESTING VALID CREDENTIALS VIA VITE PROXY (port 3000)...")
    r3 = requests.post("http://127.0.0.1:3000/api/auth/token/", json=valid_payload, timeout=5)
    print(f"Status: {r3.status_code}")
    assert r3.status_code == 200, f"Expected 200, got {r3.status_code}"
    print("[PASS] Vite proxy returned 200 OK for valid credentials.")

    print("\n4. TESTING INVALID CREDENTIALS VIA VITE PROXY (port 3000)...")
    r4 = requests.post("http://127.0.0.1:3000/api/auth/token/", json=invalid_payload, timeout=5)
    print(f"Status: {r4.status_code}")
    assert r4.status_code == 401, f"Expected 401, got {r4.status_code}"
    print(f"[PASS] Vite proxy returned 401 Unauthorized for invalid credentials.")

    print("\n5. TESTING PROTECTED ENDPOINTS WITH ACCESS TOKEN...")
    access_token = tokens["access"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
    r_cases = requests.get("http://127.0.0.1:3000/api/cases/", headers=headers, timeout=5)
    print(f"GET /api/cases/ status: {r_cases.status_code}")
    assert r_cases.status_code == 200

    r_docs = requests.get("http://127.0.0.1:3000/api/documents/", headers=headers, timeout=5)
    print(f"GET /api/documents/ status: {r_docs.status_code}")
    assert r_docs.status_code == 200

    r_audit = requests.get("http://127.0.0.1:3000/api/audit/verify/", headers=headers, timeout=5)
    print(f"GET /api/audit/verify/ status: {r_audit.status_code}")
    assert r_audit.status_code == 200

    r_ai = requests.get("http://127.0.0.1:3000/api/ai/providers/", headers=headers, timeout=5)
    print(f"GET /api/ai/providers/ status: {r_ai.status_code}")
    assert r_ai.status_code == 200

    print("=" * 70)
    print("ALL 5 AUTHENTICATION TESTS PASSED 100%!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
