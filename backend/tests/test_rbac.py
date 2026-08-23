from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.users.models import Role
from apps.cases.models import Case
from apps.documents.models import Document
from apps.users.permissions import user_can_access_document
from apps.search.service import keyword_search

User = get_user_model()


class RBACTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin_u", email="a@t.com", role=Role.ADMIN)
        self.inv1 = User.objects.create_user(username="inv1_u", email="i1@t.com", role=Role.INVESTIGATOR)
        self.inv2 = User.objects.create_user(username="inv2_u", email="i2@t.com", role=Role.INVESTIGATOR)
        self.legal = User.objects.create_user(username="legal_u", email="l@t.com", role=Role.LEGAL_OFFICER)
        self.auditor = User.objects.create_user(username="auditor_u", email="au@t.com", role=Role.AUDITOR)

        # Case assigned strictly to inv1
        self.case_private = Case.objects.create(
            case_id="CASE-RESTRICTED-101",
            title="Restricted Financial Investigation",
            created_by=self.admin,
        )
        self.case_private.assigned_investigators.add(self.inv1)

        self.doc_private = Document.objects.create(
            case=self.case_private,
            filename="private_evidence.txt",
            original_filename="private_evidence.txt",
            sha256_hash="1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
            file_size=100,
            storage_location="demo/private.txt.enc",
            uploaded_by=self.inv1,
            status="ACTIVE",
        )

    def test_document_access_permissions(self):
        # Admin can access
        self.assertTrue(user_can_access_document(self.admin, self.doc_private))
        # Auditor can access
        self.assertTrue(user_can_access_document(self.auditor, self.doc_private))
        # Assigned Investigator (inv1) can access
        self.assertTrue(user_can_access_document(self.inv1, self.doc_private))
        # Unassigned Investigator (inv2) CANNOT access
        self.assertFalse(user_can_access_document(self.inv2, self.doc_private))

    def test_rbac_search_results_filtering(self):
        # inv1 searches for "private_evidence" -> document returned
        res_inv1 = keyword_search("private_evidence", self.inv1)
        self.assertEqual(len(res_inv1), 1)

        # inv2 searches for "private_evidence" -> document NOT returned (0 results)
        res_inv2 = keyword_search("private_evidence", self.inv2)
        self.assertEqual(len(res_inv2), 0)
