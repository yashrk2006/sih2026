"""Documents app URLs."""
from django.urls import path
from . import views
from apps.search.views import search as evidence_search_view

urlpatterns = [
    path("documents/", views.document_list, name="document-list"),
    path("documents/search/", evidence_search_view, name="document-search"),
    path("evidence/search/", evidence_search_view, name="evidence-search"),
    path("documents/upload/", views.upload_document, name="document-upload"),
    path("documents/<str:document_id>/", views.document_detail, name="document-detail"),
    path("documents/<str:document_id>/versions/", views.document_versions, name="document-versions"),
    path("documents/<str:document_id>/versions/new/", views.create_version, name="document-version-create"),
    path("documents/<str:document_id>/verify-integrity/", views.verify_integrity, name="document-verify"),
    path("documents/<str:document_id>/tamper-test/", views.tamper_test, name="document-tamper-test"),
    path("documents/<str:document_id>/audit/", views.document_audit, name="document-audit"),
    path("documents/<str:document_id>/blockchain-proof/", views.blockchain_proof, name="document-blockchain"),
    path("documents/<str:document_id>/sign/", views.sign_document, name="document-sign"),
    path("documents/<str:document_id>/signature/", views.verify_signature, name="document-signature"),
    path("ai/providers/", views.ai_providers_list, name="ai-providers-list"),
    path("ai/providers/select/", views.ai_providers_select, name="ai-providers-select"),
    path("test-upload/", views.test_pipeline_upload_view, name="test-pipeline-upload"),
]
