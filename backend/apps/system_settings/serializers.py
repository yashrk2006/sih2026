from rest_framework import serializers
from .models import (
    SystemSettings,
    SecuritySettings,
    DocumentSecuritySettings,
    AISettingsModel,
    BlockchainSettingsModel,
    AuditSettingsModel,
    NotificationSettingsModel,
)


class SystemSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = SystemSettings
        fields = [
            "organization_name",
            "system_name",
            "default_office",
            "timezone",
            "date_format",
            "time_format",
            "language",
            "items_per_page",
            "updated_at",
            "updated_by_username",
        ]


class SecuritySettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = SecuritySettings
        fields = [
            "session_timeout_minutes",
            "max_login_attempts",
            "lockout_duration_minutes",
            "require_strong_password",
            "require_mfa",
            "jwt_expiry_minutes",
            "allow_concurrent_sessions",
            "updated_at",
            "updated_by_username",
        ]


class DocumentSecuritySettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = DocumentSecuritySettings
        fields = [
            "encryption_enabled",
            "encryption_algorithm",
            "hash_verification_enabled",
            "signature_verification_enabled",
            "tamper_detection_enabled",
            "max_upload_size_mb",
            "allowed_file_types",
            "updated_at",
            "updated_by_username",
        ]


class AISettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = AISettingsModel
        fields = [
            "active_provider",
            "active_model",
            "updated_at",
            "updated_by_username",
        ]


class BlockchainSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = BlockchainSettingsModel
        fields = [
            "enabled",
            "rpc_endpoint",
            "chain_id",
            "contract_address",
            "auto_anchor",
            "auto_verify",
            "updated_at",
            "updated_by_username",
        ]


class AuditSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = AuditSettingsModel
        fields = [
            "audit_logging_enabled",
            "log_document_access",
            "log_downloads",
            "log_uploads",
            "log_metadata_changes",
            "log_authentication",
            "log_case_changes",
            "log_security_events",
            "updated_at",
            "updated_by_username",
        ]


class NotificationSettingsSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = NotificationSettingsModel
        fields = [
            "security_alerts",
            "tampering_alerts",
            "failed_auth_alerts",
            "blockchain_failure_alerts",
            "email_notifications_enabled",
            "email_service_configured",
            "updated_at",
            "updated_by_username",
        ]
