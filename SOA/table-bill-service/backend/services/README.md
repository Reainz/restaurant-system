# Services Refactoring

This directory contains the modular services that were extracted from the original monolithic `services.py` file. The refactoring was done to improve code organization, readability, and maintainability.

## Modules

- **tables.py**: Handles table management functionality.
- **bills.py**: Manages bill-related operations.
- **data_consistency.py**: Ensures data integrity between services.
- **integration.py**: Manages integration with other microservices.
- **webhook.py**: Implements webhook notifications to external systems.
- **background.py**: Manages background synchronization processes.

## Module Relationships

- **TableService** (tables.py): Manages CRUD operations for tables.
- **BillService** (bills.py): Manages CRUD operations for bills.
- **DataConsistencyService** (data_consistency.py): Verifies and reconciles bill data with external services.
- **ServiceIntegration** (integration.py): Handles communication with other microservices.
- **WebhookNotificationService** (webhook.py): Sends webhook notifications to external systems.
- **start_background_sync** (background.py): Initializes background data synchronization.

## Usage

The services are imported from the package directly:

```python
from .services import (
    TableService, 
    BillService, 
    DataConsistencyService, 
    ServiceIntegration,
    WebhookNotificationService,
    start_background_sync
)
``` 