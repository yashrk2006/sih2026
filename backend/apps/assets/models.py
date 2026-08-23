"""
Assets App Models — Tracking police and forensic equipment.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


class AssetType(models.TextChoices):
    COMPUTER = "COMPUTER", "Computer workstation"
    LAPTOP = "LAPTOP", "Forensic Laptop"
    STORAGE = "STORAGE", "Encrypted Hard Drive / USB"
    VEHICLE = "VEHICLE", "Police Vehicle"
    WEAPON = "WEAPON", "Service Weapon"
    DOCUMENT_VAULT = "DOCUMENT_VAULT", "Secure Document Vault"
    OTHER = "OTHER", "Other Equipment"


class AssetStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    ASSIGNED = "ASSIGNED", "Assigned"
    IN_USE = "IN_USE", "In Use"
    TRANSFERRED = "TRANSFERRED", "Transferred"
    MAINTENANCE = "MAINTENANCE", "In Maintenance"
    RETURNED = "RETURNED", "Returned"
    LOST = "LOST", "Lost"
    RETIRED = "RETIRED", "Retired"


class AssetCondition(models.TextChoices):
    EXCELLENT = "EXCELLENT", "Excellent"
    GOOD = "GOOD", "Good"
    FAIR = "FAIR", "Fair"
    POOR = "POOR", "Poor"
    DAMAGED = "DAMAGED", "Damaged"


class Asset(models.Model):
    """
    Represents an asset/equipment owned by law enforcement or linked to cases.
    """
    asset_id = models.CharField(max_length=100, unique=True, help_text="Unique asset identifier e.g. POL-EQ-001")
    asset_type = models.CharField(
        max_length=50, choices=AssetType.choices, default=AssetType.OTHER
    )
    asset_name = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=200, blank=True)
    
    # Assignment
    current_holder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="held_assets"
    )
    case = models.ForeignKey(
        "cases.Case", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="associated_assets"
    )
    
    # State
    status = models.CharField(
        max_length=30, choices=AssetStatus.choices, default=AssetStatus.AVAILABLE
    )
    condition = models.CharField(
        max_length=30, choices=AssetCondition.choices, default=AssetCondition.GOOD
    )
    location = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assets_asset"
        ordering = ["asset_id"]

    def __str__(self):
        return f"[{self.asset_id}] {self.asset_name} ({self.status})"
