"""Search app URLs."""
from django.urls import path
from .views import search

urlpatterns = [
    path("search/", search, name="search"),
]
