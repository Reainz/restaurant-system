import logging
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
# Import Jinja2 and apply fix for contextfunction deprecation
import jinja2
if not hasattr(jinja2, 'contextfunction'):
    jinja2.contextfunction = jinja2.pass_context
from fastapi.templating import Jinja2Templates
import uvicorn
from pathlib import Path

from .routes import router
from .database import db
from .config import API_HOST, API_PORT, MENU_SERVICE_URL, TABLE_BILL_SERVICE_URL, PROJECT_NAME, DEBUG
from .utils import check_external_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("order_service.log")
    ]
)
logger = logging.getLogger("order-service")

# Create FastAPI app
app = FastAPI(
    title=PROJECT_NAME,
    description="Microservice for managing restaurant orders",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")

# Get the base directory (project root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend")), name="static")

# Templates
templates = Jinja2Templates(directory=str(BASE_DIR / "frontend" / "templates"))

@app.get("/{path:path}", tags=["ui"])
async def serve_template(request: Request, path: str = ""):
    """Serve HTML templates based on the request path"""
    # Skip this handler for API routes
    if request.url.path.startswith('/api/'):
        # Let the request continue to the API router
        raise HTTPException(status_code=404, detail="API endpoint not found")
        
    template_mapping = {
        "": "index.html",
        "customer": "customer-order.html",
        "kitchen": "kitchen-order.html",
        "service": "service-order.html"
    }
    
    # Get the template name from the mapping or use index.html as default
    template_name = template_mapping.get(path, "index.html")
    
    # Return the rendered template
    return templates.TemplateResponse(template_name, {"request": request})

@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup."""
    try:
        await db.connect_to_database()
        if not db.initialized:
            logger.critical("Failed to initialize database connection")
            # In production, you might want to exit the app here
            # import sys; sys.exit(1)
        else:
            logger.info("Connected to MongoDB")
        
        # Check if Menu Service is available
        await check_external_service(MENU_SERVICE_URL, "Menu Service")
        
        # Check if Table & Bill Service is available
        await check_external_service(TABLE_BILL_SERVICE_URL, "Table & Bill Service")
    except Exception as e:
        logger.critical(f"Failed to initialize application: {str(e)}")
        logger.exception(e)


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown."""
    await db.close_database_connection()
    logger.info("Disconnected from MongoDB")


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "order-management"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {str(exc)}")
    # Include the exception type and traceback in the log
    import traceback
    logger.error(f"Exception type: {type(exc).__name__}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Return a JSON response for API requests
    if request.url.path.startswith('/api/'):
        return JSONResponse(
            status_code=500,
            content={"detail": f"Server error: {str(exc)}"},
        )
    # Return a generic message for UI requests
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level="info",
    )