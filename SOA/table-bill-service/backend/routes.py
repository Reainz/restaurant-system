from pydantic import BaseModel
from typing import Optional, List, Literal
from fastapi import Query, APIRouter, HTTPException, Depends
from datetime import datetime
import logging
from .config import get_bills_collection, get_tables_collection
from .models import TableListResponse, BillResponse, TableResponse, TableCreate, TableUpdate, TableAssignment
from .services.integration import ServiceIntegration
from .services.bills import BillService
from .services.data_consistency import DataConsistencyService
from .services.tables import TableService
from .config import settings

# Create router
router = APIRouter()

# Configure logging
logger = logging.getLogger("table-bill-service")

# Removed commented-out GenerateBillRequest model

class OrderStatusNotification(BaseModel):
    order_id: str
    status: str

@router.post("/api/orders/status", status_code=200)
async def order_status_notification(notification: OrderStatusNotification):
    """
    Endpoint for Order Service to notify about order status changes
    This helps maintain data consistency between services
    """
    logger.info(f"Received order status notification: {notification.dict()}")
    
    try:
        # Check if bill already exists
        collection = await get_bills_collection()
        existing_bill = await collection.find_one({"order_id": notification.order_id})
        
        if not existing_bill and notification.status == "completed":
            # Bill doesn't exist and order is completed, create bill using BillService
            logger.info(f"No bill found for completed order {notification.order_id}. Calling BillService to create one.")
            try:
                # Call the centralized service method
                await BillService.create_bill_from_order(notification.order_id)
                return {"message": f"Bill creation initiated for completed order {notification.order_id}"}
            except HTTPException as he:
                 # Log and return the error from create_bill_from_order
                 logger.error(f"Error creating bill via BillService for order {notification.order_id}: {he.detail}")
                 return {"message": f"Failed to automatically create bill: {he.detail}"}
            except Exception as e:
                 logger.error(f"Unexpected error calling BillService for order {notification.order_id}: {str(e)}")
                 return {"message": "Unexpected error during automatic bill creation."}
        
        elif existing_bill:
            # Bill exists, update it based on status
            if notification.status == "cancelled":
                 if existing_bill.get("status") == "open":
                    await collection.update_one(
                        {"bill_id": existing_bill["bill_id"]},
                        {"$set": {"status": "cancelled", "updated_at": datetime.now()}}
                    )
                    logger.info(f"Marked existing bill {existing_bill['bill_id']} as cancelled for order {notification.order_id}")
                 return {"message": f"Bills updated for cancelled order {notification.order_id}"}
            
            elif notification.status == "completed":
                 # Order completed, ensure bill is final (idempotent)
                 if existing_bill.get("status") == "open":
                    # Try to refresh data first
                    try:
                        await DataConsistencyService.force_refresh_from_services(existing_bill["bill_id"])
                        logger.info(f"Refreshed data for bill {existing_bill['bill_id']} from external services")
                    except Exception as e:
                        logger.warning(f"Failed to refresh data for bill {existing_bill['bill_id']}: {str(e)}")
                    
                    await collection.update_one(
                        {"bill_id": existing_bill["bill_id"]},
                        {"$set": {"status": "final", "updated_at": datetime.now()}}
                    )
                    logger.info(f"Marked existing bill {existing_bill['bill_id']} as final for order {notification.order_id}")
                 return {"message": f"Bills updated for completed order {notification.order_id}"}
                 
            return {"message": f"Order status {notification.status} processed for existing bill."}
        
        else:
             # No bill exists, and order is not completed yet
             return {"message": f"No bill found for order {notification.order_id}, status is {notification.status}."}
        
    except Exception as e:
        logger.error(f"Error processing order status notification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing order status notification: {str(e)}"
        )

# --- Define Allowed Table Statuses ---
TableStatus = Literal["available", "occupied", "reserved"]

