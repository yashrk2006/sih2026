"""
Cases App — Legal case management.
"""
from django.db import models
from django.utils import timezone


class Case(models.Model):
    """A legal investigation case that groups related documents."""

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("CLOSED", "Closed"),
        ("ARCHIVED", "Archived"),
        ("PENDING", "Pending"),
    ]

    CASE_TYPE_CHOICES = [
        ("CRIMINAL", "Criminal"),
        ("CIVIL", "Civil"),
        ("INVESTIGATION", "Investigation"),
        ("COURT", "Court Proceeding"),
        ("FORENSIC", "Forensic Investigation"),
        ("OTHER", "Other"),
    ]

    # Unique identifiers
    case_id = models.CharField(max_length=100, unique=True, help_text="Official case ID e.g. CASE-2026-001")
    fir_number = models.CharField(max_length=100, blank=True, db_index=True, help_text="FIR number if applicable")
    reference_number = models.CharField(max_length=100, blank=True)

    # Descriptive
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    case_type = models.CharField(max_length=20, choices=CASE_TYPE_CHOICES, default="INVESTIGATION")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True, default="ACTIVE")

    # Location & jurisdiction
    location = models.CharField(max_length=300, blank=True)
    police_station = models.CharField(max_length=300, blank=True)
    court_name = models.CharField(max_length=300, blank=True)
    jurisdiction = models.CharField(max_length=300, blank=True)

    # People
    created_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="created_cases"
    )
    assigned_investigators = models.ManyToManyField(
        "users.User", blank=True, related_name="investigator_cases"
    )
    assigned_legal_officers = models.ManyToManyField(
        "users.User", blank=True, related_name="legal_officer_cases"
    )

    # Dates
    incident_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "cases_case"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.case_id}] {self.title}"

    def close(self, user=None):
        self.status = "CLOSED"
        self.closed_at = timezone.now()
        self.save()
