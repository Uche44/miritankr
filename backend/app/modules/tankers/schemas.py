import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class TankerBase(BaseModel):
    plate_number: str = Field(..., min_length=1, max_length=50)
    capacity_litres: int = Field(..., gt=0)
    default_source_id: Optional[uuid.UUID] = None
    license_documents: str = Field(..., min_length=1, description="Vehicle/license registration document link or text")
    tanker_image: str = Field(..., min_length=1, description="Tanker photo url/text")

class TankerCreate(TankerBase):
    pass

class TankerResponse(TankerBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    status: str
    created_at: datetime
    is_eligible_for_drinking: bool

    class Config:
        from_attributes = True

# Standard envelope schemas matching docs/api-contracts.md
class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None

class TankerRegistrationData(BaseModel):
    id: uuid.UUID

class TankerRegistrationEnvelope(BaseEnvelope):
    data: TankerRegistrationData

class TankerEnvelope(BaseEnvelope):
    data: TankerResponse

class TankerListEnvelope(BaseEnvelope):
    data: List[TankerResponse]

class TankerStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="PENDING, ACTIVE, OUT_OF_SERVICE")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed_statuses = {"PENDING", "ACTIVE", "OUT_OF_SERVICE"}
        upper_val = value.upper()
        if upper_val not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return upper_val
