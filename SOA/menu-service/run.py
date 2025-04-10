import uvicorn
import logging
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - menu-service - %(levelname)s - %(message)s",
)
logger = logging.getLogger("menu-service")

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(os.path.join(BASE_DIR, '.env'))

# API settings
HOST = os.getenv("API_HOST", "0.0.0.0")
PORT = int(os.getenv("API_PORT", "8000"))
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "menu_db")

def setup_static_directory():
    """Set up the static directory structure if it doesn't exist."""
    # Define paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(current_dir, "frontend", "static")
    images_dir = os.path.join(static_dir, "images")
    
    # Ensure directories exist
    for dir_path in [static_dir, images_dir]:
        if not os.path.exists(dir_path):
            logger.info(f"Creating directory: {dir_path}")
            os.makedirs(dir_path, exist_ok=True)

def check_database_connection():
    """Check if MongoDB is available and working."""
    try:
        # Connect to MongoDB
        logger.info(f"Checking MongoDB connection at {MONGODB_URL}")
        client = MongoClient(MONGODB_URL)
        
        # Test connection
        client.admin.command('ping')
        logger.info("MongoDB connection successful")
        
        # Close connection
        client.close()
        return True
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return False

if __name__ == "__main__":
    # Set up static directory structure
    setup_static_directory()
    
    # Check database connection
    if check_database_connection():
        # Start the uvicorn server
        logger.info(f"Starting Menu Management Service on {HOST}:{PORT}")
        uvicorn.run("backend.app:app", host=HOST, port=PORT, reload=True)
    else:
        logger.error("Failed to connect to database. Exiting.")