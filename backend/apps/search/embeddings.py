import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import logging
import math
import re
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-load the embedding model if explicitly enabled in environment."""
    global _model
    if _model is not None:
        return _model

    if os.environ.get("USE_REAL_EMBEDDINGS", "false").lower() != "true":
        return None

    try:
        from sentence_transformers import SentenceTransformer
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        _model = SentenceTransformer(settings.EMBEDDING_MODEL, local_files_only=True)
        logger.info("Loaded embedding model: %s", settings.EMBEDDING_MODEL)
        return _model
    except Exception as e:
        logger.info("SentenceTransformer not loaded: %s. Using deterministic vector fallback.", e)
        return None


def _fallback_embedding(text: str) -> list[float]:
    """
    Deterministic 64-dim normalized term-frequency hash vector.
    Used when PyTorch/SentenceTransformer is unavailable or out of memory.
    """
    words = re.findall(r'\w+', text.lower())
    vec = [0.0] * 64
    if not words:
        return vec
    for w in words:
        idx = hash(w) % 64
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def compute_embedding(text: str) -> Optional[list]:
    """
    Compute a normalized embedding vector for the given text.
    Returns a list of floats.
    """
    if not text or not text.strip():
        return None
    model = _get_model()
    if model:
        try:
            embedding = model.encode([text[:2048]], normalize_embeddings=True)
            return embedding[0].tolist()
        except Exception as e:
            logger.warning("SentenceTransformer embedding computation failed: %s. Using fallback vectorizer.", e)

    return _fallback_embedding(text)


def compute_similarity(embedding1: list, embedding2: list) -> float:
    """Cosine similarity between two normalized embeddings (dot product)."""
    if not embedding1 or not embedding2 or len(embedding1) != len(embedding2):
        return 0.0
    try:
        dot = sum(x * y for x, y in zip(embedding1, embedding2))
        return float(dot)
    except Exception:
        return 0.0
