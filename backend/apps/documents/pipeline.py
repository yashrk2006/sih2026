"""
Document Ingestion Pipeline.

Orchestrates the complete upload workflow:
  1. Validate file
  2. Compute SHA-256 of original bytes
  3. Encrypt and store file
  4. Create Document + DocumentVersion records
  5. Extract text (OCR/PDF parse)
  6. Classify document type
  7. Extract metadata/entities
  8. Associate with case
  9. Compute and store embedding
 10. Emit DOCUMENT_UPLOADED audit event
 11. Anchor hash on blockchain (async-friendly)
"""
import logging
import mimetypes
from pathlib import Path
from typing import Optional

from django.utils import timezone

from apps.security.services import store_document_encrypted, compute_sha256
from apps.audit.utils import log_audit_event
from .models import Document, DocumentVersion, DocumentMetadata, DocumentType, DocumentStatus
from .ocr import extract_text
from .intelligence import analyze_document
from .case_association import associate_document_with_case

logger = logging.getLogger(__name__)

# Allowed MIME types
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "text/plain",
}

# Max file size: 50 MB
MAX_FILE_SIZE = 50 * 1024 * 1024


def _detect_mime(file_bytes: bytes, filename: str) -> str:
    """Detect MIME type from content and filename."""
    # Simple magic byte detection
    if file_bytes[:4] == b'%PDF':
        return "application/pdf"
    if file_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if file_bytes[:3] == b'\xff\xd8\xff':
        return "image/jpeg"

    # Fallback: guess from filename
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def validate_upload(file_bytes: bytes, filename: str) -> tuple[bool, str, str]:
    """
    Validate an uploaded file.
    Returns (is_valid, mime_type, error_message).
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        return False, "", f"File too large: {len(file_bytes)} bytes (max {MAX_FILE_SIZE})"

    if not file_bytes:
        return False, "", "Empty file"

    mime_type = _detect_mime(file_bytes, filename)
    if mime_type not in ALLOWED_MIME_TYPES:
        return False, "", f"Unsupported file type: {mime_type}"

    return True, mime_type, ""


def ingest_document(
    file_bytes: bytes,
    original_filename: str,
    uploaded_by,
    change_description: str = "Initial upload",
    manual_case=None,
    manual_document_type: Optional[str] = None,
) -> dict:
    """
    Main document ingestion pipeline.
    
    Args:
        file_bytes: Raw bytes of the uploaded file
        original_filename: Original filename
        uploaded_by: User instance
        change_description: Version description
        manual_case: Optional Case to explicitly link
    
    Returns:
        dict with document info, pipeline results, and status
    """
    # ── Step 1: Validate ──────────────────────────────────────────────────────
    valid, mime_type, error = validate_upload(file_bytes, original_filename)
    if not valid:
        return {"success": False, "error": error}

    logger.info("UPLOAD_STARTED: filename=%s size=%d", original_filename, len(file_bytes))

    # ── Step 2: Compute SHA-256 of original bytes ─────────────────────────────
    # IMPORTANT: SHA-256 computed from ORIGINAL (pre-encryption) bytes
    sha256 = compute_sha256(file_bytes)
    logger.info("Document SHA-256: %s (file=%s)", sha256[:16] + "...", original_filename)

    # ── Step 3-11: Database & Storage Operations (Atomic Transaction) ─────────
    from django.db import transaction
    try:
        with transaction.atomic():
            # Create Document record
            document = Document.objects.create(
                filename=original_filename,
                original_filename=original_filename,
                mime_type=mime_type,
                file_size=len(file_bytes),
                sha256_hash=sha256,
                uploaded_by=uploaded_by,
                status=DocumentStatus.PROCESSING,
                storage_location="pending",
                current_version=1,
            )
            logger.info("DOCUMENT_CREATED: doc_id=%s", document.document_id)

            # Encrypt and store
            rel_path, stored_sha256 = store_document_encrypted(
                file_bytes,
                str(document.document_id),
                1,
                original_filename,
            )
            document.storage_location = rel_path
            document.is_encrypted = True

            # Create first DocumentVersion
            version = DocumentVersion.objects.create(
                document=document,
                version_number=1,
                sha256_hash=sha256,
                storage_location=rel_path,
                file_size=len(file_bytes),
                uploaded_by=uploaded_by,
                change_description=change_description,
                previous_version=None,
            )
            logger.info("DOCUMENT_VERSION_CREATED: version_number=1")

            # Extract text
            logger.info("Extracting text from %s (%s)", original_filename, mime_type)
            extraction_result = extract_text(file_bytes, mime_type)
            extracted_text = extraction_result["text"]
            extraction_method = extraction_result["method"]

            # AI intelligence: classify + extract entities
            logger.info("Running document intelligence...")
            ai_result = analyze_document(extracted_text)

            if manual_document_type and manual_document_type in [c[0] for c in DocumentType.choices]:
                document_type = manual_document_type
            else:
                document_type = ai_result.get("document_type", "UNKNOWN")
                if document_type not in [c[0] for c in DocumentType.choices]:
                    document_type = "UNKNOWN"
            document.document_type = document_type

            # Create DocumentMetadata
            metadata = DocumentMetadata.objects.create(
                document=document,
                version=version,
                raw_text=extracted_text[:50000],
                extraction_method=extraction_method,
                extraction_confidence=extraction_result.get("confidence"),
                extracted_case_id=ai_result.get("case_id") or "",
                extracted_fir_number=ai_result.get("fir_number") or "",
                extracted_date=ai_result.get("date") or "",
                extracted_location=ai_result.get("location") or "",
                extracted_police_station=ai_result.get("police_station") or "",
                extracted_court_name=ai_result.get("court_name") or "",
                extracted_persons=ai_result.get("persons", []),
                extracted_organizations=ai_result.get("organizations", []),
                extracted_legal_sections=ai_result.get("legal_sections", []),
                extracted_evidence_ids=ai_result.get("evidence_ids", []),
                classified_type=document_type,
                classification_method=ai_result.get("classification_method", "rule_based"),
                classification_confidence=ai_result.get("classification_confidence"),
                ai_output=ai_result,
            )

            # Compute embedding for semantic search (non-critical)
            try:
                from apps.search.embeddings import compute_embedding
                embedding = compute_embedding(extracted_text[:2048])
                if embedding:
                    metadata.embedding = embedding
                    metadata.save(update_fields=["embedding"])
            except Exception as e:
                logger.warning("Embedding computation failed (non-critical): %s", e)

            # Case association
            if manual_case:
                document.case = manual_case
                document.case_association_method = "MANUAL"
                document.case_association_confidence = 1.0
                document.case_association_reason = "Manually specified at upload"
                association_result = {"associated": True, "method": "MANUAL", "case_id": manual_case.case_id}
            else:
                association_result = associate_document_with_case(document, extracted_text, ai_result)

            # Finalize document record
            document.status = DocumentStatus.ACTIVE
            document.save()
    except Exception as e:
        logger.error("Failed to ingest document: %s", e)
        try:
            from apps.security.services import get_document_storage_root, get_encrypted_path
            if 'document' in locals() and document.document_id:
                rel = get_encrypted_path(str(document.document_id), 1, original_filename)
                p = get_document_storage_root() / rel
                if p.exists():
                    p.unlink()
        except Exception as cleanup_err:
            logger.warning("Failed to clean up uploaded file after transaction failure: %s", cleanup_err)
        return {"success": False, "error": f"Ingestion failed: {e}"}

    # ── Step 12: Audit event ──────────────────────────────────────────────────
    log_audit_event(
        actor=uploaded_by,
        action="DOCUMENT_UPLOADED",
        document=document,
        case=document.case,
        result="SUCCESS",
        details=f"type={document_type} method={extraction_method} sha256={sha256[:16]}...",
    )

    # ── Step 13: Blockchain anchor (async-friendly) ───────────────────────────
    tx_hash = None
    try:
        from apps.blockchain.service import anchor_hash
        tx = anchor_hash(sha256, str(document.document_id), 1)
        if tx:
            tx_hash = tx
            version.blockchain_anchored = True
            version.blockchain_tx_hash = tx
            version.save(update_fields=["blockchain_anchored", "blockchain_tx_hash"])

            # Create BlockchainAnchor record
            from apps.blockchain.models import BlockchainAnchor
            BlockchainAnchor.objects.create(
                document=document,
                version=version,
                document_hash=sha256,
                tx_hash=tx,
                block_number=None,
                anchored_by=uploaded_by,
            )
    except Exception as e:
        logger.warning("Blockchain anchoring failed (non-critical): %s", e)

    logger.info(
        "Document ingestion complete: doc_id=%s type=%s case=%s",
        document.document_id, document_type,
        document.case.case_id if document.case else "None",
    )

    return {
        "success": True,
        "document": document,
        "document_id": str(document.document_id),
        "document_pk": document.pk,
        "filename": original_filename,
        "document_type": document_type,
        "sha256_hash": sha256,
        "version": 1,
        "extraction_method": extraction_method,
        "extracted_chars": len(extracted_text),
        "ai_result": ai_result,
        "association": association_result,
        "blockchain_tx": tx_hash,
        "status": "ACTIVE",
    }


def create_document_version(
    document,
    file_bytes: bytes,
    uploaded_by,
    change_description: str = "",
) -> dict:
    """
    Create a new version of an existing document.
    The old version is NEVER deleted.
    """
    valid, mime_type, error = validate_upload(file_bytes, document.original_filename)
    if not valid:
        return {"success": False, "error": error}

    new_version_num = document.current_version + 1
    sha256 = compute_sha256(file_bytes)

    # Store encrypted
    rel_path, _ = store_document_encrypted(
        file_bytes,
        str(document.document_id),
        new_version_num,
        document.original_filename,
    )

    # Get previous version for chain linking
    previous_version = DocumentVersion.objects.filter(
        document=document, version_number=document.current_version
    ).first()

    # Create version record
    version = DocumentVersion.objects.create(
        document=document,
        version_number=new_version_num,
        sha256_hash=sha256,
        storage_location=rel_path,
        file_size=len(file_bytes),
        uploaded_by=uploaded_by,
        change_description=change_description,
        previous_version=previous_version,
    )

    # Update document record
    document.sha256_hash = sha256
    document.storage_location = rel_path
    document.current_version = new_version_num
    document.save(update_fields=["sha256_hash", "storage_location", "current_version"])

    # Audit
    log_audit_event(
        actor=uploaded_by,
        action="DOCUMENT_VERSION_CREATED",
        document=document,
        case=document.case,
        result="SUCCESS",
        details=f"version={new_version_num} sha256={sha256[:16]}...",
    )

    # Blockchain anchor
    tx_hash = None
    try:
        from apps.blockchain.service import anchor_hash
        tx = anchor_hash(sha256, str(document.document_id), new_version_num)
        if tx:
            tx_hash = tx
            version.blockchain_anchored = True
            version.blockchain_tx_hash = tx
            version.save(update_fields=["blockchain_anchored", "blockchain_tx_hash"])
    except Exception as e:
        logger.warning("Blockchain anchoring for new version failed: %s", e)

    return {
        "success": True,
        "document_id": str(document.document_id),
        "version": new_version_num,
        "sha256_hash": sha256,
        "blockchain_tx": tx_hash,
    }
