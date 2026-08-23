import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.cases.models import Case
from apps.documents.models import Document, DocumentMetadata

def inspect_db():
    print("=" * 70)
    print("DATABASE DUPLICATION DIAGNOSTIC AUDIT")
    print("=" * 70)

    cases = Case.objects.all()
    print(f"\n1. TOTAL CASES IN DB: {cases.count()}")
    for c in cases:
        print(f"   - ID: {c.id} | case_id: {c.case_id:<20} | Title: {c.title}")

    docs = Document.objects.all()
    print(f"\n2. TOTAL DOCUMENTS IN DB: {docs.count()}")
    for d in docs:
        c_id = d.case.case_id if d.case else "NO_CASE"
        print(f"   - Document ID: {d.document_id} | Filename: {d.original_filename:<40} | Type: {d.document_type:<18} | Case: {c_id}")

    metas = DocumentMetadata.objects.all()
    print(f"\n3. TOTAL DOCUMENT METADATA IN DB: {metas.count()}")
    for m in metas:
        ev_ids = m.extracted_evidence_ids if isinstance(m.extracted_evidence_ids, list) else []
        print(f"   - Meta ID: {m.id} | Doc ID: {m.document.document_id} | FIR: {m.extracted_fir_number} | Evidence IDs: {ev_ids}")

    print("=" * 70)

if __name__ == "__main__":
    inspect_db()
