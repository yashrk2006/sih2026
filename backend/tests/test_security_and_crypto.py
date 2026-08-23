from django.test import TestCase
from apps.security.services import (
    compute_sha256,
    encrypt_bytes,
    decrypt_bytes,
)
from apps.security.signatures import (
    generate_user_keypair,
    sign_document_hash,
    verify_document_signature,
)


class SecurityAndCryptoTestCase(TestCase):
    def test_sha256_computation(self):
        data = b"Confidential Legal Document"
        hash1 = compute_sha256(data)
        hash2 = compute_sha256(data)
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)

        modified_data = b"Confidential Legal Document Modified"
        hash_mod = compute_sha256(modified_data)
        self.assertNotEqual(hash1, hash_mod)

    def test_fernet_encryption_decryption(self):
        plaintext = b"Top Secret Evidentiary Data 2026"
        ciphertext = encrypt_bytes(plaintext)
        self.assertNotEqual(plaintext, ciphertext)

        decrypted = decrypt_bytes(ciphertext)
        self.assertEqual(plaintext, decrypted)

    def test_rsa_digital_signature_verification(self):
        user_id = 9999
        public_pem = generate_user_keypair(user_id)
        doc_hash = compute_sha256(b"Court Exhibit A")

        sig_hex = sign_document_hash(user_id, doc_hash)
        self.assertTrue(len(sig_hex) > 0)

        # Verification with valid signature
        val_result = verify_document_signature(public_pem, doc_hash, sig_hex)
        self.assertTrue(val_result["valid"])

        # Verification with tampered hash
        tampered_hash = compute_sha256(b"Court Exhibit B")
        tampered_result = verify_document_signature(public_pem, tampered_hash, sig_hex)
        self.assertFalse(tampered_result["valid"])
