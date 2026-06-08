import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from app.modules.water_sources.schemas import BaseEnvelope

class QualityReportCreate(BaseModel):
    tested_at: datetime
    ph: float = Field(..., description="pH acidity check (ideal: 6.5 - 8.5)")
    tds: float = Field(..., description="Total Dissolved Solids level (mg/L)")
    turbidity: float = Field(..., description="Water clarity (NTU)")
    grade: str = Field(..., description="Water grade (A, B, C, D, E, F)")

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value: str) -> str:
        allowed_grades = {"A", "B", "C", "D", "E", "F"}
        upper_val = value.upper()
        if upper_val not in allowed_grades:
            raise ValueError(f"Grade must be one of: {', '.join(allowed_grades)}")
        return upper_val

class QualityReportResponse(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    tested_at: datetime
    ph: float
    tds: float
    turbidity: float
    grade: str
    inspector_id: uuid.UUID

    class Config:
        from_attributes = True

class QualityReportEnvelope(BaseEnvelope):
    data: QualityReportResponse

class QualityReportListEnvelope(BaseEnvelope):
    data: List[QualityReportResponse]
