"""
Table Management Service
"""
import logging
from datetime import datetime
from typing import List
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError, PyMongoError

from ..models import Table, TableCreate, TableUpdate, TableResponse
from ..config import get_tables_collection

logger = logging.getLogger(__name__)

class TableService:
    @staticmethod
    async def get_tables() -> List[TableResponse]:
        """Get all tables."""
        try:
            collection = await get_tables_collection()
            tables = await collection.find({}).to_list(1000)
            return [TableResponse(**{k: v for k, v in table.items() if k != '_id'}) for table in tables]
        except PyMongoError as e:
            logger.error(f"Database error while fetching tables: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while fetching tables")

    @staticmethod
    async def create_table(table_data: TableCreate) -> TableResponse:
        """Create a new table."""
        try:
            collection = await get_tables_collection()
            new_table = Table(**table_data.dict())
            await collection.insert_one(new_table.dict())
            return new_table
        except DuplicateKeyError:
            raise HTTPException(
                status_code=400,
                detail=f"Table number {table_data.table_number} already exists"
            )
        except PyMongoError as e:
            logger.error(f"Database error while creating table: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while creating table")

    @staticmethod
    async def get_table(table_id: str) -> TableResponse:
        """Get a specific table."""
        try:
            collection = await get_tables_collection()
            table = await collection.find_one({"table_id": table_id})
            if not table:
                raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
            return TableResponse(**{k: v for k, v in table.items() if k != '_id'})
        except PyMongoError as e:
            logger.error(f"Database error while fetching table {table_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while fetching table")

    @staticmethod
    async def update_table(table_id: str, table_data: TableUpdate) -> TableResponse:
        """Update a table."""
        try:
            collection = await get_tables_collection()
            
            # Check if table exists
            if not await collection.find_one({"table_id": table_id}):
                raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
            
            # Prepare update data
            update_data = {k: v for k, v in table_data.dict().items() if v is not None}
            if update_data:
                update_data["updated_at"] = datetime.now()
                await collection.update_one(
                    {"table_id": table_id},
                    {"$set": update_data}
                )
            
            # Return updated table
            updated_table = await collection.find_one({"table_id": table_id})
            return TableResponse(**{k: v for k, v in updated_table.items() if k != '_id'})
        except PyMongoError as e:
            logger.error(f"Database error while updating table {table_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while updating table")

    @staticmethod
    async def update_table_status(table_id: str, status: str) -> TableResponse:
        """Update table status."""
        if status not in ["available", "occupied"]:
            raise HTTPException(
                status_code=400,
                detail="Status must be 'available' or 'occupied'"
            )
        
        collection = await get_tables_collection()
        
        # Check if table exists
        if not await collection.find_one({"table_id": table_id}):
            raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
        
        # Update status
        await collection.update_one(
            {"table_id": table_id},
            {"$set": {"status": status, "updated_at": datetime.now()}}
        )
        
        # Return updated table
        updated_table = await collection.find_one({"table_id": table_id})
        return TableResponse(**{k: v for k, v in updated_table.items() if k != '_id'})

    @staticmethod
    async def delete_table(table_id: str) -> dict:
        """Delete a table."""
        collection = await get_tables_collection()
        
        # Check if table exists
        if not await collection.find_one({"table_id": table_id}):
            raise HTTPException(status_code=404, detail=f"Table {table_id} not found")
        
        await collection.delete_one({"table_id": table_id})
        return {"message": f"Table {table_id} deleted successfully"}

    @staticmethod
    async def assign_table(table_id: str, order_id: str, status: str = "occupied") -> TableResponse:
        """Assign a table to an order and update its status."""
        try:
            # Get the table collection
            collection = await get_tables_collection()
            
            # Check if table exists by direct ID
            table = await collection.find_one({"table_id": table_id})
            
            # If not found, try table{id} format
            if not table and table_id.isdigit():
                table = await collection.find_one({"table_id": f"table{table_id}"})
                if table:
                    # Use the found table's ID format
                    table_id = f"table{table_id}"
            
            # If still not found, try looking up by table_number
            if not table and table_id.isdigit():
                table = await collection.find_one({"table_number": int(table_id)})
                if table:
                    # Use the found table's ID
                    table_id = table["table_id"]
            
            # If table not found at all, create it with proper format
            if not table:
                logger.warning(f"Table not found for assignment: {table_id}")
                
                # Create the table if it doesn't exist
                table_number = int(table_id) if table_id.isdigit() else None
                if table_number:
                    # Use the consistent format "tableX" for table_id
                    formatted_table_id = f"table{table_number}"
                    
                    # Check if table exists with the formatted ID
                    existing_table = await collection.find_one({"table_id": formatted_table_id})
                    if existing_table:
                        # Use the existing table
                        table_id = formatted_table_id
                    else:
                        # Create a new table with the proper format
                        new_table = Table(
                            table_id=formatted_table_id,
                            table_number=table_number,
                            status=status
                        )
                        
                        try:
                            # Insert the new table
                            await collection.insert_one(new_table.dict())
                            logger.info(f"Created new table: {formatted_table_id}")
                            table_id = formatted_table_id
                        except DuplicateKeyError as e:
                            # If we get a duplicate key error despite our checks, log and fail gracefully
                            logger.error(f"Duplicate key error creating table: {e}")
                            raise HTTPException(status_code=400, detail=f"Table {table_number} already exists")
                else:
                    raise HTTPException(status_code=404, detail=f"Table {table_id} not found and couldn't be created")
            
            # Update the table with new status and associated order
            update_data = {
                "status": status,
                "updated_at": datetime.now()
            }
            
            # Store the order_id reference in the table document
            if order_id:
                update_data["order_id"] = order_id
            
            # Update the table
            await collection.update_one(
                {"table_id": table_id},
                {"$set": update_data}
            )
            
            # Get the updated table
            updated_table = await collection.find_one({"table_id": table_id})
            if not updated_table:
                raise HTTPException(status_code=404, detail=f"Table {table_id} not found after update")
            
            return TableResponse(**{k: v for k, v in updated_table.items() if k != '_id'})
            
        except HTTPException:
            raise
        except PyMongoError as e:
            logger.error(f"Database error while assigning table {table_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while assigning table")
        except Exception as e:
            logger.error(f"Unexpected error while assigning table {table_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}") 