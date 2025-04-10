"""Menu Service Backend Package

This package provides a FastAPI-based backend service for managing restaurant menus.
It includes endpoints for CRUD operations on menu items, categories, and types,
as well as UI pages for customer and kitchen views.

Components:
- app.py: Core application logic and API endpoints
"""

import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - menu-service - %(levelname)s - %(message)s",
)

__version__ = "0.1.0"
__author__ = 'Menu Service Team'