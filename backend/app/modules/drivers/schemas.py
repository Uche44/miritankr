import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class DriverStatusUpdate(BaseModel):
    status: str = Field(..., description="AVAILABLE, OFFLINE, BUSY")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed_statuses = {"AVAILABLE", "OFFLINE", "BUSY"}
        upper_val = value.upper()
        if upper_val not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return upper_val

class DriverLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude")

class DriverTankerUpdate(BaseModel):
    tanker_id: Optional[uuid.UUID] = Field(None, description="Tanker UUID to assign. Pass null or omit to unassign.")

class DriverResponse(BaseModel):
    id: uuid.UUID
    tanker_id: Optional[uuid.UUID] = None
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Nested sub-schemas for DriverDetailResponse
class DriverUserDetail(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str

class DriverTankerDetail(BaseModel):
    id: uuid.UUID
    plate_number: str
    capacity_litres: int
    is_eligible_for_drinking: bool
    status: str
    default_source_id: Optional[uuid.UUID] = None

class DriverDetailResponse(BaseModel):
    id: uuid.UUID
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    user: DriverUserDetail
    tanker: Optional[DriverTankerDetail] = None
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None

    class Config:
        from_attributes = True

class DriverBankAccountUpdate(BaseModel):
    bank_code: str = Field(..., description="Paystack bank code (e.g. 057)")
    bank_name: str = Field(..., description="Name of the bank")
    account_number: str = Field(..., min_length=10, max_length=10, description="10-digit account number")
    account_name: str = Field(..., description="Resolved account name")

# Standard envelope schemas matching docs/api-contracts.md
class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None

class DriverEnvelope(BaseEnvelope):
    data: DriverResponse

class DriverDetailEnvelope(BaseEnvelope):
    data: DriverDetailResponse

class DriverListEnvelope(BaseEnvelope):
    data: List[DriverDetailResponse]

class EarningLogItem(BaseModel):
    payment_id: uuid.UUID
    payment_reference: str
    amount: float
    timestamp: datetime
    order_id: uuid.UUID
    customer_name: str
    water_type: str
    quantity_litres: int

    class Config:
        from_attributes = True

class DriverEarningsResponse(BaseModel):
    total_earnings: float
    earnings_logs: List[EarningLogItem]

    class Config:
        from_attributes = True

class DriverEarningsEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: DriverEarningsResponse
