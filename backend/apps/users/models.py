"""
Users App — Custom User model with Role-Based Access Control.

Roles:
  ADMIN         - Full system access
  INVESTIGATOR  - Access assigned investigation cases
  LEGAL_OFFICER - Access authorized legal documents
  VIEWER        - Read-only access
  AUDITOR       - Audit and integrity verification access
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    INVESTIGATOR = "INVESTIGATOR", "Investigator"
    LEGAL_OFFICER = "LEGAL_OFFICER", "Legal Officer"
    VIEWER = "VIEWER", "Viewer"
    AUDITOR = "AUDITOR", "Auditor"


class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, role=Role.VIEWER, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, email, password, role=Role.ADMIN, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model with role-based access control.
    """
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    badge_number = models.CharField(max_length=50, blank=True, help_text="Official ID / badge number")
    department = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    # RSA public key for digital signature verification
    public_key_pem = models.TextField(blank=True, help_text="RSA public key in PEM format")

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "users_user"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def has_role(self, *roles):
        """Check if user has one of the specified roles."""
        return self.role in roles

    def is_admin(self):
        return self.role == Role.ADMIN

    def is_investigator(self):
        return self.role == Role.INVESTIGATOR

    def is_legal_officer(self):
        return self.role == Role.LEGAL_OFFICER

    def is_viewer(self):
        return self.role == Role.VIEWER

    def is_auditor(self):
        return self.role == Role.AUDITOR


class AccessPermission(models.Model):
    """
    Explicit per-document or per-case access grants.
    Supplements role-level permissions for fine-grained access control.
    """
    PERMISSION_TYPES = [
        ("READ", "Read"),
        ("WRITE", "Write"),
        ("DOWNLOAD", "Download"),
        ("SIGN", "Sign"),
        ("ADMIN", "Admin"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="access_permissions")
    # Either case or document — at least one must be set
    case = models.ForeignKey(
        "cases.Case", on_delete=models.CASCADE, null=True, blank=True, related_name="access_permissions"
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.CASCADE, null=True, blank=True, related_name="access_permissions"
    )
    permission_type = models.CharField(max_length=20, choices=PERMISSION_TYPES)
    granted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="granted_permissions"
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "users_accesspermission"
        unique_together = ("user", "case", "document", "permission_type")

    def __str__(self):
        target = self.case or self.document
        return f"{self.user.username} → {self.permission_type} on {target}"

    def is_expired(self):
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at
