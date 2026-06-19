import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class VolumeByDate(BaseModel):
    date: str
    drinking_volume: float
    utility_volume: float
    total_volume: float

class SystemMetricsResponse(BaseModel):
    total_volume_litres: float
    drinking_volume_litres: float
    utility_volume_litres: float
    total_orders_count: int
    delivered_orders_count: int
    active_tankers_count: int
    verified_sources_count: int
    total_customers_count: int
    total_drivers_count: int
    volume_by_date: List[VolumeByDate]

class AdminQualityReportResponse(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    source_name: str
    tested_at: datetime
    ph: float
    tds: float
    turbidity: float
    grade: str
    inspector_id: uuid.UUID
    inspector_name: str

class SystemMetricsEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: SystemMetricsResponse

class AdminQualityReportListEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: List[AdminQualityReportResponse]
