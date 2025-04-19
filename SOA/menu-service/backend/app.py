import uvicorn
import logging
import os
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId
from slugify import slugify

app = FastAPI()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("menu-service")

# Define paths
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"

# Ensure directories exist
os.makedirs(str(IMAGES_DIR), exist_ok=True)

# Mount static files directory for serving images and other assets
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

# MongoDB connection
# Use environment variables for MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "menu_db")
logger.info(f"Connecting to MongoDB at: {MONGODB_URL}")
logger.info(f"Using database: {DATABASE_NAME}")
client = AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

# Pydantic models
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    available: bool = True
    menu_type: str  # buffet or a-la-carte
    image_url: Optional[str] = None

class MenuItem(MenuItemBase):
    id: str

    class Config:
        orm_mode = True

# API endpoints
@app.get("/api/menu-items", response_model=List[MenuItem])
async def get_menu_items():
    logger.info("Handling GET /api/menu-items")
    items = []
    cursor = db.menu_items.find({})
    
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        items.append(MenuItem(**doc))
    
    logger.info(f"Returning {len(items)} menu items")
    return items

@app.get("/api/menu-items/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    logger.info(f"Handling GET /api/menu-items/{item_id}")
    item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    if not item:
        logger.error(f"Item not found with ID: {item_id}")
        raise HTTPException(status_code=404, detail="Item not found")
    item["id"] = str(item["_id"])
    return MenuItem(**item)

@app.get("/api/menu-categories")
async def get_menu_categories():
    logger.info("Handling GET /api/menu-categories")
    # Return the preset categories used in the menu, excluding Buffet Options for sidebar
    categories = [
        {"id": "MAIN_DISHES", "name": "Main Dishes"},
        {"id": "BEVERAGES", "name": "Beverages"},
        {"id": "DESSERTS", "name": "Desserts"}
        # "BUFFET" category removed from sidebar display
    ]
    return categories

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "menu-service"}

# Frontend routes
# @app.get("/")
# @app.get("/customer-menu")
# @app.get("/kitchen")
# async def serve_template(request: Request):
#     """Serve HTML template based on the request path."""
#     try:
#         # Map routes to template files
#         templates = {
#             "/": "index.html",
#             "/customer-menu": "customer-menu.html",
#             "/kitchen": "kitchen.html"
#         }
        
#         # Get the template filename based on the request path
#         template_file = templates.get(request.url.path)
#         if not template_file:
#             raise HTTPException(status_code=404, detail="Template not found")
        
#         # Build the file path
#         file_path = str(TEMPLATES_DIR / template_file)
#         if not os.path.exists(file_path):
#             raise HTTPException(status_code=404, detail=f"{template_file} not found")
            
#         return FileResponse(file_path)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error serving template {request.url.path}: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error serving page: {str(e)}")

# Frontend routes - each with its own function for better organization

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """Serve the index/home page template."""
    try:
        file_path = str(TEMPLATES_DIR / "index.html")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="index.html not found")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving index template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving page: {str(e)}")

@app.get("/customer-menu", response_class=HTMLResponse)
async def serve_customer_menu(request: Request):
    """Serve the customer menu template."""
    try:
        file_path = str(TEMPLATES_DIR / "customer-menu.html")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="customer-menu.html not found")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving customer menu template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving page: {str(e)}")

@app.get("/kitchen", response_class=HTMLResponse)
async def serve_kitchen(request: Request):
    """Serve the kitchen page template."""
    try:
        file_path = str(TEMPLATES_DIR / "kitchen.html")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="kitchen.html not found")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving kitchen template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error serving page: {str(e)}")

@app.put("/api/menu-items/{item_id}")
async def update_menu_item(item_id: str, item: MenuItemBase):
    try:
        # Convert to dict and remove id field if present
        item_dict = item.dict()
        
        # Update the item in the database
        result = await db.menu_items.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item_dict}
        )
        
        if result.modified_count == 0:
            logger.error(f"Item not found or not modified: {item_id}")
            raise HTTPException(status_code=404, detail="Item not found or not modified")
        
        # Return the updated item
        updated_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
        updated_item["id"] = str(updated_item["_id"])
        return MenuItem(**updated_item)
    except Exception as e:
        logger.error(f"Error updating menu item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating menu item: {str(e)}")

async def handle_image_upload(name: str, image: Optional[UploadFile]) -> Optional[str]:
    """
    Handle image upload and return the image URL.
    Returns None if no image is provided.
    """
    if not image or not image.filename:
        return None
        
    # Create safe filename
    ext = os.path.splitext(image.filename)[1]
    safe_filename = f"{slugify(name)}{ext}"
    
    # Ensure images directory exists
    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)
    
    file_path = os.path.join(str(IMAGES_DIR), safe_filename)
    
    # Save the uploaded file
    with open(file_path, "wb") as buffer:
        content = await image.read()
        buffer.write(content)
    
    logger.info(f"Saved image for {name} at {file_path}")
    return safe_filename

@app.post("/api/menu-items-with-image")
async def create_menu_item_with_image(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    price: float = Form(...),
    category: str = Form(...),
    available: bool = Form(True),
    menu_type: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    try:
        # Create new item data
        new_item_data = {
            "name": name,
            "description": description,
            "price": price,
            "category": category,
            "available": available,
            "menu_type": menu_type
        }
        
        # Handle image upload if provided
        image_url = await handle_image_upload(name, image)
        if image_url:
            new_item_data["image_url"] = image_url
        
        # Insert the item in the database
        result = await db.menu_items.insert_one(new_item_data)
        new_item_id = str(result.inserted_id)
        
        # Return the created item
        created_item = await db.menu_items.find_one({"_id": ObjectId(new_item_id)})
        created_item["id"] = new_item_id
        return MenuItem(**created_item)
    except Exception as e:
        logger.error(f"Error creating menu item with image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating menu item with image: {str(e)}")

@app.put("/api/menu-items-with-image/{item_id}")
async def update_menu_item_with_image(
    item_id: str, 
    name: str = Form(...),
    description: Optional[str] = Form(None),
    price: float = Form(...),
    category: str = Form(...),
    available: bool = Form(True),
    menu_type: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    try:
        # Check if the item exists
        existing_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
        if not existing_item:
            logger.error(f"Item not found: {item_id}")
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Prepare update data
        update_data = {
            "name": name,
            "description": description,
            "price": price,
            "category": category,
            "available": available,
            "menu_type": menu_type,
        }
        
        # Handle image upload if provided
        image_url = await handle_image_upload(name, image)
        if image_url:
            update_data["image_url"] = image_url
        
        # Update the item in the database
        result = await db.menu_items.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": update_data}
        )
        
        # Return the updated item
        updated_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
        updated_item["id"] = str(updated_item["_id"])
        return MenuItem(**updated_item)
    except Exception as e:
        logger.error(f"Error updating menu item with image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating menu item with image: {str(e)}")

@app.delete("/api/menu-items/{item_id}")
async def delete_menu_item(item_id: str):
    try:
        # Check if the item exists
        existing_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
        if not existing_item:
            logger.error(f"Item not found: {item_id}")
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Delete the item from the database
        result = await db.menu_items.delete_one({"_id": ObjectId(item_id)})
        
        if result.deleted_count == 0:
            logger.error(f"Item not deleted: {item_id}")
            raise HTTPException(status_code=404, detail="Item not deleted")
        
        return {"status": "success", "message": f"Item {item_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting menu item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting menu item: {str(e)}")

# Run the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)