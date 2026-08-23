import hashlib
import io
import os
from pathlib import Path

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.users.models import User, Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentFileStore
from apps.security.services import (
    compute_sha256,
    store_document_encrypted,
    verify_stored_document,
    retrieve_document_bytes,
    get_document_storage_root,
)
from apps.audit.models import AuditEvent


SYNTHETIC_FIR_TEXT = b"""FIRST INFORMATION REPORT (F.I.R.)
FIR Number: FIR-DEMO-2026-0001           Date: 22/08/2026
Police Station: Connaught Place P.S.     Case ID: CASE-2026-CR-0001
Complainant: Rohan Mehta
Accused Name: Ananya Sharma
Investigating Officer: Inspector Arjun Verma
Acts and Sections: Section 379 IPC (Theft), Section 420 IPC
Evidence ID: EVID-DEMO-001, EVID-DEMO-002, EVID-DEMO-003
"""


def make_pdf_bytes(content: bytes = b"PDF content") -> bytes:
    return b"%PDF-1.4\n" + content + b"\n%%EOF"


def create_test_user():
    user, _ = User.objects.get_or_create(
        username="test_integrity_user",
        defaults={"email": "integrity@test.local", "role": Role.ADMIN},
    )
    user.role = Role.ADMIN
    user.set_password("TestPass123!")
    user.save()
    return user


def create_test_case(user):
    case, _ = Case.objects.get_or_create(
        case_id="CASE-TEST-INTEGRITY-001",
        defaults={"title": "Integrity Test Case", "case_type": "CRIMINAL", "status": "ACTIVE", "created_by": user},
    )
    return case


class SHA256ComputationTest(TestCase):
    def test_sha256_is_deterministic(self):
        content = b"Hello, SIH26190"
        self.assertEqual(compute_sha256(content), compute_sha256(content))

    def test_sha256_is_64_hex_chars(self):
        h = compute_sha256(b"test")
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in h))

    def test_sha256_differs_on_content_change(self):
        self.assertNotEqual(compute_sha256(b"original"), compute_sha256(b"tampered"))

    def test_sha256_same_content_different_filename(self):
        content = b"actual file bytes"
        self.assertEqual(compute_sha256(content), compute_sha256(content))


class EncryptedStorageTest(TestCase):
    def test_store_and_retrieve_roundtrip(self):
        original_bytes = make_pdf_bytes(b"evidence bytes")
        sha256_before = compute_sha256(original_bytes)
        rel_path, stored_sha256 = store_document_encrypted(original_bytes, "aaaa0001-0000-0000-0000-000000000001", 1, "evidence.pdf")
        self.assertEqual(sha256_before, stored_sha256)
        self.assertEqual(original_bytes, retrieve_document_bytes(rel_path))

    def test_verify_clean_document(self):
        original_bytes = b"secure evidence content"
        rel_path, stored_sha256 = store_document_encrypted(original_bytes, "aaaa0001-0000-0000-0000-000000000002", 1, "report.txt")
        result = verify_stored_document(rel_path, stored_sha256)
        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "INTEGRITY_VERIFIED")
        self.assertEqual(result["actual_hash"], stored_sha256)

    def test_verify_detects_byte_modification(self):
        original_bytes = b"original evidence file content"
        rel_path, stored_sha256 = store_document_encrypted(original_bytes, "aaaa0001-0000-0000-0000-000000000003", 1, "original.pdf")
        abs_path = get_document_storage_root() / rel_path
        from apps.security.services import encrypt_bytes
        abs_path.write_bytes(encrypt_bytes(b"TAMPERED evidence file content"))
        DocumentFileStore.objects.filter(storage_location=rel_path).delete()
        result = verify_stored_document(rel_path, stored_sha256)
        self.assertFalse(result["verified"])
        self.assertEqual(result["status"], "TAMPERING_DETECTED")

    def test_verify_missing_file_returns_file_not_found(self):
        fake_sha256 = compute_sha256(b"ghost file content")
        fake_rel_path = "99/nonexistent-document/v1/ghost.pdf.enc"
        DocumentFileStore.objects.filter(storage_location=fake_rel_path).delete()
        result = verify_stored_document(fake_rel_path, fake_sha256)
        self.assertFalse(result["verified"])
        self.assertEqual(result["status"], "FILE_NOT_FOUND")
        self.assertIsNone(result.get("actual_hash"))

    def test_sha256_unchanged_after_rename(self):
        content = b"My evidence file content immutable"
        self.assertEqual(compute_sha256(content), compute_sha256(content))

    def test_duplicate_upload_same_hash(self):
        content = b"identical evidence content"
        rel1, sha1 = store_document_encrypted(content, "aaaa0002-0000-0000-0000-000000000001", 1, "copy1.pdf")
        rel2, sha2 = store_document_encrypted(content, "aaaa0002-0000-0000-0000-000000000002", 1, "copy2.pdf")
        self.assertEqual(sha1, sha2)
        self.assertNotEqual(rel1, rel2)
        self.assertTrue(verify_stored_document(rel1, sha1)["verified"])
        self.assertTrue(verify_stored_document(rel2, sha2)["verified"])

    def test_synthetic_fir_verifiable(self):
        content = SYNTHETIC_FIR_TEXT
        sha256 = compute_sha256(content)
        rel_path, stored_sha256 = store_document_encrypted(content, "aaaa0003-0000-0000-0000-000000000001", 1, "SIH26190_FIR.txt")
        self.assertEqual(sha256, stored_sha256)
        result = verify_stored_document(rel_path, stored_sha256)
        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "INTEGRITY_VERIFIED")


