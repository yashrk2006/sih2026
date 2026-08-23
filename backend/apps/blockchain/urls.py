"""Blockchain app URLs."""
from django.urls import path
from .views import verify_hash

urlpatterns = [
    path("blockchain/verify/", verify_hash, name="blockchain-verify"),
]
