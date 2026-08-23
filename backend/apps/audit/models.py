"""
Audit App — Tamper-Evident Hash-Linked Audit Trail.

Each AuditEvent contains:
  - previous_event_hash  → hash of the previous event
  - current_event_hash   → hash of this event's data + previous_event_hash

This creates a hash chain. If any historical event is modified,
the chain integrity check will fail.

NOTE: This is a database-level audit chain. For maximum tamper evidence,
combine with the blockchain anchoring of audit event hashes.
"""
import hashlib
import json
import uuid
from django.db import models
from django.utils import timezone


class AuditEvent(models.Model):
    """
    Immutable audit event with hash-chain linkage.
    Events must NEVER be modified or deleted.
    """
    ACTION_CHOICES = [
        ("DOCUMENT_UPLOADED", "Document Uploaded"),
        ("DOCUMENT_VIEWED", "Document Viewed"),
        ("DOCUMENT_DOWNLOADED", "Document Downloaded"),
        ("DOCUMENT_UPDATED", "Document Updated"),
        ("DOCUMENT_VERSION_CREATED", "Document Version Created"),
        ("DOCUMENT_ACCESS_DENIED", "Document Access Denied"),
        ("DOCUMENT_INTEGRITY_CHECK", "Document Integrity Check"),
        ("DOCUMENT_SIGNED", "Document Signed"),
        ("CASE_CREATED", "Case Created"),
        ("CASE_ASSOCIATED", "Case Associated"),
        ("SEARCH_PERFORMED", "Search Performed"),
        ("USER_PERMISSION_CHANGED", "User Permission Changed"),
        ("USER_LOGIN", "User Login"),
        ("BLOCKCHAIN_ANCHORED", "Blockchain Anchored"),
        ("SYSTEM_EVENT", "System Event"),
    ]

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    # Actor
    actor = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="audit_events"
    )
    actor_username = models.CharField(max_length=150, blank=True, help_text="Snapshot of username")
    actor_role = models.CharField(max_length=20, blank=True, help_text="Role at time of action")

    # Action
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    result = models.CharField(max_length=50, blank=True, help_text="SUCCESS | DENIED | FAILED")

    # Context
    document = models.ForeignKey(
        "documents.Document", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_events"
    )
    case = models.ForeignKey(
        "cases.Case", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_events"
    )
    details = models.TextField(blank=True, help_text="Additional context")

    # Hash chain
    previous_event_hash = models.CharField(max_length=64, blank=True, help_text="SHA-256 of previous event")
    current_event_hash = models.CharField(max_length=64, blank=True, help_text="SHA-256 of this event")

    # IP / request tracking
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "audit_event"
        ordering = ["timestamp"]
        # No update/delete allowed — enforced at service layer

    def __str__(self):
        return f"[{self.action}] {self.actor_username} @ {self.timestamp}"

    def compute_hash(self) -> str:
        """
        Compute SHA-256 of this event's canonical data.
        Includes previous_event_hash to create the chain.
        """
        data = {
            "event_id": str(self.event_id),
            "timestamp": self.timestamp.isoformat(),
            "actor": self.actor_username,
            "actor_role": self.actor_role,
            "action": self.action,
            "result": self.result,
            "document_id": str(self.document.document_id) if self.document else None,
            "case_id": self.case.case_id if self.case else None,
            "details": self.details,
            "previous_event_hash": self.previous_event_hash,
        }
        canonical = json.dumps(data, sort_keys=True, ensure_ascii=True)
        return hashlib.sha256(canonical.encode()).hexdigest()
