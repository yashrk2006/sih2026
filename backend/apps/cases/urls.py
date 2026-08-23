"""Cases app URLs."""
from django.urls import path
from . import views

urlpatterns = [
    path("cases/", views.CaseListCreateView.as_view(), name="case-list"),
    path("cases/<int:pk>/", views.CaseDetailView.as_view(), name="case-detail"),
    path("cases/<str:case_id>/documents/", views.case_documents, name="case-documents"),
]
