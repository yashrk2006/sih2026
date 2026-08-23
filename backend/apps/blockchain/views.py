"""Blockchain app URLs."""
from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .service import verify_hash_on_chain


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verify_hash(request):
    """
    GET /api/blockchain/verify/?hash={sha256_hex}
    Check if a hash is anchored on-chain.
    """
    sha256_hex = request.query_params.get("hash", "")
    if len(sha256_hex) != 64:
        return Response({"error": "Invalid SHA-256 hash (must be 64 hex chars)"}, status=400)
    result = verify_hash_on_chain(sha256_hex)
    return Response(result)


urlpatterns_views = [verify_hash]
