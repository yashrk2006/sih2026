import os
import django
import uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.cases.models import Case
from apps.documents.models import Document, DocumentMetadata
from apps.audit.models import AuditEvent

User = get_user_model()

def reset_data():
    print("=" * 75)
    print("RESETTING DATABASE TO CANONICAL SIH26190 DEMO DATASET (0 DUPLICATES)")
    print("=" * 75)

    # 1. Clean existing records
    AuditEvent.objects.all().delete()
    DocumentMetadata.objects.all().delete()
    Document.objects.all().delete()
    Case.objects.all().delete()
    print("[+] Cleared old duplicate records from Audit, DocumentMetadata, Document, and Case tables.")

    admin_user = User.objects.filter(role="ADMIN").first() or User.objects.first()

    # 2. Create Canonical Cases
    case1 = Case.objects.create(
        case_id="CASE-2026-CR-0001",
        title="State vs. Cyberphish Banking Syndicate",
        description="Investigation into unauthorized phishing, mule bank accounts, and corporate fund diversion.",
        police_station="Cyber Crime Police Station, Central District",
        status="ACTIVE",
        created_by=admin_user,
    )

    case2 = Case.objects.create(
        case_id="CASE-2026-CY-0487",
        title="State vs. Aranya Fintech Unauthorized Fund Transfer Case",
        description="Cyber heist investigation involving unauthorized API transaction logs and server breaches.",
        police_station="Cyber & Economic Offences Police Station",
        status="ACTIVE",
        created_by=admin_user,
    )

    print("[+] Created 2 Canonical Cases.")

    # 3. Create Canonical Documents for CASE-2026-CR-0001
    doc1 = Document.objects.create(
        document_id=uuid.UUID("8953ddde-86c1-44e9-9f48-18df63f519d0"),
        case=case1,
        filename="SIH26190_Synthetic_FIR_Test_Document.pdf",
        original_filename="SIH26190_Synthetic_FIR_Test_Document.pdf",
        document_type="FIR",
        mime_type="application/pdf",
        file_size=154200,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status="ACTIVE",
        uploaded_by=admin_user,
    )
    DocumentMetadata.objects.create(
        document=doc1,
        extracted_case_id="CASE-2026-CR-0001",
        extracted_fir_number="FIR-DEMO-2026-0001",
        extracted_persons=["Rohan Mehta", "Priya Nair"],
        extracted_organizations=["Cyberphish Banking Syndicate"],
        extracted_legal_sections=["Section 318 BNS", "Section 66C IT Act"],
        extracted_location="Connaught Place, New Delhi",
        extracted_police_station="Cyber Crime Police Station, Central District",
        extracted_date="2026-08-20",
        extracted_evidence_ids=["EVID-DEMO-001", "EVID-DEMO-002"],
        raw_text="FIRST INFORMATION REPORT (Under Section 154 Cr.P.C / Section 173 BNSS). FIR No: FIR-DEMO-2026-0001. Case: CASE-2026-CR-0001."
    )

    doc2 = Document.objects.create(
        document_id=uuid.UUID("2dd5e432-887d-425e-8441-e26c8531cdf5"),
        case=case1,
        filename="Witness_Statement_Ananya_Sharma.pdf",
        original_filename="Witness_Statement_Ananya_Sharma.pdf",
        document_type="WITNESS_STATEMENT",
        mime_type="application/pdf",
        file_size=84200,
        sha256_hash="c5d2b781a94e09f21b72a412c98031d454a2b90218ef839210c4f8290a129ef2",
        status="ACTIVE",
        uploaded_by=admin_user,
    )
    DocumentMetadata.objects.create(
        document=doc2,
        extracted_case_id="CASE-2026-CR-0001",
        extracted_fir_number="FIR-DEMO-2026-0001",
        extracted_persons=["Ananya Sharma"],
        extracted_organizations=["Cyberphish Banking Syndicate"],
        extracted_legal_sections=["Section 318 BNS"],
        extracted_location="Central District, New Delhi",
        extracted_police_station="Cyber Crime Police Station, Central District",
        extracted_date="2026-08-21",
        extracted_evidence_ids=["EVID-DEMO-003"],
        raw_text="WITNESS STATEMENT OF ANANYA SHARMA in connection with FIR-DEMO-2026-0001."
    )

    doc3 = Document.objects.create(
        document_id=uuid.UUID("34a06521-1969-412a-9d65-7896e7c88a44"),
        case=case1,
        filename="Forensic_Server_Log_Analysis.pdf",
        original_filename="Forensic_Server_Log_Analysis.pdf",
        document_type="FORENSIC_REPORT",
        mime_type="application/pdf",
        file_size=245000,
        sha256_hash="a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
        status="ACTIVE",
        uploaded_by=admin_user,
    )
    DocumentMetadata.objects.create(
        document=doc3,
        extracted_case_id="CASE-2026-CR-0001",
        extracted_fir_number="FIR-DEMO-2026-0001",
        extracted_persons=["Rohan Mehta"],
        extracted_organizations=["Cyberphish Banking Syndicate"],
        extracted_legal_sections=["Section 66C IT Act", "Section 66D IT Act"],
        extracted_location="Server Room 4, New Delhi",
        extracted_police_station="Cyber Crime Police Station, Central District",
        extracted_date="2026-08-21",
        extracted_evidence_ids=["EVID-DEMO-001"],
        raw_text="FORENSIC REPORT: Technical server log analysis confirming IP spoofing and unauthorized database access."
    )

    doc4 = Document.objects.create(
        document_id=uuid.UUID("70faab5f-ebe2-42aa-a610-21f17cc8a2d8"),
        case=case1,
        filename="Charge_Sheet_Cyberphish_Syndicate.pdf",
        original_filename="Charge_Sheet_Cyberphish_Syndicate.pdf",
        document_type="CHARGE_SHEET",
        mime_type="application/pdf",
        file_size=312000,
        sha256_hash="9f8e7d6c5b4a3928172635441324151617181920212223242526272829303132",
        status="ACTIVE",
        uploaded_by=admin_user,
    )
    DocumentMetadata.objects.create(
        document=doc4,
        extracted_case_id="CASE-2026-CR-0001",
        extracted_fir_number="FIR-DEMO-2026-0001",
        extracted_persons=["Rohan Mehta", "Priya Nair", "Ananya Sharma"],
        extracted_organizations=["Cyberphish Banking Syndicate"],
        extracted_legal_sections=["Section 318 BNS", "Section 66C IT Act"],
        extracted_location="Metropolitan Magistrate Court, New Delhi",
        extracted_police_station="Cyber Crime Police Station, Central District",
        extracted_date="2026-08-22",
        extracted_evidence_ids=["EVID-DEMO-001", "EVID-DEMO-002", "EVID-DEMO-003"],
        raw_text="FINAL CHARGE SHEET filed under Section 193 BNSS in CASE-2026-CR-0001."
    )

    # 4. Create Canonical Document for CASE-2026-CY-0487
    doc5 = Document.objects.create(
        document_id=uuid.UUID("fd94fc9b-a10f-4800-bb4f-41d7222eb80e"),
        case=case2,
        filename="SIH26190_Complex_Synthetic_FIR_Test_Document.pdf",
        original_filename="SIH26190_Complex_Synthetic_FIR_Test_Document.pdf",
        document_type="FIR",
        mime_type="application/pdf",
        file_size=198000,
        sha256_hash="8d4a7c91e48f0291a82b99214a1c58e77a11d8820f12456a99214a1c58e77a11",
        status="ACTIVE",
        uploaded_by=admin_user,
    )
    DocumentMetadata.objects.create(
        document=doc5,
        extracted_case_id="CASE-2026-CY-0487",
        extracted_fir_number="FIR-SYN-2026-00487",
        extracted_persons=["Vikram Malhotra", "Priya Nair", "Inspector Arjun Verma"],
        extracted_organizations=["Aranya Fintech Solutions Pvt. Ltd."],
        extracted_legal_sections=["Section 318 BNS", "Section 66C IT Act"],
        extracted_location="Connaught Place, New Delhi",
        extracted_police_station="Cyber & Economic Offences Police Station",
        extracted_date="2026-08-20",
        extracted_evidence_ids=["EVID-SYN-0487-001", "EVID-SYN-0487-005"],
        raw_text="FIR No: FIR-SYN-2026-00487. Case: CASE-2026-CY-0487. Accused: Vikram Malhotra. Company: Aranya Fintech Solutions Pvt. Ltd. Exhibits: EVID-SYN-0487-001, EVID-SYN-0487-005."
    )

    print("[+] Created 5 Canonical Documents across the 2 cases.")
    print("=" * 75)
    print("CANONICAL DATASET RESET COMPLETE (0 DUPLICATES)!")
    print("=" * 75)

if __name__ == "__main__":
    reset_data()
