"""Assets app views."""
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Asset, AssetStatus
from .serializers import AssetSerializer
from apps.audit.utils import log_audit_event
from apps.users.models import User
from apps.cases.models import Case


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def asset_list(request):
    """
    GET /api/assets/ - List all assets
    POST /api/assets/ - Register a new asset (ADMIN/INVESTIGATOR only)
    """
    if request.method == "GET":
        assets = Asset.objects.all()
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        if not (request.user.is_admin() or request.user.is_investigator()):
            return Response(
                {"error": "Unauthorized to register assets"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssetSerializer(data=request.data)
        if serializer.is_valid():
            asset = serializer.save()
            log_audit_event(
                actor=request.user,
                action="SYSTEM_EVENT",
                details=f"Registered new asset {asset.asset_id} ({asset.asset_name})",
                result="SUCCESS",
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def asset_detail(request, pk):
    """
    GET /api/assets/{id}/
    PUT /api/assets/{id}/
    DELETE /api/assets/{id}/
    """
    try:
        asset = Asset.objects.get(pk=pk)
    except Asset.DoesNotExist:
        return Response({"error": "Asset not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = AssetSerializer(asset)
        return Response(serializer.data)

    elif request.method == "PUT":
        if not (request.user.is_admin() or request.user.is_investigator()):
            return Response(
                {"error": "Unauthorized to modify assets"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssetSerializer(asset, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == "DELETE":
        if not request.user.is_admin():
            return Response(
                {"error": "Only administrators can delete assets"},
                status=status.HTTP_403_FORBIDDEN,
            )
        asset_id = asset.asset_id
        asset.delete()
        log_audit_event(
            actor=request.user,
            action="SYSTEM_EVENT",
            details=f"Deleted asset {asset_id}",
            result="SUCCESS",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def asset_transition(request, pk):
    """
    POST /api/assets/{id}/transition/
    Body:
    {
      "action": "ASSIGN" | "TRANSFER" | "MAINTENANCE" | "RETURN" | "RETIRE",
      "holder_username": "username" (optional),
      "case_id": "case_id" (optional),
      "notes": "notes" (optional),
      "location": "location" (optional)
    }
    """
    try:
        asset = Asset.objects.get(pk=pk)
    except Asset.DoesNotExist:
        return Response({"error": "Asset not found"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get("action")
    notes = request.data.get("notes", "")
    location = request.data.get("location", asset.location)
    holder_username = request.data.get("holder_username")
    case_id = request.data.get("case_id")

    if not action:
        return Response({"error": "Action is required"}, status=status.HTTP_400_BAD_REQUEST)

    previous_status = asset.status
    previous_holder = asset.current_holder

    new_holder = asset.current_holder
    new_case = asset.case
    new_status = asset.status

    # 1. ASSIGN
    if action == "ASSIGN":
        if not holder_username:
            return Response({"error": "holder_username is required for assignment"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_holder = User.objects.get(username=holder_username)
        except User.DoesNotExist:
            return Response({"error": "Holder user not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if case_id:
            try:
                new_case = Case.objects.get(case_id=case_id)
            except Case.DoesNotExist:
                return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = AssetStatus.ASSIGNED

    # 2. TRANSFER
    elif action == "TRANSFER":
        if not holder_username:
            return Response({"error": "holder_username is required for transfer"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_holder = User.objects.get(username=holder_username)
        except User.DoesNotExist:
            return Response({"error": "New holder user not found"}, status=status.HTTP_404_NOT_FOUND)
        
        new_status = AssetStatus.TRANSFERRED

    # 3. MAINTENANCE
    elif action == "MAINTENANCE":
        new_status = AssetStatus.MAINTENANCE
        new_holder = None

    # 4. RETURN
    elif action == "RETURN":
        new_status = AssetStatus.AVAILABLE
        new_holder = None
        new_case = None

    # 5. RETIRE
    elif action == "RETIRE":
        new_status = AssetStatus.RETIRED
        new_holder = None
        new_case = None

    else:
        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    # Apply changes
    asset.status = new_status
    asset.current_holder = new_holder
    asset.case = new_case
    asset.location = location
    if notes:
        asset.notes = notes
    asset.save()

    # Log in system audit trail
    details = f"Asset {asset.asset_id} transitioned: {previous_status} -> {new_status}. Action: {action}. Notes: {notes}"
    log_audit_event(
        actor=request.user,
        action="SYSTEM_EVENT",
        case=asset.case,
        details=details,
        result="SUCCESS",
    )

    serializer = AssetSerializer(asset)
    return Response(serializer.data)
