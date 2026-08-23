"""
run_full_demo.py — SIH26190 Full End-to-End Demo Script.

Simulates the complete user workflow via HTTP API:
  1. Login as admin
  2. List Cases & Documents (Overview)
  3. Refresh session (token re-use)
  4. Upload a document
  5. Search evidence
  6. Verify document integrity
  7. Sign document (as Legal Officer)
  8. Check blockchain proof
  9. Verify audit hash chain
  10. Logout (token blacklist)
  11. Re-login to confirm session cycle
"""

import sys
import requests
import os
import time

BASE = "http://127.0.0.1:8000/api"
DEMO_FILE = os.path.join(os.path.dirname(__file__), "SIH26190_Synthetic_FIR_Test_Document.pdf")

PASS = 0
FAIL = 0

def step(num, title, ok, detail=""):
    global PASS, FAIL
    mark = "[PASS]" if ok else "[FAIL]"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {mark}  Step {num:02d}: {title}")
    if detail:
        print(f"          {detail}")

def get_token(username, password):
    r = requests.post(f"{BASE}/auth/token/", json={"username": username, "password": password})
    if r.status_code == 200:
        return r.json().get("access"), r.json().get("refresh")
    return None, None

def auth(token):
    return {"Authorization": f"Bearer {token}"}

print()
print("=" * 70)
print("  SIH26190  FULL END-TO-END DEMO RUN")
print("=" * 70)
print()

# STEP 1 — Login
token, refresh = get_token("admin", "SecurePass123!")
step(1, "Login as ADMIN", token is not None, f"JWT access token issued")

if not token:
    print("[ABORT] Cannot proceed without auth token.")
    sys.exit(1)

# STEP 2 — Overview: list cases and documents
r_cases = requests.get(f"{BASE}/cases/", headers=auth(token))
r_docs  = requests.get(f"{BASE}/documents/", headers=auth(token))
step(2, "Overview — List Cases & Documents",
     r_cases.status_code == 200 and r_docs.status_code == 200,
     f"Cases: {len(r_cases.json())}  |  Documents: {len(r_docs.json())}")

# STEP 3 — Refresh session (re-use token for /api/users/me)
r_me = requests.get(f"{BASE}/users/me/", headers=auth(token))
step(3, "Session Persistence — GET /api/users/me/",
     r_me.status_code == 200,
     f"Authenticated user: {r_me.json().get('username', '?')}  role: {r_me.json().get('role', '?')}")

# STEP 4 — Upload document
docs_list = r_docs.json()
doc_id = docs_list[0]["document_id"] if docs_list else None

# Try a real upload if test file exists; otherwise test the endpoint reachability
if os.path.exists(DEMO_FILE):
    with open(DEMO_FILE, "rb") as f:
        r_upload = requests.post(
            f"{BASE}/documents/upload/",
            data={"case": "CASE-2026-CR-0001", "document_type": "FIR"},
            files={"file": (os.path.basename(DEMO_FILE), f, "application/pdf")},
            headers=auth(token)
        )
    step(4, "Upload Document — POST /api/documents/upload/",
         r_upload.status_code in (200, 201),
         f"Response: {r_upload.status_code}  |  {r_upload.json().get('message', r_upload.json().get('document_id', ''))}")
else:
    # Verify endpoint is reachable (no file)
    r_upload_check = requests.post(f"{BASE}/documents/upload/", headers=auth(token))
    step(4, "Upload Document — Endpoint Reachable (no test file present)",
         r_upload_check.status_code in (400, 200, 201),
         f"Endpoint responds: HTTP {r_upload_check.status_code}")

# STEP 5 — Search evidence
r_search = requests.get(f"{BASE}/search/?q=EVID-DEMO-001", headers=auth(token))
step(5, "Evidence Search — GET /api/search/?q=EVID-DEMO-001",
     r_search.status_code == 200 and len(r_search.json()) > 0,
     f"Results returned: {len(r_search.json())} document(s)")

