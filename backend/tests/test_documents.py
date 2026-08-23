import io
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.users.models import Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentVersion, DocumentMetadata
from apps.documents.pipeline import ingest_document, validate_upload
from apps.security.services import compute_sha256, decrypt_file_to_bytes, get_document_storage_root

User = get_user_model()


class DocumentIngestionTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="test_investigator",
            email="investigator@test.com",
            role=Role.INVESTIGATOR,
        )
        self.case = Case.objects.create(
            case_id="CASE-TEST-001",
            title="Test Investigation",
            created_by=self.user,
        )

    def test_validate_upload(self):
        valid_bytes = b"Sample legal text content"
        is_valid, mime, err = validate_upload(valid_bytes, "test.txt")
        self.assertTrue(is_valid)
        self.assertEqual(mime, "text/plain")

        empty_bytes = b""
        is_valid, mime, err = validate_upload(empty_bytes, "empty.txt")
        self.assertFalse(is_valid)
        self.assertIn("Empty", err)

    def test_document_ingestion_pipeline(self):
        raw_content = b"CONFIDENTIAL EVIDENTIARY REPORT\nCase Reference: CASE-TEST-001"
        expected_hash = compute_sha256(raw_content)

        result = ingest_document(
            file_bytes=raw_content,
            original_filename="evidence_001.txt",
            uploaded_by=self.user,
            change_description="Initial evidence upload",
            manual_case=self.case,
        )

        self.assertTrue(result["success"])
        doc = result["document"]
        self.assertEqual(doc.sha256_hash, expected_hash)
        self.assertTrue(doc.is_encrypted)

        # Verify decrypted content on disk matches original plaintext
        decrypted_bytes = decrypt_file_to_bytes(str(get_document_storage_root() / doc.storage_location))
        self.assertEqual(decrypted_bytes, raw_content)

        # Verify DocumentMetadata and Version record created
        self.assertTrue(DocumentVersion.objects.filter(document=doc, version_number=1).exists())
        self.assertTrue(DocumentMetadata.objects.filter(document=doc).exists())
