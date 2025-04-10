"""
Service Integration module for handling communication with other microservices
"""
import httpx
import logging
import time
from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException
import contextlib
import json

from ..config import settings

logger = logging.getLogger(__name__)

class ServiceIntegration:
    """
    Utility class for handling service integration with error handling
    and fallback strategies for resilient operation.
    """
    
    # Service health status tracking
    _service_health = {
        'order_service': {'available': True, 'last_check': 0, 'failure_count': 0},
        'menu_service': {'available': True, 'last_check': 0, 'failure_count': 0}
    }
    
    # Constants for service checks
    HEALTH_CHECK_INTERVAL = 30  # seconds
    MAX_FAILURES = 3
    
    @classmethod
    async def check_service_health(cls):
        """Check the health of connected services and update status"""
        current_time = time.time()
        
        # Check Order Service
        if current_time - cls._service_health['order_service']['last_check'] > cls.HEALTH_CHECK_INTERVAL:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{settings.ORDER_SERVICE_URL}/health",
                        timeout=5.0
                    )
                
                if response.status_code == 200:
                    cls._service_health['order_service']['available'] = True
                    cls._service_health['order_service']['failure_count'] = 0
                    logger.debug("Order Service is healthy")
                else:
                    cls._service_health['order_service']['failure_count'] += 1
                    if cls._service_health['order_service']['failure_count'] >= cls.MAX_FAILURES:
                        cls._service_health['order_service']['available'] = False
                    logger.warning(f"Order Service health check failed: {response.status_code} at {settings.ORDER_SERVICE_URL}/health")
            except Exception as e:
                cls._service_health['order_service']['failure_count'] += 1
                if cls._service_health['order_service']['failure_count'] >= cls.MAX_FAILURES:
                    cls._service_health['order_service']['available'] = False
                logger.error(f"Error checking Order Service health: {str(e)}")
            
            cls._service_health['order_service']['last_check'] = current_time
        
        # Check Menu Service
        if current_time - cls._service_health['menu_service']['last_check'] > cls.HEALTH_CHECK_INTERVAL:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{settings.MENU_SERVICE_URL}/health",
                        timeout=5.0
                    )
                
                if response.status_code == 200:
                    cls._service_health['menu_service']['available'] = True
                    cls._service_health['menu_service']['failure_count'] = 0
                    logger.debug("Menu Service is healthy")
                else:
                    cls._service_health['menu_service']['failure_count'] += 1
                    if cls._service_health['menu_service']['failure_count'] >= cls.MAX_FAILURES:
                        cls._service_health['menu_service']['available'] = False
                    logger.warning(f"Menu Service health check failed: {response.status_code} at {settings.MENU_SERVICE_URL}/health")
            except Exception as e:
                cls._service_health['menu_service']['failure_count'] += 1
                if cls._service_health['menu_service']['failure_count'] >= cls.MAX_FAILURES:
                    cls._service_health['menu_service']['available'] = False
                logger.error(f"Error checking Menu Service health: {str(e)}")
            
            cls._service_health['menu_service']['last_check'] = current_time
    
    @classmethod
    def is_service_available(cls, service_name):
        """Check if a service is currently available"""
        if service_name not in cls._service_health:
            logger.warning(f"Unknown service {service_name}")
            return False
        
        # If it's been a while since we checked and the service was down,
        # reset the status to allow retrying
        current_time = time.time()
        if (not cls._service_health[service_name]['available'] and 
                current_time - cls._service_health[service_name]['last_check'] > 60):
            cls._service_health[service_name]['available'] = True
            cls._service_health[service_name]['failure_count'] = 0
            
        return cls._service_health[service_name]['available']
    
    @staticmethod
    async def fetch_order_details(order_id: str) -> dict:
        """
        Fetch order details from Order Service
        
        Args:
            order_id: The order ID to fetch
            
        Returns:
            dict: Order data or empty dict if unavailable
            
        Raises:
            HTTPException: If the order cannot be found
        """
        if not order_id:
            logger.error("Attempted to fetch order details with empty order_id")
            return {}
        
        logger.info(f"Fetching order details for order ID: {order_id}")
        
        try:
            # First check service health
            await ServiceIntegration.check_service_health()
            
            # Check if the Order Service is available
            if not ServiceIntegration.is_service_available('order_service'):
                logger.warning(f"Order Service unavailable, skipping fetch for order {order_id}")
                return {}
            
            # Use a context manager for the HTTP client
            async with httpx.AsyncClient() as client:
                # Set a reasonable timeout
                response = await client.get(
                    f"{settings.ORDER_SERVICE_URL}/api/orders/{order_id}",
                    timeout=5.0
                )
                
                # Handle the response based on status code
                if response.status_code == 200:
                    order_data = response.json()
                    logger.debug(f"Successfully fetched order {order_id}: {len(str(order_data))} bytes")
                    return order_data
                elif response.status_code == 404:
                    error_msg = f"Order details for {order_id} could not be found in Order Service"
                    logger.warning(error_msg)
                    # Raise exception instead of returning empty dict
                    raise HTTPException(status_code=404, detail=error_msg)
                else:
                    error_msg = f"Error fetching order {order_id}: status {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    
                    # Track service health degradation for non-404 errors
                    ServiceIntegration._service_health['order_service']['failure_count'] += 1
                    if ServiceIntegration._service_health['order_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                        ServiceIntegration._service_health['order_service']['available'] = False
                    
                    # Don't raise exception for server errors, return empty data
                    return {}
                    
        except httpx.TimeoutException:
            error_msg = f"Timeout fetching order {order_id} from Order Service"
            logger.error(error_msg)
            
            # Track service health degradation
            ServiceIntegration._service_health['order_service']['failure_count'] += 1
            if ServiceIntegration._service_health['order_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['order_service']['available'] = False
                
            # Continue with empty data
            return {}
            
        except httpx.RequestError as e:
            error_msg = f"Network error fetching order {order_id}: {str(e)}"
            logger.error(error_msg)
            
            # Track service health degradation
            ServiceIntegration._service_health['order_service']['failure_count'] += 1
            if ServiceIntegration._service_health['order_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['order_service']['available'] = False
            
            # Continue with empty data
            return {}
            
        except json.JSONDecodeError:
            error_msg = f"Invalid JSON response from Order Service for order {order_id}"
            logger.error(error_msg)
            
            # Track service health degradation for JSON decode errors
            ServiceIntegration._service_health['order_service']['failure_count'] += 1
            if ServiceIntegration._service_health['order_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['order_service']['available'] = False
                
            return {}
            
        except Exception as e:
            error_msg = f"Unexpected error fetching order {order_id}: {str(e)}"
            logger.error(error_msg)
            
            # Track service health degradation for unexpected errors
            ServiceIntegration._service_health['order_service']['failure_count'] += 1
            if ServiceIntegration._service_health['order_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['order_service']['available'] = False
                
            return {}
    
    @staticmethod
    async def fetch_menu_item_details(item_id: str) -> tuple[dict, bool]:
        """
        Fetch menu item details from Menu Service
        
        Args:
            item_id: The menu item ID to fetch
            
        Returns:
            tuple[dict, bool]: (Menu item data, success flag)
            
        Note: 
            This function doesn't raise exceptions but returns a success flag
            to indicate whether the data was retrieved successfully
        """
        if not item_id:
            logger.error("Attempted to fetch menu item details with empty item_id")
            return {}, False
        
        logger.debug(f"Fetching menu item details for item ID: {item_id}")
        
        try:
            # Check if the Menu Service is available
            if not ServiceIntegration.is_service_available('menu_service'):
                logger.warning(f"Menu Service unavailable, skipping fetch for item {item_id}")
                return {}, False
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{settings.MENU_SERVICE_URL}/api/menu-items/{item_id}",
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    item_data = response.json()
                    logger.debug(f"Successfully fetched menu item {item_id}")
                    return item_data, True
                elif response.status_code == 404:
                    logger.warning(f"Menu item {item_id} not found in Menu Service")
                    return {}, False
                else:
                    logger.error(f"Error fetching menu item {item_id}: status {response.status_code}")
                    return {}, False
                    
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching menu item {item_id} from Menu Service")
            
            # Track service health degradation
            ServiceIntegration._service_health['menu_service']['failure_count'] += 1
            if ServiceIntegration._service_health['menu_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['menu_service']['available'] = False
                
            return {}, False
            
        except httpx.RequestError as e:
            logger.error(f"Network error fetching menu item {item_id}: {str(e)}")
            
            # Track service health degradation
            ServiceIntegration._service_health['menu_service']['failure_count'] += 1
            if ServiceIntegration._service_health['menu_service']['failure_count'] >= ServiceIntegration.MAX_FAILURES:
                ServiceIntegration._service_health['menu_service']['available'] = False
            
            return {}, False
            
        except Exception as e:
            logger.error(f"Unexpected error fetching menu item {item_id}: {str(e)}")
            return {}, False 