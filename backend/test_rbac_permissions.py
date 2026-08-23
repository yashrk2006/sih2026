"""
Automated RBAC test suite verifying server-side DRF permissions across all 5 roles.
"""
import requests

BASE_URL = "http://127.0.0.1:8000/api"

USERS = {
    "ADMIN": ("admin", "SecurePass123!"),
    "INVESTIGATOR": ("investigator1", "SecurePass123!"),
    "LEGAL_OFFICER": ("legal1", "SecurePass123!"),
    "AUDITOR": ("auditor1", "SecurePass123!"),
    "VIEWER": ("demo_viewer", "SecurePass123!"),
}

def get_tokens():
    tokens = {}
    for role, (username, password) in USERS.items():
        r = requests.post(f"{BASE_URL}/auth/token/", json={"username": username, "password": password})
        if r.status_code == 200:
            tokens[role] = r.json()["access"]
        else:
            print(f"[FAIL] Failed to obtain token for role {role}: {r.status_code}")
    return tokens

def test_rbac():
    print("=" * 75)
    print("RUNNING AUTOMATED SERVER-SIDE RBAC PERMISSION TEST SUITE")
    print("=" * 75)

    tokens = get_tokens()
    all_passed = True

    def check(test_name, role, expected_status, status):
        nonlocal all_passed
        passed = (status == expected_status)
        if not passed:
            all_passed = False
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"{mark} {test_name} | Role: {role:<14} | Expected: {expected_status} | Got: {status}")

    # 1. Test GET /api/cases/
    for role in USERS.keys():
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        r = requests.get(f"{BASE_URL}/cases/", headers=headers)
        check("GET /api/cases/", role, 200, r.status_code)

    # 2. Test GET /api/documents/
    for role in USERS.keys():
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        r = requests.get(f"{BASE_URL}/documents/", headers=headers)
        check("GET /api/documents/", role, 200, r.status_code)

    # 3. Test POST /api/cases/ (Case Creation: Admin & Investigator only)
    for role in USERS.keys():
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        payload = {"case_id": f"CASE-RBAC-TEST-{role}", "title": f"Test Case {role}", "description": "RBAC test"}
        r = requests.post(f"{BASE_URL}/cases/", json=payload, headers=headers)
        expected = 201 if role in ("ADMIN", "INVESTIGATOR") else 403
        check("POST /api/cases/", role, expected, r.status_code)

    # 4. Test PATCH /api/settings/general/ (System Settings: Admin only)
    for role in USERS.keys():
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        payload = {"organization_name": "Test Org Security"}
        r = requests.patch(f"{BASE_URL}/settings/general/", json=payload, headers=headers)
        expected = 200 if role == "ADMIN" else 403
        check("PATCH /api/settings/general/", role, expected, r.status_code)

    # 5. Test Unauthenticated Requests (Must return 401 Unauthorized)
    r_unauth = requests.get(f"{BASE_URL}/cases/")
    check("GET /api/cases/ (Unauthenticated)", "ANONYMOUS", 401, r_unauth.status_code)

    print("=" * 75)
    if all_passed:
        print("ALL RBAC PERMISSION TESTS PASSED 100%!")
    else:
        print("SOME RBAC TESTS FAILED - INSPECT LOGS ABOVE")
    print("=" * 75)

if __name__ == "__main__":
    test_rbac()
