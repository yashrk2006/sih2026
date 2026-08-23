from django.contrib import admin
from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "actor", "action", "result", "timestamp", "current_event_hash")
    list_filter = ("action", "result")
    search_fields = ("event_id", "actor__username", "action", "current_event_hash")