@router.get("/api/tables", response_model=TableListResponse, status_code=200, tags=["tables"])
async def get_tables():
    """
    Retrieve a list of all tables.
    """
    try:
        collection = await get_tables_collection()
        # Fetch all tables. Use to_list(None) to get all documents.
        tables_cursor = collection.find({})
        tables_list = await tables_cursor.to_list(length=None) 
        
        # Convert ObjectId to string if necessary (Motor usually handles this for Pydantic)
        for table in tables_list:
             if '_id' in table:
                 table['_id'] = str(table['_id'])
        
        logger.info(f"Retrieved {len(tables_list)} tables.")
        return {"tables": tables_list}
    except Exception as e:
        logger.error(f"Error retrieving tables: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving tables: {str(e)}"
        )

@router.get("/api/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def get_table(table_id: str):
    """Get a specific table."""
    return await TableService.get_table(table_id)

@router.post("/api/tables", response_model=TableResponse, tags=["tables"])
async def create_table(table_data: TableCreate):
    """Create a new table."""
    try:
        return await TableService.create_table(table_data)
    except HTTPException as e:
        # Check if this is a duplicate key error
        if "duplicate key error" in str(e) or "E11000" in str(e):
            logger.warning(f"Duplicate table creation attempt for table number {table_data.table_number}, fetching existing table instead")
            try:
                # Try to fetch the existing table
                tables_collection = await get_tables_collection()
                existing_table = await tables_collection.find_one({"table_number": table_data.table_number})
                
                if existing_table:
                    logger.info(f"Found existing table with number {table_data.table_number}, returning it")
                    # Ensure _id is converted or handled correctly if needed for TableResponse
                    return TableResponse(**{k: v for k, v in existing_table.items() if k != '_id'}) 
            except Exception as fetch_error:
                logger.error(f"Error fetching existing table after duplicate key error: {str(fetch_error)}")
        
        # Re-raise the original exception if we couldn't handle it
        raise

@router.post("/api/tables/assign", tags=["tables"])
async def assign_table(table_data: TableAssignment):
    """Assign a table to an order and update its status."""
    try:
        table = await TableService.assign_table(
            table_id=table_data.table_id,
            order_id=table_data.order_id,
            status=table_data.status
        )
        return table
    except Exception as e:
        logger.error(f"Error assigning table: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error assigning table: {str(e)}")

@router.put("/api/tables/{table_id}", response_model=TableResponse, tags=["tables"])
async def update_table(table_id: str, table_data: TableUpdate):
    """Update a table."""
    return await TableService.update_table(table_id, table_data)

@router.put("/api/tables/{table_id}/status", status_code=200, tags=["tables"])
async def update_table_status_route(
    table_id: str,
    status: TableStatus = Query(..., description="The new status for the table (available, occupied, reserved)")
):
    """
    Update the status of a specific table.
    Receives the new status as a query parameter.
    """
    logger.info(f"Received request to update table {table_id} to status {status}")
    try:
        collection = await get_tables_collection()
        result = await collection.update_one(
            {"table_id": table_id},
            {"$set": {"status": status}}
        )

        if result.matched_count == 0:
            logger.warning(f"Table {table_id} not found for status update.")
            raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
        
        if result.modified_count == 0 and result.matched_count > 0:
             # This might happen if the status is already set to the target value
             logger.info(f"Table {table_id} status already set to {status}. No changes made.")
             # Still return success as the state is correct
        else:
             logger.info(f"Successfully updated table {table_id} status to {status}")

        # Return a simple success message
        return {"message": f"Table {table_id} status updated to {status}"}

    except HTTPException as he:
        raise he # Re-raise known HTTP exceptions
    except Exception as e:
        logger.error(f"Error updating status for table {table_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating table status: {str(e)}")

@router.delete("/api/tables/{table_id}", tags=["tables"])
async def delete_table(table_id: str):
    """Delete a table."""
    return await TableService.delete_table(table_id)

@router.post("/api/bills/{bill_id}/refresh", response_model=dict, tags=["bills"])
async def refresh_bill_data(bill_id: str):
    """
    Force refresh bill data from external services.
    Updates the bill with the latest menu prices and order details.
    """
    return await DataConsistencyService.force_refresh_from_services(bill_id) 