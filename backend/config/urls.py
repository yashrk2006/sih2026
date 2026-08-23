"""
URL Configuration — SIH26190
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from rest_framework_simplejwt.views import TokenBlacklistView
from apps.users.views import CustomTokenObtainPairView

from apps.documents.views import test_pipeline_upload_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("test-upload/", test_pipeline_upload_view, name="test_pipeline_upload"),

    # Authentication
    path("api/auth/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/auth/token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),

    # API endpoints
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.cases.urls")),
    path("api/", include("apps.documents.urls")),
    path("api/", include("apps.audit.urls")),
    path("api/", include("apps.search.urls")),
    path("api/", include("apps.blockchain.urls")),
    path("api/", include("apps.system_settings.urls")),
    path("api/", include("apps.assets.urls")),
]
