# **Product Requirements Document (PRD) - v2.0**

## **Project Title: Digitizing Restaurant Interactions**

---

## **1. Overview & Introduction**

### **1.1 Purpose**

This Product Requirements Document (PRD) outlines the specifications for developing three independent microservices designed to streamline interactions between restaurant customers, service staff, and kitchen staff. The system facilitates table-side ordering via tablets, efficient order management for the kitchen, and streamlined table/bill management for service staff.

### **1.2 System Overview**

The system employs a Microservice Architecture comprising three distinct, fully independent services:

1.  **Order Management Service:** Handles order creation, modification, tracking, status updates, and communication with other services regarding order details.
2.  **Menu Management Service:** Manages menu items (both à-la-carte and buffet), categories, pricing, and availability, providing this information to other services.
3.  **Table & Bill Management Service:** Manages table status, assignments, bill generation based on completed orders, and interaction with other services for necessary data.

Each service includes its own dedicated frontend (HTML/CSS/JavaScript with Tailwind CSS), backend (Python/FastAPI), and database (MongoDB), communicating via REST APIs. The system is designed for local on-premises deployment.

### **1.3 Scope**

**In Scope:**

*   Independent Order, Menu, and Table & Bill microservices.
*   Frontend, Backend, and Database for each service.
*   REST API communication between services.
*   Local on-premises deployment.
*   In-person dining focus; table-based ordering via tablets.
*   Role-specific interfaces/functionality (Customer, Service Staff, Kitchen Staff).
*   Menu management supporting à-la-carte and buffet options.
*   Real-time item availability updates by kitchen staff.
*   Order creation, tracking (status lifecycle), and special instructions.
*   Table status tracking (available, occupied).
*   Bill generation from completed orders and digital receipt display.
*   Basic transaction history viewing (by shift/date for staff).
*   Single restaurant setup.

**Out of Scope:**

*   Online ordering, delivery, or takeaway functionality.
*   Payment processing or integration with payment gateways.
*   Inventory management beyond menu item availability flags.
*   User authentication, login systems, or customer accounts.
*   Loyalty programs or reservation systems.
*   Complex analytics or reporting beyond basic history.
*   Multi-restaurant or multi-location support.
*   Integration with external systems (POS, accounting, etc.).
*   Physical receipt printing.

---

## **2. User Roles and Responsibilities**

### **2.1 Customers (Interacting via Tablet UI)**

*   **Browse Menu:** View items, categories, descriptions, prices (Menu Service). Switch between à-la-carte/buffet views.
*   **Place Orders:** Select items, specify quantities, add special notes/requests (Order Service).
*   **Track Order:** View the status of their current order (Order Service).
*   **View Bill:** See the itemized bill and total amount for their table (Table & Bill Service).
*   **(Implicit) Request Service:** While not a direct function, staff monitor tables/orders.

### **2.2 Service Staff (Interacting via Staff UI)**

*   **Manage Tables:** View table layout/status, assign customers, update status (occupied/available) (Table & Bill Service).
*   **Manage Orders:** Assist customers with ordering, create/modify orders if needed, track status, cancel orders (before kitchen processing) (Order Service).
*   **Manage Bills:** Generate bills for tables upon request or order completion, mark bills as paid (Table & Bill Service).
*   **View History:** Access basic transaction/order history by date or shift (Order & Table & Bill Services).

### **2.3 Kitchen Staff (Interacting via Kitchen UI)**

*   **Manage Menu Items:** Update the availability status of menu items (enable/disable) (Menu Service).
*   **View Orders:** See incoming orders with items and special instructions (Order Service).
*   **Process Orders:** Update order item status (e.g., preparing, ready) and overall order status (e.g., completed) (Order Service).
*   **Handle Issues:** Cancel specific items or entire orders if necessary (e.g., item unavailable) (Order Service, potentially notifying Menu Service).

---

## **3. System Architecture**

### **3.1 High-Level Architecture**

The system is designed as three collaborating microservices. Each service operates independently with its own data store and communicates with others via synchronous REST API calls when necessary.

