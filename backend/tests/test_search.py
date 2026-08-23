from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.cases.models import Case
from apps.documents.models import Document, DocumentMetadata
from apps.search.service import keyword_search, semantic_search

User = get_user_model()


class SearchTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="search_user", email="s@test.com", role=Role.ADMIN)
        self.case = Case.objects.create(case_id="CASE-SEARCH-999", title="Cyber Search Case", created_by=self.user)

        self.doc = Document.objects.create(
            case=self.case,
            filename="search_evidence.txt",
            original_filename="search_evidence.txt",
            sha256_hash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            file_size=200,
            storage_location="demo/search.txt.enc",
            uploaded_by=self.user,
            status="ACTIVE",
        )
        DocumentMetadata.objects.create(
            document=self.doc,
            raw_text="Phishing netbanking wire transfer fraud",
            extracted_case_id="CASE-SEARCH-999",
            extracted_fir_number="FIR-999/2026",
            embedding=[0.1] * 64,
        )

    def test_keyword_and_metadata_search(self):
        res = keyword_search("Phishing", self.user)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["case_id"], "CASE-SEARCH-999")

    def test_semantic_search(self):
        res = semantic_search("wire transfer fraud", self.user)
        self.assertGreaterEqual(len(res), 1)
