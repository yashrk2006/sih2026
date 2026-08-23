"""
Documents App — Core document lifecycle models.

Document
 └── DocumentVersion (immutable versions)
 └── DocumentMetadata (AI-extracted)
 └── BlockchainAnchor (via blockchain app)
"""
import uuid
from django.db import models
from django.utils import timezone


class DocumentType(models.TextChoices):
    FIR = "FIR", "First Information Report"
    POLICE_REPORT = "POLICE_REPORT", "Police Report"
    WITNESS_STATEMENT = "WITNESS_STATEMENT", "Witness Statement"
    INVESTIGATION_REPORT = "INVESTIGATION_REPORT", "Investigation Report"
    CHARGE_SHEET = "CHARGE_SHEET", "Charge Sheet"
    EVIDENCE_RECORD = "EVIDENCE_RECORD", "Evidence Record"
    COURT_FILING = "COURT_FILING", "Court Filing"
    FORENSIC_REPORT = "FORENSIC_REPORT", "Forensic Report"
    LEGAL_NOTICE = "LEGAL_NOTICE", "Legal Notice"
    JUDGMENT = "JUDGMENT", "Judgment"
    UNKNOWN = "UNKNOWN", "Unknown"


class DocumentStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processing"
    ACTIVE = "ACTIVE", "Active"
    ARCHIVED = "ARCHIVED", "Archived"
    DELETED = "DELETED", "Deleted"
    ERROR = "ERROR", "Error"


class Document(models.Model):
    """
    Represents a legal document in the system.
    The actual file is stored encrypted on disk; this record holds metadata.
    """
    document_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    case = models.ForeignKey(
        "cases.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents"
    )
    filename = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=500)
    document_type = models.CharField(
        max_length=30, choices=DocumentType.choices, default=DocumentType.UNKNOWN
    )
    mime_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField(help_text="Original file size in bytes")

    # Storage — path to the encrypted file on disk; never served directly
    storage_location = models.CharField(max_length=1000, help_text="Encrypted file path (relative)")
    is_encrypted = models.BooleanField(default=True)

    # Integrity — SHA-256 of the ORIGINAL (pre-encryption) bytes
    sha256_hash = models.CharField(max_length=64, help_text="SHA-256 hex digest of original file bytes")

    # Versioning
    current_version = models.IntegerField(default=1)

    # Ownership / tracking
    uploaded_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="uploaded_documents"
    )
    status = models.CharField(max_length=20, choices=DocumentStatus.choices, default=DocumentStatus.PROCESSING)

    # Case association metadata
    case_association_method = models.CharField(
        max_length=50, blank=True,
        help_text="How the document was linked: DETERMINISTIC | SEMANTIC | MANUAL"
    )
    case_association_confidence = models.FloatField(
        null=True, blank=True, help_text="Similarity score 0-1 if semantic association"
    )
    case_association_reason = models.TextField(blank=True)

    # Digital signature (optional)
    signature = models.TextField(blank=True, help_text="RSA signature of SHA-256 hash in hex")
    signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="signed_documents"
    )
    signed_at = models.DateTimeField(null=True, blank=True)

    # Compliance & Retention Policy
    retention_category = models.CharField(max_length=100, default="STANDARD")
    retention_start_date = models.DateField(default=timezone.now)
    retention_end_date = models.DateField(null=True, blank=True)
    legal_hold_status = models.BooleanField(default=False, help_text="True if document is locked due to active court hold")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents_document"
        ordering = ["-created_at"]

    def delete(self, *args, **kwargs):
        if self.legal_hold_status:
            raise PermissionError("This document is under legal hold and cannot be deleted.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"[{self.document_type}] {self.original_filename} (v{self.current_version})"

    @property
    def doc_id_str(self):
        return str(self.document_id)


class DocumentVersion(models.Model):
    """
    Immutable version record. Old versions are NEVER deleted.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()
    sha256_hash = models.CharField(max_length=64, help_text="SHA-256 of the original file bytes for this version")
    storage_location = models.CharField(max_length=1000)
    file_size = models.BigIntegerField()

    uploaded_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="document_versions"
    )
    change_description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Version chain — link to previous version for auditability
    previous_version = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="next_version"
    )

    # Blockchain anchor status
    blockchain_anchored = models.BooleanField(default=False)
    blockchain_tx_hash = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "documents_version"
        unique_together = ("document", "version_number")
        ordering = ["version_number"]

    def __str__(self):
        return f"{self.document.original_filename} v{self.version_number}"


class DocumentMetadata(models.Model):
    """
    AI-extracted metadata for a document.
    Stored as structured JSON alongside searchable fields.
    """
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name="metadata")
    version = models.ForeignKey(DocumentVersion, on_delete=models.SET_NULL, null=True, related_name="metadata")

    # Extracted text (plain, from OCR or PDF parse)
    raw_text = models.TextField(blank=True)
    extraction_method = models.CharField(
        max_length=50, blank=True, help_text="pdf_text | ocr_tesseract | ocr_paddleocr"
    )
    extraction_confidence = models.FloatField(null=True, blank=True)

    # Structured extracted fields
    extracted_case_id = models.CharField(max_length=200, blank=True)
    extracted_fir_number = models.CharField(max_length=200, blank=True)
    extracted_date = models.CharField(max_length=100, blank=True)
    extracted_location = models.CharField(max_length=500, blank=True)
    extracted_police_station = models.CharField(max_length=500, blank=True)
    extracted_court_name = models.CharField(max_length=500, blank=True)
    extracted_persons = models.JSONField(default=list)
    extracted_organizations = models.JSONField(default=list)
    extracted_legal_sections = models.JSONField(default=list)
    extracted_evidence_ids = models.JSONField(default=list)

    # AI classification
    classified_type = models.CharField(max_length=30, blank=True)
    classification_method = models.CharField(
        max_length=50, blank=True, help_text="rule_based | embedding | llm"
    )
    classification_confidence = models.FloatField(null=True, blank=True)

    # Full structured JSON from AI (for future extension)
    ai_output = models.JSONField(default=dict, blank=True)

    # Embedding vector stored as JSON list (for semantic search)
    # In production, use pgvector or FAISS index
    embedding = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents_metadata"

    def __str__(self):
        return f"Metadata for {self.document.original_filename}"
