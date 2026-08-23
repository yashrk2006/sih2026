"""Users app serializers."""
from rest_framework import serializers
from .models import User, AccessPermission


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "badge_number", "department", "is_active", "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "username", "email", "password", "first_name", "last_name",
            "role", "badge_number", "department",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AccessPermissionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    granted_by_username = serializers.CharField(source="granted_by.username", read_only=True)

    class Meta:
        model = AccessPermission
        fields = [
            "id", "user", "user_username", "case", "document",
            "permission_type", "granted_by", "granted_by_username",
            "granted_at", "expires_at", "notes",
        ]
        read_only_fields = ["id", "granted_at", "granted_by"]

    def create(self, validated_data):
        validated_data["granted_by"] = self.context["request"].user
        return super().create(validated_data)
