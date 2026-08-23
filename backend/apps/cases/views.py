"""Cases app views."""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Case
from .serializers import CaseSerializer, CaseListSerializer
from apps.users.permissions import IsAdminOrInvestigator, user_can_access_case
from apps.audit.utils import log_audit_event


class CaseListCreateView(generics.ListCreateAPIView):
    """List accessible cases or create a new case."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return CaseListSerializer
        return CaseSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "ADMIN" or user.role == "AUDITOR":
            return Case.objects.all()
        if user.role == "INVESTIGATOR":
            return Case.objects.filter(assigned_investigators=user)
        if user.role == "LEGAL_OFFICER":
            return Case.objects.filter(assigned_legal_officers=user)
        # VIEWER sees active cases
        return Case.objects.filter(status="ACTIVE")

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminOrInvestigator()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        case = serializer.save()
        log_audit_event(
            actor=self.request.user,
            action="CASE_CREATED",
            case=case,
            result="SUCCESS",
        )


class CaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a case."""
    serializer_class = CaseSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsAdminOrInvestigator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Case.objects.all()

    def get_object(self):
        obj = super().get_object()
        if not user_can_access_case(self.request.user, obj):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to access this case.")
        return obj


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def case_documents(request, case_id):
    """List all documents for a case (RBAC-filtered)."""
    from apps.documents.models import Document
    from apps.documents.serializers import DocumentListSerializer
    from apps.users.permissions import user_can_access_document

    try:
        case = Case.objects.get(case_id=case_id)
    except Case.DoesNotExist:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

    if not user_can_access_case(request.user, case):
        log_audit_event(
            actor=request.user,
            action="DOCUMENT_ACCESS_DENIED",
            case=case,
            result="DENIED",
            details=f"User attempted to access documents for case {case_id}",
        )
        return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

    documents = Document.objects.filter(case=case)
    # Further filter by document-level permissions
    accessible = [d for d in documents if user_can_access_document(request.user, d)]
    serializer = DocumentListSerializer(accessible, many=True)
    return Response(serializer.data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def share_case(request, case_id):
    """
    POST /api/cases/{case_id}/share/ - Share case dossier with an officer.
    DELETE /api/cases/{case_id}/share/ - Revoke case dossier access from an officer.
    """
    try:
        case = Case.objects.get(case_id=case_id)
    except Case.DoesNotExist:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

    # Only case creator or admin can change sharing permissions
    if not (request.user.role == "ADMIN" or case.created_by == request.user):
        return Response({"error": "Only the case creator or administrators can change sharing permissions"}, status=status.HTTP_403_FORBIDDEN)

    from apps.users.models import User, AccessPermission
    username = request.data.get("username")

    if not username:
        return Response({"error": "Username is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_to_change = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        # Remove user from case assignments
        if user_to_change.role == "INVESTIGATOR":
            case.assigned_investigators.remove(user_to_change)
        elif user_to_change.role == "LEGAL_OFFICER":
            case.assigned_legal_officers.remove(user_to_change)

        # Delete any explicit AccessPermission record
        AccessPermission.objects.filter(
            user=user_to_change,
            case=case
        ).delete()

        log_audit_event(
            actor=request.user,
            action="USER_PERMISSION_CHANGED",
            case=case,
            result="SUCCESS",
            details=f"Revoked case {case_id} access from {username}",
        )

        return Response({
            "case_id": case.case_id,
            "revoked_user": username,
            "status": "CASE_ACCESS_REVOKED"
        })

    else:
        # POST - Share case
        permission_type = request.data.get("permission", "READ")
        
        # Assign user to case m2m
        if user_to_change.role == "INVESTIGATOR":
            case.assigned_investigators.add(user_to_change)
        elif user_to_change.role == "LEGAL_OFFICER":
            case.assigned_legal_officers.add(user_to_change)

        # Create permission record
        AccessPermission.objects.get_or_create(
            user=user_to_change,
            case=case,
            permission_type=permission_type,
            defaults={"granted_by": request.user}
        )

        log_audit_event(
            actor=request.user,
            action="USER_PERMISSION_CHANGED",
            case=case,
            result="SUCCESS",
            details=f"Shared case {case_id} with {username} (Permission: {permission_type})",
        )

        return Response({
            "case_id": case.case_id,
            "shared_with": username,
            "permission": permission_type,
            "status": "CASE_SHARED_SUCCESSFULLY"
        })
