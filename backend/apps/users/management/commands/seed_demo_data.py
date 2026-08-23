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
        log_audit_event(
            actor=created_users["admin"],
            action="SYSTEM_EVENT",
            details=f"Asset POL-EQ-0002 (Seized WD Passport 2TB) status set to MAINTENANCE",
            result="SUCCESS",
        )

        self.stdout.write(self.style.SUCCESS("[OK] Seed completed successfully!"))
