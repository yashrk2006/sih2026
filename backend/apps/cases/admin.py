from django.contrib import admin
from .models import Case


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("case_id", "title", "fir_number", "police_station", "court_name", "status", "created_at")
    list_filter = ("status", "police_station", "court_name")
    search_fields = ("case_id", "title", "fir_number", "description")
