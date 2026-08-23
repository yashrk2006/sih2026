"""
System Settings models — SIH26190 Law Enforcement & Evidence System.
Persists configuration settings for General, Security, Document Security, AI, Blockchain, Audit, and Notifications.
"""
from django.db import models
from django.conf import settings


class SystemSettings(models.Model):
    """General organization & application settings."""
    organization_name = models.CharField(max_length=255, default="Delhi Police Cyber Crime Cell")
    system_name = models.CharField(max_length=255, default="SIH26190 Digital Evidence Integrity System")
    default_office = models.CharField(max_length=255, default="Connaught Place P.S.")
    timezone = models.CharField(max_length=100, default="Asia/Kolkata")
    date_format = models.CharField(max_length=50, default="YYYY-MM-DD")
    time_format = models.CharField(max_length=50, default="24h")
    language = models.CharField(max_length=20, default="en-us")
    items_per_page = models.IntegerField(default=20)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "System Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SecuritySettings(models.Model):
    """Security and authentication policy configuration."""
    session_timeout_minutes = models.IntegerField(default=60)
    max_login_attempts = models.IntegerField(default=5)
    lockout_duration_minutes = models.IntegerField(default=15)
    require_strong_password = models.BooleanField(default=True)
    require_mfa = models.BooleanField(default=False)
    jwt_expiry_minutes = models.IntegerField(default=60)
    allow_concurrent_sessions = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "Security Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class DocumentSecuritySettings(models.Model):
    """Document processing & encryption configuration."""
    encryption_enabled = models.BooleanField(default=True)
    encryption_algorithm = models.CharField(max_length=100, default="AES-256 / Fernet CBC")
    hash_verification_enabled = models.BooleanField(default=True)
    signature_verification_enabled = models.BooleanField(default=True)
    tamper_detection_enabled = models.BooleanField(default=True)
    max_upload_size_mb = models.IntegerField(default=50)
    allowed_file_types = models.CharField(max_length=255, default="pdf,txt,doc,docx")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "Document Security Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AISettingsModel(models.Model):
    """AI extraction provider settings."""
    active_provider = models.CharField(max_length=50, default="local")
    active_model = models.CharField(max_length=100, default="qwen2.5:3b")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "AI Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BlockchainSettingsModel(models.Model):
    """Blockchain ledger configuration."""
    enabled = models.BooleanField(default=True)
    rpc_endpoint = models.CharField(max_length=255, default="http://127.0.0.1:8545")
    chain_id = models.IntegerField(default=31337)
    contract_address = models.CharField(max_length=255, default="0x5FbDB2315678afecb367f032d93F642f64180aa3")
    auto_anchor = models.BooleanField(default=True)
    auto_verify = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "Blockchain Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AuditSettingsModel(models.Model):
    """Audit logging & compliance configuration."""
    audit_logging_enabled = models.BooleanField(default=True)
    log_document_access = models.BooleanField(default=True)
    log_downloads = models.BooleanField(default=True)
    log_uploads = models.BooleanField(default=True)
    log_metadata_changes = models.BooleanField(default=True)
    log_authentication = models.BooleanField(default=True)
    log_case_changes = models.BooleanField(default=True)
    log_security_events = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "Audit Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class NotificationSettingsModel(models.Model):
    """System notification preferences."""
    security_alerts = models.BooleanField(default=True)
    tampering_alerts = models.BooleanField(default=True)
    failed_auth_alerts = models.BooleanField(default=True)
    blockchain_failure_alerts = models.BooleanField(default=True)
    email_notifications_enabled = models.BooleanField(default=False)
    email_service_configured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name_plural = "Notification Settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