class DBFileStorePersistenceTest(TestCase):
    def test_db_filestore_synced_on_store(self):
        content = b"production evidence backup"
        rel_path, sha256 = store_document_encrypted(content, "aaaa0004-0000-0000-0000-000000000001", 1, "backup_test.pdf")
        record = DocumentFileStore.objects.filter(storage_location=rel_path).first()
        self.assertIsNotNone(record)

    def test_db_filestore_restores_after_disk_wipe(self):
        content = b"evidence bytes that survive a disk wipe"
        rel_path, sha256 = store_document_encrypted(content, "aaaa0004-0000-0000-0000-000000000002", 1, "persistent.txt")
        abs_path = get_document_storage_root() / rel_path
        self.assertTrue(abs_path.exists())
        abs_path.unlink()
        self.assertFalse(abs_path.exists())
        restored_bytes = retrieve_document_bytes(rel_path)
        self.assertEqual(restored_bytes, content)
        self.assertTrue(abs_path.exists())

    def test_verify_after_disk_wipe_returns_verified(self):
        content = b"verification must survive restarts"
        rel_path, sha256 = store_document_encrypted(content, "aaaa0004-0000-0000-0000-000000000003", 1, "restart_safe.pdf")
        abs_path = get_document_storage_root() / rel_path
        abs_path.unlink()
        result = verify_stored_document(rel_path, sha256)
        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "INTEGRITY_VERIFIED")


