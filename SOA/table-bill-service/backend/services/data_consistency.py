"""
Data Consistency Service for ensuring data integrity between services
"""
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from pymongo import ReturnDocument

from ..config import get_bills_collection
from .integration import ServiceIntegration

logger = logging.getLogger(__name__)

class DataConsistencyService:
    """Service for ensuring data consistency across microservices"""
    
    @staticmethod
    async def verify_bill_consistency(bill_id: str) -> dict:
        """
        Verify bill data consistency with external services.
        
        Args:
            bill_id: The bill ID to verify
            
        Returns:
            dict: The verification results including issues found
        """
        logger.info(f"Verifying bill consistency for bill_id: {bill_id}")
        
        # Initialize results
        results = {
            "bill_id": bill_id,
            "verified": False,
            "status": "inconsistent",
            "issues": [],
            "order_exists": False,
            "items_consistency": False,
            "total_match": False,
            "details": {}
        }
        
        try:
            # Step 1: Get the bill from the database
            collection = await get_bills_collection()
            bill = await collection.find_one({"bill_id": bill_id})
            
            if not bill:
                results["issues"].append("Bill not found in database")
                return results
            
            # Extract key bill information for verification
            bill_order_id = bill.get("order_id")
            bill_items = bill.get("items", [])
            bill_total = bill.get("total_amount", 0)
            bill_table_id = bill.get("table_id")
            
            # Store original data for comparison
            results["details"]["original_bill"] = {
                "order_id": bill_order_id,
                "table_id": bill_table_id,
                "total_amount": bill_total,
                "item_count": len(bill_items)
            }
            
            # Step 2: If we have an order_id, verify the order exists
            if bill_order_id:
                order_data = await ServiceIntegration.fetch_order_details(bill_order_id)
                
                if not order_data:
                    results["issues"].append(f"Order {bill_order_id} not found in Order Service")
                else:
                    results["order_exists"] = True
                    results["details"]["order_data"] = {
                        "status": order_data.get("status"),
                        "table_id": order_data.get("table_id"),
                        "item_count": len(order_data.get("items", []))
                    }
                    
                    # Step 3: Verify table_id consistency
                    order_table_id = order_data.get("table_id")
                    if order_table_id and bill_table_id and order_table_id != bill_table_id:
                        results["issues"].append(f"Table ID mismatch: bill has {bill_table_id}, order has {order_table_id}")
                    
                    # Step 4: Verify items consistency
                    order_items = order_data.get("items", [])
                    
                    # Create lookup dictionaries for comparison
                    bill_items_dict = {f"{item.get('item_id')}": item for item in bill_items}
                    order_items_dict = {f"{item.get('item_id')}": item for item in order_items}
                    
                    # Check for missing items in bill
                    for item_id, order_item in order_items_dict.items():
                        if item_id not in bill_items_dict:
                            results["issues"].append(f"Item {item_id} ({order_item.get('name')}) in order but missing from bill")
                    
                    # Check for extra items in bill
                    for item_id, bill_item in bill_items_dict.items():
                        if item_id not in order_items_dict:
                            results["issues"].append(f"Item {item_id} ({bill_item.get('name')}) in bill but missing from order")
                    
                    # Check for quantity mismatches
                    for item_id in bill_items_dict.keys() & order_items_dict.keys():
                        bill_qty = bill_items_dict[item_id].get("quantity", 0)
                        order_qty = order_items_dict[item_id].get("quantity", 0)
                        
                        if bill_qty != order_qty:
                            results["issues"].append(
                                f"Quantity mismatch for item {item_id}: bill has {bill_qty}, order has {order_qty}"
                            )
                    
                    # Step 5: Verify total amount
                    calculated_total = 0
                    
                    # Use menu service to get current prices
                    for bill_item in bill_items:
                        item_id = bill_item.get("item_id")
                        if item_id:
                            menu_item, success = await ServiceIntegration.fetch_menu_item_details(item_id)
                            
                            if success and menu_item:
                                current_price = menu_item.get("price", 0)
                                bill_price = bill_item.get("price", 0)
                                
                                if current_price != bill_price:
                                    results["issues"].append(
                                        f"Price mismatch for item {item_id}: bill has {bill_price}, menu has {current_price}"
                                    )
                            
                            # Use bill price for calculation regardless of menu price
                            bill_price = bill_item.get("price", 0)
                            bill_qty = bill_item.get("quantity", 0)
                            calculated_total += bill_price * bill_qty
                    
                    # Compare calculated total with bill total
                    if abs(calculated_total - bill_total) > 0.001:  # Use epsilon for float comparison
                        results["issues"].append(
                            f"Total amount mismatch: bill has {bill_total}, calculated total is {calculated_total}"
                        )
                    else:
                        results["total_match"] = True
            else:
                results["issues"].append("Bill is missing order_id")
            
            # Set final verification status
            if len(results["issues"]) == 0:
                results["verified"] = True
                results["status"] = "consistent"
            
            return results
            
        except Exception as e:
            logger.error(f"Error verifying bill consistency: {str(e)}")
            results["issues"].append(f"Verification error: {str(e)}")
            return results
    
    @staticmethod
    async def reconcile_bill(bill_id: str, auto_fix: bool = False) -> dict:
        """
        Reconcile bill data with external services.
        
        Args:
            bill_id: The bill ID to reconcile
            auto_fix: Whether to automatically fix inconsistencies
            
        Returns:
            dict: The reconciliation results
        """
        logger.info(f"Reconciling bill {bill_id} (auto_fix: {auto_fix})")
        
        # First verify the bill to identify issues
        verify_results = await DataConsistencyService.verify_bill_consistency(bill_id)
        
        # Initialize reconciliation results
        results = {
            "bill_id": bill_id,
            "reconciled": False,
            "fixes_applied": [],
            "remaining_issues": [],
            "details": verify_results
        }
        
        # If there are no issues or auto_fix is False, return verification results
        if verify_results["verified"] or not auto_fix:
            if verify_results["verified"]:
                results["reconciled"] = True
            else:
                results["remaining_issues"] = verify_results["issues"]
            return results
        
        try:
            # Get the bill from the database
            collection = await get_bills_collection()
            bill = await collection.find_one({"bill_id": bill_id})
            
            if not bill:
                results["remaining_issues"].append("Bill not found in database")
                return results
            
            # Extract key bill information
            bill_order_id = bill.get("order_id")
            bill_items = bill.get("items", [])
            bill_total = bill.get("total_amount", 0)
            
            # Update data structure for modifications
            update_data = {}
            recalculate_total = False
            
            # If we have an order_id, get order details
            if bill_order_id:
                order_data = await ServiceIntegration.fetch_order_details(bill_order_id)
                
                if order_data:
                    # Fix table_id if needed
                    order_table_id = order_data.get("table_id")
                    bill_table_id = bill.get("table_id")
                    
                    if order_table_id and bill_table_id and order_table_id != bill_table_id:
                        update_data["table_id"] = order_table_id
                        results["fixes_applied"].append(f"Updated table_id from {bill_table_id} to {order_table_id}")
                    
                    # Fix items consistency
                    order_items = order_data.get("items", [])
                    fixed_items = []
                    
                    # Create lookup dictionaries
                    bill_items_dict = {item.get("item_id"): item for item in bill_items}
                    order_items_dict = {item.get("item_id"): item for item in order_items}
                    
                    # Process all items from order
                    for item_id, order_item in order_items_dict.items():
                        if item_id in bill_items_dict:
                            # Item exists in both - update quantity if needed
                            bill_item = bill_items_dict[item_id]
                            bill_qty = bill_item.get("quantity", 0)
                            order_qty = order_item.get("quantity", 0)
                            
                            if bill_qty != order_qty:
                                # Use the order quantity but keep the bill price
                                fixed_item = bill_item.copy()
                                fixed_item["quantity"] = order_qty
                                fixed_items.append(fixed_item)
                                results["fixes_applied"].append(
                                    f"Updated quantity for item {item_id} from {bill_qty} to {order_qty}"
                                )
                                recalculate_total = True
                            else:
                                # Keep the bill item as is
                                fixed_items.append(bill_item)
                        else:
                            # Item in order but not in bill - need to add it
                            # Get current price from Menu Service
                            menu_item, success = await ServiceIntegration.fetch_menu_item_details(item_id)
                            
                            if success and menu_item:
                                price = menu_item.get("price", 0)
                                name = menu_item.get("name", order_item.get("name", "Unknown Item"))
                            else:
                                # Fall back to order data
                                price = order_item.get("price", 0)
                                name = order_item.get("name", "Unknown Item")
                            
                            quantity = order_item.get("quantity", 1)
                            
                            new_item = {
                                "item_id": item_id,
                                "name": name,
                                "price": price,
                                "quantity": quantity
                            }
                            
                            fixed_items.append(new_item)
                            results["fixes_applied"].append(f"Added missing item {item_id} ({name})")
                            recalculate_total = True
                    
                    # Update items list
                    update_data["items"] = fixed_items
                    
                    # Recalculate total if needed
                    if recalculate_total:
                        calculated_total = sum(
                            item.get("price", 0) * item.get("quantity", 0) 
                            for item in fixed_items
                        )
                        
                        update_data["total_amount"] = calculated_total
                        results["fixes_applied"].append(
                            f"Recalculated total from {bill_total} to {calculated_total}"
                        )
                    
                    # Apply updates to the database
                    if update_data:
                        update_data["updated_at"] = datetime.now()
                        update_data["last_reconciled"] = datetime.now()
                        
                        await collection.update_one(
                            {"bill_id": bill_id},
                            {"$set": update_data}
                        )
                        
                        # Check for remaining issues
                        updated_verify = await DataConsistencyService.verify_bill_consistency(bill_id)
                        results["reconciled"] = updated_verify["verified"]
                        results["remaining_issues"] = updated_verify["issues"]
                    else:
                        # No updates needed
                        results["reconciled"] = True
                else:
                    results["remaining_issues"].append(f"Order {bill_order_id} not found, cannot reconcile")
            else:
                results["remaining_issues"].append("Bill missing order_id, cannot reconcile")
            
            return results
            
        except Exception as e:
            logger.error(f"Error reconciling bill: {str(e)}")
            results["remaining_issues"].append(f"Reconciliation error: {str(e)}")
            return results
    
    @staticmethod
    async def force_refresh_from_services(bill_id: str) -> dict:
        """
        Force refresh bill data from external services.
        
        Args:
            bill_id: The bill ID to refresh
            
        Returns:
            dict: The refresh results
        """
        logger.info(f"Force refreshing bill {bill_id} from external services")
        
        # Initialize results
        results = {
            "bill_id": bill_id,
            "refreshed": False,
            "updates_applied": [],
            "issues": []
        }
        
        try:
            # Get the bill from the database
            collection = await get_bills_collection()
            bill = await collection.find_one({"bill_id": bill_id})
            
            if not bill:
                results["issues"].append("Bill not found in database")
                return results
            
            # Get the order_id from the bill
            bill_order_id = bill.get("order_id")
            
            if not bill_order_id:
                results["issues"].append("Bill has no order_id, cannot refresh")
                return results
            
            # Fetch order data from Order Service
            order_data = await ServiceIntegration.fetch_order_details(bill_order_id)
            
            if not order_data:
                results["issues"].append(f"Order {bill_order_id} not found in Order Service")
                return results
            
            # Update data structure
            update_data = {}
            
            # Extract data from order
            order_status = order_data.get("status")
            order_items = order_data.get("items", [])
            order_table_id = order_data.get("table_id")
            
            # Update bill items with fresh data
            refreshed_items = []
            
            # Keep track of items that need price refresh
            items_for_price_refresh = []
            
            for order_item in order_items:
                item_id = order_item.get("item_id")
                if not item_id:
                    continue
                
                # Create a refreshed item entry
                refreshed_item = {
                    "item_id": item_id,
                    "name": order_item.get("name", "Unknown Item"),
                    "quantity": order_item.get("quantity", 1)
                }
                
                # Add to list for price refresh
                items_for_price_refresh.append(refreshed_item)
            
            # Fetch prices from Menu Service for all items
            for item in items_for_price_refresh:
                item_id = item.get("item_id")
                
                # Try to get current price from Menu Service
                menu_item, success = await ServiceIntegration.fetch_menu_item_details(item_id)
                
                if success and menu_item:
                    # Use menu price
                    item["price"] = menu_item.get("price", 0)
                    
                    # Update name if available
                    if menu_item.get("name"):
                        item["name"] = menu_item.get("name")
                else:
                    # Find the original price from the bill
                    original_item = next(
                        (i for i in bill.get("items", []) if i.get("item_id") == item_id), 
                        None
                    )
                    
                    if original_item:
                        item["price"] = original_item.get("price", 0)
                    else:
                        # Fall back to order price or zero
                        order_item = next(
                            (i for i in order_items if i.get("item_id") == item_id),
                            {}
                        )
                        item["price"] = order_item.get("price", 0)
                
                refreshed_items.append(item)
            
            # Calculate new total
            new_total = sum(item.get("price", 0) * item.get("quantity", 0) for item in refreshed_items)
            
            # Update the bill data
            update_data = {
                "items": refreshed_items,
                "total_amount": new_total,
                "updated_at": datetime.now(),
                "last_refreshed": datetime.now()
            }
            
            # Update table_id if different
            if order_table_id and order_table_id != bill.get("table_id"):
                update_data["table_id"] = order_table_id
                results["updates_applied"].append(f"Updated table_id to {order_table_id}")
            
            # Update bill status based on order status
            # If order is completed, set bill status to final
            if order_status in ["completed", "delivered"]:
                if bill.get("status") != "final":
                    update_data["status"] = "final"
                    results["updates_applied"].append(f"Updated bill status to final (order is {order_status})")
            
            # Update item count if changed
            original_item_count = len(bill.get("items", []))
            new_item_count = len(refreshed_items)
            if original_item_count != new_item_count:
                results["updates_applied"].append(f"Updated item count from {original_item_count} to {new_item_count}")
            
            # Update total if changed
            original_total = bill.get("total_amount", 0)
            if abs(original_total - new_total) > 0.001:  # Use epsilon for float comparison
                results["updates_applied"].append(f"Updated total from {original_total} to {new_total}")
            
            # Apply the updates
            if update_data:
                updated_bill = await collection.find_one_and_update(
                    {"bill_id": bill_id},
                    {"$set": update_data},
                    return_document=ReturnDocument.AFTER
                )
                
                if updated_bill:
                    results["refreshed"] = True
                    
                    # If no specific updates mentioned, add a generic one
                    if not results["updates_applied"]:
                        results["updates_applied"].append("Refreshed bill data from external services")
                else:
                    results["issues"].append("Failed to update bill in database")
            else:
                results["refreshed"] = True
                results["updates_applied"].append("No changes needed, bill data is current")
            
            return results
            
        except Exception as e:
            logger.error(f"Error refreshing bill: {str(e)}")
            results["issues"].append(f"Refresh error: {str(e)}")
            return results 