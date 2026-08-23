"""Documents app serializers."""
from rest_framework import serializers
from .models import Document, DocumentVersion, DocumentMetadata


class DocumentMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentMetadata
        fields = [
            "extraction_method", "extraction_confidence",
            "extracted_case_id", "extracted_fir_number", "extracted_date",
            "extracted_location", "extracted_police_station", "extracted_court_name",
            "extracted_persons", "extracted_organizations",
            "extracted_legal_sections", "extracted_evidence_ids",
            "classified_type", "classification_method", "classification_confidence",
            "ai_output", "created_at",
        ]
        read_only_fields = fields


class DocumentVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = DocumentVersion
        fields = [
            "id", "version_number", "sha256_hash", "file_size",
            "uploaded_by", "uploaded_by_name", "change_description",
            "created_at", "blockchain_anchored", "blockchain_tx_hash",
        ]
        read_only_fields = fields


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)
    case_id_str = serializers.CharField(source="case.case_id", read_only=True, default=None)
    metadata = DocumentMetadataSerializer(read_only=True)
    versions = DocumentVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "document_id", "filename", "original_filename",
            "document_type", "mime_type", "file_size", "sha256_hash",
            "current_version", "status", "is_encrypted",
            "uploaded_by", "uploaded_by_name",
            "case", "case_id_str",
            "case_association_method", "case_association_confidence", "case_association_reason",
            "signature", "signed_by", "signed_at",
            "retention_category", "retention_start_date", "retention_end_date", "legal_hold_status",
            "created_at", "updated_at",
            "metadata", "versions",
        ]
        read_only_fields = [
            "id", "document_id", "sha256_hash", "current_version",
            "status", "is_encrypted", "uploaded_by",
            "case_association_method", "case_association_confidence",
            "case_association_reason", "created_at", "updated_at",
        ]


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    case_id_str = serializers.CharField(source="case.case_id", read_only=True, default=None)
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "document_id", "original_filename", "document_type",
            "file_size", "sha256_hash", "current_version", "status",
            "case", "case_id_str", "uploaded_by_name", "created_at",
            "retention_category", "retention_start_date", "retention_end_date", "legal_hold_status",
        ]


class DocumentUploadSerializer(serializers.Serializer):
    """Handles multipart file upload."""
    file = serializers.FileField()
    change_description = serializers.CharField(required=False, default="Initial upload")
    case_id = serializers.CharField(required=False, allow_blank=True)
