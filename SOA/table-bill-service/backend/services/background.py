"""
Background tasks and periodic synchronization for Table & Bill Service
"""
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Global variable to track the background task
background_sync_task: Optional[asyncio.Task] = None

async def periodic_data_sync():
    """Background task to periodically sync data from external services."""
    while True:
        try:
            logger.info("Starting periodic data synchronization")
            
            # Import here to avoid circular import
            from .data_consistency import DataConsistencyService
            
            # Get all bills
            from ..config import get_bills_collection
            collection = await get_bills_collection()
            bills = await collection.find({}).to_list(1000)
            
            # Process active bills first
            active_bills = [b for b in bills if b.get("status") in ["open", "final"]]
            
            for bill in active_bills:
                try:
                    await DataConsistencyService.force_refresh_from_services(bill["bill_id"])
                    # Small delay to avoid overwhelming services
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.error(f"Error syncing bill {bill['bill_id']}: {str(e)}")
            
            logger.info(f"Completed sync for {len(active_bills)} active bills")
            
            # Sleep for 60 seconds before next sync
            await asyncio.sleep(60)
        except Exception as e:
            logger.error(f"Error in periodic data sync: {str(e)}")
            # If there's an error, wait a bit and try again
            await asyncio.sleep(30)

def start_background_sync():
    """Start the background synchronization task."""
    global background_sync_task
    if background_sync_task is None:
        logger.info("Starting background synchronization task")
        background_sync_task = asyncio.create_task(periodic_data_sync()) 