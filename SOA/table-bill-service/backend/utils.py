import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger("table-bill-service")

async def check_external_service(url: str, service_name: str) -> Dict[str, Any]:
    """
    Check if an external service is available.
    
    Args:
        url: Base URL of the external service
        service_name: Name of the service for logging purposes
        
    Returns:
        Dictionary with status information
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{url}/health", timeout=5.0)
            if response.status_code == 200:
                logger.info(f"{service_name} is available")
                return {
                    "available": True,
                    "status_code": response.status_code,
                    "service_name": service_name,
                    "url": url,
                    "error": None
                }
            else:
                logger.warning(f"{service_name} returned status code {response.status_code}")
                return {
                    "available": False,
                    "status_code": response.status_code,
                    "service_name": service_name,
                    "url": url,
                    "error": f"Received status code {response.status_code}"
                }
    except Exception as e:
        logger.warning(f"Failed to connect to {service_name}: {str(e)}")
        return {
            "available": False,
            "status_code": None,
            "service_name": service_name,
            "url": url,
            "error": str(e)
        } 