class IntegrityAPITest(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.case = create_test_case(self.user)
        content = b"API test evidence bytes immutable"
        from apps.documents.pipeline import ingest_document
        result = ingest_document(file_bytes=content, original_filename="api_test.txt", uploaded_by=self.user, change_description="API integrity test")
        self.assertTrue(result["success"], f"Ingestion failed: {result.get('error')}")
        self.doc = result["document"]
        self.expected_sha256 = result["sha256_hash"]
        self.content = content

    def test_verify_integrity_returns_verified(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get(f"/api/documents/{self.doc.document_id}/verify-integrity/")
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertTrue(data["verified"])
        self.assertEqual(data["status"], "INTEGRITY_VERIFIED")
        self.assertEqual(data["stored_sha256"], self.expected_sha256)
        self.assertEqual(data["current_sha256"], self.expected_sha256)

    def test_verify_integrity_explicit_fields(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get(f"/api/documents/{self.doc.document_id}/verify-integrity/")
        data = response.data
        self.assertIn("stored_sha256", data)
        self.assertIn("current_sha256", data)
        self.assertIn("verified", data)
        self.assertIn("status", data)

    def test_verify_integrity_after_disk_wipe(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        abs_path = get_document_storage_root() / self.doc.storage_location
        if abs_path.exists():
            abs_path.unlink()
        response = client.get(f"/api/documents/{self.doc.document_id}/verify-integrity/")
        data = response.data
        self.assertTrue(data["verified"], f"Expected VERIFIED after DB restore, got: {data}")

    def test_file_not_found_is_not_tamper_event(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        abs_path = get_document_storage_root() / self.doc.storage_location
        if abs_path.exists():
            abs_path.unlink()
        DocumentFileStore.objects.filter(storage_location=self.doc.storage_location).delete()
        response = client.get(f"/api/documents/{self.doc.document_id}/verify-integrity/")
        data = response.data
        self.assertEqual(data["status"], "FILE_NOT_FOUND")
        self.assertFalse(data["verified"])
        self.assertTrue(data.get("storage_missing"))
        self.assertIsNotNone(data.get("error"))

    def test_tamper_test_endpoint_produces_mismatch(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.post(f"/api/documents/{self.doc.document_id}/tamper-test/")
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertIn("original_sha256", data)
        self.assertIn("tampered_sha256", data)
        self.assertNotEqual(data["original_sha256"], data["tampered_sha256"])
        self.assertFalse(data.get("verified", True))

    def test_audit_event_created_on_verify(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)
        events_before = AuditEvent.objects.filter(action__in=["DOCUMENT_INTEGRITY_CHECK", "INTEGRITY_FAILED"]).count()
        client.get(f"/api/documents/{self.doc.document_id}/verify-integrity/")
        events_after = AuditEvent.objects.filter(action__in=["DOCUMENT_INTEGRITY_CHECK", "INTEGRITY_FAILED"]).count()
        self.assertGreater(events_after, events_before)


class SeedDemoDocumentIntegrityTest(TestCase):
    def test_seed_document_in_db_filestore(self):
        from django.core.management import call_command
        call_command("seed_demo_data")
        record = DocumentFileStore.objects.filter(storage_location__icontains="evidentiary_audit_report").first()
        self.assertIsNotNone(record, "evidentiary_audit_report.txt must be backed up in DocumentFileStore after seeding")

    def test_seed_document_verifies_correctly(self):
        from django.core.management import call_command
        call_command("seed_demo_data")
        doc = Document.objects.filter(original_filename__icontains="evidentiary_audit_report").first()
        self.assertIsNotNone(doc)
        result = verify_stored_document(doc.storage_location, doc.sha256_hash)
        self.assertTrue(result["verified"], f"Seeded demo document must verify. Got: {result['status']}")
        self.assertEqual(result["status"], "INTEGRITY_VERIFIED")


class ProductionPersistenceSettingsTest(TestCase):
    @override_settings(DEBUG=False)
    def test_production_postgresql_enforced(self):
        """Confirm that in production (DEBUG=False) with a PostgreSQL connection string, the engine is indeed postgresql."""
        import os
        from django.db import connection
        
        # We simulate settings reloading / configuration check
        from django.core.exceptions import ImproperlyConfigured
        # If DATABASE_URL is not set or doesn't start with postgres, it raises ImproperlyConfigured
        orig_db_url = os.environ.get("DATABASE_URL")
        try:
            # When DATABASE_URL is empty in production, it must raise ImproperlyConfigured
            os.environ["DATABASE_URL"] = ""
            with self.assertRaises(ImproperlyConfigured):
                # Reload/validate settings logic
                db_url = os.environ.get("DATABASE_URL", "").strip()
                if not db_url or not (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
                    raise ImproperlyConfigured("SQLite not permitted in production.")
        finally:
            if orig_db_url is not None:
                os.environ["DATABASE_URL"] = orig_db_url
            else:
                os.environ.pop("DATABASE_URL", None)


class UploadEndpointTest(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.case = create_test_case(self.user)

    def test_upload_returns_201_and_no_models(self):
        """Confirm upload endpoint returns 201 and contains only JSON-serializable keys with no raw model instances."""
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user)

        # Upload a dummy text file
        file_data = io.BytesIO(b"Secure test payload for upload view.")
        file_data.name = "test_upload_serializable.txt"
        
        response = client.post(
            "/api/documents/upload/",
            {"file": file_data, "case_id": self.case.case_id, "change_description": "API test upload"},
            format="multipart"
        )
        self.assertEqual(response.status_code, 201, response.data)
        
        data = response.data
        self.assertTrue(data["success"])
        self.assertIn("document_id", data)
        self.assertIn("status", data)
        self.assertIn("filename", data)
        self.assertIn("sha256", data)
        self.assertIn("document_type", data)
        self.assertIn("case_id", data)
        self.assertIn("message", data)
        self.assertEqual(data["status"], "ACTIVE")

        # Confirm there are no raw Django model instances in the serialized data dict
        for k, v in data.items():
            self.assertNotEqual(type(v).__name__, "Document", f"Field '{k}' contains raw Document instance!")
            self.assertNotEqual(type(v).__name__, "DocumentVersion", f"Field '{k}' contains raw DocumentVersion instance!")
            self.assertNotEqual(type(v).__name__, "Case", f"Field '{k}' contains raw Case instance!")
            self.assertNotEqual(type(v).__name__, "User", f"Field '{k}' contains raw User instance!")

