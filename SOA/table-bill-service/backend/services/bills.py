"""
Bill Management Service module
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError, PyMongoError
import uuid
import io
import csv

from ..models import Bill, BillUpdate, BillResponse, BillItem
from ..config import get_bills_collection
from .integration import ServiceIntegration
from .webhook import WebhookNotificationService
from .tables import TableService

logger = logging.getLogger(__name__)

# Define what bill statuses are considered "active" for table status check
ACTIVE_BILL_STATUSES = ["open", "final"]

class BillService:
    """Service for managing bills"""
    
    @staticmethod
    async def get_bills(
        table_id: Optional[str] = None,
        status: Optional[str] = None,
        payment_status: Optional[str] = None,
        date: Optional[str] = None # Add date parameter
    ) -> List[BillResponse]:
        """
        Get bills with optional filtering.
        
        Args:
            table_id: Filter bills by table ID
            status: Filter bills by status
            payment_status: Filter bills by payment status
            date: Filter bills by date
            
        Returns:
            List[BillResponse]: List of bills matching criteria
        """
        query = {}
        if table_id:
            query["table_id"] = table_id
        if status:
            query["status"] = status
        if payment_status:
            query["payment_status"] = payment_status
        if date:
            # Assuming date is YYYY-MM-DD string
            # Create date range for the entire day
            try:
                start_date = datetime.strptime(date, "%Y-%m-%d")
                end_date = start_date + timedelta(days=1)
                query["created_at"] = {"$gte": start_date, "$lt": end_date}
                logger.info(f"Filtering bills for date: {date}")
            except ValueError:
                logger.warning(f"Invalid date format received: {date}. Ignoring date filter.")

        try:
            collection = await get_bills_collection()
            bills_cursor = collection.find(query).sort("created_at", -1) # Sort newest first
            bills_list = await bills_cursor.to_list(length=1000) # Adjust length as needed
            
            # Convert MongoDB docs to BillResponse models
            response_list = [
                BillResponse(**{k: v for k, v in bill.items() if k != '_id'})
                for bill in bills_list
            ]
            logger.info(f"Retrieved {len(response_list)} bills matching query: {query}")
            return response_list
        except Exception as e:
            logger.error(f"Error fetching bills from database: {str(e)}")
            return [] # Return empty list on error
    
    # @staticmethod
    # async def create_bill(bill_data: BillCreate) -> BillResponse:
    #     """
    #     Create a new bill.
        
    #     Args:
    #         bill_data: The bill data to create
            
    #     Returns:
    #         BillResponse: The created bill
    #     """
    #     logger.info(f"Creating bill for order_id: {bill_data.order_id}, table_id: {bill_data.table_id}")
        
    #     try:
    #         # Validate and enhance bill data using external services
    #         updated_items, calculated_total = await ServiceIntegration.validate_bill_data(bill_data)
            
    #         collection = await get_bills_collection()
            
    #         # Generate a unique bill ID
    #         bill_id = str(uuid.uuid4())
            
    #         # Create the bill object
    #         current_time = datetime.now()
    #         new_bill = {
    #             "bill_id": bill_id,
    #             "order_id": bill_data.order_id,
    #             "table_id": bill_data.table_id,
    #             "status": "open",
    #             "payment_status": "pending",
    #             "total_amount": calculated_total,
    #             "items": updated_items,
    #             "created_at": current_time,
    #             "updated_at": current_time
    #         }
            
    #         # Insert the bill into the database
    #         await collection.insert_one(new_bill)
            
    #         # Get the inserted bill
    #         created_bill = await collection.find_one({"bill_id": bill_id})
            
    #         if not created_bill:
    #             raise HTTPException(status_code=500, detail="Bill created but not found in database")
            
    #         # Try to update the table status if we have a table_id
    #         if bill_data.table_id:
    #             try:
    #                 await TableService.update_table_status(bill_data.table_id, "occupied")
    #                 logger.info(f"Updated table {bill_data.table_id} status to occupied")
    #             except Exception as e:
    #                 logger.warning(f"Failed to update table status: {str(e)}")
            
    #         # Send webhook notification for bill creation
    #         await WebhookNotificationService.send_notification(
    #             service="bill",
    #             event_type="created",
    #             data={"bill_id": bill_id, "table_id": bill_data.table_id, "order_id": bill_data.order_id}
    #         )
            
    #         # Add verification info
    #         try:
    #             from .data_consistency import DataConsistencyService
    #             verification_result = await DataConsistencyService.verify_bill_consistency(bill_id)
    #             if not verification_result.get("verified", False):
    #                 issues = verification_result.get("issues", [])
    #                 if issues:
    #                     logger.warning(f"Consistency issues with new bill {bill_id}: {', '.join(issues)}")
    #         except Exception as e:
    #             logger.error(f"Error verifying new bill consistency: {str(e)}")
            
    #         return BillResponse(**{k: v for k, v in created_bill.items() if k != '_id'})
    #     except HTTPException as e:
    #         # Re-raise HTTP exceptions
    #         raise
    #     except DuplicateKeyError:
    #         logger.error(f"Duplicate key error while creating bill for order: {bill_data.order_id}")
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"Bill for order {bill_data.order_id} already exists"
    #         )
    #     except PyMongoError as e:
    #         logger.error(f"Database error while creating bill: {str(e)}")
    #         raise HTTPException(status_code=500, detail="Database error while creating bill")
    #     except Exception as e:
    #         logger.error(f"Unexpected error creating bill: {str(e)}")
    #         raise HTTPException(status_code=500, detail=f"Error creating bill: {str(e)}")
    
    @staticmethod
    async def create_bill_from_order(order_id: str) -> BillResponse:
        """
        Creates a bill based on a completed order fetched from the Order Service.
        Args:
            order_id: The ID of the completed order.
        Returns:
            BillResponse: The created bill.
        Raises:
            HTTPException: If order not found, not completed, or other errors occur.
        """
        logger.info(f"Attempting to create bill from order_id: {order_id}")
        collection = await get_bills_collection()

        # 1. Check if bill already exists for this order
        existing_bill = await collection.find_one({"order_id": order_id})
        if existing_bill:
            logger.warning(f"Bill already exists for order {order_id}. Returning existing bill.")
            # Optionally, you could return a different status code or message
            # For now, return the existing bill data
            return BillResponse(**{k: v for k, v in existing_bill.items() if k != '_id'})

        # 2. Fetch order details from Order Service
        order_data = None # Initialize order_data
        try:
            logger.debug(f"Fetching order details for {order_id} from ServiceIntegration...")
            order_data = await ServiceIntegration.fetch_order_details(order_id)
            # Check immediately if data was fetched
            if not order_data:
                logger.error(f"ServiceIntegration.fetch_order_details returned None for order {order_id}.")
                # Return a more specific error than just 404 for the entire route
                raise HTTPException(status_code=404, detail=f"Order details for {order_id} could not be found in Order Service.")
            logger.debug(f"Successfully fetched order details for {order_id}.")

        except HTTPException as he:
            # Log the specific error from fetch_order_details before re-raising
            logger.error(f"HTTPException while fetching order details for {order_id}: Status={he.status_code}, Detail={he.detail}")
            # Re-raise with potentially more context if needed, or just re-raise
            raise he 
        except Exception as e:
            logger.error(f"Unexpected error fetching order details for {order_id} from Order Service: {str(e)}", exc_info=True)
            raise HTTPException(status_code=503, detail=f"Could not communicate with Order Service to fetch details for order {order_id}.")

        # 3. Validate order data and status (order_data should be populated here)
        if not order_data: # Should not happen if checks above are correct, but as a safeguard
             logger.error(f"Order data is unexpectedly None after fetch attempt for {order_id}")
             raise HTTPException(status_code=500, detail="Internal error retrieving order data.")
             
        if order_data.get("status") != "completed":
            logger.warning(f"Attempted to create bill for non-completed order {order_id} (status: {order_data.get('status')})")
            raise HTTPException(status_code=400, detail=f"Cannot create bill for order {order_id} because its status is {order_data.get('status')}, not 'completed'.")
            
        if not order_data.get("items") or not order_data.get("table_id"):
             logger.error(f"Incomplete order data received for {order_id}: missing items or table_id.")
             raise HTTPException(status_code=400, detail=f"Incomplete order data received for order {order_id}.")

        # 4. Calculate total and prepare bill items (fetch prices from Menu Service)
        bill_items = []
        total_amount = 0
        try:
            for item in order_data["items"]:
                # Fetch current price from Menu Service
                menu_item, is_fallback = await ServiceIntegration.fetch_menu_item_details(item["item_id"])
                # Use fetched price if available, otherwise fallback to price in order data
                price = menu_item.get("price", item.get("price", 0)) if not is_fallback else item.get("price", 0)
                price = float(price) # Ensure price is float
                quantity = int(item["quantity"]) # Ensure quantity is int
                
                bill_items.append({
                    "item_id": item["item_id"],
                    "name": item["name"],
                    "price": price,
                    "quantity": quantity
                })
                total_amount += price * quantity
        except Exception as e:
            logger.error(f"Error processing items/prices for order {order_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error calculating bill total.")

        # --- REMOVE Tax Calculation --- 
        # tax_rate = 0.07
        # final_total_amount = total_amount * (1 + tax_rate)
        # --- End Removal ---
        # The total_amount calculated from items IS the final total now
        final_total_amount = total_amount

        # 5. Create and insert the new bill
        bill_id = f"bill-{order_id}" # Use a predictable ID format
        current_time = datetime.now()
        table_id_from_order = order_data["table_id"]
        new_bill = {
            "bill_id": bill_id,
            "table_id": table_id_from_order,
            "order_id": order_id,
            "status": "final",  # Bill starts as final when created from completed order
            "payment_status": "pending",
            "items": bill_items,
            "total_amount": final_total_amount, # <-- Store the CORRECT total
            "created_at": current_time,
            "updated_at": current_time
        }

        try:
            # --- START: Update Table Status Before Inserting Bill ---
            # Ensures table is marked occupied when the bill is generated
            try:
                logger.info(f"Attempting to mark table {table_id_from_order} as occupied due to bill creation for order {order_id}")
                await TableService.update_table_status(table_id_from_order, "occupied")
                logger.info(f"Successfully marked table {table_id_from_order} as occupied.")
            except HTTPException as table_http_err:
                # Log warning but continue bill creation - maybe table doesn't exist?
                logger.warning(f"HTTPException when trying to mark table {table_id_from_order} occupied: {table_http_err.detail}")
            except Exception as table_err:
                logger.error(f"Unexpected error marking table {table_id_from_order} occupied: {str(table_err)}")
                # Decide if this should prevent bill creation? For now, log and continue.
            # --- END: Update Table Status --- 
                
            await collection.insert_one(new_bill)
            logger.info(f"Successfully inserted new bill {bill_id} for order {order_id}")
            
            # Get the created bill to return
            created_bill_doc = await collection.find_one({"bill_id": bill_id})
            if not created_bill_doc:
                 logger.error(f"Failed to retrieve newly created bill {bill_id}")
                 raise HTTPException(status_code=500, detail="Failed to retrieve created bill.")
                 
            # Send webhook notification for bill creation
            await WebhookNotificationService.send_notification(
                service="bill",
                event_type="created",
                data={"bill_id": bill_id, "table_id": table_id_from_order, "order_id": order_id}
            )
            
            return BillResponse(**{k: v for k, v in created_bill_doc.items() if k != '_id'})

        except DuplicateKeyError:
            # This might happen in a race condition if notification handler runs simultaneously
            logger.warning(f"Duplicate key error for bill {bill_id}. Bill likely created by another process.")
            # Fetch and return the existing bill
            existing_bill = await collection.find_one({"bill_id": bill_id})
            if existing_bill:
                 return BillResponse(**{k: v for k, v in existing_bill.items() if k != '_id'})
            else:
                 # This state should be rare
                 raise HTTPException(status_code=500, detail="Duplicate key error, but could not find existing bill.")
        except PyMongoError as e:
            logger.error(f"Database error inserting bill {bill_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while creating bill.")
        except Exception as e:
             logger.error(f"Unexpected error during final bill creation steps for {bill_id}: {str(e)}")
             raise HTTPException(status_code=500, detail="Unexpected error saving the bill.")
    
    @staticmethod
    async def get_bill(bill_id: str) -> BillResponse:
        """Get a specific bill by ID."""
        logger.info(f"Attempting to get bill with ID: {bill_id}")
        try:
            collection = await get_bills_collection()
            logger.debug(f"Searching for bill_id: {bill_id}")
            bill = await collection.find_one({"bill_id": bill_id})
            
            if not bill:
                logger.warning(f"Bill {bill_id} not found in database.")
                raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")
                
            logger.info(f"Bill document found for {bill_id}. Attempting conversion.")
            # Explicitly handle conversion errors
            try:
                response_data = BillResponse(**{k: v for k, v in bill.items() if k != '_id'})
                logger.info(f"Successfully converted bill {bill_id} to BillResponse.")
                return response_data
            except Exception as conversion_error: # Catch pydantic.ValidationError and others
                logger.error(f"Failed to convert bill document {bill_id} to BillResponse model.")
                logger.exception(conversion_error) # Log the full traceback
                raise HTTPException(status_code=500, detail=f"Error processing bill data for {bill_id}")

        except PyMongoError as e:
            logger.error(f"Database error while fetching bill {bill_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while fetching bill")
        except HTTPException: # Re-raise known HTTPExceptions (like the 404)
            raise
        except Exception as e:
            # Catch any other unexpected errors during the process
            logger.error(f"Unexpected error in get_bill for {bill_id}: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Internal server error processing bill {bill_id}")
    
    @staticmethod
    async def update_bill(bill_id: str, bill_data: BillUpdate) -> BillResponse:
        """Update a bill."""
        try:
            collection = await get_bills_collection()
            
            # Check if bill exists
            if not await collection.find_one({"bill_id": bill_id}):
                raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")
            
            # Prepare update data
            update_data = {k: v for k, v in bill_data.dict().items() if v is not None}
            if update_data:
                update_data["updated_at"] = datetime.now()
                await collection.update_one(
                    {"bill_id": bill_id},
                    {"$set": update_data}
                )
            
            # Return updated bill
            updated_bill = await collection.find_one({"bill_id": bill_id})
            
            # Send webhook for bill update
            await WebhookNotificationService.send_notification(
                service="bill",
                event_type="updated",
                data={"bill_id": bill_id}
            )
            
            return BillResponse(**{k: v for k, v in updated_bill.items() if k != '_id'})
        except PyMongoError as e:
            logger.error(f"Database error while updating bill {bill_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error while updating bill")
    
    # @staticmethod
    # async def update_bill_status(bill_id: str, status: str) -> BillResponse:
    #     """
    #     Update the status of a specific bill.
    #     If status is set to 'closed' or 'paid', check if the table should become available.
    #     """
    #     logger.info(f"Updating status for bill {bill_id} to {status}")
    #     collection = await get_bills_collection()
        
    #     # Fetch the bill first to get table_id and check current status
    #     bill = await collection.find_one({"bill_id": bill_id})
    #     if not bill:
    #         logger.error(f"Bill {bill_id} not found for status update.")
    #         raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")
            
    #     # Prevent invalid transitions (optional, but good practice)
    #     # e.g., cannot reopen a closed/paid bill directly via this method?
    #     # current_status = bill.get("status")
    #     # if current_status in ['closed', 'paid'] and status not in ['closed', 'paid']:
    #     #     raise HTTPException(status_code=400, detail=f"Cannot change status from {current_status} to {status}")
            
    #     update_data = {
    #         "$set": {
    #             "status": status,
    #             "updated_at": datetime.now()
    #         }
    #     }
        
    #     # If setting to closed/paid, also update payment status if appropriate
    #     if status in ['closed', 'paid'] and bill.get("payment_status") != 'paid':
    #          logger.info(f"Setting payment_status to 'paid' as bill status is {status}")
    #          update_data["$set"]["payment_status"] = 'paid' 
        
    #     result = await collection.update_one({"bill_id": bill_id}, update_data)
        
    #     if result.matched_count == 0:
    #         # Should not happen due to check above, but safeguard
    #         logger.error(f"Bill {bill_id} not found during update operation.")
    #         raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found during update")
            
    #     updated_bill_doc = await collection.find_one({"bill_id": bill_id})
    #     if not updated_bill_doc:
    #          raise HTTPException(status_code=500, detail="Failed to retrieve updated bill details")
        
    #     # --- START: Logic to update table status --- 
    #     if status in ["closed", "paid"]:
    #         table_id = bill.get("table_id")
    #         if table_id:
    #             logger.info(f"Bill {bill_id} marked as {status}. Checking if table {table_id} should become available.")
    #             try:
    #                 # Count other ACTIVE bills for the same table
    #                 active_bill_count = await collection.count_documents({
    #                     "table_id": table_id, 
    #                     "bill_id": {"$ne": bill_id}, # Exclude the current bill
    #                     "status": {"$in": ACTIVE_BILL_STATUSES} # Check against defined active statuses
    #                 })
                    
    #                 logger.info(f"Found {active_bill_count} other active bill(s) for table {table_id}.")
                    
    #                 if active_bill_count == 0:
    #                     logger.info(f"No other active bills found. Setting table {table_id} to available.")
    #                     # Use TableService to update the table status
    #                     await TableService.update_table_status(table_id, 'available')
    #                 else:
    #                      logger.info(f"Table {table_id} still has other active bills. Status not changed.")
                         
    #             except HTTPException as he:
    #                 # Log error if table update fails but don't fail the bill update
    #                 logger.error(f"HTTP Error trying to update table {table_id} status after closing bill {bill_id}: {he.detail}")
    #             except Exception as e:
    #                 logger.error(f"Error checking/updating table status for table {table_id} after closing bill {bill_id}: {str(e)}")
    #         else:
    #              logger.warning(f"Bill {bill_id} has no table_id associated. Cannot check table status.")
    #     # --- END: Logic to update table status --- 
        
    #     return BillResponse(**{k: v for k, v in updated_bill_doc.items() if k != '_id'})
    
    @staticmethod
    async def update_payment_status(bill_id: str, payment_status: str) -> BillResponse:
        """
        Update the payment status of a specific bill.
        If payment_status is set to 'paid', check if the table should become available.
        """
        logger.info(f"Updating payment status for bill {bill_id} to {payment_status}")
        collection = await get_bills_collection()
        
        # Fetch the bill first to get table_id
        bill = await collection.find_one({"bill_id": bill_id})
        if not bill:
            logger.error(f"Bill {bill_id} not found for payment status update.")
            raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")
            
        update_data = {
            "$set": {
                "payment_status": payment_status,
                "updated_at": datetime.now()
            }
        }
        
        # If marking as paid, potentially update main status too if it's still open
        if payment_status == 'paid' and bill.get("status") == 'open':
            logger.info(f"Setting main bill status to 'paid' as payment_status is 'paid'")
            update_data["$set"]["status"] = 'paid'
        
        result = await collection.update_one({"bill_id": bill_id}, update_data)
        
        if result.matched_count == 0:
            logger.error(f"Bill {bill_id} not found during update operation.")
            raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found during update")

        updated_bill_doc = await collection.find_one({"bill_id": bill_id})
        if not updated_bill_doc:
             raise HTTPException(status_code=500, detail="Failed to retrieve updated bill details")

        # --- START: Logic to update table status ---
        final_status = updated_bill_doc.get("status") # Use the status AFTER potential update
        if payment_status == "paid" or final_status in ["closed", "paid"]:
            table_id = bill.get("table_id")
            if table_id:
                logger.info(f"Bill {bill_id} marked as paid/closed. Checking if table {table_id} should become available.")
                try:
                    # Count other ACTIVE bills for the same table
                    active_bill_count = await collection.count_documents({
                        "table_id": table_id,
                        "bill_id": {"$ne": bill_id},
                        "status": {"$in": ACTIVE_BILL_STATUSES}
                    })
                    
                    logger.info(f"Found {active_bill_count} other active bill(s) for table {table_id}.")
                    
                    if active_bill_count == 0:
                        logger.info(f"No other active bills found. Setting table {table_id} to available.")
                        await TableService.update_table_status(table_id, 'available')
                    else:
                         logger.info(f"Table {table_id} still has other active bills. Status not changed.")
                         
                except HTTPException as he:
                    logger.error(f"HTTP Error trying to update table {table_id} status after paying bill {bill_id}: {he.detail}")
                except Exception as e:
                    logger.error(f"Error checking/updating table status for table {table_id} after paying bill {bill_id}: {str(e)}")
            else:
                 logger.warning(f"Bill {bill_id} has no table_id associated. Cannot check table status.")
        # --- END: Logic to update table status ---

        return BillResponse(**{k: v for k, v in updated_bill_doc.items() if k != '_id'})
    
    @staticmethod
    def format_bill_as_html(bill: BillResponse) -> str:
        """Formats bill data into a simple HTML receipt string."""
        # Basic inline styles for the receipt
        styles = {
            "body": "font-family: sans-serif; margin: 20px;",
            "h1": "text-align: center; color: #333;",
            "header_info": "margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;",
            "table": "width: 100%; border-collapse: collapse; margin-bottom: 20px;",
            "th": "border-bottom: 1px solid #ccc; padding: 8px; text-align: left; background-color: #f8f8f8;",
            "td": "border-bottom: 1px solid #eee; padding: 8px;",
            "td_right": "text-align: right;",
            "totals": "margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc;",
            "totals_td_right": "text-align: right; font-weight: bold;",
            "footer": "text-align: center; margin-top: 30px; font-size: 0.9em; color: #777;"
        }

        # Build item rows using f-strings
        item_rows_html = ""
        subtotal_calc = 0
        for item in bill.items:
            item_total = item.price * item.quantity
            subtotal_calc += item_total
            unit_price_vnd = f"{item.price:,.0f}"
            item_total_vnd = f"{item_total:,.0f}"
            item_rows_html += f"""
            <tr>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td class="text-right">{unit_price_vnd}</td>
                <td class="text-right">{item_total_vnd}</td>
            </tr>"""

        # Format final numbers
        formatted_subtotal = f"{subtotal_calc:,.0f}"
        formatted_total = f"{bill.total_amount:,.0f}"

        # Construct the final HTML using ONE f-string for the main template
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bill Receipt - {bill.bill_id}</title>
    <style>
        body {{ {styles['body']} }}
        h1 {{ {styles['h1']} }}
        .header-info {{ {styles['header_info']} }}
        table {{ {styles['table']} }}
        th {{ {styles['th']} }}
        td {{ {styles['td']} }}
        .text-right {{ {styles['td_right']} }}
        .totals {{ {styles['totals']} }}
        .totals .text-right {{ {styles['totals_td_right']} }}
        footer {{ {styles['footer']} }}
    </style>
</head>
<body>
    <h1>Manwah Restaurant</h1>
    <div class="header-info">
        <strong>Bill ID:</strong> {bill.bill_id}<br>
        <strong>Table ID:</strong> {bill.table_id}<br>
        <strong>Order ID:</strong> {bill.order_id}<br>
        <strong>Date:</strong> {bill.created_at.strftime('%Y-%m-%d %H:%M:%S')}<br>
        <strong>Payment Status:</strong> {bill.payment_status.capitalize()}
    </div>

    <h2>Order Details</h2>
    <table>
        <thead>
            <tr>
                <th>Item Name</th>
                <th>Quantity</th>
                <th class="text-right">Unit Price (₫)</th>
                <th class="text-right">Total Price (₫)</th>
            </tr>
        </thead>
        <tbody>
            {item_rows_html}
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr><td>Subtotal</td><td class="text-right">{formatted_subtotal} ₫</td></tr>
            <tr><td><strong>Total</strong></td><td class="text-right"><strong>{formatted_total} ₫</strong></td></tr>
        </table>
    </div>

    <footer>Thank you for dining with us!</footer>
</body>
</html>"""

        return html 