"""
RBAC Permission classes for Django REST Framework.
Every sensitive endpoint enforces these server-side — not just UI hiding.
"""
from rest_framework.permissions import BasePermission
from .models import Role


class IsAdmin(BasePermission):
    """Only ADMIN role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == Role.ADMIN)


class IsAdminOrInvestigator(BasePermission):
    """ADMIN or INVESTIGATOR."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.INVESTIGATOR)
        )


class IsAdminOrLegal(BasePermission):
    """ADMIN or LEGAL_OFFICER."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.LEGAL_OFFICER)
        )


class CanUploadDocument(BasePermission):
    """ADMIN, INVESTIGATOR, LEGAL_OFFICER can upload documents."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.INVESTIGATOR, Role.LEGAL_OFFICER)
        )


class CanViewAudit(BasePermission):
    """All authenticated users can view audit trails for transparency."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
        )


class CanManageUsers(BasePermission):
    """Only ADMIN can manage users and permissions."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


def user_can_access_document(user, document, permission_type="READ"):
    """
    Check if a user can access a specific document.
    
    Priority order:
    1. ADMIN → always yes
    2. Explicit AccessPermission record
    3. Role-based case access (INVESTIGATOR/LEGAL_OFFICER for their cases)
    4. VIEWER → READ-only on all active documents
    """
    from .models import AccessPermission

    if not user.is_authenticated:
        return False

    # Admin has full access
    if user.role == Role.ADMIN:
        return True

    # Check explicit document permission
    explicit = AccessPermission.objects.filter(
        user=user, document=document, permission_type=permission_type
    ).first()
    if explicit and not explicit.is_expired():
        return True

    # Check case-level permission
    if document.case:
        case_perm = AccessPermission.objects.filter(
            user=user, case=document.case, permission_type=permission_type
        ).first()
        if case_perm and not case_perm.is_expired():
            return True

    # INVESTIGATOR can read documents in cases they are assigned to
    if user.role == Role.INVESTIGATOR and permission_type == "READ":
        if document.case and document.case.assigned_investigators.filter(pk=user.pk).exists():
            return True

    # LEGAL_OFFICER can read and sign active documents or assigned cases
    if user.role == Role.LEGAL_OFFICER and permission_type in ("READ", "SIGN"):
        return document.status == "ACTIVE" or (document.case and document.case.assigned_legal_officers.filter(pk=user.pk).exists())

    # VIEWER has read-only access to active documents
    if user.role == Role.VIEWER and permission_type == "READ":
        return document.status == "ACTIVE"

    # AUDITOR can read everything (for audit purposes)
    if user.role == Role.AUDITOR and permission_type == "READ":
        return True

    return False


def user_can_access_case(user, case, permission_type="READ"):
    """Check if a user can access a specific case."""
    from .models import AccessPermission

    if not user.is_authenticated:
        return False

    if user.role == Role.ADMIN:
        return True

    explicit = AccessPermission.objects.filter(
        user=user, case=case, permission_type=permission_type
    ).first()
    if explicit and not explicit.is_expired():
        return True

    if user.role == Role.INVESTIGATOR:
        return case.assigned_investigators.filter(pk=user.pk).exists()

    if user.role == Role.LEGAL_OFFICER:
        return case.assigned_legal_officers.filter(pk=user.pk).exists()

    if user.role == Role.VIEWER and permission_type == "READ":
        return case.status == "ACTIVE"

    if user.role == Role.AUDITOR and permission_type == "READ":
        return True

    return False
