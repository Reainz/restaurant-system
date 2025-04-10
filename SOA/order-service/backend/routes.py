from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi import status
from typing import List, Optional
import logging
from datetime import datetime

from .models import (
    Order,
    OrderCreate,
    OrderUpdate,
    OrderResponse, 
    OrderListResponse,
    OrderStatusUpdate,
    OrderItemUpdate,
    OrderStatus,
    OrderItem
)
from .services import OrderService
from .config import MENU_SERVICE_URL, TABLE_BILL_SERVICE_URL

router = APIRouter(tags=["orders"])
logger = logging.getLogger("order-service")

@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(order_data: OrderCreate):
    """Create a new order."""
    try:
        # Log complete request for debugging
        logger.info("=============== ORDER CREATION REQUEST ===============")
        logger.info(f"Received order creation request: {order_data.dict()}")
        logger.info(f"Raw order data: {order_data}")
        logger.info("====================================================")
        
        # Additional validation for items
        if not order_data.items or len(order_data.items) == 0:
            logger.error("Order creation failed: No items in order")
            raise ValueError("Order must contain at least one item")
        
        # Log each item for debugging
        for i, item in enumerate(order_data.items):
            logger.info(f"Item {i+1}: {item.dict()}")
            
        try:
            order = await OrderService.create_order(order_data)
            logger.info(f"Order created successfully with ID: {order.order_id}")
            
            # Return a more complete response for debugging
            response = {
                "order_id": order.order_id,
                "table_id": order.table_id,
                "status": order.status,
                "created_at": order.created_at,
                "updated_at": order.updated_at,
                "special_instructions": order.special_instructions,
                "items": [item.dict() for item in order.items]
            }
            logger.info(f"Returning response: {response}")
            return response
        except Exception as service_error:
            logger.error(f"Error in OrderService.create_order: {str(service_error)}")
            logger.exception(service_error)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error when creating order: {str(service_error)}"
            )
    except ValueError as e:
        logger.error(f"Order creation validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create order: {str(e)}")
        # Log the full exception details including stack trace
        import traceback
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )

@router.get("/orders", response_model=OrderListResponse)
async def get_orders(
    table_id: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Get all orders with optional filtering by table and/or status(es)."""
    try:
        logger.info(f"API request received: get_orders with table_id={table_id}, status={status}")
        
        filter_query = {}
        if table_id:
            filter_query["table_id"] = table_id
        if status:
            if len(status) > 0:
                filter_query["status"] = {"$in": status}
        
        orders = await OrderService.get_orders(filter_query, skip, limit)
        
        logger.info(f"Successfully retrieved {len(orders)} orders")
        
        # Convert Order objects to OrderResponse objects
        order_responses = [OrderResponse(
            order_id=order.order_id,
            table_id=order.table_id,
            status=order.status,
            created_at=order.created_at,
            updated_at=order.updated_at,
            special_instructions=order.special_instructions,
            items=order.items
        ) for order in orders]
        
        return OrderListResponse(orders=order_responses)
    except Exception as e:
        logger.error(f"Failed to get orders: {str(e)}")
        # Log the full exception details including stack trace
        import traceback
        logger.error(f"Exception traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orders: {str(e)}"
        )

@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str):
    """Get a specific order by ID."""
    try:
        order = await OrderService.get_order(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get order: {str(e)}"
        )

@router.put("/orders/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, update_data: OrderUpdate):
    """Update an order."""
    try:
        order = await OrderService.update_order(order_id, update_data)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update order: {str(e)}"
        )

@router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, status_update: OrderStatusUpdate):
    """Update order status."""
    try:
        # Log incoming request
        logger.info(f"Received status update request for order {order_id}: {status_update.dict()}")
        
        # Get the current order
        order = await OrderService.get_order(order_id)
        if not order:
            logger.warning(f"Order with ID {order_id} not found for status update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )
        
        logger.info(f"Current order status: {order.status}, updating to: {status_update.status}")
        
        # Update the order status
        try:
            updated_order = await OrderService.update_order_status(order_id, status_update.status)
            logger.info(f"Successfully updated order {order_id} status to {status_update.status}")
        except ValueError as ve:
            logger.error(f"Status update validation error: {str(ve)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(ve)
            )
        
        return updated_order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update order status {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update order status: {str(e)}"
        )

@router.put("/orders/{order_id}/items/{item_id}", response_model=OrderResponse)
async def update_order_item(
    order_id: str, 
    item_id: str, 
    update_data: OrderItemUpdate
):
    """Update an item in an order."""
    try:
        # Get the current order
        order = await OrderService.get_order(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )
        
        # Verify that the item exists in the order
        item_exists = False
        for item in order.items:
            if item.item_id == item_id:
                item_exists = True
                break
        
        if not item_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found in order {order_id}"
            )
        
        # Update the item
        updated_order = await OrderService.update_order_item(order_id, item_id, update_data)
        return updated_order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update order item {order_id}/{item_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update order item: {str(e)}"
        )

@router.delete("/orders/{order_id}", response_model=OrderResponse)
async def delete_order(order_id: str):
    """Delete an order by ID (only for received orders)."""
    success = await OrderService.delete_order(order_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete order. Order may not be in 'received' status or doesn't exist."
        )
    return {"order_id": order_id, "message": "Order deleted successfully"}

@router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(order_id: str):
    """Cancel an order."""
    try:
        logger.info(f"Received cancel request for order {order_id}")
        
        order = await OrderService.cancel_order(order_id)
        if not order:
            logger.warning(f"Order with ID {order_id} not found for cancellation")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found"
            )
        
        logger.info(f"Successfully cancelled order {order_id}")
        return order
    except ValueError as ve:
        logger.error(f"Error cancelling order: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Failed to cancel order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel order: {str(e)}"
        )

@router.get("/orders/table/{table_id}", response_model=OrderListResponse)
async def get_orders_by_table(table_id: str):
    """Get all orders for a specific table."""
    try:
        logger.info(f"Getting orders for table {table_id}")
        filter_query = {"table_id": table_id}
        orders = await OrderService.get_orders(filter_query)
        logger.info(f"Found {len(orders)} orders for table {table_id}")
        return OrderListResponse(orders=orders)
    except Exception as e:
        logger.error(f"Failed to get orders for table {table_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orders for table: {str(e)}"
        )

# async def notify_table_bill_service(order_id: str, status: OrderStatus):
#     """Notify the Table & Bill service about an order status change."""
#     try:
#         async with httpx.AsyncClient() as client:
#             # Notify the Table & Bill service about the order status update
#             # Assuming the endpoint in Table & Bill service is /orders/status as per interaction needs
#             # (This endpoint isn't explicitly listed in the PRD's Table/Bill section, but is implied by this function)
#             response = await client.post(
#                 f"{TABLE_BILL_SERVICE_URL}/orders/status", 
#                 json={"order_id": order_id, "status": status.value},
#                 timeout=5.0
#             )
            
#             if response.status_code not in (200, 201, 202):
#                 logger.warning(f"Failed to notify Table & Bill service: {response.status_code}")
#     except Exception as e:
#         logger.warning(f"Failed to notify Table & Bill service: {str(e)}")
#         # We don't want to fail the order status update if notification fails
#         # Just log the warning and continue 