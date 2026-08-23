from django.test import TestCase
from django.conf import settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.documents.intelligence import (
    classify_document_type,
    extract_entities_regex,
    analyze_document,
    get_ai_providers_status,
    set_selected_ai_provider,
)

User = get_user_model()


class AIDocumentIntelligenceTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="ai_tester",
            email="ai@test.com",
            role=Role.ADMIN,
        )
        self.client.force_authenticate(user=self.user)

    def test_document_classification_types(self):
        sample_texts = {
            "FIR": "First Information Report FIR No 104/2026 Under Section 302 IPC Station House Officer Police Station Delhi",
            "POLICE_REPORT": "Police report beat report station house report incident report crime report",
            "WITNESS_STATEMENT": "Witness statement statement of witness deponent solemnly affirm section 161 CrPC",
            "INVESTIGATION_REPORT": "Investigation report preliminary inquiry investigation findings case investigation",
            "CHARGE_SHEET": "Charge sheet chargesheet challan section 173 CrPC final report",
            "EVIDENCE_RECORD": "Evidence record exhibit E-101 seized property chain of custody muddemal",
            "COURT_FILING": "In the Honourable Court of High Court petitioner respondent writ petition",
            "FORENSIC_REPORT": "Forensic science laboratory FSL report dna analysis fingerprint examination post mortem",
        }

        for expected_type, text in sample_texts.items():
            res = classify_document_type(text)
            self.assertEqual(res["document_type"], expected_type, f"Expected {expected_type}, got {res['document_type']}")

    def test_regex_metadata_extraction(self):
        text = (
            "CASE-2026-CR-0891\n"
            "FIR No 104/2026\n"
            "Date: 2026-08-15\n"
            "Police Station: Connaught Place Delhi\n"
            "Court of Sessions Judge Delhi\n"
            "Section 302 IPC, u/s 420 IPC\n"
            "Exhibit A-101"
        )
        res = extract_entities_regex(text)
        self.assertEqual(res["case_id"], "CASE-2026-CR-0891")
        self.assertEqual(res["fir_number"], "104/2026")
        # legal_sections may contain '302 IPC' rather than bare '302'
        self.assertTrue(
            any("302" in s for s in res["legal_sections"]),
            f"Expected '302' to appear in a legal_sections entry, got: {res['legal_sections']}"
        )
        self.assertIn("A-101", res["evidence_ids"])

    def test_ai_provider_status_api(self):
        response = self.client.get("/api/ai/providers/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("providers", response.data)
        self.assertIn("selected", response.data)
        self.assertEqual(response.data["selected"], "local")

    def test_ai_provider_selection_and_fallback(self):
        # Attempt to select Qwen 3B — may be unavailable/OOM in CI
        try:
            set_selected_ai_provider("qwen")
            status = get_ai_providers_status()
            self.assertEqual(status["selected"], "qwen")
            # When Qwen is selected, analyze_document uses qwen or falls back
            res = analyze_document("First Information Report FIR No 99/2026")
            self.assertIn(res["provider_used"], ("qwen", "local_fallback"))
            self.assertEqual(res["processing_status"], "SUCCESS")
        except ValueError:
            # Qwen is unavailable (OOM / not installed) — this is valid behaviour
            status = get_ai_providers_status()
            self.assertEqual(status["selected"], "local")

        # Always reset to local and verify
        set_selected_ai_provider("local")
        status_reset = get_ai_providers_status()
        self.assertEqual(status_reset["selected"], "local")
