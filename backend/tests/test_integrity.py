import os
from django.test import TestCase
from apps.security.services import (
    compute_sha256,
    encrypt_bytes,
    decrypt_bytes,
    verify_file_integrity,
)


class EncryptionAndIntegrityTestCase(TestCase):
    def test_encryption_decryption_roundtrip(self):
        original_plaintext = b"CONFIDENTIAL EVIDENTIARY EXHIBIT A-101\nTop Secret Details"
        ciphertext = encrypt_bytes(original_plaintext)

        # Ciphertext must not be plaintext
        self.assertNotEqual(ciphertext, original_plaintext)

        decrypted_plaintext = decrypt_bytes(ciphertext)
        self.assertEqual(decrypted_plaintext, original_plaintext)

    def test_seven_step_sha256_integrity_workflow(self):
        tmp_file = "tmp_test_doc.txt"
        original_bytes = b"ORIGINAL LEGAL DOCUMENT CONTENT 2026"
        with open(tmp_file, "wb") as f:
            f.write(original_bytes)

        try:
            # STEP 1 & 2: Calculate SHA-256
            original_hash = compute_sha256(original_bytes)

            # STEP 3 & 4: Initial verification -> INTEGRITY_VERIFIED
            res1 = verify_file_integrity(tmp_file, original_hash)
            self.assertTrue(res1["verified"])
            self.assertEqual(res1["status"], "INTEGRITY_VERIFIED")

            # STEP 5: Tamper with file
            modified_bytes = b"TAMPERED LEGAL DOCUMENT CONTENT 2026"
            with open(tmp_file, "wb") as f:
                f.write(modified_bytes)

            # STEP 6: Verify after modification -> TAMPERING_DETECTED
            res2 = verify_file_integrity(tmp_file, original_hash)
            self.assertFalse(res2["verified"])
            self.assertEqual(res2["status"], "TAMPERING_DETECTED")

            # STEP 7: Restore original -> INTEGRITY_VERIFIED
            with open(tmp_file, "wb") as f:
                f.write(original_bytes)

            res3 = verify_file_integrity(tmp_file, original_hash)
            self.assertTrue(res3["verified"])
            self.assertEqual(res3["status"], "INTEGRITY_VERIFIED")

        finally:
            if os.path.exists(tmp_file):
                os.remove(tmp_file)
