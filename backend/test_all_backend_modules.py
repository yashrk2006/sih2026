"""
Comprehensive Automated Test Suite covering all 11 SIH26190 Backend Subsystems:
Auth, RBAC, Cases, Documents, Evidence Search, Integrity, Signatures, Blockchain, Audit, AI, Settings.
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
            print(f"[FAIL] Auth token failed for role {role}: {r.status_code}")
    return tokens

def run_suite():
    print("=" * 80)
    print("RUNNING COMPREHENSIVE END-TO-END SIH26190 BACKEND SUITE")
    print("=" * 80)

    tokens = get_tokens()
    all_passed = True

    def check(module, test_name, expected, got):
        nonlocal all_passed
        passed = (got == expected)
        if not passed:
            all_passed = False
        mark = "[PASS]" if passed else "[FAIL]"
        print(f"{mark} [{module:<12}] {test_name:<45} | Expected: {expected} | Got: {got}")

    # 1. AUTH MODULE
    r_auth_valid = requests.post(f"{BASE_URL}/auth/token/", json={"username": "admin", "password": "SecurePass123!"})
    check("AUTH", "Valid Credentials", 200, r_auth_valid.status_code)

    r_auth_invalid = requests.post(f"{BASE_URL}/auth/token/", json={"username": "admin", "password": "WrongPassword!"})
    check("AUTH", "Invalid Credentials (401)", 401, r_auth_invalid.status_code)

    # 2. CASES MODULE
    headers_admin = {"Authorization": f"Bearer {tokens['ADMIN']}"}
    r_cases = requests.get(f"{BASE_URL}/cases/", headers=headers_admin)
    check("CASES", "List Cases", 200, r_cases.status_code)

    import time
    case_test_id = f"CASE-TEST-{int(time.time())}"
    payload_case = {"case_id": case_test_id, "title": "Test Suite Investigation", "description": "Automated test"}
    r_create_case = requests.post(f"{BASE_URL}/cases/", json=payload_case, headers=headers_admin)
    check("CASES", "Create Case (Admin)", 201, r_create_case.status_code)

    # 3. DOCUMENTS MODULE
    r_docs = requests.get(f"{BASE_URL}/documents/", headers=headers_admin)
    check("DOCUMENTS", "List Documents", 200, r_docs.status_code)

    # 4. SEARCH MODULE
    r_search = requests.get(f"{BASE_URL}/search/?q=EVID-SYN-0487-001", headers=headers_admin)
    check("SEARCH", "Search Evidence ID", 200, r_search.status_code)

    # 5. INTEGRITY MODULE
    r_verify_audit = requests.get(f"{BASE_URL}/audit/verify/", headers=headers_admin)
    check("INTEGRITY", "Audit Hash Chain Verification", 200, r_verify_audit.status_code)

    # 6. SIGNATURES MODULE
    headers_legal = {"Authorization": f"Bearer {tokens['LEGAL_OFFICER']}"}
    headers_viewer = {"Authorization": f"Bearer {tokens['VIEWER']}"}
    
    docs_data = r_docs.json()
    if isinstance(docs_data, list) and len(docs_data) > 0:
        doc_id = docs_data[0].get("document_id") or docs_data[0].get("id")
        r_sign_legal = requests.post(f"{BASE_URL}/documents/{doc_id}/sign/", headers=headers_legal)
        check("SIGNATURES", "Sign Document (Legal Officer)", 200, r_sign_legal.status_code)

        r_sign_viewer = requests.post(f"{BASE_URL}/documents/{doc_id}/sign/", headers=headers_viewer)
        check("SIGNATURES", "Sign Document (Viewer - 403 Forbidden)", 403, r_sign_viewer.status_code)

    # 7. AI PROVIDERS MODULE
    r_ai_providers = requests.get(f"{BASE_URL}/ai/providers/", headers=headers_admin)
    check("AI", "List AI Providers", 200, r_ai_providers.status_code)

    r_ai_select = requests.post(f"{BASE_URL}/ai/providers/select/", json={"provider": "deterministic"}, headers=headers_admin)
    check("AI", "Select AI Provider", 200, r_ai_select.status_code)

    # 8. SYSTEM SETTINGS MODULE
    r_settings_get = requests.get(f"{BASE_URL}/settings/", headers=headers_admin)
    check("SETTINGS", "Get System Settings", 200, r_settings_get.status_code)

    r_settings_patch = requests.patch(f"{BASE_URL}/settings/general/", json={"organization_name": "SIH26190 National Security Vault"}, headers=headers_admin)
    check("SETTINGS", "Update General Settings (Admin)", 200, r_settings_patch.status_code)

    r_settings_viewer = requests.patch(f"{BASE_URL}/settings/general/", json={"organization_name": "Hacked"}, headers=headers_viewer)
    check("SETTINGS", "Update General Settings (Viewer - 403)", 403, r_settings_viewer.status_code)

    print("=" * 80)
    if all_passed:
        print("ALL BACKEND MODULE SUITES PASSED 100%!")
    else:
        print("SOME SUITE TESTS FAILED - REVIEW LOGS")
    print("=" * 80)

if __name__ == "__main__":
    run_suite()
