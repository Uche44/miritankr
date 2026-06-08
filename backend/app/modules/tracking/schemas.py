import uuid
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel


class TrackingEventResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    event_type: str
    actor_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DriverLocationSnapshot(BaseModel):
    """Driver's last known GPS position (from the most recent event with coordinates)."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    last_updated_at: Optional[datetime] = None


class SourceLocationSnapshot(BaseModel):
    """The water source linked to this order."""
    id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: Optional[str] = None
    quality_grade: Optional[str] = None


class LiveTrackingResponse(BaseModel):
    """
    Complete snapshot for the live tracking screen.
    Includes the driver's last GPS position, the source location,
    the current order status, and the full event timeline.
    """
    order_id: uuid.UUID
    order_status: str
    driver_location: DriverLocationSnapshot
    source_location: SourceLocationSnapshot
    estimated_arrival_minutes: Optional[int] = None  # stub — real value needs routing API
    timeline: List[TrackingEventResponse]


# ---------------------------------------------------------------------------
# Envelopes
# ---------------------------------------------------------------------------

class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None


class TimelineEnvelope(BaseEnvelope):
    data: List[TrackingEventResponse]


class LiveTrackingEnvelope(BaseEnvelope):
    data: LiveTrackingResponse
