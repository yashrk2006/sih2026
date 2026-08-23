"""
Case Association Service.

Associates documents with cases using:
  1. Deterministic match: case_id / FIR number / reference number
  2. Semantic similarity: sentence-transformer embeddings
  3. Manual override (set via API)
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Minimum similarity score for automatic semantic association
SEMANTIC_ASSOCIATION_THRESHOLD = 0.75


def associate_case_deterministic(document_metadata: dict) -> Optional[object]:
    """
    Try to find a case by exact ID match from extracted metadata.
    
    Returns (Case, method, confidence, reason) or None.
    """
    from apps.cases.models import Case

    # Try case_id
    case_id = document_metadata.get("case_id")
    if case_id:
        try:
            case = Case.objects.get(case_id=case_id)
            return case, "DETERMINISTIC", 1.0, f"Matched case_id='{case_id}'"
        except Case.DoesNotExist:
            pass

    # Try FIR number
    fir_number = document_metadata.get("fir_number")
    if fir_number:
        try:
            case = Case.objects.get(fir_number=fir_number)
            return case, "DETERMINISTIC", 1.0, f"Matched fir_number='{fir_number}'"
        except Case.DoesNotExist:
            pass

    return None


def associate_case_semantic(extracted_text: str) -> Optional[tuple]:
    """
    Try to find a case by semantic similarity of document text to case descriptions.
    Only fires if no deterministic match found.
    
    Returns (Case, "SEMANTIC", confidence, reason) or None.
    """
    from apps.cases.models import Case
    from apps.search.embeddings import compute_embedding, compute_similarity

    cases = list(Case.objects.filter(status="ACTIVE"))
    if not cases:
        return None

    try:
        doc_embedding = compute_embedding(extracted_text[:1024])
        if not doc_embedding:
            return None

        best_score = -1.0
        best_case = None

        for c in cases:
            case_str = f"{c.case_id} {c.title} {c.description}"
            c_emb = compute_embedding(case_str)
            if c_emb:
                score = compute_similarity(doc_embedding, c_emb)
                if score > best_score:
                    best_score = score
                    best_case = c

        if best_case and best_score >= 0.3:
            return (
                best_case,
                "SEMANTIC",
                round(best_score, 4),
                f"Semantic similarity={best_score:.3f} to case '{best_case.case_id}'",
            )

        return None

    except Exception as e:
        logger.error("Semantic association failed: %s", e)
        return None


def associate_document_to_case(text: str, metadata: dict = None) -> dict:
    """
    Direct text & metadata to case association lookup.
    Returns matched case object, similarity score, method, and reason.
    """
    if metadata is None:
        from .intelligence import extract_entities_regex
        metadata = extract_entities_regex(text)

    result = associate_case_deterministic(metadata)
    if result is None and text:
        result = associate_case_semantic(text)

    if result is None:
        return {
            "associated": False,
            "case": None,
            "method": "UNASSOCIATED",
            "similarity": 0.0,
            "reason": "No matching case found",
        }

    case, method, confidence, reason = result
    return {
        "associated": True,
        "case": case,
        "case_id": case.case_id,
        "method": method,
        "similarity": confidence,
        "reason": reason,
    }


def associate_document_with_case(document, extracted_text: str, metadata: dict) -> dict:
    """
    Main entry: associate a document with a case.
    
    Updates the document record in-place and returns association result.
    """
    # Step 1: Deterministic
    result = associate_case_deterministic(metadata)

    # Step 2: Semantic fallback
    if result is None and extracted_text:
        result = associate_case_semantic(extracted_text)

    if result is None:
        logger.info(
            "No case association found for document %s", document.document_id
        )
        return {
            "associated": False,
            "case": None,
            "method": None,
            "confidence": None,
            "reason": "No matching case found",
        }

    case, method, confidence, reason = result

    # Update document
    document.case = case
    document.case_association_method = method
    document.case_association_confidence = confidence
    document.case_association_reason = reason
    document.save(update_fields=[
        "case", "case_association_method",
        "case_association_confidence", "case_association_reason",
    ])

    logger.info(
        "Document %s associated with case %s via %s (confidence=%.3f)",
        document.document_id, case.case_id, method, confidence,
    )

    return {
        "associated": True,
        "case_id": case.case_id,
        "case_title": case.title,
        "method": method,
        "confidence": confidence,
        "reason": reason,
    }

