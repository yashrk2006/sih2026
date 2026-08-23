from django.contrib import admin
from .models import BlockchainAnchor


@admin.register(BlockchainAnchor)
class BlockchainAnchorAdmin(admin.ModelAdmin):
    list_display = ("document", "document_hash", "tx_hash", "block_number", "anchored_at")
    search_fields = ("document__filename", "document_hash", "tx_hash")
