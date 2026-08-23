"""
Test runner script to verify evidence search for all 12 test queries.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User
from apps.search.service import keyword_search

def test_queries():
    admin = User.objects.get(username="admin")
    
    test_cases = [
        "EVID-SYN-0487-001",
        "EVID-SYN-0487-005",
        "FIR-SYN-2026-00487",
        "CASE-2026-CY-0487",
        "Vikram Malhotra",
        "Priya Nair",
        "Aranya Fintech",
        "Cyber Crime",
        "318",
        "66C",
        "8d4a7c91",
        "Cyber & Economic Offences Police Station",
    ]

    print("=" * 70)
    print("VERIFYING EVIDENCE SEARCH FOR ALL 12 TEST QUERIES")
    print("=" * 70)

    all_passed = True
    for query in test_cases:
        results = keyword_search(query, admin)
        found = len(results) > 0
        status = "[PASS]" if found else "[FAIL]"
        if not found:
            all_passed = False
        
        doc_names = [r["filename"] for r in results]
        print(f"{status} Query: '{query}' -> Found {len(results)} match(es): {doc_names}")

    print("=" * 70)
    if all_passed:
        print("ALL 12 EVIDENCE SEARCH QUERIES PASSED 100%!")
    else:
        print("SOME QUERIES FAILED — INSPECT LOGS")
    print("=" * 70)

if __name__ == "__main__":
    test_queries()
