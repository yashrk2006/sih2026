"""Audit app views."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import AuditEvent
from .serializers import AuditEventSerializer
from .utils import verify_audit_chain
from apps.users.permissions import CanViewAudit


@api_view(["GET"])
@permission_classes([CanViewAudit])
def audit_list(request):
    """
    GET /api/audit/
    List all audit events (ADMIN and AUDITOR only).
    """
    events = AuditEvent.objects.select_related("actor", "document", "case").all()
    
    document_id = request.query_params.get("document_id")
    if document_id:
        events = events.filter(document__document_id=document_id)
        
    case_id = request.query_params.get("case_id")
    if case_id:
        events = events.filter(case__case_id=case_id)
        
    events = events[:500]
    serializer = AuditEventSerializer(events, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([CanViewAudit])
def verify_chain(request):
    """
    GET /api/audit/verify
    Verify the entire audit chain integrity.
    """
    result = verify_audit_chain()
    return Response(result)
