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
