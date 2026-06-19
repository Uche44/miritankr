import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user
from app.modules.ratings.schemas import (
    RatingCreate,
    RatingEnvelope,
    RatingSummaryEnvelope,
)
from app.modules.ratings.service import ratings_service

router = APIRouter()

@router.post(
    "/orders/{order_id}/rating",
    response_model=RatingEnvelope,
    status_code=status.HTTP_201_CREATED,
    tags=["Ratings"],
)
async def submit_rating(
    order_id: uuid.UUID,
    payload: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a customer rating and review for a completed order.

    Grades:
    - **rating_water_quality**: 1-5
    - **rating_delivery_speed**: 1-5
    - **rating_driver_professionalism**: 1-5
    - **comments**: text review up to 1000 characters.

    Only the placing Customer is allowed to submit a rating, and only once the order is `DELIVERED`.
    """
    rating = await ratings_service.submit_rating(db, order_id, current_user, payload)
    return RatingEnvelope(
        success=True,
        message="Rating submitted successfully",
        data=rating
    )

@router.get(
    "/orders/{order_id}/rating",
    response_model=RatingEnvelope,
    tags=["Ratings"],
)
async def get_rating_for_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the rating details submitted for a specific order.

    Access: Customer who placed it, assigned Driver, or Admin.
    """
    rating = await ratings_service.get_rating_for_order(db, order_id, current_user)
    return RatingEnvelope(
        success=True,
        message="Order rating retrieved successfully",
        data=rating
    )

@router.get(
    "/drivers/{driver_id}/ratings",
    response_model=RatingSummaryEnvelope,
    tags=["Ratings"],
)
async def get_driver_ratings_summary(
    driver_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all ratings and overall average scores for a driver operator.
    """
    summary = await ratings_service.get_driver_ratings_summary(db, driver_id)
    return RatingSummaryEnvelope(
        success=True,
        message="Driver ratings summary retrieved successfully",
        data=summary
    )

@router.get(
    "/water-sources/{source_id}/ratings",
    response_model=RatingSummaryEnvelope,
    tags=["Ratings"],
)
async def get_water_source_ratings_summary(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all ratings and water quality average scores for a specific water source.
    """
    summary = await ratings_service.get_water_source_ratings_summary(db, source_id)
    return RatingSummaryEnvelope(
        success=True,
        message="Water source ratings summary retrieved successfully",
        data=summary
    )
