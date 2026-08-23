"""Audit app URLs."""
from django.urls import path
from . import views

urlpatterns = [
    path("audit/", views.audit_list, name="audit-list"),
    path("audit/events/", views.audit_list, name="audit-events"),
    path("audit/verify/", views.verify_chain, name="audit-verify"),
]
