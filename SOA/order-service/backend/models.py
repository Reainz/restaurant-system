from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime
from enum import Enum
import uuid
import logging

logger = logging.getLogger(__name__)


class OrderStatus(str, Enum):
    RECEIVED = "received"
    IN_PROGRESS = "in-progress"
    PAUSED = "paused"
    READY = "ready"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OrderItem(BaseModel):
    item_id: str
    name: str
    quantity: int = Field(gt=0)
    notes: str = ""
    status: str = "pending"  # pending, in-progress, completed, cancelled
    price: Optional[float] = None  # Add price field


class OrderCreate(BaseModel):
    table_id: str
    items: List[OrderItem]
    special_instructions: str = ""


class Order(BaseModel):
    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_id: str
    status: str = "new"  # new, received, in-progress, ready, delivered, paid, cancelled
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    special_instructions: str = ""
    items: List[OrderItem] = []

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class OrderUpdate(BaseModel):
    special_instructions: Optional[str] = None
    status: Optional[str] = None


class OrderItemUpdate(BaseModel):
    item_id: str
    status: str


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderResponse(BaseModel):
    order_id: str
    table_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    special_instructions: str
    items: List[OrderItem]


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]


# MongoDB document models
class OrderDocument(BaseModel):
    _id: Optional[Any] = None  # MongoDB ObjectID
    order_id: str
    table_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    special_instructions: str
    items: List[OrderItem]
    
    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def from_order(cls, order: Order) -> "OrderDocument":
        return cls(
            order_id=order.order_id,
            table_id=order.table_id,
            status=order.status,
            created_at=order.created_at,
            updated_at=order.updated_at,
            special_instructions=order.special_instructions,
            items=order.items
        )

    def to_order(self) -> Order:
        try:
            return Order(
                order_id=self.order_id,
                table_id=self.table_id,
                status=self.status,
                created_at=self.created_at,
                updated_at=self.updated_at,
                special_instructions=self.special_instructions,
                items=self.items
            )
        except Exception as e:
            logger.error(f"Error converting OrderDocument to Order: {str(e)}")
            logger.exception(e)
            raise 