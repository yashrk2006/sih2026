"""System settings app URL routing."""
from django.urls import path
from . import views

urlpatterns = [
    path("settings/", views.all_settings_view, name="all-settings"),
    path("settings/general/", views.update_general_settings, name="update-general-settings"),
    path("settings/security/", views.update_security_settings, name="update-security-settings"),
    path("settings/document-security/", views.update_doc_security_settings, name="update-doc-security-settings"),
    path("settings/ai/", views.update_ai_settings, name="update-ai-settings"),
    path("settings/blockchain/", views.update_blockchain_settings, name="update-blockchain-settings"),
    path("settings/audit/", views.update_audit_settings, name="update-audit-settings"),
    path("settings/notifications/", views.update_notification_settings, name="update-notification-settings"),
    path("settings/blockchain/test/", views.test_blockchain_connection, name="test-blockchain-connection"),
    path("settings/ai/test/", views.test_ai_provider, name="test-ai-provider"),
    path("system/health/", views.system_health_check, name="system-health-check"),
]
