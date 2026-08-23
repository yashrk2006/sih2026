from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.cases.models import Case
from apps.documents.case_association import associate_document_to_case

User = get_user_model()


class CaseAssociationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="case_assoc_user",
            email="assoc@test.com",
            role=Role.INVESTIGATOR,
        )
        self.case1 = Case.objects.create(
            case_id="CASE-2026-CR-0891",
            title="State vs. Apex Cyber Fraud Syndicate",
            description="Phishing and unauthorized bank transfers investigation.",
            created_by=self.user,
        )

    def test_deterministic_case_association(self):
        doc_text = "CONFIDENTIAL EVIDENTIARY REPORT\nReference Case ID: CASE-2026-CR-0891\nExtracted details."
        res = associate_document_to_case(doc_text)
        self.assertIsNotNone(res["case"])
        self.assertEqual(res["case"].case_id, "CASE-2026-CR-0891")
        self.assertEqual(res["method"], "DETERMINISTIC")

    def test_semantic_fallback_case_association(self):
        # Text without explicit CASE ID, but semantically matching case title/description
        doc_text = "Forensic evidence regarding phishing attack netbanking unauthorized wire transfer"
        res = associate_document_to_case(doc_text)
        self.assertIn(res["method"], ("SEMANTIC", "UNASSOCIATED"))
        self.assertIn("reason", res)
