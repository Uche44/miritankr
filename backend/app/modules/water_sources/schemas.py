import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class QualityReportStub(BaseModel):
    id: Optional[uuid.UUID] = None
    tested_at: datetime
    ph: float
    tds: float
    turbidity: float
    grade: str
    inspector_id: uuid.UUID

    class Config:
        from_attributes = True

class SourceLocation(BaseModel):
    latitude: float
    longitude: float
    address: str

class WaterSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., description="BOREHOLE, TREATMENT_PLANT, RESERVOIR, GOVERNMENT_FACILITY, COMMERCIAL_VENDOR")
    address: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        allowed_types = {"BOREHOLE", "TREATMENT_PLANT", "RESERVOIR", "GOVERNMENT_FACILITY", "COMMERCIAL_VENDOR"}
        upper_val = value.upper()
        if upper_val not in allowed_types:
            raise ValueError(f"Type must be one of: {', '.join(allowed_types)}")
        return upper_val

class WaterSourceCreate(WaterSourceBase):
    pass

class WaterSourceResponse(WaterSourceBase):
    id: uuid.UUID
    verification_status: str
    quality_grade: Optional[str] = None
    owner_id: Optional[uuid.UUID] = None
    last_verified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Standard envelope schemas matching docs/api-contracts.md
class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None

class WaterSourceEnvelope(BaseEnvelope):
    data: WaterSourceResponse

class WaterSourceListEnvelope(BaseEnvelope):
    data: List[WaterSourceResponse]

# GET /water-sources/{id} detail schema matching api-contracts.md
class WaterSourceDetail(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    verification_status: str
    quality_grade: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    owner_id: Optional[uuid.UUID] = None
    created_at: datetime
    quality_reports: List[QualityReportStub] = []
    location: SourceLocation

    class Config:
        from_attributes = True

class WaterSourceDetailEnvelope(BaseEnvelope):
    data: WaterSourceDetail

# Admin verification request
class WaterSourceVerifyRequest(BaseModel):
    verification_status: str = Field(..., description="PENDING, VERIFIED, SUSPENDED, REJECTED")
    quality_grade: Optional[str] = Field(None, description="Water grade (A, B, C, D)")

    @field_validator("verification_status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed_statuses = {"PENDING", "VERIFIED", "SUSPENDED", "REJECTED"}
        upper_val = value.upper()
        if upper_val not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return upper_val

    @field_validator("quality_grade")
    @classmethod
    def validate_grade(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed_grades = {"A", "B", "C", "D", "E", "F"}
        upper_val = value.upper()
        if upper_val not in allowed_grades:
            raise ValueError(f"Grade must be one of: {', '.join(allowed_grades)}")
        return upper_val
