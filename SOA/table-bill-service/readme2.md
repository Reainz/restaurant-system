table-bill-service/
├── backend/
│   ├── services/
│   │   ├── bills.py - Bill management functionality
│   │   ├── tables.py - Table management functionality
│   │   ├── integration.py - Integration with other services
│   │   ├── webhook.py - Webhook notifications
│   │   └── data_consistency.py - Data consistency verification
│   ├── models.py - Data models
│   ├── config.py - Configuration settings
│   └── app.py - FastAPI application
├── frontend/
│   ├── js/ - JavaScript modules
│   ├── templates/ - HTML templates
│   └── static/ - Static assets
├── run.py - Service entry point
├── requirements.txt - Python dependencies
└── .env - Environment variables