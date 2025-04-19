from fastapi import FastAPI, Query, HTTPException, Path, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.requests import Request
import jinja2
if not hasattr(jinja2, 'contextfunction'):
    jinja2.contextfunction = jinja2.pass_context
from typing import List, Optional
import logging
from pathlib import Path
from starlette.status import HTTP_302_FOUND
import requests


from .models import (
    BillUpdate, BillResponse, BillListResponse,
    GenerateBillRequest
)
from .config import settings, connect_to_mongodb, close_mongodb_connection, get_tables_collection, get_bills_collection, get_database
from .services.bills import BillService
from .services.data_consistency import DataConsistencyService
from .services.background import start_background_sync
from .services.integration import ServiceIntegration
from .routes import router as notification_router
from .utils import check_external_service

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Create FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    description="Microservice for managing restaurant tables and bills",
    version=settings.VERSION,
)

# Include notification router
app.include_router(notification_router)

# Add CORS middleware to allow requests from the frontend
origins = [
    "http://localhost",
    "http://localhost:8000",  # Menu service
    "http://localhost:8001",  # Gateway service
    "http://localhost:8002",  # Order service
    "http://localhost:8003",  # Table & Bill service
    "http://127.0.0.1",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8001",
    "http://127.0.0.1:8002",
    "http://127.0.0.1:8003",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the base directory (project root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend")), name="static")

# Templates
templates = Jinja2Templates(directory=str(BASE_DIR / "frontend" / "templates"))

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize database connection and check service availability."""
    await connect_to_mongodb()
    
    # Initialize service health monitoring
    await ServiceIntegration.check_service_health()
    
    # Check if Order Service is available
    await check_external_service(settings.ORDER_SERVICE_URL, "Order Service")
    
    # Check if Menu Service is available
    await check_external_service(settings.MENU_SERVICE_URL, "Menu Service")
    
    # Start background data synchronization
    start_background_sync()
    logger.info("Background data synchronization started")

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection."""
    await close_mongodb_connection()

# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.SERVICE_NAME}

# Table endpoints
# (Table routes removed - now in routes.py)

# async def auth_middleware(request: Request):
#     """
#     Middleware to verify authentication from gateway service
#     Optional parameter 'require_role' to check for specific role
#     """

#     request.state.user = None

#     token = request.cookies.get("auth_token")
    
#     if not token:
#         return RedirectResponse(
#             "http://localhost:8001/login?error=Authentication+required",
#             status_code=HTTP_302_FOUND
#         )
    
#     try:
#         response = requests.get(
#             "http://localhost:8001/api/verify-token",
#             params={"token": token}
#         )
#         data = response.json()
        
#         if not data.get("valid"):
#             return RedirectResponse(
#                 "http://localhost:8001/login?error=Invalid+or+expired+session",
#                 status_code=HTTP_302_FOUND
#             )
        
#         request.state.user = data.get("user_info")

#         if request.state.user is None:
#             return RedirectResponse(
#                 "http://localhost:8001/login?error=Invalid+or+expired+session",
#                 status_code=HTTP_302_FOUND
#             )
        
#         return True
    
#     except requests.RequestException:
#         # Gateway service is unreachable
#         return HTMLResponse(
#             content="Authentication service unavailable. Please try again later.",
#             status_code=503
#         )


async def auth_middleware(request: Request):
    """
    Middleware to verify authentication from gateway service
    """
    request.state.user = None
    token = request.cookies.get("auth_token")
    
    if not token:
        # Instead of returning a redirect response, raise an HTTPException
        raise HTTPException(
            status_code=HTTP_302_FOUND,
            headers={"Location": "http://localhost:8001/login?error=Authentication+required"}
        )
    
    try:
        response = requests.get(
            "http://localhost:8001/api/verify-token",
            params={"token": token}
        )
        
        # Add debugging to see what's coming back
        logger.info(f"Token verification response: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if not data.get("valid"):
            raise HTTPException(
                status_code=HTTP_302_FOUND,
                headers={"Location": "http://localhost:8001/login?error=Invalid+or+expired+session"}
            )
        
        user_info = data.get("user_info")
        request.state.user = user_info
        
        if not user_info:
            raise HTTPException(
                status_code=HTTP_302_FOUND,
                headers={"Location": "http://localhost:8001/login?error=Missing+user+information"}
            )
        
        return user_info  # Return user info rather than True
        
    except requests.RequestException as e:
        logger.error(f"Error verifying token: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Authentication service unavailable. Please try again later."
        )

# Bill endpoints
@app.get("/api/bills", response_model=BillListResponse, tags=["bills"])
async def get_bills(
    table_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    auto_refresh: bool = Query(None)
):
    """Get all bills with optional filtering."""
    # Use configured default if not explicitly provided
    auto_refresh_enabled = settings.AUTO_REFRESH_DEFAULT if auto_refresh is None else auto_refresh
    
    # Always get bills first without attempting refreshes to ensure we can return data
    bills = await BillService.get_bills(table_id, status, payment_status, date)
    
    # If auto_refresh is enabled, attempt to refresh bills but catch and log any errors
    # This prevents server 500 errors when refresh fails
    if auto_refresh_enabled and bills:
        try:
            # Only attempt to refresh a limited number of bills to prevent timeout
            refresh_limit = 5
            bills_to_refresh = bills[:refresh_limit]
            
            # Only refresh active bills
            active_bills = [b for b in bills_to_refresh if b.status in ["open", "final"]]
            
            logger.info(f"Auto-refreshing {len(active_bills)} active bills")
            
            for bill in active_bills:
                try:
                    await DataConsistencyService.force_refresh_from_services(bill.bill_id)
                except Exception as e:
                    # Log the error but continue processing other bills
                    logger.warning(f"Failed to refresh bill {bill.bill_id}: {str(e)}")
                    continue
            
            # Get updated bills after refresh
            bills = await BillService.get_bills(table_id, status, payment_status, date)
        except Exception as e:
            # Log error but use the bills we already retrieved
            logger.error(f"Error during bill auto-refresh: {str(e)}")
    
    return BillListResponse(bills=bills)

@app.post("/api/bills", response_model=BillResponse, tags=["bills"], status_code=201)
async def generate_bill_from_order_id(request: GenerateBillRequest):
    """
    Generate a new bill from a completed order ID.
    This replaces the previous create_bill that required full bill details.
    """
    logger.info(f"Received request to generate bill for order: {request.order_id}")
    try:
        # Use the BillService to handle the logic
        bill = await BillService.create_bill_from_order(request.order_id)
        logger.info(f"Successfully generated bill {bill.bill_id} for order {request.order_id}")
        return bill
    except ValueError as ve:
        logger.error(f"Value error generating bill for order {request.order_id}: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        # Re-raise HTTPExceptions from BillService (e.g., order not found, not completed)
        logger.error(f"HTTP error generating bill for order {request.order_id}: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error generating bill for order {request.order_id}: {str(e)}")
        # Use a more specific error message for the user
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while generating the bill for order {request.order_id}. Please check service logs."
        )

@app.get("/api/bills/{bill_id}", response_model=BillResponse, tags=["bills"])
async def get_bill(bill_id: str):
    """Get a specific bill."""
    return await BillService.get_bill(bill_id)

@app.put("/api/bills/{bill_id}", response_model=BillResponse, tags=["bills"])
async def update_bill(bill_id: str, bill_data: BillUpdate):
    """Update a bill."""
    return await BillService.update_bill(bill_id, bill_data)

@app.put("/api/bills/{bill_id}/payment-status", response_model=BillResponse, tags=["bills"])
async def update_bill_payment_status_route(
    bill_id: str,
    payment_status: str = Query(..., description="New payment status (e.g., 'paid', 'pending', 'failed')")
):
    """Update the payment status of a specific bill."""
    # Basic validation for payment status (can be enhanced with Enum/Literal)
    allowed_statuses = ["paid", "pending", "failed", "processing"] # Add others if needed
    if payment_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payment status '{payment_status}'. Allowed values: {allowed_statuses}"
        )
        
    logger.info(f"Received request to update payment status for bill {bill_id} to {payment_status}")
    try:
        # Call the service function that contains our table update logic
        updated_bill = await BillService.update_payment_status(bill_id, payment_status)
        return updated_bill
    except HTTPException as he:
        # Re-raise HTTP exceptions from the service layer
        raise he
    except Exception as e:
        logger.error(f"Error updating payment status for bill {bill_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while updating payment status."
        )

@app.get("/api/tables/{table_id}/bills", response_model=BillListResponse, tags=["bills"])
async def get_table_bills(table_id: str):
    """Get all bills for a specific table."""
    bills = await BillService.get_bills(table_id=table_id)
    return BillListResponse(bills=bills)

@app.post("/api/bills/{bill_id}/refresh", tags=["bills"])
async def refresh_bill_data(bill_id: str):
    """Force refresh bill data from external services."""
    try:
        result = await DataConsistencyService.force_refresh_from_services(bill_id)
        return {"message": "Bill data refresh initiated", "details": result}
    except Exception as e:
        logger.error(f"Error refreshing bill {bill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error refreshing bill data: {str(e)}")

@app.get("/api/bills/{bill_id}/receipt", tags=["bills"], response_class=HTMLResponse)
async def get_bill_receipt_html(bill_id: str):
    """Generate and return an HTML receipt for a specific bill."""
    try:
        # Fetch the bill data
        bill = await BillService.get_bill(bill_id)
        if not bill:
            raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")

        # Format the bill as HTML
        html_content = BillService.format_bill_as_html(bill)
        file_name = f"bill_receipt_{bill_id}.html"

        # Return as HTML response with headers for download
        return HTMLResponse(
            content=html_content,
            media_type="text/html",
            headers={f"Content-Disposition": f"attachment; filename={file_name}"}
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error generating HTML receipt for bill {bill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating bill receipt.")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )

# Frontend routes (Now defined AFTER API routes)
# @app.get("/{path:path}", tags=["ui"], response_class=HTMLResponse)
# async def serve_template(request: Request, path: str = ""):
#     """Serve HTML templates based on the request path"""
#     # Sanitize path to prevent directory traversal
#     import os
#     safe_path = os.path.normpath(path).lstrip('/')
    
#     logger.info(f"Serving template for path: '{safe_path}'")
    
#     template_mapping = {
#         "": "index.html",
#         "tables": "service-tables.html",
#         "bills": "service-bills.html", 
#         "customer-bill": "customer-bill.html"
#     }
    
#     # Get the template name from the mapping or use index.html as default
#     template_name = template_mapping.get(safe_path, "index.html")
#     logger.debug(f"Mapped path '{safe_path}' to template: '{template_name}'")
    
#     # Check if template exists
#     template_file = Path(templates.env.loader.searchpath[0]) / template_name
#     if not template_file.is_file():
#         logger.warning(f"Template not found: {template_name} for path {safe_path}")
#         # Optionally return a 404 template or raise HTTPException
#         # For simplicity, falling back to index.html as per original logic
#         template_name = "index.html"
    
#     # Return the rendered template
#     try:
#         return templates.TemplateResponse(template_name, {"request": request})
#     except Exception as e:
#         logger.error(f"Error rendering template {template_name}: {str(e)}")
#         # Fallback or raise internal server error
#         raise HTTPException(status_code=500, detail="Error rendering page")

# Example frontend routes (ensure these match your needs)
@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/tables", response_class=HTMLResponse, include_in_schema=False)
async def tables_page(request: Request):
    return templates.TemplateResponse("service-tables.html", {"request": request})

@app.get("/bills", response_class=HTMLResponse, include_in_schema=False)
async def bills_page(request: Request):
    return templates.TemplateResponse("service-bills.html", {"request": request})

@app.get("/manager-bills", response_class=HTMLResponse, include_in_schema=False)
async def bills_page(request: Request, _=Depends(auth_middleware)):
    return templates.TemplateResponse("manager-bills.html", {"request": request, "username": request.state.user})

@app.get("/customer-bill", response_class=HTMLResponse, include_in_schema=False)
async def customer_bill_page(request: Request, bill_id: str = Query(...)):
    # You might want to fetch bill details here to pass to the template
    return templates.TemplateResponse("customer-bill.html", {"request": request, "bill_id": bill_id})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level="info")