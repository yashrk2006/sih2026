"""
Digital Signature Service (Prototype).

Uses RSA-PSS + SHA-256 for document approval signing.

IMPORTANT: This is a prototype signature mechanism.
It is NOT a legally recognized digital signature unless connected to
a recognized PKI (e.g., Aadhaar eSign, NIC CA).
The system clearly distinguishes between cryptographic proof (this)
and legal validity (not claimed here).
"""
import os
import logging
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature

logger = logging.getLogger(__name__)

# Key storage path (dev only — in production use HSM or vault)
_KEY_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "user_keys"


def _get_user_key_dir(user_id: int) -> Path:
    key_dir = _KEY_DIR / str(user_id)
    key_dir.mkdir(parents=True, exist_ok=True)
    return key_dir


def generate_user_keypair(user_id: int) -> str:
    """
    Generate an RSA-2048 key pair for a user.
    Private key stored locally (dev only).
    Returns the PEM-encoded public key.
    
    WARNING: In production, private keys must be stored in an HSM or
    secure key vault, never on the application filesystem.
    """
    key_dir = _get_user_key_dir(user_id)
    private_key_path = key_dir / "private_key.pem"

    if private_key_path.exists():
        # Already has keys — return public key
        private_key = serialization.load_pem_private_key(
            private_key_path.read_bytes(), password=None, backend=default_backend()
        )
    else:
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        private_key_path.write_bytes(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        logger.info("Generated RSA keypair for user_id=%d", user_id)

    public_key_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return public_key_pem


def sign_document_hash(user_id: int, sha256_hex: str) -> str:
    """
    Sign a document's SHA-256 hash with the user's private key.
    Returns hex-encoded signature.
    """
    key_dir = _get_user_key_dir(user_id)
    private_key_path = key_dir / "private_key.pem"

    if not private_key_path.exists():
        raise FileNotFoundError(f"No private key for user {user_id}. Generate keys first.")

    private_key = serialization.load_pem_private_key(
        private_key_path.read_bytes(), password=None, backend=default_backend()
    )

    signature = private_key.sign(
        bytes.fromhex(sha256_hex),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        hashes.SHA256(),
    )

    return signature.hex()


def verify_document_signature(public_key_pem: str, sha256_hex: str, signature_hex: str) -> dict:
    """
    Verify a document signature using a public key.
    
    Returns:
        {"valid": bool, "status": str}
    """
    try:
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode(), backend=default_backend()
        )
        public_key.verify(
            bytes.fromhex(signature_hex),
            bytes.fromhex(sha256_hex),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )
        return {"valid": True, "status": "SIGNATURE_VALID"}
    except InvalidSignature:
        return {"valid": False, "status": "SIGNATURE_INVALID"}
    except Exception as e:
        logger.error("Signature verification error: %s", e)
        return {"valid": False, "status": f"ERROR: {e}"}
