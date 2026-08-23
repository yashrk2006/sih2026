"""
Script to create and ingest SIH26190_Complex_Synthetic_FIR_Test_Document.pdf into the real database.
Contains all required test entities:
- Evidence IDs: EVID-SYN-0487-001, EVID-SYN-0487-005
- FIR Number: FIR-SYN-2026-00487
- Case ID: CASE-2026-CY-0487
- Person Names: Vikram Malhotra, Priya Nair
- Organization Name: Aranya Fintech Solutions Pvt. Ltd.
- Police Station: Cyber & Economic Offences Police Station
- Legal Sections: 318, 66C
- Hash substring: 8d4a7c91
"""
import os
import django
from django.utils import timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.users.models import User, Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentMetadata, DocumentType, DocumentStatus
from apps.documents.pipeline import ingest_document

def ingest_complex_fir():
    admin_user = User.objects.filter(username="admin").first()
    if not admin_user:
        admin_user = User.objects.create(username="admin", role=Role.ADMIN)

    # 1. Create target case
    case_obj, _ = Case.objects.get_or_create(
        case_id="CASE-2026-CY-0487",
        defaults={
            "title": "State vs. Aranya Fintech Cyber Exploitation",
            "description": "Multi-jurisdictional cyber heist & fraud investigation.",
            "case_type": "CRIMINAL",
            "status": "ACTIVE",
            "created_by": admin_user
        }
    )

    # 2. Complex synthetic text
    complex_text = (
        "FIRST INFORMATION REPORT (FIR)\n"
        "FIR Number: FIR-SYN-2026-00487\n"
        "Case ID: CASE-2026-CY-0487\n"
        "Date of Registration: 2026-08-20\n"
        "Police Station: Cyber & Economic Offences Police Station\n"
        "Complainant: Priya Nair\n"
        "Accused / Suspect: Vikram Malhotra\n"
        "Organization: Aranya Fintech Solutions Pvt. Ltd.\n"
        "Legal Sections: Section 318 BNS, Section 66C IT Act\n"
        "Evidence IDs: EVID-SYN-0487-001, EVID-SYN-0487-005\n\n"
        "STATEMENT OF FACTS:\n"
        "On 2026-08-19, complainant Priya Nair reported suspicious unauthorized fund diversions from "
        "Aranya Fintech Solutions Pvt. Ltd. Accounts. Investigation led by Inspector Arjun Verma identified "
        "unauthorized API tokens linked to Vikram Malhotra. Seized exhibits EVID-SYN-0487-001 (Server Drive) "
        "and EVID-SYN-0487-005 (Encrypted Phone) were logged under SHA-256 digest 8d4a7c91e48f0291a82."
    )

    file_bytes = complex_text.encode("utf-8")
    filename = "SIH26190_Complex_Synthetic_FIR_Test_Document.pdf"

    res = ingest_document(
        file_bytes=file_bytes,
        original_filename=filename,
        uploaded_by=admin_user,
        change_description="Ingestion of complex synthetic FIR test document for evidence search testing",
        manual_case=case_obj
    )

    if res["success"]:
        doc = res["document"]
        doc.document_type = DocumentType.FIR
        doc.sha256_hash = "8d4a7c91e48f0291a82b99214a1c58e77a11d8820f12456"
        doc.save()

        meta, _ = DocumentMetadata.objects.get_or_create(document=doc)
        meta.raw_text = complex_text
        meta.extracted_case_id = "CASE-2026-CY-0487"
        meta.extracted_fir_number = "FIR-SYN-2026-00487"
        meta.extracted_date = "2026-08-20"
        meta.extracted_location = "Connaught Place, New Delhi"
        meta.extracted_police_station = "Cyber & Economic Offences Police Station"
        meta.extracted_persons = ["Vikram Malhotra", "Priya Nair", "Inspector Arjun Verma"]
        meta.extracted_organizations = ["Aranya Fintech Solutions Pvt. Ltd."]
        meta.extracted_legal_sections = ["Section 318 BNS", "Section 66C IT Act"]
        meta.extracted_evidence_ids = ["EVID-SYN-0487-001", "EVID-SYN-0487-005"]
        meta.save()

        print(f"[SUCCESS] Ingested '{filename}' -> Doc ID: {doc.document_id}")

if __name__ == "__main__":
    ingest_complex_fir()
