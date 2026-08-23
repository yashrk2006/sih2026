from rest_framework import serializers
from .models import Asset
from apps.users.serializers import UserSerializer
from apps.cases.serializers import CaseSerializer


class AssetSerializer(serializers.ModelSerializer):
    holder_username = serializers.CharField(source="current_holder.username", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)
    case_id_str = serializers.CharField(source="case.case_id", read_only=True)

    class Meta:
        model = Asset
        fields = [
            "id",
            "asset_id",
            "asset_type",
            "asset_name",
            "serial_number",
            "department",
            "current_holder",
            "holder_username",
            "case",
            "case_title",
            "case_id_str",
            "status",
            "condition",
            "location",
            "notes",
            "created_at",
            "updated_at",
        ]