# STEP 6 — Integrity verification
if doc_id:
    r_integrity = requests.get(f"{BASE}/documents/{doc_id}/verify-integrity/", headers=auth(token))
    integrity_status = r_integrity.json().get("status", "?") if r_integrity.status_code == 200 else f"HTTP {r_integrity.status_code}"
    step(6, f"Integrity Check — /api/documents/{doc_id[:8]}…/verify-integrity/",
         r_integrity.status_code == 200,
         f"Status: {integrity_status}")
else:
    step(6, "Integrity Check", False, "No document ID available")

# STEP 7 — Sign document (Legal Officer)
legal_token, _ = get_token("legal1", "SecurePass123!")
if legal_token and doc_id:
    r_sign = requests.post(f"{BASE}/documents/{doc_id}/sign/", headers=auth(legal_token))
    step(7, "Digital Signature — POST /api/documents/{id}/sign/ (Legal Officer)",
         r_sign.status_code == 200,
         f"Signed by: {r_sign.json().get('signed_by', '?')}  at: {str(r_sign.json().get('signed_at','?'))[:19]}")
else:
    step(7, "Digital Signature", False, "Could not get legal1 token or doc_id")

# STEP 7b — Confirm viewer cannot sign (RBAC check)
viewer_token, _ = get_token("demo_viewer", "SecurePass123!")
if viewer_token and doc_id:
    r_sign_v = requests.post(f"{BASE}/documents/{doc_id}/sign/", headers=auth(viewer_token))
    step(8, "RBAC Guard — Viewer cannot sign (must be 403)",
         r_sign_v.status_code == 403,
         f"Viewer sign attempt returned: HTTP {r_sign_v.status_code}")

# STEP 8 — Blockchain proof
if doc_id:
    r_bc = requests.get(f"{BASE}/documents/{doc_id}/blockchain-proof/", headers=auth(token))
    bc_anchors = len(r_bc.json().get("blockchain_anchors", [])) if r_bc.status_code == 200 else 0
    step(9, "Blockchain Proof — GET /api/documents/{id}/blockchain-proof/",
         r_bc.status_code == 200,
         f"EVM anchors on record: {bc_anchors}  |  Current integrity: {r_bc.json().get('current_integrity', {}).get('status', '?')}")

# STEP 9 — Audit hash chain
r_verify_chain = requests.get(f"{BASE}/audit/verify/", headers=auth(token))
chain_ok = r_verify_chain.json().get("valid", False) if r_verify_chain.status_code == 200 else False
step(10, "Audit Chain Verification — GET /api/audit/verify/",
     r_verify_chain.status_code == 200 and chain_ok,
     f"Chain valid: {chain_ok}  |  Events: {r_verify_chain.json().get('total_events','?')}")

# STEP 10 — Logout (JWT blacklist via refresh token)
if refresh:
    r_logout = requests.post(f"{BASE}/auth/token/blacklist/", json={"refresh": refresh})
    step(11, "Logout — POST /api/auth/token/blacklist/",
         r_logout.status_code in (200, 205),
         f"Refresh token blacklisted: HTTP {r_logout.status_code}")
else:
    step(11, "Logout", False, "No refresh token available")

# STEP 11 — Re-login
token2, _ = get_token("admin", "SecurePass123!")
step(12, "Re-Login — Full session cycle complete",
     token2 is not None,
     f"New access token issued successfully")

# Final Report
print()
print("=" * 70)
total = PASS + FAIL
print(f"  DEMO RESULT:  {PASS}/{total} steps PASSED  |  {FAIL} FAILED")
if FAIL == 0:
    print("  STATUS: FULL DEMO PASSED")
else:
    print("  STATUS: PARTIAL — REVIEW ABOVE FAILURES")
print("=" * 70)
print()

sys.exit(0 if FAIL == 0 else 1)
