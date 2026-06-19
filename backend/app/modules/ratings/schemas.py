import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class RatingCreate(BaseModel):
    rating_water_quality: int = Field(..., ge=1, le=5, description="Water quality score from 1 to 5")
    rating_delivery_speed: int = Field(..., ge=1, le=5, description="Delivery speed score from 1 to 5")
    rating_driver_professionalism: int = Field(..., ge=1, le=5, description="Driver professionalism score from 1 to 5")
    comments: Optional[str] = Field(None, max_length=1000, description="Optional written review")

class RatingResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    customer_id: uuid.UUID
    driver_id: uuid.UUID
    water_source_id: uuid.UUID
    rating_water_quality: int
    rating_delivery_speed: int
    rating_driver_professionalism: int
    comments: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class RatingSummary(BaseModel):
    average_water_quality: float
    average_delivery_speed: float
    average_driver_professionalism: float
    overall_average: float
    total_ratings_count: int
    ratings: List[RatingResponse]

class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None

class RatingEnvelope(BaseEnvelope):
    data: RatingResponse

class RatingSummaryEnvelope(BaseEnvelope):
    data: RatingSummary
