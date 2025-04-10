import os
import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from .config import MONGO_URL, MONGO_DB
import time

logger = logging.getLogger("order-service")

logger.debug(f"MongoDB URL: {MONGO_URL}, Database: {MONGO_DB}")

class Database:
    """Database connection manager for the Order service."""
    
    def __init__(self):
        """Initialize the database connection manager."""
        self.client = None
        self.db = None
        self.initialized = False
        self.connect_attempts = 0
    
    async def connect_to_database(self) -> None:
        """Connect to the MongoDB database."""
        try:
            logger.info(f"Connecting to MongoDB at {MONGO_URL}")
            self.connect_attempts += 1
            
            # Create a Motor client
            self.client = AsyncIOMotorClient(MONGO_URL)
            # Get the database
            self.db = self.client[MONGO_DB]
            # Test connection
            await self.client.admin.command('ping')
            
            logger.info(f"Connected to MongoDB database: {MONGO_DB}")
            self.initialized = True
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            # Reset connection if failed
            self.client = None
            self.db = None
            self.initialized = False
            
            # Implementation of retry logic with increasing backoff
            if self.connect_attempts < 5:
                backoff = min(2 ** self.connect_attempts, 60)  # Max 60s backoff
                logger.info(f"Retrying connection in {backoff} seconds (attempt {self.connect_attempts})")
                await asyncio.sleep(backoff)
                await self.connect_to_database()
    
    async def get_collection(self, collection_name):
        """Get a collection from the database with connection retry."""
        if self.initialized is not True:
            # Instead of raising an error, try to connect first
            try:
                logger.info(f"Database not initialized, connecting to get collection: {collection_name}")
                await self.connect_to_database()
            except Exception as e:
                logger.error(f"Trying to access database before initialization: {str(e)}")
                logger.error("Failed to initialize database connection")
                raise RuntimeError(f"Database connection failed: {str(e)}")
        
        # Even if we're initialized, the connection might have been lost
        # Check connection health and reconnect if necessary
        try:
            # Quick ping to verify connection
            await self.client.admin.command('ping')
        except Exception as e:
            logger.warning(f"Database connection appears to be lost: {str(e)}")
            logger.info("Attempting to reconnect to database...")
            await self.connect_to_database()
        
        if self.db is None:
            logger.error("Database object is None")
            raise RuntimeError("Database object is None")
        
        return self.db[collection_name]

    async def create_indices(self):
        """Create database indices for better performance."""
        try:
            # Create indices for better query performance
            await self.db.orders.create_index("order_id", unique=True)
            await self.db.orders.create_index("table_id")
            await self.db.orders.create_index("status")
            await self.db.orders.create_index("created_at")  # For date-based queries
            
            logger.info("Created database indices")
        except Exception as e:
            logger.error(f"Failed to create indices: {str(e)}")

    async def close_database_connection(self):
        """Close MongoDB connection."""
        logger.info("Closing connection to MongoDB")
        if self.client:
            self.client.close()
            self.initialized = False
            logger.info("MongoDB connection closed")


# Create a singleton instance of the database
db = Database()