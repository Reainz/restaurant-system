"""
Services package for table-bill-service.
This package contains modular services extracted from the original monolithic services.py file.
"""

# Import service modules
from .tables import TableService
from .bills import BillService
from .data_consistency import DataConsistencyService
from .integration import ServiceIntegration
from .webhook import WebhookNotificationService
from .background import start_background_sync

# Export all service classes for backwards compatibility
__all__ = [
    'TableService', 
    'BillService', 
    'DataConsistencyService', 
    'ServiceIntegration',
    'WebhookNotificationService',
    'start_background_sync'
] 