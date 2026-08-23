"""
Management command to seed initial demonstration data for SIH26190:
- Standard system roles and permissions
- Test user accounts (Admin, Investigator, Legal Officer, Auditor)
- Sample case files
- Sample legal documents with extracted metadata & audit records
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import User, Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentVersion, DocumentMetadata, DocumentType, DocumentStatus
from apps.security.services import encrypt_bytes, compute_sha256
from apps.audit.models import AuditEvent


class Command(BaseCommand):
    help = "Seed initial demonstration users, cases, and legal documents"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding SIH26190 demonstration data..."))

        # 1. Create Users
        users_data = [
            {
                "username": "admin",
                "email": "admin@legal-system.gov.in",
                "role": Role.ADMIN,
                "first_name": "System",
                "last_name": "Administrator",
                "department": "IT & Security",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "username": "investigator1",
                "email": "rajesh.kumar@investigation.gov.in",
                "role": Role.INVESTIGATOR,
                "first_name": "Rajesh",
                "last_name": "Kumar",
                "department": "Financial Fraud Wing",
            },
            {
                "username": "legal1",
                "email": "ananya.sharma@prosecution.gov.in",
                "role": Role.LEGAL_OFFICER,
                "first_name": "Ananya",
                "last_name": "Sharma",
                "department": "High Court Legal Cell",
            },
            {
                "username": "auditor1",
                "email": "vikram.aditya@cag.gov.in",
                "role": Role.AUDITOR,
                "first_name": "Vikram",
                "last_name": "Aditya",
                "department": "Internal Compliance",
            },
            {
                "username": "viewer1",
                "email": "amit.das@public-view.gov.in",
                "role": Role.VIEWER,
                "first_name": "Amit",
                "last_name": "Das",
                "department": "Public Information Cell",
            },
        ]

        import os
        demo_password = os.environ.get("DEMO_ADMIN_PASSWORD", "SecurePass123!")

        created_users = {}
        for udata in users_data:
            username = udata["username"]
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": udata["email"],
                    "role": udata["role"],
                    "first_name": udata["first_name"],
                    "last_name": udata["last_name"],
                    "department": udata["department"],
                    "is_staff": udata.get("is_staff", False),
                    "is_superuser": udata.get("is_superuser", False),
                },
            )
            # Update user fields to keep them in sync
            user.email = udata["email"]
            user.role = udata["role"]
            user.first_name = udata["first_name"]
            user.last_name = udata["last_name"]
            user.department = udata["department"]
            user.is_staff = udata.get("is_staff", False)
            user.is_superuser = udata.get("is_superuser", False)
            user.set_password(demo_password)
            user.save()
            
            if created:
                self.stdout.write(self.style.SUCCESS(f"  [+] Created user: {username} ({udata['role']})"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  [*] Updated/Seeded user: {username} ({udata['role']})"))
            created_users[username] = user

        # 2. Create Sample Cases
        cases_data = [
            {
                "case_id": "CASE-2026-CR-0891",
                "title": "State vs. Apex Cyber Fraud Consortium",
                "description": "Investigation into multi-state phishing network and unauthorized bank transfers.",
                "case_type": "CRIMINAL",
                "status": "ACTIVE",
                "created_by": created_users["admin"],
            },
            {
                "case_id": "CASE-2026-CV-0412",
                "title": "National Infrastructure Land Acquisition Dispute",
                "description": "Litigation regarding compensation claim alignment for NH-44 expansion.",
                "case_type": "CIVIL",
                "status": "ACTIVE",
                "created_by": created_users["legal1"],
            },
        ]

        created_cases = {}
        for cdata in cases_data:
            case, created = Case.objects.get_or_create(
                case_id=cdata["case_id"],
                defaults=cdata,
            )
            # Always ensure demo officers are assigned to cases for relationship mapping
            case.assigned_investigators.add(created_users["investigator1"])
            case.assigned_legal_officers.add(created_users["legal1"])
            
            if created:
                self.stdout.write(self.style.SUCCESS(f"  [+] Created Case: {case.case_id}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  [*] Synced Case: {case.case_id}"))
            created_cases[case.case_id] = case

        # 3. Create Sample Document
        raw_doc_text = (
            "CONFIDENTIAL LEGAL MEMORANDUM\n"
            "Date: 2026-08-15\n"
            "Case Reference: CASE-2026-CR-0891\n"
            "Subject: Evidentiary Audit of Server Logs and Financial Records\n\n"
            "Summary of Evidence:\n"
            "On 10th August 2026, forensically preserved image files were extracted from server IP 192.168.1.100.\n"
            "The initial analysis reveals unauthorized API invocations originating from account ID ACCT-99481.\n"
            "Total estimated financial impact: INR 45,00,000.\n\n"
            "Signatory: Legal Counsel Ananya Sharma"
        )
        doc_bytes = raw_doc_text.encode("utf-8")
        content_hash = compute_sha256(doc_bytes)

        from apps.security.signatures import generate_user_keypair, sign_document_hash

        legal_user = created_users["legal1"]
        public_pem = generate_user_keypair(legal_user.id)
        signature_hex = sign_document_hash(legal_user.id, content_hash)

        doc_title = "evidentiary_audit_report.txt"
        doc, created = Document.objects.get_or_create(
            original_filename=doc_title,
            defaults={
                "case": created_cases["CASE-2026-CR-0891"],
                "filename": doc_title,
                "document_type": DocumentType.EVIDENCE_RECORD,
                "mime_type": "text/plain",
                "file_size": len(doc_bytes),
                "storage_location": "demo/evidentiary_audit_report.txt.enc",
                "is_encrypted": True,
                "sha256_hash": content_hash,
                "current_version": 1,
                "uploaded_by": created_users["investigator1"],
                "status": DocumentStatus.ACTIVE,
                "signature": signature_hex,
                "signed_by": legal_user,
                "signed_at": timezone.now(),
            },
        )

        # Write the encrypted file to disk & backup to DB FileStore on every seed run
        from django.conf import settings
        from pathlib import Path
        from apps.security.services import encrypt_bytes
        from apps.documents.models import DocumentFileStore
        
        ciphertext = encrypt_bytes(doc_bytes)
        
        # Local disk cache write
        storage_root = Path(settings.DOCUMENT_STORAGE_PATH)
        dest_path = storage_root / doc.storage_location
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(ciphertext)

        # DB FileStore write for production persistence
        DocumentFileStore.objects.update_or_create(
            storage_location=doc.storage_location,
            defaults={"encrypted_data": ciphertext}
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"  [+] Created Sample Document: '{doc.original_filename}'"))

            # Version record
            v1 = DocumentVersion.objects.create(
                document=doc,
                version_number=1,
                sha256_hash=content_hash,
                storage_location=doc.storage_location,
                file_size=len(doc_bytes),
                change_description="Initial forensic evidence ingestion",
                uploaded_by=created_users["investigator1"],
            )

            # Metadata record
            DocumentMetadata.objects.create(
                document=doc,
                version=v1,
                raw_text=raw_doc_text,
                extracted_case_id="CASE-2026-CR-0891",
                extracted_date="2026-08-15",
                extracted_persons=["Ananya Sharma", "Rajesh Kumar"],
                extracted_organizations=["Apex Cyber Fraud Consortium"],
                extracted_evidence_ids=["ACCT-99481"],
                extraction_method="plain_text",
                extraction_confidence=1.0,
                classified_type="EVIDENCE_RECORD",
                classification_method="rule_based",
                classification_confidence=1.0,
            )

            from apps.audit.utils import log_audit_event

            log_audit_event(
                actor=created_users["investigator1"],
                action="DOCUMENT_UPLOADED",
                document=doc,
                case=created_cases["CASE-2026-CR-0891"],
                result="SUCCESS",
                details="Uploaded and encrypted evidentiary document",
                ip_address="127.0.0.1",
            )

        # 4. Update Document Compliance settings
        doc.legal_hold_status = True
        doc.retention_category = "FORENSIC_RECORD"
        doc.retention_end_date = timezone.now().date() + timezone.timedelta(days=365 * 10)  # 10 years
        doc.save(update_fields=["legal_hold_status", "retention_category", "retention_end_date"])

        # 5. Share Cases (Collaboration data)
        from apps.users.models import AccessPermission
        case_cv = created_cases["CASE-2026-CV-0412"]
        case_cv.assigned_investigators.add(created_users["investigator1"])
        AccessPermission.objects.get_or_create(
            user=created_users["investigator1"],
            case=case_cv,
            permission_type="READ",
            defaults={"granted_by": created_users["legal1"]},
        )

        # 6. Seed Police Assets
        from apps.assets.models import Asset, AssetType, AssetStatus, AssetCondition

        # Asset 1: Forensic Laptop
        asset_laptop, created_a1 = Asset.objects.get_or_create(
            asset_id="POL-EQ-0001",
            defaults={
                "asset_type": AssetType.LAPTOP,
                "asset_name": "Dell Latitude Forensic Workstation",
                "serial_number": "SN-DELL-88914A",
                "department": "Financial Fraud Wing",
                "current_holder": created_users["investigator1"],
                "case": created_cases["CASE-2026-CR-0891"],
                "status": AssetStatus.ASSIGNED,
                "condition": AssetCondition.EXCELLENT,
                "location": "Locker Room B",
                "notes": "Equipped with Tableau T8u Write Blocker.",
            }
        )
        if not created_a1:
            asset_laptop.current_holder = created_users["investigator1"]
            asset_laptop.case = created_cases["CASE-2026-CR-0891"]
            asset_laptop.status = AssetStatus.ASSIGNED
            asset_laptop.save()

        # Asset 2: Seized Hard Drive
        asset_hdd, created_a2 = Asset.objects.get_or_create(
            asset_id="POL-EQ-0002",
            defaults={
                "asset_type": AssetType.STORAGE,
                "asset_name": "Seized WD Passport 2TB",
                "serial_number": "SN-WD-229410B",
                "department": "Cyber Cell Laboratory",
                "status": AssetStatus.MAINTENANCE,
                "condition": AssetCondition.GOOD,
                "location": "Hardware Lab 3",
                "notes": "Sent for hardware decryption/cloning.",
            }
        )
        if not created_a2:
            asset_hdd.status = AssetStatus.MAINTENANCE
            asset_hdd.save()

        # Log asset transition history in audit trail
        from apps.audit.utils import log_audit_event
        log_audit_event(
            actor=created_users["admin"],
            action="SYSTEM_EVENT",
            details=f"Asset POL-EQ-0001 (Dell Latitude Forensic Workstation) status set to ASSIGNED to Rajesh Kumar",
            result="SUCCESS",
        )
        # Log asset transition history in audit trail
        from apps.audit.utils import log_audit_event
        log_audit_event(
            actor=created_users["admin"],
            action="SYSTEM_EVENT",
            details=f"Asset POL-EQ-0001 (Dell Latitude Forensic Workstation) status set to ASSIGNED to Rajesh Kumar",
            result="SUCCESS",
        )
        log_audit_event(
            actor=created_users["admin"],
            action="SYSTEM_EVENT",
            details=f"Asset POL-EQ-0002 (Seized WD Passport 2TB) status set to MAINTENANCE",
            result="SUCCESS",
        )

        # ── 7. Seed additional documents for all document types ─────────────
        from apps.security.services import encrypt_bytes
        from apps.security.signatures import generate_user_keypair, sign_document_hash
        from pathlib import Path
        from django.conf import settings

        extra_docs = [
            {
                "filename": "fir_CASE-2026-CR-0891.txt",
                "doc_type": DocumentType.FIR,
                "uploader": "investigator1",
                "signer": "investigator1",
                "content": (
                    "FIRST INFORMATION REPORT\n"
                    "FIR No: FIR/2026/CR/0891\n"
                    "Police Station: Cyber Crime Unit, Mumbai\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Date: 2026-08-01\n"
                    "Complainant: Reserve Bank of India – Fraud Prevention Cell\n"
                    "Accused: Apex Cyber Fraud Consortium\n"
                    "Sections: IPC 420, IT Act 66C, BSA 302\n"
                    "Description: Multi-state phishing and unauthorized bank transfer network detected."
                ),
                "persons": ["Rajesh Kumar", "Priya Nair"],
                "orgs": ["Apex Cyber Fraud Consortium", "Reserve Bank of India"],
                "sections": ["420", "66C", "302"],
                "ev_ids": ["FIR/2026/CR/0891"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "police_report_site_survey.txt",
                "doc_type": DocumentType.POLICE_REPORT,
                "uploader": "investigator1",
                "signer": "investigator1",
                "content": (
                    "POLICE REPORT — SITE SURVEY\n"
                    "Date: 2026-08-05\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Officer: Rajesh Kumar, Badge 7723\n"
                    "Location: Server Farm, Plot 44, Navi Mumbai\n"
                    "Findings: Four servers found running unauthorized proxy software.\n"
                    "Sections: IT Act 43A, IPC 385"
                ),
                "persons": ["Rajesh Kumar"],
                "orgs": ["Apex Cyber Fraud Consortium"],
                "sections": ["43A", "385"],
                "ev_ids": ["SRV-44-NM"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "investigation_record_digital_forensics.txt",
                "doc_type": DocumentType.INVESTIGATION_RECORD,
                "uploader": "investigator1",
                "signer": "investigator1",
                "content": (
                    "DIGITAL FORENSICS INVESTIGATION RECORD\n"
                    "Date: 2026-08-10\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Analyst: Forensic Lab, CERT-In\n"
                    "Tool: Autopsy 4.21 / Tableau T8u Write Blocker\n"
                    "Findings: SHA-256 verified disk image extracted from seized WD Passport 2TB.\n"
                    "Evidence ID: EVID-SYN-0487-001\n"
                    "Hash: c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
                ),
                "persons": ["Rajesh Kumar"],
                "orgs": ["CERT-In"],
                "sections": ["IT Act 65B"],
                "ev_ids": ["EVID-SYN-0487-001"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "witness_statement_priya_nair.txt",
                "doc_type": DocumentType.WITNESS_STATEMENT,
                "uploader": "investigator1",
                "signer": "legal1",
                "content": (
                    "WITNESS STATEMENT\n"
                    "Date: 2026-08-12\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Witness: Priya Nair, Account Manager, Aranya Fintech Pvt Ltd\n"
                    "Statement: On 9th August 2026 I noticed anomalous API calls from IP 192.168.1.100.\n"
                    "I immediately reported to compliance and froze account ACCT-99481.\n"
                    "Sections: IPC 193 (Perjury clause acknowledged)"
                ),
                "persons": ["Priya Nair", "Ananya Sharma"],
                "orgs": ["Aranya Fintech Pvt Ltd"],
                "sections": ["193"],
                "ev_ids": ["ACCT-99481"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "charge_sheet_apex_fraud.txt",
                "doc_type": DocumentType.CHARGE_SHEET,
                "uploader": "legal1",
                "signer": "legal1",
                "content": (
                    "CHARGE SHEET\n"
                    "Date: 2026-08-20\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Court: Sessions Court, Mumbai\n"
                    "Accused: Directors of Apex Cyber Fraud Consortium\n"
                    "Charges: Section 420 IPC, Section 66C IT Act, Section 302 BSA\n"
                    "Lead Prosecutor: Ananya Sharma, High Court Legal Cell\n"
                    "Trial Date: 2026-09-15"
                ),
                "persons": ["Ananya Sharma", "Vikram Malhotra"],
                "orgs": ["Apex Cyber Fraud Consortium", "Sessions Court Mumbai"],
                "sections": ["420", "66C", "302"],
                "ev_ids": ["CS/2026/CR/0891"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "forensic_report_disk_image.txt",
                "doc_type": DocumentType.FORENSIC_REPORT,
                "uploader": "investigator1",
                "signer": "investigator1",
                "content": (
                    "FORENSIC ANALYSIS REPORT\n"
                    "Date: 2026-08-13\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Exhibit: WD Passport 2TB – Serial SN-WD-229410B\n"
                    "Tool Chain: Autopsy + Wireshark + Volatility3\n"
                    "RAM Dump Hash: a94a8fe5ccb19ba61c4c0873d391e987982fbbd3\n"
                    "Key Finding: Keylogger binary detected in system32 folder — created 2026-07-28.\n"
                    "Legal Standard: Section 65B Indian Evidence Act; IT Act 79A"
                ),
                "persons": ["Rajesh Kumar"],
                "orgs": ["CERT-In", "Forensic Lab"],
                "sections": ["65B", "79A"],
                "ev_ids": ["EVID-SYN-0487-002", "EVID-SYN-0487-003"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "court_filing_bail_opposition.txt",
                "doc_type": DocumentType.COURT_FILING,
                "uploader": "legal1",
                "signer": "legal1",
                "content": (
                    "COURT FILING — OPPOSITION TO BAIL APPLICATION\n"
                    "Date: 2026-08-22\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Court: Sessions Court, Mumbai — Case No. CR/0891/2026\n"
                    "Filed By: Ananya Sharma, High Court Legal Cell\n"
                    "Grounds: Flight risk; financial evidence still under forensic custody.\n"
                    "Relief Sought: Remand extended to 2026-09-10."
                ),
                "persons": ["Ananya Sharma"],
                "orgs": ["Sessions Court Mumbai"],
                "sections": ["437"],
                "ev_ids": ["CF/2026/CR/0891/BAIL"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "legal_notice_financial_freeze.txt",
                "doc_type": DocumentType.LEGAL_NOTICE,
                "uploader": "legal1",
                "signer": "legal1",
                "content": (
                    "LEGAL NOTICE — ACCOUNT FREEZE ORDER\n"
                    "Date: 2026-08-03\n"
                    "Issuing Authority: Economic Offences Wing, Mumbai Police\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Respondent: Aranya Fintech Pvt Ltd\n"
                    "Subject: Freeze account ACCT-99481 pending investigation.\n"
                    "Sections: PMLA 2002, IPC 102\n"
                    "Compliance Required By: 2026-08-05"
                ),
                "persons": ["Ananya Sharma"],
                "orgs": ["Aranya Fintech Pvt Ltd", "Economic Offences Wing"],
                "sections": ["PMLA 2002", "IPC 102"],
                "ev_ids": ["ACCT-99481"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "judgment_interim_order.txt",
                "doc_type": DocumentType.JUDGMENT,
                "uploader": "legal1",
                "signer": "legal1",
                "content": (
                    "INTERIM ORDER\n"
                    "Court: Sessions Court, Mumbai\n"
                    "Case No: CR/0891/2026\n"
                    "Date: 2026-08-25\n"
                    "Presiding Judge: Hon. Justice Vikram Aditya\n"
                    "Order: Account ACCT-99481 and associated assets remain frozen.\n"
                    "Next Hearing: 2026-09-15\n"
                    "Certified as a true copy under Section 65B."
                ),
                "persons": ["Vikram Aditya", "Ananya Sharma"],
                "orgs": ["Sessions Court Mumbai"],
                "sections": ["65B"],
                "ev_ids": ["ORD/2026/CR/0891/01"],
                "fir_no": "FIR/2026/CR/0891",
            },
            {
                "filename": "other_chain_of_custody_log.txt",
                "doc_type": DocumentType.OTHER,
                "uploader": "investigator1",
                "signer": "investigator1",
                "content": (
                    "CHAIN OF CUSTODY LOG\n"
                    "Date: 2026-08-10\n"
                    "Case Reference: CASE-2026-CR-0891\n"
                    "Item: WD Passport 2TB — Serial SN-WD-229410B\n"
                    "Received By: Rajesh Kumar, Badge 7723\n"
                    "Seal Intact: YES\n"
                    "Transfer History:\n"
                    "  2026-08-10 10:00 — Seized at server farm by Rajesh Kumar\n"
                    "  2026-08-11 09:30 — Transferred to Forensic Lab, CERT-In\n"
                    "  2026-08-14 15:00 — Returned to evidence locker, Cyber Crime Unit\n"
                    "Signature of Custodian: Rajesh Kumar"
                ),
                "persons": ["Rajesh Kumar"],
                "orgs": ["CERT-In", "Cyber Crime Unit"],
                "sections": [],
                "ev_ids": ["COC/2026/CR/0891/WD"],
                "fir_no": "FIR/2026/CR/0891",
            },
        ]

        storage_root = Path(settings.DOCUMENT_STORAGE_PATH)
        generate_user_keypair(created_users["investigator1"].id)
        generate_user_keypair(created_users["legal1"].id)

        for ddata in extra_docs:
            if Document.objects.filter(original_filename=ddata["filename"]).exists():
                self.stdout.write(f"  [~] Skip (exists): {ddata['filename']}")
                continue

            doc_bytes_ex = ddata["content"].encode("utf-8")
            content_hash_ex = compute_sha256(doc_bytes_ex)
            signer_user = created_users[ddata["signer"]]
            sig_hex = sign_document_hash(signer_user.id, content_hash_ex)

            storage_rel = f"demo/{ddata['filename']}.enc"
            ciphertext_ex = encrypt_bytes(doc_bytes_ex)

            dest = storage_root / storage_rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(ciphertext_ex)

            DocumentFileStore.objects.update_or_create(
                storage_location=storage_rel,
                defaults={"encrypted_data": ciphertext_ex}
            )

            doc_ex = Document.objects.create(
                case=created_cases["CASE-2026-CR-0891"],
                filename=ddata["filename"],
                original_filename=ddata["filename"],
                document_type=ddata["doc_type"],
                mime_type="text/plain",
                file_size=len(doc_bytes_ex),
                storage_location=storage_rel,
                is_encrypted=True,
                sha256_hash=content_hash_ex,
                current_version=1,
                uploaded_by=created_users[ddata["uploader"]],
                status=DocumentStatus.ACTIVE,
                signature=sig_hex,
                signed_by=signer_user,
                signed_at=timezone.now(),
                legal_hold_status=True,
                retention_category="FORENSIC_RECORD",
                retention_end_date=timezone.now().date() + timezone.timedelta(days=365 * 10),
            )

            v_ex = DocumentVersion.objects.create(
                document=doc_ex,
                version_number=1,
                sha256_hash=content_hash_ex,
                storage_location=storage_rel,
                file_size=len(doc_bytes_ex),
                change_description="Initial ingestion via seed_demo_data",
                uploaded_by=created_users[ddata["uploader"]],
            )

            DocumentMetadata.objects.create(
                document=doc_ex,
                version=v_ex,
                raw_text=ddata["content"],
                extracted_case_id="CASE-2026-CR-0891",
                extracted_fir_number=ddata.get("fir_no", ""),
                extracted_date="2026-08-15",
                extracted_persons=ddata.get("persons", []),
                extracted_organizations=ddata.get("orgs", []),
                extracted_legal_sections=ddata.get("sections", []),
                extracted_evidence_ids=ddata.get("ev_ids", []),
                extraction_method="plain_text",
                extraction_confidence=1.0,
                classified_type=ddata["doc_type"],
                classification_method="rule_based",
                classification_confidence=1.0,
            )

            log_audit_event(
                actor=created_users[ddata["uploader"]],
                action="DOCUMENT_UPLOADED",
                document=doc_ex,
                case=created_cases["CASE-2026-CR-0891"],
                result="SUCCESS",
                details=f"Seeded {ddata['doc_type']} document: {ddata['filename']}",
                ip_address="127.0.0.1",
            )
            self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {ddata['doc_type']}: {ddata['filename']}"))

        self.stdout.write(self.style.SUCCESS("[OK] Seed completed successfully!"))

