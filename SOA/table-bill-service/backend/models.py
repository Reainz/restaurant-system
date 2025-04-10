from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class Table(BaseModel):
    table_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_number: int
    status: str = "available"  # available, occupied
    capacity: int = 4
    order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class TableCreate(BaseModel):
    table_number: int
    capacity: int = 4

class TableUpdate(BaseModel):
    table_number: Optional[int] = None
    status: Optional[str] = None
    capacity: Optional[int] = None

class TableAssignment(BaseModel):
    table_id: str
    order_id: str
    status: str = "occupied"

class TableResponse(Table):
    pass

class TableListResponse(BaseModel):
    tables: List[TableResponse]

class BillItem(BaseModel):
    item_id: str
    name: str
    price: float
    quantity: int

class Bill(BaseModel):
    bill_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_id: str
    order_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: str = "open"  # open, closed
    payment_status: str = "pending"  # pending, completed
    total_amount: float = 0.0
    items: List[BillItem] = []

class BillCreate(BaseModel):
    table_id: str
    order_id: str
    items: List[BillItem]
    total_amount: float

class BillUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    total_amount: Optional[float] = None
    items: Optional[List[BillItem]] = None

class GenerateBillRequest(BaseModel):
    order_id: str

class BillResponse(Bill):
    pass

class BillListResponse(BaseModel):
    bills: List[BillResponse] 