"""Users app URLs."""
from django.urls import path
from . import views

urlpatterns = [
    path("users/", views.UserListCreateView.as_view(), name="user-list"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="user-detail"),
    path("users/me/", views.me, name="user-me"),
    path("permissions/", views.AccessPermissionListCreateView.as_view(), name="permission-list"),
]
