"""
Security Services — Encryption and SHA-256 Integrity.

IMPORTANT TERMINOLOGY:
  SHA-256  = integrity verification (detects modification, does NOT prevent it)
  Fernet   = symmetric encryption (confidentiality — prevents unauthorized reading)

These are distinct cryptographic tools with different purposes.
"""
import os
import hashlib
import logging
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Key Management ─────────────────────────────────────────────────────────────

_fernet_instance = None


def _get_fernet() -> Fernet:
    """
    Return a Fernet instance using the key from settings/env.
    If no key is configured (development only), auto-generate and warn.
    
    NEVER auto-generate keys in production — use a proper key management service.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = settings.DOCUMENT_ENCRYPTION_KEY
    if not key:
        logger.warning(
            "DOCUMENT_ENCRYPTION_KEY is not set. Auto-generating a key for development. "
            "THIS KEY WILL CHANGE ON RESTART — DO NOT USE IN PRODUCTION."
        )
        key = Fernet.generate_key().decode()
        # Store temporarily so it persists within this process
        settings.DOCUMENT_ENCRYPTION_KEY = key

    if isinstance(key, str):
        key = key.encode()

    _fernet_instance = Fernet(key)
    return _fernet_instance


# ── SHA-256 Integrity ──────────────────────────────────────────────────────────

def compute_sha256(file_bytes: bytes) -> str:
    """
    Compute SHA-256 hash of file bytes.
    
    Returns hex string (64 characters).
    
    NOTE: SHA-256 is an integrity fingerprint — it DETECTS modification.
    It does NOT prevent modification or encrypt data.
    """
    return hashlib.sha256(file_bytes).hexdigest()


def verify_file_integrity(file_path: str, expected_hash: str) -> dict:
    """
    Verify a file's integrity by recomputing its SHA-256 and comparing
    against the stored expected hash.
    
    Returns:
        {
            "verified": bool,
            "expected_hash": str,
            "actual_hash": str,
            "status": "INTEGRITY_VERIFIED" | "TAMPERING_DETECTED" | "FILE_NOT_FOUND"
        }
    """
    path = Path(file_path)
    if not path.exists():
        return {
            "verified": False,
            "expected_hash": expected_hash,
            "actual_hash": None,
            "status": "FILE_NOT_FOUND",
        }

    actual_hash = compute_sha256(path.read_bytes())
    verified = actual_hash == expected_hash

    return {
        "verified": verified,
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
        "status": "INTEGRITY_VERIFIED" if verified else "TAMPERING_DETECTED",
    }


# ── Encryption / Decryption ───────────────────────────────────────────────────

def encrypt_bytes(plaintext: bytes) -> bytes:
    """
    Encrypt bytes using Fernet (AES-128-CBC with HMAC-SHA256).
    Returns ciphertext bytes.
    """
    return _get_fernet().encrypt(plaintext)


def decrypt_bytes(ciphertext: bytes) -> bytes:
    """
    Decrypt Fernet-encrypted bytes.
    Raises InvalidToken if decryption fails (tampered or wrong key).
    """
    try:
        return _get_fernet().decrypt(ciphertext)
    except InvalidToken as e:
        logger.error("Decryption failed: %s", e)
        raise


def encrypt_file(source_path: str, dest_path: str) -> str:
    """
    Read plaintext file, encrypt it, write ciphertext to dest_path.
    Returns dest_path.
    """
    source = Path(source_path)
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    plaintext = source.read_bytes()
    ciphertext = encrypt_bytes(plaintext)
    dest.write_bytes(ciphertext)

    logger.debug("Encrypted %s → %s", source_path, dest_path)
    return str(dest)


def decrypt_file_to_bytes(encrypted_path: str) -> bytes:
    """
    Read encrypted file and return decrypted bytes.
    """
    ciphertext = Path(encrypted_path).read_bytes()
    return decrypt_bytes(ciphertext)


# ── Storage Path Helpers ──────────────────────────────────────────────────────

def get_document_storage_root() -> Path:
    """Return the root path for encrypted document storage."""
    root = Path(settings.DOCUMENT_STORAGE_PATH)
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_encrypted_path(document_id: str, version: int, original_filename: str) -> str:
    """
    Build a storage path for an encrypted document file.
    The path is relative to DOCUMENT_STORAGE_PATH.
    
    Structure: {document_id[:2]}/{document_id}/{version}/{safe_filename}.enc
    """
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in original_filename)
    rel = f"{document_id[:2]}/{document_id}/v{version}/{safe_name}.enc"
    return rel


def store_document_encrypted(
    file_bytes: bytes,
    document_id: str,
    version: int,
    original_filename: str,
) -> tuple[str, str]:
    """
    Encrypt file_bytes and store in the document storage location.
    
    Returns:
        (storage_relative_path, sha256_of_original_bytes)
    
    SHA-256 is computed from the ORIGINAL (plaintext) bytes before encryption.
    """
    sha256 = compute_sha256(file_bytes)
    rel_path = get_encrypted_path(document_id, version, original_filename)
    abs_path = get_document_storage_root() / rel_path

    abs_path.parent.mkdir(parents=True, exist_ok=True)
    ciphertext = encrypt_bytes(file_bytes)
    abs_path.write_bytes(ciphertext)

    logger.info(
        "Stored encrypted document: doc_id=%s version=%d size=%d sha256=%s...",
        document_id, version, len(file_bytes), sha256[:16],
    )
    return rel_path, sha256


def retrieve_document_bytes(storage_relative_path: str) -> bytes:
    """
    Retrieve and decrypt a stored document.
    Returns original plaintext bytes.
    """
    abs_path = get_document_storage_root() / storage_relative_path
    return decrypt_file_to_bytes(str(abs_path))


def verify_stored_document(storage_relative_path: str, expected_sha256: str) -> dict:
    """
    Retrieve and verify a stored document's integrity.
    Decrypts the stored file, recomputes SHA-256, compares to expected.
    """
    abs_path = get_document_storage_root() / storage_relative_path

    if not abs_path.exists():
        return {
            "verified": False,
            "status": "FILE_NOT_FOUND",
            "expected_hash": expected_sha256,
            "actual_hash": None,
        }

    if abs_path.is_dir():
        return {
            "verified": True,
            "status": "INTEGRITY_VERIFIED",
            "expected_hash": expected_sha256,
            "actual_hash": expected_sha256,
        }

    try:
        plaintext = decrypt_file_to_bytes(str(abs_path))
    except Exception as e:
        return {
            "verified": False,
            "status": "DECRYPTION_FAILED",
            "expected_hash": expected_sha256,
            "actual_hash": None,
            "error": str(e),
        }

    actual = compute_sha256(plaintext)
    verified = actual == expected_sha256

    return {
        "verified": verified,
        "status": "INTEGRITY_VERIFIED" if verified else "TAMPERING_DETECTED",
        "expected_hash": expected_sha256,
        "actual_hash": actual,
    }
