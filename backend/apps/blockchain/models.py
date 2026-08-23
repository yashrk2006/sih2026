"""
Blockchain App — Hash Anchoring.

Stores only document hashes on-chain.
NEVER stores: document content, filenames, PII, or any sensitive data.

Approach: Hardhat local dev network + minimal Solidity contract.
Falls back gracefully if blockchain is unavailable.
"""
from django.db import models


class BlockchainAnchor(models.Model):
    """
    Record of a document hash anchored on the blockchain.
    Contains only the hash — no document content or PII.
    """
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("ANCHORED", "Anchored"),
        ("FAILED", "Failed"),
    ]

    document = models.ForeignKey(
        "documents.Document", on_delete=models.CASCADE, related_name="blockchain_anchors"
    )
    version = models.ForeignKey(
        "documents.DocumentVersion", on_delete=models.SET_NULL, null=True,
        related_name="blockchain_anchors"
    )

    # Hash only — no document content on-chain
    document_hash = models.CharField(max_length=64, help_text="SHA-256 hex of original document bytes")

    # Blockchain transaction details
    tx_hash = models.CharField(max_length=200, blank=True, help_text="On-chain transaction hash")
    block_number = models.BigIntegerField(null=True, blank=True)
    network = models.CharField(max_length=100, default="hardhat-local")
    contract_address = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    anchored_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="blockchain_anchors"
    )
    anchored_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "blockchain_anchor"
        ordering = ["-anchored_at"]

    def __str__(self):
        return f"Anchor: {self.document_hash[:16]}... tx={self.tx_hash[:16] if self.tx_hash else 'pending'}..."
