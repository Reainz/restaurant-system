# Service-Oriented FastAPI Web App

This is midterm project of service-oriented architecture course at TDTU, a microservice-based web application built with **FastAPI**. This web application has four independent services that communicate with each other and a **MongoDB** database. Each service runs as its own FastAPI app and serves a specific purpose.

---

## Project Structure

Each service is a standalone FastAPI web app with its own:

- `backend/` or just `app.py` folder or python file containing the app logic
- `frontend/` folder containing client side views, and other static files
- `requirements.txt`/ txt file containing names of require python modules
- Optionally its own database or storage format

---

## How to Run the Project (Step-by-Step Guide)

The following are steps to run the app on your laptop

---

### 1. Clone the Repository

```bash
git clone https://github.com/Reainz/restaurant-system.git
cd restaurant-system/SOA
```

### 2. Open 4 Terminal Tabs (or Windows)

Each tab will represent one service. Navigate into each service folder like, 

```cd gateway-service
cd menu-service
cd order-service
cd table-bill-service
```


### 3. [Optional but require for mac with brew as package installer] Set Up Python Virtual Environment (Python 3.12, compatible version)

If the your laptop does not already use Python 3.12, create a virtual environment in each service folder, Sir.

```python3.12 -m venv venv
source venv/bin/activate
```
On windows

`venv\Scripts\activate on Windows`


### 4. Install Required Dependencies

Each service has a requirements.txt file. Run the following in each terminal tab,

`pip install -r requirements.txt`

### 5. Install MongoDB (If Not Already Installed)

Make sure MongoDB Community Edition is installed on the machine. After that, since your laptop is mac, sir,

To start mongodb, run this.
`brew services start mongodb-community`

To see if mongodb is running, run this.
`brew services list`

To stop the running mongodb, run this.
`brew services stop mongodb-community`

For Windows, go to official website of it and dowload it. Then, Start the mongodb.

### 6. Run MongoDB Setup Script

Run the provided MongoDB setup script (already provided):

`mongo < setup_script.js`


### 7. Run Each FastAPI Service

In each terminal tab (each inside a separate service folder), run:

`python -m uvicorn backend.app:app --reload --port <PORT>`

Like
`python -m uvicorn backend.app:app --reload --port 8000`

However, for the gateway-service, run this to run
`python -m uvicorn app:app --reload --port 8001


For example:
- Service 1 (Gateway): --port 8001
- Service 2: --port 8000
- Service 3: --port 8002
- Service 4: --port 8003

Make sure no ports conflict.

---

🌐 Accessing the Web App
- Main App (Gateway): http://localhost:8001/ (you can just go to this one, Sir. The other are connected to this ^^)
- Service 1 Index Page: http://localhost:8000/
- Service 2 Index Page: http://localhost:8002/
- Service 3 Index Page: http://localhost:8003/

You can explore each service directly by visiting the URLs.

---

**Notes**
- All services must be running for full functionality.
- MongoDB must be running before starting the services.
- If any service fails to start, check that the correct port is used and dependencies are installed.

