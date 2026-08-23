"""
Audit Utility Functions.

log_audit_event() is called throughout the system to create immutable,
hash-linked audit events.
"""
import logging
from django.db import transaction

logger = logging.getLogger(__name__)


def log_audit_event(
    actor=None,
    action: str = "SYSTEM_EVENT",
    document=None,
    case=None,
    result: str = "SUCCESS",
    details: str = "",
    ip_address=None,
    user_agent: str = "",
) -> "AuditEvent":
    """
    Create an immutable audit event and link it to the chain.
    
    The chain is built by:
    1. Finding the most recent event's current_event_hash
    2. Using it as previous_event_hash for the new event
    3. Computing current_event_hash from (event data + previous_event_hash)
    
    This ensures: modify any past event → chain verification fails.
    """
    from .models import AuditEvent

    with transaction.atomic():
        # Get the hash of the most recent event (for chain linking)
        last_event = AuditEvent.objects.select_for_update().order_by("-timestamp", "-id").first()
        previous_hash = last_event.current_event_hash if last_event else "GENESIS"

        # Build the event
        actor_username = ""
        actor_role = ""
        if actor and hasattr(actor, "username"):
            actor_username = actor.username
            actor_role = getattr(actor, "role", "")

        event = AuditEvent(
            actor=actor,
            actor_username=actor_username,
            actor_role=actor_role,
            action=action,
            result=result,
            document=document,
            case=case,
            details=details[:2000],
            previous_event_hash=previous_hash,
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )

        # Compute hash BEFORE saving (includes all fields set above)
        current_hash = event.compute_hash()
        event.current_event_hash = current_hash
        event.save()

    logger.debug("Audit event: %s | %s | %s", action, actor_username, result)
    return event


def verify_audit_chain() -> dict:
    """
    Walk the entire audit chain and verify hash integrity.
    
    Returns:
        {
            "valid": bool,
            "total_events": int,
            "first_broken_at": event_id or None,
            "status": "AUDIT_CHAIN_VALID" | "AUDIT_CHAIN_INVALID"
        }
    """
    from .models import AuditEvent

    events = list(AuditEvent.objects.order_by("timestamp", "id"))
    total = len(events)

    if total == 0:
        return {
            "valid": True,
            "total_events": 0,
            "first_broken_at": None,
            "status": "AUDIT_CHAIN_VALID",
            "message": "No audit events yet",
        }

    previous_hash = "GENESIS"

    for i, event in enumerate(events):
        # Verify previous_event_hash matches
        if event.previous_event_hash != previous_hash:
            logger.error(
                "Audit chain broken at event %s (index %d): "
                "expected previous_hash=%s, got %s",
                event.event_id, i, previous_hash, event.previous_event_hash,
            )
            return {
                "valid": False,
                "total_events": total,
                "first_broken_at": str(event.event_id),
                "broken_at_index": i,
                "status": "AUDIT_CHAIN_INVALID",
                "message": f"Chain broken at event {i} (id={event.event_id}): previous hash mismatch",
            }

        # Recompute and verify current hash
        expected_hash = event.compute_hash()
        if event.current_event_hash != expected_hash:
            logger.error(
                "Audit event %s (index %d) has been tampered with: "
                "stored hash=%s, computed hash=%s",
                event.event_id, i, event.current_event_hash, expected_hash,
            )
            return {
                "valid": False,
                "total_events": total,
                "first_broken_at": str(event.event_id),
                "broken_at_index": i,
                "status": "AUDIT_CHAIN_INVALID",
                "message": f"Event {i} (id={event.event_id}) has been tampered with",
            }

        previous_hash = event.current_event_hash

    return {
        "valid": True,
        "total_events": total,
        "first_broken_at": None,
        "status": "AUDIT_CHAIN_VALID",
        "message": f"All {total} audit events verified",
    }
