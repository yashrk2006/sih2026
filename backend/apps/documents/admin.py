from django.contrib import admin
from .models import Document, DocumentVersion, DocumentMetadata


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("document_id", "filename", "document_type", "case", "status", "is_encrypted", "created_at")
    list_filter = ("document_type", "status", "is_encrypted", "case_association_method")
    search_fields = ("filename", "original_filename", "sha256_hash", "document_id")


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ("document", "version_number", "sha256_hash", "blockchain_anchored", "created_at")
    list_filter = ("blockchain_anchored",)
    search_fields = ("sha256_hash", "change_description")


@admin.register(DocumentMetadata)
class DocumentMetadataAdmin(admin.ModelAdmin):
    list_display = ("document", "extracted_case_id", "extracted_fir_number", "classified_type", "classification_method")
    search_fields = ("extracted_case_id", "extracted_fir_number", "raw_text")
