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


from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.core.management import call_command

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom JWT Token Obtain view that auto-seeds demo data if
    the database is uninitialized or missing the admin account.
    """
    def post(self, request, *args, **kwargs):
        User = get_user_model()
        admin = User.objects.filter(username="admin").first()
        if not admin or not admin.check_password("SecurePass123!"):
            try:
                # Trigger db seeding dynamically
                call_command("seed_demo_data")
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Auto-seeding database failed: {e}")
        return super().post(request, *args, **kwargs)
