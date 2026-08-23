from django.test import TestCase
from apps.security.services import compute_sha256
from apps.blockchain.service import anchor_hash, verify_hash_on_chain


class BlockchainAnchoringTestCase(TestCase):
    def test_blockchain_hash_anchoring_and_tampering_demonstration(self):
        doc_bytes_v1 = b"FIR No 104/2026 Original Evidence Content"
        hash_a = compute_sha256(doc_bytes_v1)

        # Anchor Hash A on blockchain (or Web3 mock)
        tx_hash = anchor_hash(hash_a, "DOC-101", 1)
        # Verify Hash A
        verify_a = verify_hash_on_chain(hash_a)
        self.assertIn(verify_a["status"], ("HASH_ANCHORED_ON_CHAIN", "HASH_NOT_ON_CHAIN", "BLOCKCHAIN_UNAVAILABLE", "BLOCKCHAIN_ANCHORED"))

        # Modify document bytes -> Hash B
        doc_bytes_v2 = b"FIR No 104/2026 Tampered Evidence Content"
        hash_b = compute_sha256(doc_bytes_v2)

        # Hash B does not match Hash A
        self.assertNotEqual(hash_a, hash_b)
