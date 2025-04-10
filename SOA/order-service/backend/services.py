import logging
import httpx
from datetime import datetime
from typing import List, Optional, Dict, Any, Set

from .database import db
from .models import Order, OrderCreate, OrderUpdate, OrderItem, OrderItemUpdate, OrderDocument, OrderStatus
from .config import MENU_SERVICE_URL, TABLE_BILL_SERVICE_URL

logger = logging.getLogger(__name__)

# Define common HTTP client for reuse (consider using lifespan events for proper management)
async_client = httpx.AsyncClient() 

class OrderService:
    """Service class for handling order-related business logic."""
    
    # Define valid status transitions
    VALID_STATUS_TRANSITIONS = {
        OrderStatus.RECEIVED: {OrderStatus.IN_PROGRESS, OrderStatus.RECEIVED, OrderStatus.CANCELLED},
        # Allow 'in-progress' orders to be paused
        OrderStatus.IN_PROGRESS: {OrderStatus.READY, OrderStatus.IN_PROGRESS, OrderStatus.PAUSED, OrderStatus.CANCELLED},
        # Define transitions for 'paused' orders (allow resuming or cancelling)
        OrderStatus.PAUSED: {OrderStatus.IN_PROGRESS, OrderStatus.PAUSED, OrderStatus.CANCELLED},
        OrderStatus.READY: {OrderStatus.DELIVERED, OrderStatus.READY, OrderStatus.CANCELLED},
        OrderStatus.DELIVERED: {OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CANCELLED},
        OrderStatus.COMPLETED: {OrderStatus.COMPLETED},
        OrderStatus.CANCELLED: {OrderStatus.CANCELLED}
    }
    
    @staticmethod
    async def create_order(order_data: OrderCreate) -> Order:
        """Create a new order and notify table service to occupy table."""
        try:
            logger.info(f"Creating order from: {order_data}")
            
            # Make sure the database is connected
            if db.initialized is not True:
                logger.info("Database not initialized, connecting...")
                await db.connect_to_database()
            
            # Get the order collection
            collection = await db.get_collection("orders")
            if collection is None:
                logger.error("Failed to get orders collection")
                raise ValueError("Failed to get orders collection")
            
            # Validate table_id format (simple check) - Optional but recommended
            if not order_data.table_id or not order_data.table_id.startswith('T') or not order_data.table_id[1:].isdigit():
                 logger.warning(f"Invalid table_id format received: {order_data.table_id}. Rejecting order creation.")
                 # Use ValueError or a custom exception/HTTPException if in route context
                 raise ValueError(f"Invalid table_id format: {order_data.table_id}. Expected format like 'T1', 'T12'.")

            # Convert OrderCreate to Order
            order = Order(
                table_id=order_data.table_id,
                items=order_data.items,
                special_instructions=order_data.special_instructions,
                status="received"
            )
            
            # Create order document from Order
            order_doc = OrderDocument.from_order(order)
            
            # Check if order already exists
            existing_order = await collection.find_one({"order_id": order.order_id})
            if existing_order:
                logger.warning(f"Order with ID {order.order_id} already exists")
                raise ValueError(f"Order with ID {order.order_id} already exists")
            
            # Insert order document
            logger.info(f"Inserting order: {order_doc.dict(exclude={'_id'})}")
            result = await collection.insert_one(order_doc.dict(exclude={'_id'}))
            
            if result.inserted_id is None:
                 logger.error("Failed to insert order")
                 raise ValueError("Failed to insert order")

            logger.info(f"Order created with ID: {order.order_id}")

            # --- START: Notify Table Service to Occupy Table ---
            try:
                table_update_url = f"{TABLE_BILL_SERVICE_URL}/api/tables/{order.table_id}/status?status=occupied"
                logger.info(f"Notifying Table Service to occupy table: PUT {table_update_url}")
                response = await async_client.put(table_update_url)
                response.raise_for_status() # Raise exception for 4xx or 5xx errors
                logger.info(f"Table Service notified successfully for table {order.table_id}. Status code: {response.status_code}")
            except httpx.RequestError as e:
                 # Log error but don't fail order creation - maybe table service is down?
                 logger.error(f"Could not connect to Table Service at {TABLE_BILL_SERVICE_URL} to update table status for {order.table_id}: {e}")
            except httpx.HTTPStatusError as e:
                 # Log error if table service responded with an error (e.g., 404 Table Not Found)
                 logger.error(f"Table Service returned error {e.response.status_code} when updating status for table {order.table_id}: {e.response.text}")
            except Exception as e:
                 # Catch any other unexpected errors
                 logger.error(f"Unexpected error notifying Table Service about table {order.table_id}: {str(e)}")
            # --- END: Notify Table Service ---

            return order
            
        except ValueError as ve: # Catch specific validation error
             logger.error(f"Validation error creating order: {str(ve)}")
             raise # Re-raise to be handled by caller/route
        except Exception as e:
            logger.error(f"Error creating order: {str(e)}")
            logger.exception(e)
            raise
    
    @staticmethod
    async def get_order(order_id: str) -> Optional[Order]:
        """Get a specific order by ID."""
        logger.info(f"SERVICE: >>> Entering get_order for ID: {order_id}") # ADDED: Entry log
        try:
            order_collection = await db.get_collection("orders")
            logger.info(f"SERVICE: Attempting find_one for order_id: {order_id}") # Existing log
            
            # ADDED: Log before the database call
            logger.debug(f"SERVICE: About to call find_one on collection: {order_collection.name}")
            order_doc = await order_collection.find_one({"order_id": order_id})
            # ADDED: Log after the database call, showing what was found (or None)
            logger.info(f"SERVICE: find_one returned: {'Document found' if order_doc else 'None'}")
            logger.debug(f"SERVICE: Raw document from DB: {order_doc}") # ADDED: Log raw document

            if order_doc:
                logger.info(f"SERVICE: Order document found for: {order_id}") # Existing log
                try:
                    logger.info(f"SERVICE: Attempting conversion OrderDocument(**order_doc).to_order() for: {order_id}") # MODIFIED: Changed level to INFO
                    order_obj = OrderDocument(**order_doc).to_order()
                    logger.info(f"SERVICE: Conversion successful for order: {order_id}") # MODIFIED: Changed level to INFO
                    logger.info(f"SERVICE: <<< Exiting get_order for ID: {order_id} with Order object") # ADDED: Exit log (success)
                    return order_obj
                except Exception as conversion_error:
                     logger.error(f"SERVICE: CRITICAL: Failed to convert DB document to Order object for ID {order_id}") # Existing log
                     logger.exception(conversion_error) # Existing log
                     logger.info(f"SERVICE: <<< Exiting get_order for ID: {order_id} with None (due to conversion error)") # ADDED: Exit log (conversion failure)
                     return None
            else:
                logger.warning(f"SERVICE: Order document not found in DB for ID: {order_id}") # Existing log
                logger.info(f"SERVICE: <<< Exiting get_order for ID: {order_id} with None (not found)") # ADDED: Exit log (not found)
                return None
        except Exception as e:
            logger.error(f"SERVICE: Database error in get_order for {order_id}: {str(e)}") # Existing log
            logger.exception(e) # Existing log
            logger.info(f"SERVICE: <<< Exiting get_order for ID: {order_id} with None (due to DB exception)") # ADDED: Exit log (DB exception)
            return None
    
    @staticmethod
    async def get_orders(
        filter_query: Optional[Dict[str, Any]] = None, 
        skip: int = 0,
        limit: int = 100,
        sort_field: str = "created_at", # Default sort field
        sort_order: int = -1 # Default sort order (descending = newest first)
    ) -> List[Order]:
        """Get orders with optional filtering and sorting."""
        if filter_query is None:
            filter_query = {}
        
        logger.info(f"Fetching orders with filter: {filter_query}, skip={skip}, limit={limit}, sort={sort_field} {sort_order}")
        
        try:
            # Check if database is initialized
            if db.initialized is not True:
                logger.error("Database not initialized - attempting to reconnect")
                await db.connect_to_database()
                if db.initialized is not True:
                    logger.error("Failed to initialize database")
                    return []
            
            order_collection = await db.get_collection("orders")
            logger.debug(f"Got collection reference: {order_collection}")
            
            # Execute query
            logger.debug(f"Query filter: {filter_query}")
            cursor = order_collection.find(filter_query).sort(sort_field, sort_order).skip(skip).limit(limit)
            orders = []
            
            logger.debug("Iterating through cursor results")
            async for order_data in cursor:
                logger.debug(f"Found order: {order_data.get('order_id')}")
                try:
                    order_doc = OrderDocument(**order_data)
                    orders.append(order_doc.to_order())
                except Exception as doc_error:
                    logger.error(f"Error converting order document: {str(doc_error)}")
                    # Continue processing other documents
                    continue
            
            logger.info(f"Found {len(orders)} orders")
            return orders
        except Exception as e:
            logger.error(f"Error in get_orders: {str(e)}")
            logger.exception(e)
            raise
    
    @staticmethod
    async def update_order(order_id: str, update_data: OrderUpdate) -> Optional[Order]:
        """Update an existing order."""
        logger.info(f"Updating order with ID: {order_id}")
        order_collection = await db.get_collection("orders")
        
        # Check if order exists
        existing_order = await OrderService.get_order(order_id)
        if not existing_order:
            logger.warning(f"Order not found for update: {order_id}")
            return None
        
        # If status update is included, validate the transition
        if update_data.status:
            # Convert string to OrderStatus enum if needed
            if isinstance(update_data.status, str):
                try:
                    new_status = OrderStatus(update_data.status)
                except ValueError:
                    error_msg = f"Invalid status value: {update_data.status}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
            else:
                new_status = update_data.status
                
            # Validate status transition
            current_status = OrderStatus(existing_order.status)
            if not OrderService._is_valid_status_transition(current_status, new_status):
                error_msg = f"Invalid status transition from {current_status} to {new_status}"
                logger.error(error_msg)
                raise ValueError(error_msg)
        
        # Update order
        update_dict = update_data.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.now()
        
        # Update in database
        update_result = await order_collection.update_one(
            {"order_id": order_id},
            {"$set": update_dict}
        )

        if update_result.modified_count == 0 and update_result.matched_count > 0:
             logger.warning(f"Order {order_id} status update resulted in no changes (maybe status was already {new_status.value}?).")
             # Continue to notification step if status was included in update_data
        
        # --- Check and Call Notification Logic ---
        if update_data.status:
             try:
                 status_enum = OrderStatus(update_data.status) # Convert string status to Enum
                 # Call the general notification function
                 await OrderService.notify_table_service_about_order_status(order_id, status_enum)
             except ValueError:
                 logger.error(f"Invalid status '{update_data.status}' provided during update, cannot notify.")
             except Exception as e:
                 logger.error(f"Failed to notify table service after status update for order {order_id}: {e}")
        # --- End Notification Logic ---

        # Get updated order
        updated_order = await OrderService.get_order(order_id)
        logger.info(f"Order updated: {order_id}")
        return updated_order
    
    @staticmethod
    async def update_order_status(order_id: str, status: str) -> Optional[Order]:
        """Update order status with validation and notify table service."""
        logger.info(f"Updating status for order {order_id} to {status}")
        order_collection = await db.get_collection("orders")
        
        # Check if order exists
        existing_order = await OrderService.get_order(order_id)
        if not existing_order:
            logger.warning(f"Order not found for status update: {order_id}")
            return None
        
        # Convert string to OrderStatus enum if needed
        try:
            if isinstance(status, str):
                new_status = OrderStatus(status)
            else:
                new_status = status
        except ValueError:
            error_msg = f"Invalid status value: {status}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Validate status transition
        current_status = OrderStatus(existing_order.status)
        if not OrderService._is_valid_status_transition(current_status, new_status):
            error_msg = f"Invalid status transition from {current_status} to {new_status}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Update in database
            update_result = await order_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": new_status.value, "updated_at": datetime.now()}}
            )
            
            if update_result.modified_count == 0 and update_result.matched_count > 0:
                 logger.warning(f"Order {order_id} status update resulted in no changes (maybe status was already {new_status.value}?).")
                 # Still proceed to notify, as the desired state is confirmed
            
            logger.info(f"Successfully updated order {order_id} status to {new_status.value} in DB.")
            
            # --- Call Notification Logic ---
            try:
                 await OrderService.notify_table_service_about_order_status(order_id, new_status)
            except Exception as e:
                 logger.error(f"Failed to notify table service after status update for order {order_id}: {e}")
            # --- End Notification Logic ---

            # Return updated order
            return await OrderService.get_order(order_id)
            
        except Exception as e:
            logger.error(f"Error updating status in DB for order {order_id}: {e}")
            raise # Re-raise DB errors
    
    @staticmethod
    def _is_valid_status_transition(current_status: OrderStatus, new_status: OrderStatus) -> bool:
        """Check if a status transition is valid."""
        # Log the status transition being checked
        logger.info(f"Checking status transition from {current_status} to {new_status}")
        
        # Special case for cancellation - can cancel from any state except completed
        if new_status == OrderStatus.CANCELLED and current_status != OrderStatus.COMPLETED:
            logger.info(f"Allowing cancellation from {current_status}")
            return True
        
        # Get valid transitions for the current status, default to empty set if not found
        valid_transitions = OrderService.VALID_STATUS_TRANSITIONS.get(current_status, set())
        logger.info(f"Valid transitions from {current_status}: {valid_transitions}")
        
        # Check if the new status is in the set of valid transitions for the current status
        is_valid = new_status in valid_transitions
        logger.info(f"Is {current_status} -> {new_status} valid? {is_valid}")
        return is_valid
    
    @staticmethod
    async def update_order_item(
        order_id: str, 
        item_id: str, 
        update_data: OrderItemUpdate
    ) -> Optional[Order]:
        """Update a specific item in an order."""
        logger.info(f"Updating item {item_id} in order {order_id}")
        order_collection = await db.get_collection("orders")
        
        # Check if order exists
        existing_order = await OrderService.get_order(order_id)
        if not existing_order:
            logger.warning(f"Order not found for item update: {order_id}")
            return None
        
        # Find the item index
        item_index = None
        for i, item in enumerate(existing_order.items):
            if item.item_id == item_id:
                item_index = i
                break
                
        if item_index is None:
            logger.warning(f"Item {item_id} not found in order {order_id}")
            return None
        
        # Update in database
        update_fields = {"updated_at": datetime.now()}
        
        if hasattr(update_data, 'status') and update_data.status is not None:
            update_fields[f"items.{item_index}.status"] = update_data.status
            
        if hasattr(update_data, 'notes') and update_data.notes is not None:
            update_fields[f"items.{item_index}.notes"] = update_data.notes
            
        await order_collection.update_one(
            {"order_id": order_id},
            {"$set": update_fields}
        )
        
        # Get updated order
        updated_order = await OrderService.get_order(order_id)
        logger.info(f"Order item updated: {order_id}/{item_id}")
        return updated_order
    
    @staticmethod
    async def delete_order(order_id: str) -> bool:
        """Delete an order."""
        try:
            # First, get the order to check if it exists
            order = await OrderService.get_order(order_id)
            if not order:
                logger.warning(f"Order not found for deletion: {order_id}")
                return False
            
            logger.info(f"Deleting order: {order_id}")
            
            # Use the database helper to delete the order
            result = await db.get_collection("orders").delete_one({"order_id": order_id})
            
            if result.deleted_count == 0:
                logger.warning(f"No order was deleted with ID: {order_id}")
                return False
            
            logger.info(f"Order deleted successfully: {order_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting order {order_id}: {str(e)}")
            return False
    
    @staticmethod
    async def notify_table_service_about_order_status(order_id: str, status: OrderStatus) -> None:
        """Notify Table & Bill service about an order status update."""
        # Only notify for 'completed' or 'cancelled' statuses
        if status not in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
             logger.debug(f"Skipping notification for order {order_id} with status {status.value} - not completed or cancelled.")
             return

        notification_url = f"{TABLE_BILL_SERVICE_URL}/api/orders/status"
        payload = {"order_id": order_id, "status": status.value}
        
        logger.info(f"Notifying Table Service about order {order_id} status {status.value}: POST {notification_url}")
        
        try:
            response = await async_client.post(notification_url, json=payload)
            response.raise_for_status()
            logger.info(f"Table Service notified successfully for order {order_id}, status {status.value}. Response: {response.text}")
        except httpx.RequestError as e:
            logger.error(f"Could not connect to Table Service at {TABLE_BILL_SERVICE_URL} to notify status for order {order_id}: {e}")
        except httpx.HTTPStatusError as e:
            logger.error(f"Table Service returned error {e.response.status_code} during status notification for order {order_id}: {e.response.text}")
        except Exception as e:
            logger.error(f"Unexpected error notifying Table Service about order {order_id} status: {str(e)}")

    @staticmethod
    async def cancel_order(order_id: str) -> Optional[Order]:
         """Cancel an order if possible and notify table service."""
         logger.info(f"Cancelling order with ID: {order_id}")
         
         # Check if order exists
         existing_order = await OrderService.get_order(order_id)
         if not existing_order:
             logger.warning(f"Order not found for cancellation: {order_id}")
             return None
         
         # If already cancelled, just return the order
         if existing_order.status == OrderStatus.CANCELLED.value:
             logger.info(f"Order {order_id} is already cancelled")
             return existing_order
         
         # If completed, we can't cancel
         if existing_order.status == OrderStatus.COMPLETED.value:
             error_msg = f"Cannot cancel completed order {order_id}"
             logger.error(error_msg)
             raise ValueError(error_msg)
         
         try:
             # Update status to cancelled
             updated_order = await OrderService.update_order_status(order_id, OrderStatus.CANCELLED.value)
             
             if updated_order: # If status was successfully set to CANCELLED
                 logger.info(f"Order {order_id} cancelled successfully.")
                 # --- Call Notification Logic ---
                 try:
                     await OrderService.notify_table_service_about_order_status(order_id, OrderStatus.CANCELLED)
                 except Exception as e:
                     logger.error(f"Failed to notify table service after cancelling order {order_id}: {e}")
                 # --- End Notification Logic ---
             else:
                 logger.warning(f"Failed to cancel order {order_id} (already processed or not found?).")

             return updated_order
         except Exception as e:
             logger.error(f"Error cancelling order: {str(e)}")
             raise