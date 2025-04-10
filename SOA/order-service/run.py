import uvicorn
import os
import sys
import logging
from dotenv import load_dotenv
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("order_service.log", mode="w")  # Overwrite the log file each time
    ]
)
logger = logging.getLogger("order-service")

# Get the base directory of the project
BASE_DIR = Path(__file__).resolve().parent

# Add the project directory to Python path
sys.path.append(str(BASE_DIR))

# Import the FastAPI app
from backend.app import app

# Load environment variables from .env file
env_file = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_file):
    logger.info(f"Loading environment variables from {env_file}")
    load_dotenv(env_file)
else:
    logger.warning(f"Environment file {env_file} not found, using defaults")

# API settings
API_HOST = os.getenv("API_HOST", "localhost")
API_PORT = int(os.getenv("API_PORT", "8002"))

# Check MongoDB connection string
mongodb_url = os.getenv("MONGODB_URL")
if not mongodb_url:
    logger.warning("MONGODB_URL not set in environment variables. Using default: mongodb://localhost:27017")

if __name__ == "__main__":
    try:
        logger.info(f"Starting Order Management Service on {API_HOST}:{API_PORT}")
        
        uvicorn.run(
            "backend.app:app",
            host=API_HOST,
            port=API_PORT,
            reload=True,
            log_level="info",
        )
    except Exception as e:
        logger.error(f"Failed to start Order Management Service: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)