from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.audit.models import AuditEvent
from apps.audit.utils import log_audit_event, verify_audit_chain

User = get_user_model()


class AuditTrailTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="auditor_test",
            email="auditor@test.com",
            role=Role.AUDITOR,
        )

    def test_audit_event_hash_chain(self):
        e1 = log_audit_event(
            actor=self.user,
            action="USER_LOGIN",
            result="SUCCESS",
            details="User logged in from test runner",
        )
        self.assertEqual(e1.previous_event_hash, "GENESIS")
        self.assertIsNotNone(e1.current_event_hash)

        e2 = log_audit_event(
            actor=self.user,
            action="SEARCH_PERFORMED",
            result="SUCCESS",
            details="Query: 'cyber fraud'",
        )
        self.assertEqual(e2.previous_event_hash, e1.current_event_hash)

        chain_result = verify_audit_chain()
        self.assertTrue(chain_result["valid"])
        self.assertEqual(chain_result["total_events"], 2)

    def test_tamper_detection(self):
        e1 = log_audit_event(
            actor=self.user,
            action="DOCUMENT_VIEWED",
            result="SUCCESS",
        )
        e2 = log_audit_event(
            actor=self.user,
            action="DOCUMENT_DOWNLOADED",
            result="SUCCESS",
        )

        # Tamper with e1 details directly in DB
        e1.details = "Unauthorized modification"
        e1.save(update_fields=["details"])

        chain_result = verify_audit_chain()
        self.assertFalse(chain_result["valid"])
        self.assertEqual(chain_result["status"], "AUDIT_CHAIN_INVALID")
