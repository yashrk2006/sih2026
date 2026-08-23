"""Cases app serializers."""
from rest_framework import serializers
from .models import Case
from apps.users.serializers import UserSerializer


class CaseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            "id", "case_id", "fir_number", "reference_number",
            "title", "description", "case_type", "status",
            "location", "police_station", "court_name", "jurisdiction",
            "created_by", "created_by_name",
            "assigned_investigators", "assigned_legal_officers",
            "incident_date", "created_at", "updated_at", "closed_at",
            "tags", "metadata", "document_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def get_document_count(self, obj):
        return obj.documents.count()

    def create(self, validated_data):
        investigators = validated_data.pop("assigned_investigators", [])
        legal_officers = validated_data.pop("assigned_legal_officers", [])
        validated_data["created_by"] = self.context["request"].user
        case = Case.objects.create(**validated_data)
        case.assigned_investigators.set(investigators)
        case.assigned_legal_officers.set(legal_officers)
        return case


class CaseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            "id", "case_id", "fir_number", "title", "case_type",
            "status", "location", "created_at", "document_count",
        ]

    def get_document_count(self, obj):
        return obj.documents.count()
