"""
Webhook notification service for sending notifications to external systems
"""
import logging
import httpx
import asyncio
from typing import Dict, Any

from ..config import settings

logger = logging.getLogger(__name__)

class WebhookNotificationService:
    """Service for sending webhook notifications to external systems"""
    
    @staticmethod
    async def send_notification(service: str, event_type: str, data: dict) -> bool:
        """
        Send a notification to external systems via webhook
        
        Args:
            service: The service name (e.g., 'table', 'bill')
            event_type: The event type (e.g., 'created', 'updated')
            data: The notification data
            
        Returns:
            bool: True if the notification was sent successfully, False otherwise
        """
        if not settings.WEBHOOK_NOTIFICATIONS_ENABLED:
            logger.debug("Webhook notifications are disabled")
            return False
            
        webhook_url = settings.WEBHOOK_URL
        if not webhook_url:
            logger.warning("No webhook URL configured, skipping notification")
            return False
            
        # Prepare notification payload
        payload = {
            "service": "table-bill",
            "resource": service,
            "event": event_type,
            "data": data
        }
        
        try:
            logger.info(f"Sending webhook notification: {service}.{event_type}")
            logger.debug(f"Webhook payload: {payload}")
            
            # Use background task to avoid blocking
            async def send_webhook():
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            webhook_url,
                            json=payload,
                            timeout=5.0
                        )
                        
                        if response.status_code in (200, 201, 202, 204):
                            logger.info(f"Webhook notification sent successfully: {service}.{event_type}")
                            return True
                        else:
                            logger.warning(f"Failed to send webhook notification: {response.status_code}")
                            return False
                except Exception as e:
                    logger.error(f"Error sending webhook notification: {str(e)}")
                    return False
            
            # Create task but don't await it to avoid blocking the caller
            asyncio.create_task(send_webhook())
            return True
            
        except Exception as e:
            logger.error(f"Error creating webhook notification task: {str(e)}")
            return False 