*   **Menu Service:** Central source for menu data.
*   **Order Service:** Manages the order lifecycle, consuming data from Menu Service and interacting with Table & Bill Service.
*   **Table & Bill Service:** Manages tables and bills, consuming data from Order and Menu Services.

\`\`\`
+--------------------------+      +-----------------------+      +-----------------------------+
| Menu Management Service  |----->| Order Management Serv |----->| Table & Bill Management Serv|
| (Frontend, Backend, DB)  |<-----| (Frontend, Backend, DB)|<-----| (Frontend, Backend, DB)     |
+--------------------------+      +-----------------------+      +-----------------------------+
      ^                                       |                               ^
      |---------------------------------------+-------------------------------|
\`\`\`
*(Arrows indicate primary data flow directions via API calls)*

### **3.2 Microservice Details**

Each microservice adheres to the following:

*   **Frontend:** HTML, CSS (Tailwind CSS), JavaScript. Separate UIs tailored to roles (Customer, Service, Kitchen).
*   **Backend:** Python with FastAPI framework. Pydantic for data validation.
*   **Database:** Dedicated MongoDB database/collections per service.
*   **API:** RESTful endpoints for internal frontend use and inter-service communication.
*   **Deployment:** Local on-premises server.

*(Note: Current Menu Service backend structure is simpler than initially planned, primarily containing \`app.py\`)*

### **3.3 Technology Stack**

*   **Backend:** Python 3.x, FastAPI, Uvicorn
*   **Database:** MongoDB, Motor (async driver)
*   **Frontend:** HTML5, CSS3, Tailwind CSS, JavaScript (Vanilla)
*   **Environment:** Python-dotenv
*   **Testing (Planned):** Pytest, pytest-asyncio

---

## **4. Functional Requirements**

### **4.1 Menu Management Service**

*   **FR-M-01:** Allow authorized staff (Kitchen) to Create, Read, Update, Delete (CRUD) menu items (name, description, price, category, type).
*   **FR-M-02:** Support \`à-la-carte\` and \`buffet\` menu item types.
*   **FR-M-03:** Allow authorized staff (Kitchen) to manage menu categories (CRUD).
*   **FR-M-04:** Allow authorized staff (Kitchen) to toggle the \`available\` status of menu items.
*   **FR-M-05:** Provide API endpoints for other services to fetch menu items, categories, details, and availability.
*   **FR-M-06:** Frontend for customers to browse the menu.
*   **FR-M-07:** Frontend for kitchen staff to manage menu items and availability.

### **4.2 Order Management Service**

*   **FR-O-01:** Allow customers/staff to create new orders associated with a \`table_id\`.
*   **FR-O-02:** Allow adding items (referencing \`item_id\` from Menu Service) to an order, including quantity and optional notes per item.
*   **FR-O-03:** Validate item availability with Menu Service before adding to an order (or handle gracefully if added when unavailable).
*   **FR-O-04:** Allow adding special instructions to the overall order.
*   **FR-O-05:** Track and update order status (\`received\`, \`in-progress\`, \`ready\`, \`delivered\`, \`completed\`, \`cancelled\`).
*   **FR-O-06:** Track and update individual item status within an order.
*   **FR-O-07:** Allow cancellation of orders/items by authorized staff (Service/Kitchen) under specific conditions (e.g., before 'in-progress').
*   **FR-O-08:** Provide API endpoints for fetching order details (by \`order_id\`, \`table_id\`), creating orders, and updating status.
*   **FR-O-09:** Notify Table & Bill service upon order creation/completion/cancellation.
*   **FR-O-10:** Frontend for customers to create/view their orders and status.
*   **FR-O-11:** Frontend for service staff to manage orders for tables.
*   **FR-O-12:** Frontend for kitchen staff to view incoming orders, details, and update status.
*   **FR-O-13:** Store and provide access to basic order history.

### **4.3 Table & Bill Management Service**

*   **FR-TB-01:** Allow authorized staff (Service) to manage tables (view layout/status). *(Note: Table creation might be implicit or pre-configured)*
*   **FR-TB-02:** Track table status (\`available\`, \`occupied\`).
*   **FR-TB-03:** Associate active orders (\`order_id\`) with tables (\`table_id\`).
*   **FR-TB-04:** Allow authorized staff (Service) to manually update table status. Status should also update implicitly when an order starts/completes.
*   **FR-TB-05:** Generate a new bill associated with a \`table_id\` and \`order_id\` when an order is completed (or upon staff request).
*   **FR-TB-06:** Fetch completed order details (items, quantities) from Order Service and item pricing from Menu Service to populate the bill.
*   **FR-TB-07:** Calculate the total bill amount.
*   **FR-TB-08:** Allow authorized staff (Service) to mark a bill status as \`paid\` (or similar terminal state like \`closed\`).
*   **FR-TB-09:** Provide API endpoints for fetching table status, bill details (by \`bill_id\`, \`table_id\`), creating bills, and updating bill status.
*   **FR-TB-10:** Frontend for customers to view their current itemized bill and total.
*   **FR-TB-11:** Frontend for service staff to view table status, manage tables, and generate/manage bills.
*   **FR-TB-12:** Store and provide access to basic bill history.

---

## **5. User Interfaces**

*(High-level description; requires detailed UI/UX design)*

### **5.1 Customer Interface (Tablet)**

*   **Menu View:** Clean, categorized browsing of menu items; clear pricing and descriptions; toggle for buffet/à-la-carte.
*   **Ordering View:** Simple item selection, quantity adjustment, notes field; running order summary.
*   **Order Status View:** Real-time status update of their active order.
*   **Bill View:** Itemized list of items consumed, quantities, prices, total amount due.

### **5.2 Service Staff Interface (Tablet/Terminal)**

*   **Table Dashboard:** Visual representation of tables, color-coded by status (available, occupied); table details on click/tap.
*   **Order Management View:** View orders by table, assist with creation/modification, update status.
*   **Bill Management View:** Generate bills for tables, view active/closed bills, mark bills as paid.
*   **History View:** Simple searchable/filterable list of past orders/bills.

### **5.3 Kitchen Staff Interface (Tablet/Screen)**

*   **Menu Management View:** List of menu items, ability to quickly toggle availability; potentially category management.
*   **Order Queue:** Display of incoming orders (e.g., card/ticket format), prioritized or chronological; clear item details and notes.
*   **Order Detail View:** Expanded view of a single order; ability to update item/order status.

---

## **6. Data Models**

*(Based on Implementation Plan)*

### **6.1 Menu Management Service Models**

\`\`\`python
# MenuItem
{
    "item_id": "string",      # Unique identifier
    "name": "string",
    "description": "string",
    "price": "decimal",
    "category_id": "string",  # FK to MenuCategory
    "available": "boolean",
    "menu_type": "string",    # 'buffet' or 'a-la-carte'
    "created_at": "datetime",
    "updated_at": "datetime"
}

# MenuCategory
{
    "category_id": "string",  # Unique identifier
    "name": "string",
    "description": "string"
}
\`\`\`

### **6.2 Order Management Service Models**

\`\`\`python
# Order
{
    "order_id": "string",          # Unique identifier
    "table_id": "string",          # FK to Table
    "status": "string",            # 'received', 'in-progress', 'ready', 'delivered', 'completed', 'cancelled'
    "created_at": "datetime",
    "updated_at": "datetime",
    "special_instructions": "string", # Overall order notes
    "items": [                     # List of items in the order
        {
            "item_id": "string",   # FK to MenuItem
            "name": "string",      # Denormalized for convenience
            "quantity": "integer",
            "notes": "string",     # Notes specific to this item
            "status": "string"     # Status for this specific item line
        }
    ]
}
\`\`\`

### **6.3 Table & Bill Management Service Models**

\`\`\`python
# Table
{
    "table_id": "string",          # Unique identifier (e.g., "T1", "T15")
    "table_number": "integer",     # Display number
    "status": "string",            # 'available', 'occupied'
    "capacity": "integer",
    "current_order_id": "string"   # Optional: FK to active Order
}

# Bill
{
    "bill_id": "string",           # Unique identifier (e.g., "bill-{order_id}")
    "table_id": "string",          # FK to Table
    "order_id": "string",          # FK to Order
    "created_at": "datetime",
    "updated_at": "datetime",
    "status": "string",            # 'open', 'closed', 'paid', 'cancelled'
    "total_amount": "decimal",
    "items": [                     # Itemized list at the time of billing
        {
            "item_id": "string",   # FK to MenuItem
            "name": "string",      # Denormalized
            "price": "decimal",    # Price at the time of billing
            "quantity": "integer"
        }
    ],
    "payment_status": "string"     # 'unpaid', 'paid' (Simplified)
}
\`\`\`

---

## **7. API Endpoints**

*(Based on Implementation Plan)*

### **7.1 Menu Management Service APIs**

*   \`GET /menu-items\`: List all menu items (potentially with filters for category, availability).
*   \`GET /menu-items/{item_id}\`: Get specific menu item details.
*   \`POST /menu-items\`: Create new menu item (Kitchen Staff).
*   \`PUT /menu-items/{item_id}\`: Update menu item details (Kitchen Staff).
*   \`PUT /menu-items/{item_id}/availability\`: Update item availability (Kitchen Staff).
*   \`DELETE /menu-items/{item_id}\`: Remove menu item (Kitchen Staff).
*   \`GET /menu-categories\`: List all menu categories.
*   \`GET /menu-types\`: Get available menu types ('buffet', 'à-la-carte').

### **7.2 Order Management Service APIs**

*   \`GET /orders\`: List orders (potentially with filters for status, table).
*   \`GET /orders/{order_id}\`: Get specific order details.
*   \`POST /orders\`: Create a new order.
*   \`PUT /orders/{order_id}\`: Update order details (e.g., add/remove items, modify notes - subject to status rules).
*   \`PUT /orders/{order_id}/status\`: Update overall order status.
*   \`DELETE /orders/{order_id}\`: Cancel an entire order (subject to status rules).
*   \`GET /orders/table/{table_id}\`: Get orders for a specific table (active or historical).
*   **(Internal) \`POST /orders/status\` (Webhook receiver from Table & Bill)**

### **7.3 Table & Bill Management Service APIs**

*   \`GET /tables\`: List all tables and their current status.
*   \`GET /tables/{table_id}\`: Get specific table details (status, current order).
*   \`PUT /tables/{table_id}/status\`: Manually update table status (Service Staff).
*   \`GET /bills\`: List bills (potentially with filters for status, table, date).
*   \`GET /bills/{bill_id}\`: Get specific bill details.
*   \`POST /bills\`: Create a new bill from a completed order (triggered by Order Service notification or Staff action).
*   \`PUT /bills/{bill_id}\`: Update bill details (e.g., mark as paid).
*   \`GET /bills/table/{table_id}\`: Get bills for a specific table.
*   \`POST /bills/{bill_id}/refresh\`: Recalculate/refresh bill details from source services.
*   \`PUT /bills/{bill_id}/payment-status\`: Update the payment status of a bill.
*   **(Internal) \`POST /api/orders/status\` (Webhook sender to Order)**

---

## **8. Non-Functional Requirements**

### **8.1 Performance**

*   **NFR-P-01:** Average API response time < 1 second under normal load.
*   **NFR-P-02:** Frontend page load time < 2 seconds.
*   **NFR-P-03:** System to support at least 50 concurrent users (across all roles).
*   **NFR-P-04:** System to support at least 20 active tables simultaneously.

### **8.2 Reliability**

*   **NFR-R-01:** Each microservice must operate independently; failure in one should not cascade catastrophically (graceful degradation).
*   **NFR-R-02:** Ensure data consistency mechanisms are in place (e.g., for bill calculation based on potentially changing menu prices or order details).
*   **NFR-R-03:** Implement basic error handling and logging in all services.

### **8.3 Security**

*   **NFR-S-01:** Communication between services should occur over a trusted internal network (HTTPS recommended if network is not secure).
*   **NFR-S-02:** No sensitive personal data (like payment info) is stored.
*   **NFR-S-03:** Validate all incoming API request data (using Pydantic).
*   **NFR-S-04:** Implement basic rate limiting if abuse is a concern.

### **8.4 Usability**

*   **NFR-U-01:** Interfaces must be intuitive and require minimal training for all user roles.
*   **NFR-U-02:** Clear visual cues for status (e.g., table occupied, order ready, item unavailable).
*   **NFR-U-03:** Consistent design language (leveraging Tailwind CSS) across all service frontends.
*   **NFR-U-04:** Responsive design suitable for target devices (tablets primarily).

---

## **9. Implementation Guidelines**

*   **Backend:** Follow Python PEP 8. Use FastAPI async capabilities. Implement clear separation of concerns (e.g., routes, services, models). Use Motor for async MongoDB access.
*   **Frontend:** Use semantic HTML, modern CSS with Tailwind utility classes, and vanilla JavaScript organized into modules/components. Fetch data via API calls to the respective backend.
*   **Database:** Use appropriate MongoDB collection design. Implement necessary indexes for performance.
*   **Communication:** Use REST APIs for inter-service communication. Define clear API contracts. Handle potential service unavailability gracefully.
*   **Configuration:** Use \`.env\` files for environment-specific settings (DB URLs, ports, service URLs).
*   **Code Quality:** Write clean, maintainable, and appropriately documented code. Remove unused/demo code. Follow rules outlined in \`updated rules.mdc\`.

---

## **10. Deployment & Hosting**

*   **Environment:** Local on-premises server within the restaurant.
*   **Setup:** Each service runs as a separate process (e.g., using Uvicorn). MongoDB instance(s) accessible by all services. Network configuration allowing inter-service communication via defined ports/URLs.

---

## **11. Limitations & Exclusions**

*   (As listed in Section 1.3 Scope) - No online orders, payments, inventory, auth, multi-location, etc.

---

## **Appendix: Project Structure**

*(Based on Implementation Plan and current state)*

\`\`\`
restaurant-system/
│
├── menu-service/
│   ├── frontend/
│   │   ├── static/
│   │   │   ├── css/ (Tailwind output)
│   │   │   │   ├── customer-menu.js
│   │   │   │   └── kitchen.js
│   │   │   └── images/
│   │   └── templates/
│   │       ├── customer_menu.html
│   │       └── kitchen_menu.html
│   │
│   ├── backend/
│   │   ├── __init__.py
│   │   └── app.py              # (Currently holds routes, models, logic)
│   │   # (Missing: models.py, routes.py, services.py, config.py from plan)
│   │
│   ├── .env
│   ├── .gitignore
│   ├── requirements.txt
│   └── run.py
│
├── order-service/
│   ├── frontend/
│   │   ├── js/
│   │   │   ├── customer-order.js
│   │   │   ├── service-order.js
│   │   │   ├── kitchen-order.js
│   │   │   ├── api-config.js
│   │   │   ├── config.js
│   │   │   └── utils/
│   │   │       └── notifications.js
│   │   └── templates/
│   │       ├── customer_order.html
│   │       ├── service_order.html
│   │       └── kitchen_order.html
│   │
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── routes.py
│   │   ├── services.py
│   │   └── utils.py
│   │
│   ├── .env
│   ├── .gitignore
│   ├── requirements.txt
│   └── run.py
│
├── table-bill-service/
│   ├── frontend/
│   │   ├── css/ (Tailwind output)
│   │   ├── js/
│   │   │   ├── tables.js (Main)
│   │   │   ├── tables-core.js
│   │   │   ├── tables-ui.js
│   │   │   ├── tables-api.js
│   │   │   ├── tables-actions.js
│   │   │   ├── bills.js (Main)
│   │   │   ├── customer-bill.js (Main)
│   │   │   ├── customer-bill-core.js
│   │   │   ├── customer-bill-ui.js
│   │   │   ├── customer-bill-api.js
│   │   │   └── api.js (Shared?)
│   │   └── templates/
│   │       ├── tables.html
│   │       ├── bills.html
│   │       └── customer_bill.html
│   │
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── routes.py
│   │   ├── utils.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── background.py
│   │       ├── bills.py
│   │       ├── data_consistency.py
│   │       ├── integration.py
│   │       ├── tables.py
│   │       └── webhook.py
│   │
│   ├── .env
│   ├── .gitignore
│   ├── requirements.txt
│   └── run.py
│
└── (Possibly shared docs/, config/ at root - not currently present)
\`\`\`

--- 