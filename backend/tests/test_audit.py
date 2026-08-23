from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Role
from apps.audit.models import AuditEvent
from apps.audit.utils import log_audit_event, verify_audit_chain

User = get_user_model()


class AuditHashChainTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="audit_tester",
            email="audit@test.com",
            role=Role.AUDITOR,
        )

    def test_five_event_hash_chain_and_tampering(self):
        actions = [
            "DOCUMENT_UPLOADED",
            "DOCUMENT_VIEWED",
            "DOCUMENT_VERSION_CREATED",
            "DOCUMENT_INTEGRITY_CHECK",
            "DOCUMENT_DOWNLOADED",
        ]

        events = []
        for act in actions:
            ev = log_audit_event(
                actor=self.user,
                action=act,
                result="SUCCESS",
                details=f"Executing action {act}",
            )
            events.append(ev)

        # 1. Normal chain -> AUDIT_CHAIN_VALID
        res_valid = verify_audit_chain()
        self.assertTrue(res_valid["valid"])
        self.assertEqual(res_valid["total_events"], 5)
        self.assertEqual(res_valid["status"], "AUDIT_CHAIN_VALID")

        # 2. Modify Event #2 -> AUDIT_CHAIN_INVALID
        target = events[1]
        original_details = target.details
        target.details = "Tampered details content"
        target.save(update_fields=["details"])

        res_tampered = verify_audit_chain()
        self.assertFalse(res_tampered["valid"])
        self.assertEqual(res_tampered["status"], "AUDIT_CHAIN_INVALID")

        # 3. Restore Event #2 -> AUDIT_CHAIN_VALID
        target.details = original_details
        target.save(update_fields=["details"])

        res_restored = verify_audit_chain()
        self.assertTrue(res_restored["valid"])

        # 4. Delete Event #3 -> AUDIT_CHAIN_INVALID
        del_target = events[2]
        del_target.delete()

        res_deleted = verify_audit_chain()
        self.assertFalse(res_deleted["valid"])
        self.assertEqual(res_deleted["status"], "AUDIT_CHAIN_INVALID")
