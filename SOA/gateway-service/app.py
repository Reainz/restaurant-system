import uvicorn
import logging
import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.requests import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from pathlib import Path


app = FastAPI(title="Restaurant Gateway Service")

# Mount the static folder
# app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Set up the Jinja2 templates
templates = Jinja2Templates(directory="frontend/templates")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("gateway-service")

# Define paths
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"

# Ensure directories exist
os.makedirs(str(STATIC_DIR), exist_ok=True)
os.makedirs(str(TEMPLATES_DIR), exist_ok=True)

# Mount static files directory
try:
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    logger.info("Successfully mounted static directory")
except Exception as e:
    logger.error(f"Failed to mount static directory: {str(e)}")

# CORS middleware
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

# Define service information
SERVICES = {
    "menu": {
        "name": "Menu Service",
        "base_url": "http://localhost:8000",
        "routes": {
            "customer_menu": "/customer-menu",
            "kitchen": "/kitchen",
            "management": "/"  # Menu management page
        }
    },
    "order": {
        "name": "Order Service",
        "base_url": "http://localhost:8002",
        "routes": {
            "customer_order": "/",
            "kitchen_order": "/kitchen"
        }
    },
    "table": {
        "name": "Table & Bill Service",
        "base_url": "http://localhost:8003",
        "routes": {
            "manage_tables": "/",
            "bills": "/bills"
        }
    }
}

# Homepage route
@app.get("/")
async def serve_index(request: Request):
    """Serve the gateway homepage with links to all services."""
    try:
        file_path = str(TEMPLATES_DIR / "index.html")
        if not os.path.exists(file_path):
            logger.error("index.html template not found")
            # If the template doesn't exist yet, return a temporary response
            return {"message": "Gateway service is running, but the index template is not yet created"}
            
        return FileResponse(file_path)
    except Exception as e:
        logger.error(f"Error serving index template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving page: {str(e)}")
    
@app.get("/dashboard", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index_dashboard.html", {"request": request})

@app.get("/manager", response_class=HTMLResponse)
async def manager_page(request: Request):
    return templates.TemplateResponse("manager-dashboard.html", {"request": request})

@app.get("/kitchen", response_class=HTMLResponse)
async def kitchen_page(request: Request):
    return templates.TemplateResponse("kitchen-staff-dashboard.html", {"request": request})

@app.get("/service", response_class=HTMLResponse)
async def service_page(request: Request):
    return templates.TemplateResponse("service-staff-dashboard.html", {"request": request})

# Redirect routes for each service
@app.get("/service/{service_name}/{route_name}")
async def redirect_to_service(service_name: str, route_name: str):
    """Redirect to the specified service and route."""
    if service_name not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    
    service = SERVICES[service_name]
    if route_name not in service["routes"]:
        raise HTTPException(status_code=404, detail=f"Route '{route_name}' not found in service '{service_name}'")
    
    target_url = service["base_url"] + service["routes"][route_name]
    return RedirectResponse(url=target_url)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "gateway-service"}

# Run the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Using port 8001 for the gateway