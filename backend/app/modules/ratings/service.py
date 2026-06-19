import uuid
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ratings.repository import ratings_repo
from app.modules.ratings.schemas import RatingCreate, RatingSummary, RatingResponse
from app.modules.orders.repository import order_repo
from app.modules.auth.models import User
from app.modules.ratings.models import Rating

class RatingsService:
    async def submit_rating(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User,
        payload: RatingCreate
    ) -> Rating:
        # 1. Fetch order
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found."
            )

        # 2. Check access - only the customer who placed the order can rate it
        if order.customer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only the customer who placed the order can submit a rating."
            )

        # 3. Check order status - must be DELIVERED
        if order.status != "DELIVERED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rate an order that is not delivered."
            )

        # 4. Check for duplicate ratings
        existing_rating = await ratings_repo.get_by_order_id(db, order_id)
        if existing_rating:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order has already been rated."
            )

        # 5. Extract driver and water source from order
        driver_id = order.assigned_driver_id
        water_source_id = order.source_id

        if not driver_id or not water_source_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rate order: missing assigned driver or water source details."
            )

        # 6. Persist rating
        rating = await ratings_repo.create(
            db=db,
            order_id=order_id,
            customer_id=current_user.id,
            driver_id=driver_id,
            water_source_id=water_source_id,
            rating_water_quality=payload.rating_water_quality,
            rating_delivery_speed=payload.rating_delivery_speed,
            rating_driver_professionalism=payload.rating_driver_professionalism,
            comments=payload.comments
        )
        return rating

    async def get_rating_for_order(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User
    ) -> Rating:
        # Fetch order
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found."
            )

        # Check access: Customer, Driver, or Admin
        is_authorized = (
            current_user.id == order.customer_id
            or current_user.id == order.assigned_driver_id
            or current_user.role == "ADMIN"
        )
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view this order's rating."
            )

        rating = await ratings_repo.get_by_order_id(db, order_id)
        if not rating:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rating not found for this order."
            )
        return rating

    async def get_driver_ratings_summary(
        self,
        db: AsyncSession,
        driver_id: uuid.UUID
    ) -> RatingSummary:
        ratings = await ratings_repo.get_by_driver_id(db, driver_id)
        count = len(ratings)
        
        if count == 0:
            return RatingSummary(
                average_water_quality=0.0,
                average_delivery_speed=0.0,
                average_driver_professionalism=0.0,
                overall_average=0.0,
                total_ratings_count=0,
                ratings=[]
            )

        sum_quality = sum(r.rating_water_quality for r in ratings)
        sum_speed = sum(r.rating_delivery_speed for r in ratings)
        sum_prof = sum(r.rating_driver_professionalism for r in ratings)

        avg_quality = round(sum_quality / count, 2)
        avg_speed = round(sum_speed / count, 2)
        avg_prof = round(sum_prof / count, 2)

        # Overall average calculation (average of the three dimensions)
        overall_avg = round((avg_quality + avg_speed + avg_prof) / 3, 2)

        return RatingSummary(
            average_water_quality=avg_quality,
            average_delivery_speed=avg_speed,
            average_driver_professionalism=avg_prof,
            overall_average=overall_avg,
            total_ratings_count=count,
            ratings=[RatingResponse.from_orm(r) for r in ratings]
        )

    async def get_water_source_ratings_summary(
        self,
        db: AsyncSession,
        water_source_id: uuid.UUID
    ) -> RatingSummary:
        ratings = await ratings_repo.get_by_water_source_id(db, water_source_id)
        count = len(ratings)

        if count == 0:
            return RatingSummary(
                average_water_quality=0.0,
                average_delivery_speed=0.0,
                average_driver_professionalism=0.0,
                overall_average=0.0,
                total_ratings_count=0,
                ratings=[]
            )

        sum_quality = sum(r.rating_water_quality for r in ratings)
        sum_speed = sum(r.rating_delivery_speed for r in ratings)
        sum_prof = sum(r.rating_driver_professionalism for r in ratings)

        avg_quality = round(sum_quality / count, 2)
        avg_speed = round(sum_speed / count, 2)
        avg_prof = round(sum_prof / count, 2)
        overall_avg = round((avg_quality + avg_speed + avg_prof) / 3, 2)

        return RatingSummary(
            average_water_quality=avg_quality,
            average_delivery_speed=avg_speed,
            average_driver_professionalism=avg_prof,
            overall_average=overall_avg,
            total_ratings_count=count,
            ratings=[RatingResponse.from_orm(r) for r in ratings]
        )

ratings_service = RatingsService()
