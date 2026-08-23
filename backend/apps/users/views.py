"""Users app views."""
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import User, AccessPermission
from .serializers import UserSerializer, UserCreateSerializer, AccessPermissionSerializer
from .permissions import IsAdmin, CanManageUsers


class UserListCreateView(generics.ListCreateAPIView):
    """List all users (admin only) or create a new user."""
    queryset = User.objects.all().order_by("username")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == "ADMIN":
            return User.objects.all().order_by("username")
        return User.objects.filter(pk=user.pk)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a user (admin only)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]


class AccessPermissionListCreateView(generics.ListCreateAPIView):
    """Manage access permissions."""
    serializer_class = AccessPermissionSerializer
    permission_classes = [CanManageUsers]

    def get_queryset(self):
        return AccessPermission.objects.select_related("user", "case", "document", "granted_by")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the authenticated user's profile."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
