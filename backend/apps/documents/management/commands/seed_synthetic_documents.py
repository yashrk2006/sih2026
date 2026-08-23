"""
Management command to seed synthetic demo dataset for SIH26190:
- 5 Fictional Cases (CASE-2026-CR-0001 to CASE-2026-CR-0005)
- 8 Synthetic Document Types (FIR, Police Report, Witness Statement, Investigation Report, Charge Sheet, Evidence Record, Court Filing, Forensic Report)
- Zero real PII
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import User, Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentType
from apps.documents.pipeline import ingest_document
from apps.security.signatures import generate_user_keypair, sign_document_hash
from apps.blockchain.service import anchor_hash


class Command(BaseCommand):
    help = "Seed 5 synthetic cases and 8 fictional document types for SIH26190"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Generating synthetic demonstration dataset..."))

        # 1. Ensure Standard Users
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@legal-system.gov.in", "role": Role.ADMIN, "is_staff": True, "is_superuser": True}
        )
        inv_user, _ = User.objects.get_or_create(
            username="investigator1",
            defaults={"email": "rajesh.kumar@investigation.gov.in", "role": Role.INVESTIGATOR}
        )
        legal_user, _ = User.objects.get_or_create(
            username="legal1",
            defaults={"email": "ananya.sharma@prosecution.gov.in", "role": Role.LEGAL_OFFICER}
        )

        generate_user_keypair(legal_user.id)

        # 2. Create 5 Synthetic Cases
        synthetic_cases = [
            {
                "case_id": "CASE-2026-CR-0001",
                "title": "State vs. Cyberphish Banking Syndicate",
                "description": "Multi-state credential harvesting and wire fraud investigation.",
                "case_type": "CRIMINAL",
                "status": "ACTIVE",
            },
            {
                "case_id": "CASE-2026-CR-0002",
                "title": "State vs. Metro Transit Procurement Irregularities",
                "description": "Alleged kickbacks and invoice inflation in urban rail procurement.",
                "case_type": "INVESTIGATION",
                "status": "ACTIVE",
            },
            {
                "case_id": "CASE-2026-CV-0003",
                "title": "Green Energy Patent Infringement Dispute",
                "description": "Civil suit regarding photovoltaic cell storage algorithm trade secrets.",
                "case_type": "CIVIL",
                "status": "ACTIVE",
            },
            {
                "case_id": "CASE-2026-CR-0004",
                "title": "State vs. Northern Highway Cargo Theft",
                "description": "Hijacking of semiconductor component transport trucks on NH-44.",
                "case_type": "CRIMINAL",
                "status": "ACTIVE",
            },
            {
                "case_id": "CASE-2026-CR-0005",
                "title": "State vs. Horizon Pharmaceuticals Adulteration",
                "description": "Substandard ingredient substitution in exported medicinal batches.",
                "case_type": "FORENSIC",
                "status": "ACTIVE",
            },
        ]

        created_cases = {}
        for cdata in synthetic_cases:
            c_obj, _ = Case.objects.get_or_create(
                case_id=cdata["case_id"],
                defaults={
                    "title": cdata["title"],
                    "description": cdata["description"],
                    "case_type": cdata["case_type"],
                    "status": cdata["status"],
                    "created_by": admin_user,
                }
            )
            c_obj.assigned_investigators.add(inv_user)
            c_obj.assigned_legal_officers.add(legal_user)
            created_cases[cdata["case_id"]] = c_obj
            self.stdout.write(self.style.SUCCESS(f"  [+] Case: {c_obj.case_id} — {c_obj.title}"))

        # 3. 8 Synthetic Document Types Across Cases
        synthetic_docs = [
            {
                "filename": "FIR_001_Cyberphish.txt",
                "case_id": "CASE-2026-CR-0001",
                "doc_type": DocumentType.FIR,
                "content": (
                    "FIRST INFORMATION REPORT (FIR)\n"
                    "FIR No: 104/2026\n"
                    "Date: 2026-02-10\n"
                    "Police Station: Cyber Crime Cell Delhi\n"
                    "Case Reference: CASE-2026-CR-0001\n"
                    "Complainant: National Bank Fraud Control Unit\n"
                    "Under Section: Section 66D IT Act, Section 420 IPC\n\n"
                    "Details of Offence:\n"
                    "Unauthorized phishing domains impersonating netbanking portals were detected on 08-02-2026.\n"
                    "Suspect account ACCT-99182 received fraudulently diverted funds totaling INR 32,50,000.\n"
                    "Officer In-Charge: Inspector Rajesh Kumar"
                ),
            },
            {
                "filename": "Police_Beat_Report_Metro.txt",
                "case_id": "CASE-2026-CR-0002",
                "doc_type": DocumentType.POLICE_REPORT,
                "content": (
                    "POLICE STATION INCIDENT REPORT\n"
                    "Date: 2026-03-14\n"
                    "Police Station: Connaught Place Station\n"
                    "Case Reference: CASE-2026-CR-0002\n\n"
                    "Summary:\n"
                    "Station house officer conducted preliminary inspection of Metro Transit project offices.\n"
                    "Sealed audit logs and vendor ledgers were secured under evidence memo 88/2026.\n"
                    "Suspects identified: Vendor Apex Infra Tech and procurement clerk V. Mehta."
                ),
            },
            {
                "filename": "Witness_Statement_Driver.txt",
                "case_id": "CASE-2026-CR-0004",
                "doc_type": DocumentType.WITNESS_STATEMENT,
                "content": (
                    "STATEMENT OF WITNESS UNDER SECTION 161 CrPC\n"
                    "Date: 2026-04-02\n"
                    "Case Reference: CASE-2026-CR-0004\n"
                    "Deponent: Witness Ramesh Singh (Cargo Truck Driver)\n\n"
                    "Statement:\n"
                    "I hereby state on oath that on 01-04-2026 at 23:30 hours near NH-44 Toll Plaza,\n"
                    "an unmarked dark SUV intercepted container truck container-ID CONT-7741.\n"
                    "Three masked individuals forced open the rear latch and removed 40 crates of semiconductor chips.\n"
                    "Signed: Ramesh Singh"
                ),
            },
            {
                "filename": "Investigation_Report_Pharma.txt",
                "case_id": "CASE-2026-CR-0005",
                "doc_type": DocumentType.INVESTIGATION_REPORT,
                "content": (
                    "DETAILED INVESTIGATION REPORT\n"
                    "Case Reference: CASE-2026-CR-0005\n"
                    "Date: 2026-05-18\n"
                    "Subject: Field Investigation Findings on Horizon Pharmaceuticals Facility\n\n"
                    "Findings:\n"
                    "Inspection of Batch B-991A revealed unauthorized substitution of Active Pharmaceutical Ingredient (API).\n"
                    "Discrepancies in raw material receipts confirmed 1,200 kg of industrial grade filler was used.\n"
                    "Lead Investigator: Inspector Rajesh Kumar"
                ),
            },
            {
                "filename": "Charge_Sheet_Cyberphish.txt",
                "case_id": "CASE-2026-CR-0001",
                "doc_type": DocumentType.CHARGE_SHEET,
                "content": (
                    "FINAL CHARGE SHEET UNDER SECTION 173 CrPC\n"
                    "Court: Court of Chief Metropolitan Magistrate Delhi\n"
                    "Case Reference: CASE-2026-CR-0001\n"
                    "FIR No: 104/2026\n"
                    "Date: 2026-06-01\n\n"
                    "Accused Charged:\n"
                    "1. Accused A. Verma (Mastermind)\n"
                    "2. Accused S. Patel (Mule Account Operator)\n\n"
                    "Offences Charged: Section 120B, 420, 468 IPC and Section 66D IT Act.\n"
                    "Prosecution Counsel: Ananya Sharma"
                ),
            },
            {
                "filename": "Evidence_Record_HardDrive.txt",
                "case_id": "CASE-2026-CR-0001",
                "doc_type": DocumentType.EVIDENCE_RECORD,
                "content": (
                    "EVIDENCE SEIZURE RECORD & CHAIN OF CUSTODY\n"
                    "Exhibit ID: Exhibit E-101\n"
                    "Case Reference: CASE-2026-CR-0001\n"
                    "Date: 2026-02-12\n\n"
                    "Seized Item: Seagate 2TB External Hard Drive (Serial: S2TB-99281)\n"
                    "Seized From: Premises of Accused A. Verma\n"
                    "Sealing Officer: Inspector Rajesh Kumar\n"
                    "Chain of Custody Status: Forensic Locker 4B Sealed"
                ),
            },
            {
                "filename": "Court_Filing_Patent_Bail.txt",
                "case_id": "CASE-2026-CV-0003",
                "doc_type": DocumentType.COURT_FILING,
                "content": (
                    "IN THE HIGH COURT OF DELHI\n"
                    "CIVIL MISC PETITION NO. 441/2026\n"
                    "Case Reference: CASE-2026-CV-0003\n\n"
                    "Petitioner: Solartech Innovations Pvt Ltd\n"
                    "Respondent: Green Energy Corp\n\n"
                    "Application Under Order 39 Rules 1 & 2 CPC for Temporary Injunction.\n"
                    "The Petitioner respectfully prays for restraining Respondent from commercializing Solar Patent US-99182."
                ),
            },
            {
                "filename": "Forensic_Report_Ballistics.txt",
                "case_id": "CASE-2026-CR-0005",
                "doc_type": DocumentType.FORENSIC_REPORT,
                "content": (
                    "FORENSIC SCIENCE LABORATORY (FSL) EXAMINATION REPORT\n"
                    "FSL Report No: FSL-2026-CHEM-884\n"
                    "Case Reference: CASE-2026-CR-0005\n"
                    "Date: 2026-05-20\n\n"
                    "Chemical & Toxicology Examination:\n"
                    "Sample Mark: Sample S-1 (Medicinal Solution Batch B-991A)\n"
                    "Results: Purity level registered 42.1% against standard requirement of 99.0%.\n"
                    "Contaminant Identified: Diethylene Glycol 12.4% w/v.\n"
                    "Senior Scientific Officer: Dr. K. N. Rao"
                ),
            },
        ]

        for ddata in synthetic_docs:
            case_obj = created_cases[ddata["case_id"]]
            content_bytes = ddata["content"].encode("utf-8")

            res = ingest_document(
                file_bytes=content_bytes,
                original_filename=ddata["filename"],
                uploaded_by=inv_user,
                change_description=f"Initial ingestion of {ddata['doc_type']}",
                manual_case=case_obj,
            )

            if res["success"]:
                doc_obj = res["document"]
                doc_obj.document_type = ddata["doc_type"]
                doc_obj.save()

                # Sign document
                from apps.security.signatures import sign_document_hash
                sig_hex = sign_document_hash(legal_user.id, doc_obj.sha256_hash)
                doc_obj.signature = sig_hex
                doc_obj.signed_by = legal_user
                doc_obj.signed_at = timezone.now()
                doc_obj.save()

                anchor_res = anchor_hash(
                    sha256_hex=doc_obj.sha256_hash,
                    document_id=str(doc_obj.document_id),
                    version=doc_obj.current_version,
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [+] Document Ingested & Anchored: '{doc_obj.original_filename}' "
                        f"({ddata['doc_type']}) → {ddata['case_id']}"
                    )
                )

        self.stdout.write(self.style.SUCCESS("[OK] Synthetic demo dataset created successfully!"))
