import os
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class Settings:
    # Service configuration
    SERVICE_NAME: str = "table-bill-service"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # MongoDB configuration
    MONGODB_URL: str = os.getenv("MONGODB_URL", os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "table_bill_db")
    
    # External service URLs
    ORDER_SERVICE_URL: str = os.getenv("ORDER_SERVICE_URL", "http://localhost:8002")
    MENU_SERVICE_URL: str = os.getenv("MENU_SERVICE_URL", "http://localhost:8000")

    # Collections
    TABLES_COLLECTION: str = "tables"
    BILLS_COLLECTION: str = "bills"
    CACHED_ORDERS_COLLECTION: str = "cached_orders"
    CACHED_MENU_ITEMS_COLLECTION: str = "cached_menu_items"
    
    # Data synchronization settings
    SYNC_INTERVAL: int = int(os.getenv("SYNC_INTERVAL", "60"))  # Seconds
    AUTO_REFRESH_DEFAULT: bool = os.getenv("AUTO_REFRESH_DEFAULT", "True").lower() == "true"
    MAX_CACHE_AGE: int = int(os.getenv("MAX_CACHE_AGE", "3600"))  # 1 hour cache validity

    # Webhook settings (Added)
    WEBHOOK_NOTIFICATIONS_ENABLED: bool = os.getenv("WEBHOOK_NOTIFICATIONS_ENABLED", "False").lower() == "true"
    WEBHOOK_URL: Optional[str] = os.getenv("WEBHOOK_URL", None)

settings = Settings()

# MongoDB client instance
client: Optional[AsyncIOMotorClient] = None

async def get_database():
    """Get database instance."""
    return client[settings.MONGO_DB_NAME]

async def get_tables_collection():
    """Get tables collection."""
    db = await get_database()
    return db[settings.TABLES_COLLECTION]

async def get_bills_collection():
    """Get bills collection."""
    db = await get_database()
    return db[settings.BILLS_COLLECTION]

async def create_indexes():
    """Create database indexes for optimal performance."""
    try:
        # Get collections
        tables_collection = await get_tables_collection()
        bills_collection = await get_bills_collection()
        
        # Get cache collections
        db = await get_database()
        cached_orders_collection = db[settings.CACHED_ORDERS_COLLECTION]
        cached_menu_items_collection = db[settings.CACHED_MENU_ITEMS_COLLECTION]

        # Create indexes for tables collection
        await tables_collection.create_index("table_number", unique=True)
        await tables_collection.create_index("status")
        await tables_collection.create_index("table_id", unique=True)

        # Create indexes for bills collection
        await bills_collection.create_index("bill_id", unique=True)
        await bills_collection.create_index("table_id")
        await bills_collection.create_index("order_id")
        await bills_collection.create_index("created_at")
        await bills_collection.create_index("status")
        await bills_collection.create_index("payment_status")
        await bills_collection.create_index([
            ("table_id", 1),
            ("created_at", -1)
        ])
        
        # Create indexes for cached data collections
        await cached_orders_collection.create_index("order_id", unique=True)
        await cached_orders_collection.create_index("cached_at")
        
        await cached_menu_items_collection.create_index("item_id", unique=True)
        await cached_menu_items_collection.create_index("cached_at")

        logger.info("Successfully created database indexes")
    except Exception as e:
        logger.error(f"Error creating database indexes: {str(e)}")
        raise

async def connect_to_mongodb():
    """Create database connection and initialize indexes."""
    global client
    try:
        client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            connectTimeoutMS=10000,  # 10 second timeout
            maxPoolSize=10,  # Maximum connection pool size
            retryWrites=True  # Enable retryable writes
        )
        
        # Test connection
        await client.admin.command('ping')
        logger.info(f"Connected to MongoDB at {settings.MONGODB_URL}")
        
        # Create indexes
        await create_indexes()
        
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {str(e)}")
        raise

async def close_mongodb_connection():
    """Close database connection."""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection") 