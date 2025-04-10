import os
from dotenv import load_dotenv
from pathlib import Path

# Get the base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(os.path.join(BASE_DIR, '.env'))

# Database settings
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
# Revert default back to 'order_service_db'
MONGO_DB = os.getenv("MONGO_DB", "order_service_db")

# API settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8002))

# Project information
PROJECT_NAME = os.getenv("PROJECT_NAME", "Order Management Service")
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")

# External service URLs
MENU_SERVICE_URL = os.getenv("MENU_SERVICE_URL", "http://localhost:8001")
TABLE_BILL_SERVICE_URL = os.getenv("TABLE_BILL_SERVICE_URL", "http://localhost:8003")

# Print configuration for debugging
if DEBUG:
    print("=== Order Service Configuration ===")
    print(f"API_HOST: {API_HOST}")
    print(f"API_PORT: {API_PORT}")
    print(f"MENU_SERVICE_URL: {MENU_SERVICE_URL}")
    print(f"TABLE_BILL_SERVICE_URL: {TABLE_BILL_SERVICE_URL}")
    print(f"MONGO_URL: {MONGO_URL}")
    print(f"MONGO_DB: {MONGO_DB}")
    print(f"DEBUG: {DEBUG}")
    print("===================================") 