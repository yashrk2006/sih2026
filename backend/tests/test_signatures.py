from django.test import TestCase
from apps.security.services import compute_sha256
from apps.security.signatures import (
    generate_user_keypair,
    sign_document_hash,
    verify_document_signature,
)


class DigitalSignaturesTestCase(TestCase):
    def test_rsa_signature_generation_and_verification(self):
        user_id = 7777
        public_pem = generate_user_keypair(user_id)
        self.assertIn("BEGIN PUBLIC KEY", public_pem)

        doc_bytes = b"State vs. Cyber Syndicate Court Filing Exhibit"
        original_hash = compute_sha256(doc_bytes)

        sig_hex = sign_document_hash(user_id, original_hash)
        self.assertTrue(len(sig_hex) > 0)

        # Verification with valid signature -> VALID
        valid_res = verify_document_signature(public_pem, original_hash, sig_hex)
        self.assertTrue(valid_res["valid"])
        self.assertEqual(valid_res["status"], "SIGNATURE_VALID")

        # Verification with tampered hash -> INVALID
        tampered_hash = compute_sha256(b"Modified Court Filing Exhibit")
        invalid_res = verify_document_signature(public_pem, tampered_hash, sig_hex)
        self.assertFalse(invalid_res["valid"])
        self.assertEqual(invalid_res["status"], "SIGNATURE_INVALID")
