"""
Search app views — SIH26190 Law Enforcement Evidence Search.
Supports both GET and POST requests for evidence search.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .service import keyword_search, semantic_search
from apps.audit.utils import log_audit_event


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def search(request):
    """
    GET /api/search/?q=<query>  or  POST /api/search/
    
    Parameters:
        q / query: str
        search_type: "keyword" | "semantic" (default: "keyword")
        case_id: str
        doc_type: str
    
    Returns:
    {
      "results": [...],
      "total": int,
      "query": str
    }
    """
    if request.method == "GET":
        query = request.GET.get("q", "").strip() or request.GET.get("query", "").strip()
        search_type = request.GET.get("search_type", "keyword")
        case_id = request.GET.get("case_id", "")
        doc_type = request.GET.get("doc_type", "")
        officer = request.GET.get("officer", "")
        status_val = request.GET.get("status", "")
        legal_section = request.GET.get("legal_section", "")
        date_from = request.GET.get("date_from", "")
        date_to = request.GET.get("date_to", "")
    else:
        query = request.data.get("q", "").strip() or request.data.get("query", "").strip()
        search_type = request.data.get("search_type", "keyword")
        case_id = request.data.get("case_id", "")
        doc_type = request.data.get("doc_type", "")
        officer = request.data.get("officer", "")
        status_val = request.data.get("status", "")
        legal_section = request.data.get("legal_section", "")
        date_from = request.data.get("date_from", "")
        date_to = request.data.get("date_to", "")

    search_kwargs = {
        "case_id": case_id or None,
        "doc_type": doc_type or None,
        "officer": officer or None,
        "status": status_val or None,
        "legal_section": legal_section or None,
        "date_from": date_from or None,
        "date_to": date_to or None,
    }

    if search_type == "semantic" and query:
        results = semantic_search(query, request.user, **search_kwargs)
    else:
        results = keyword_search(query, request.user, **search_kwargs)

    if query:
        log_audit_event(
            actor=request.user,
            action="SEARCH_PERFORMED",
            result="SUCCESS",
            details=f"query='{query[:100]}' results={len(results)}",
        )

    return Response({
        "query": query,
        "search_type": search_type,
        "total": len(results),
        "count": len(results),
        "results": results,
    })
