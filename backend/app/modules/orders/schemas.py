import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class OrderCreate(BaseModel):
    """
    Payload for a Customer to place a water delivery order.
    The customer must specify which driver they want to fulfil the order.
    """
    driver_id: uuid.UUID = Field(..., description="UUID of the DRIVER the customer is requesting delivery from")
    water_type: str = Field(..., description="DRINKING or UTILITY")
    quantity_litres: int = Field(..., gt=0, description="Volume of water ordered in litres")
    delivery_address: str = Field(..., min_length=1, max_length=500)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    scheduled_at: Optional[datetime] = None

    @field_validator("water_type")
    @classmethod
    def validate_water_type(cls, value: str) -> str:
        allowed = {"DRINKING", "UTILITY"}
        upper_val = value.upper()
        if upper_val not in allowed:
            raise ValueError(f"Water type must be one of: {', '.join(allowed)}")
        return upper_val

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None:
            val_naive = value
            if val_naive.tzinfo is not None:
                from datetime import timezone
                val_naive = val_naive.astimezone(timezone.utc).replace(tzinfo=None)
            if val_naive < datetime.utcnow():
                raise ValueError("Scheduled time must be in the future")
            return val_naive
        return value


class OrderStatusUpdate(BaseModel):
    """
    Payload for updating an order's status.
    - Driver uses this to ACCEPT, REJECT, or progress through the delivery lifecycle.
    - Customer uses this to CANCEL a PENDING order.
    - Admin uses this to CANCEL any non-terminal order.
    """
    status: str = Field(..., description="New status for the order")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {
            "ACCEPTED", "REJECTED",
            "GOING_TO_SOURCE", "LOADING_WATER",
            "EN_ROUTE", "ARRIVED", "DELIVERED", "CANCELLED",
        }
        upper_val = value.upper()
        if upper_val not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return upper_val


class OrderResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    water_type: str
    quantity_litres: int
    delivery_address: str
    latitude: float
    longitude: float
    scheduled_at: Optional[datetime] = None
    status: str
    assigned_tanker_id: Optional[uuid.UUID] = None
    assigned_driver_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    price: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderRegistrationData(BaseModel):
    order_id: uuid.UUID
    status: str


# ---------------------------------------------------------------------------
# Envelope wrappers
# ---------------------------------------------------------------------------

class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None


class OrderRegistrationEnvelope(BaseEnvelope):
    data: OrderRegistrationData


class OrderEnvelope(BaseEnvelope):
    data: OrderResponse


class OrderListEnvelope(BaseEnvelope):
    data: List[OrderResponse]


class OrderStatusEnvelope(BaseEnvelope):
    data: OrderResponse
