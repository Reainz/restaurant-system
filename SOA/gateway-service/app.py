import uvicorn
import uuid
from fastapi import FastAPI, Depends, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.requests import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.templating import Jinja2Templates
from starlette.status import HTTP_302_FOUND


app = FastAPI(title="Restaurant Gateway Service")


# Set up the Jinja2 templates
templates = Jinja2Templates(directory="frontend/templates")


# Mount the static folder
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

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

session_tokens = {}

app.add_middleware(
    SessionMiddleware,
    secret_key="your-super-secret-key"
)

def authMiddleware(request: Request):
    user = request.session.get("user")
    token = request.session.get("token")
    if user == None or token not in session_tokens:
        raise HTTPException(
            status_code=HTTP_302_FOUND,
            headers={"Location": "/login?error=You+have+to+login+to+access+this+page"},
        )
    
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login(request: Request, error: str = None):
    return templates.TemplateResponse("login.html", {"request": request, "error": error})

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == "manager" and password == "123456":
        token = str(uuid.uuid4())
        request.session["user"] = "manager"
        request.session["token"] = token
        session_tokens[token] = "manager"
        return RedirectResponse("/manager", status_code=HTTP_302_FOUND)
    return RedirectResponse("/login?error=Invalid+credentials", status_code=HTTP_302_FOUND)

@app.get("/logout")
async def logout(request: Request):
    token = request.session.get("token")
    if token in session_tokens:
        del session_tokens[token]
    request.session.clear()
    return RedirectResponse("/login", status_code=HTTP_302_FOUND)

@app.get("/manager", response_class=HTMLResponse)
async def managerPage(request: Request, _auth=Depends(authMiddleware)):
    return templates.TemplateResponse("manager-dashboard.html", {"request": request})

@app.get("/kitchen", response_class=HTMLResponse)
async def kitchenPage(request: Request):
    return templates.TemplateResponse("kitchen-staff-dashboard.html", {"request": request})

@app.get("/service", response_class=HTMLResponse)
async def servicePage(request: Request):
    return templates.TemplateResponse("service-staff-dashboard.html", {"request": request})


# Run the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)