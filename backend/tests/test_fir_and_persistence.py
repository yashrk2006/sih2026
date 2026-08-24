import hashlib
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from pathlib import Path
from django.conf import settings

from apps.users.models import User, Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentVersion, DocumentFileStore, DocumentType
from apps.audit.models import AuditEvent
from apps.security.services import (
    compute_sha256,
    get_document_storage_root,
    verify_stored_document
)

class FIROnPersistenceTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.admin = User.objects.create_user(
            username="admin_test", email="admin_test@test.com", password="SecurePass123!", role=Role.ADMIN
        )
        self.investigator = User.objects.create_user(
            username="investigator_test", email="inv_test@test.com", password="SecurePass123!", role=Role.INVESTIGATOR
        )
        self.viewer = User.objects.create_user(
            username="viewer_test", email="view_test@test.com", password="SecurePass123!", role=Role.VIEWER
        )

        # Create case
        self.case = Case.objects.create(
            case_id="CASE-TEST-101",
            title="Assault at Central Plaza",
            case_type="CRIMINAL",
            status="ACTIVE",
            created_by=self.admin
        )
        # Assign investigator
        self.case.assigned_investigators.add(self.investigator)

    def test_fir_creation_with_attachment_success(self):
        self.client.force_authenticate(user=self.investigator)
        
        file_content = b"Official FIR Attachment Content"
        file_hash = compute_sha256(file_content)
        uploaded_file = SimpleUploadedFile("fir_attach.pdf", file_content, content_type="application/pdf")
        
        payload = {
            "fir_number": "FIR-999-XYZ",
            "case_id": self.case.case_id,
            "police_station": "Central P.S.",
            "date": "2026-08-24",
            "officer": "Inspector Vikram",
            "applicable_sections": "307 IPC, 34 IPC",
            "description": "Attempted robbery and physical assault.",
            "file": uploaded_file
        }
        
        response = self.client.post("/api/documents/fir/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        
        data = response.data
        self.assertTrue(data["success"])
        self.assertEqual(data["document_type"], "FIR")
        self.assertEqual(data["case_id"], self.case.case_id)
        self.assertEqual(data["sha256"], file_hash)
        
        # Verify Case model fields updated
        self.case.refresh_from_db()
        self.assertEqual(self.case.fir_number, "FIR-999-XYZ")
        self.assertEqual(self.case.police_station, "Central P.S.")
        
        # Verify document metadata
        doc = Document.objects.get(document_id=data["document_id"])
        self.assertEqual(doc.document_type, "FIR")
        metadata = doc.metadata
        self.assertEqual(metadata.extracted_fir_number, "FIR-999-XYZ")
        self.assertIn("Inspector Vikram", metadata.extracted_persons)
        
        # Verify actual file persistence in DB FileStore
        store_entry = DocumentFileStore.objects.get(storage_location=doc.storage_location)
        self.assertIsNotNone(store_entry.encrypted_data)
        
        # Verify Audit Log
        audit_exists = AuditEvent.objects.filter(
            document=doc,
            action="DOCUMENT_UPLOADED",
            result="SUCCESS"
        ).exists()
        self.assertTrue(audit_exists)

    def test_fir_creation_without_attachment_success(self):
        self.client.force_authenticate(user=self.investigator)
        
        payload = {
            "fir_number": "FIR-888-ABC",
            "case_id": self.case.case_id,
            "police_station": "East Coast P.S.",
            "date": "2026-08-20",
            "officer": "Sub-Inspector Maya",
            "applicable_sections": "420 IPC, 120B IPC",
            "description": "Financial conspiracy and fraud case details.",
        }
        
        response = self.client.post("/api/documents/fir/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        
        # Should auto-generate a document of type FIR
        doc = Document.objects.get(document_id=response.data["document_id"])
        self.assertEqual(doc.document_type, "FIR")
        self.assertTrue(doc.original_filename.startswith("FIR_"))
        
        # Verify file bytes persist and contain metadata
        store_entry = DocumentFileStore.objects.get(storage_location=doc.storage_location)
        self.assertIsNotNone(store_entry.encrypted_data)

    def test_fir_creation_rbac_viewer_blocked(self):
        self.client.force_authenticate(user=self.viewer)
        payload = {
            "fir_number": "FIR-Viewer-Blocked",
            "case_id": self.case.case_id,
            "police_station": "Central P.S.",
            "date": "2026-08-24",
            "officer": "Officer Bob",
            "applicable_sections": "100 IPC",
            "description": "Test description",
        }
        response = self.client.post("/api/documents/fir/", payload, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_evidence_download_and_decryption(self):
        self.client.force_authenticate(user=self.investigator)
        file_content = b"Highly confidential forensic report bytes."
        uploaded_file = SimpleUploadedFile("forensic.pdf", file_content, content_type="application/pdf")
        
        response = self.client.post(
            "/api/documents/upload/",
            {"file": uploaded_file, "case_id": self.case.case_id, "change_description": "Forensic exhibit"},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc_id = response.data["document_id"]
        
        # Download document
        response_dl = self.client.get(f"/api/documents/{doc_id}/download/")
        self.assertEqual(response_dl.status_code, status.HTTP_200_OK)
        self.assertEqual(response_dl.content, file_content)

    def test_file_rename_does_not_change_hash(self):
        self.client.force_authenticate(user=self.investigator)
        doc = Document.objects.create(
            filename="report_v1.pdf",
            original_filename="report_v1.pdf",
            mime_type="application/pdf",
            file_size=100,
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            uploaded_by=self.investigator,
            status="ACTIVE",
            storage_location="path/to/report_v1.pdf.enc"
        )
        original_hash = doc.sha256_hash
        
        # Rename file
        doc.filename = "renamed_report.pdf"
        doc.save()
        
        # Hash must remain unchanged
        self.assertEqual(doc.sha256_hash, original_hash)

    def test_duplicate_upload_same_content_different_records(self):
        self.client.force_authenticate(user=self.investigator)
        file_content = b"identical content bytes"
        
        f1 = SimpleUploadedFile("exhibit_a.txt", file_content, content_type="text/plain")
        f2 = SimpleUploadedFile("exhibit_b.txt", file_content, content_type="text/plain")
        
        r1 = self.client.post("/api/documents/upload/", {"file": f1, "case_id": self.case.case_id}, format="multipart")
        r2 = self.client.post("/api/documents/upload/", {"file": f2, "case_id": self.case.case_id}, format="multipart")
        
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(r1.data["document_id"], r2.data["document_id"])
        self.assertEqual(r1.data["sha256"], r2.data["sha256"])

    def test_db_filestore_fallback_survives_disk_wipe(self):
        self.client.force_authenticate(user=self.investigator)
        file_content = b"Persistent audit evidence that survives container wipe."
        uploaded_file = SimpleUploadedFile("audit_log.txt", file_content, content_type="text/plain")
        
        response = self.client.post(
            "/api/documents/upload/",
            {"file": uploaded_file, "case_id": self.case.case_id},
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc = Document.objects.get(document_id=response.data["document_id"])
        
        local_path = get_document_storage_root() / doc.storage_location
        if local_path.exists():
            local_path.unlink()
        self.assertFalse(local_path.exists())
        
        response_verify = self.client.get(f"/api/documents/{doc.document_id}/verify-integrity/")
        self.assertEqual(response_verify.status_code, status.HTTP_200_OK)
        self.assertTrue(response_verify.data["verified"])
        self.assertEqual(response_verify.data["status"], "INTEGRITY_VERIFIED")
        self.assertTrue(local_path.exists())

    def test_legal_hold_deletion_protection(self):
        doc = Document.objects.create(
            filename="protected.pdf",
            original_filename="protected.pdf",
            mime_type="application/pdf",
            file_size=200,
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            uploaded_by=self.investigator,
            status="ACTIVE",
            storage_location="path/to/protected.pdf.enc",
            legal_hold_status=True
        )
        with self.assertRaises(PermissionError):
            doc.delete()
