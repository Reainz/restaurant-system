#!/usr/bin/env python3

import logging
import uvicorn
import os
import sys
from pathlib import Path

# Add the parent directory to path so we can import the backend package
parent_dir = Path(__file__).resolve().parent
sys.path.append(str(parent_dir))

from backend.app import app
from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - table-bill-service - %(levelname)s - %(message)s",
)

# Get the logger and add the file handler
logger = logging.getLogger("table-bill-service")
file_handler = logging.FileHandler("table_bill_service.log")
file_handler.setFormatter(logging.Formatter("%(asctime)s - table-bill-service - %(levelname)s - %(message)s"))
logger.addHandler(file_handler)

# Define default host and port
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8003"))

def main():
    """Main entry point to run the service"""
    try:
        logger.info("Starting Table & Bill Management Service")
        logger.info(f"MongoDB URL: {settings.MONGODB_URL}")
        logger.info(f"MongoDB Database: {settings.MONGO_DB_NAME}")
        logger.info(f"Order Service URL: {settings.ORDER_SERVICE_URL}")
        logger.info(f"Menu Service URL: {settings.MENU_SERVICE_URL}")
        
        # Start the service
        logger.info(f"Starting service on {HOST}:{PORT}")
        uvicorn.run(
            "backend.app:app",
            host=HOST,
            port=PORT,
            reload=True if settings.DEBUG else False,
        )
    except Exception as e:
        logger.error(f"Error starting service: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 