"""Audit app serializers."""
from rest_framework import serializers
from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id", "event_id", "timestamp", "actor_username", "actor_role",
            "action", "result", "details",
            "document", "case",
            "previous_event_hash", "current_event_hash",
            "ip_address",
        ]
        read_only_fields = fields
