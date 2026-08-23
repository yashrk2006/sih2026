from django.urls import path
from . import views

urlpatterns = [
    path("assets/", views.asset_list, name="asset-list"),
    path("assets/<int:pk>/", views.asset_detail, name="asset-detail"),
    path("assets/<int:pk>/transition/", views.asset_transition, name="asset-transition"),
]
