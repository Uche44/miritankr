import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.ratings.models import Rating

class RatingsRepository:
    async def create(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        customer_id: uuid.UUID,
        driver_id: uuid.UUID,
        water_source_id: uuid.UUID,
        rating_water_quality: int,
        rating_delivery_speed: int,
        rating_driver_professionalism: int,
        comments: Optional[str] = None
    ) -> Rating:
        rating = Rating(
            order_id=order_id,
            customer_id=customer_id,
            driver_id=driver_id,
            water_source_id=water_source_id,
            rating_water_quality=rating_water_quality,
            rating_delivery_speed=rating_delivery_speed,
            rating_driver_professionalism=rating_driver_professionalism,
            comments=comments
        )
        db.add(rating)
        await db.flush()  # populate ID
        return rating

    async def get_by_id(self, db: AsyncSession, rating_id: uuid.UUID) -> Optional[Rating]:
        result = await db.execute(select(Rating).where(Rating.id == rating_id))
        return result.scalars().first()

    async def get_by_order_id(self, db: AsyncSession, order_id: uuid.UUID) -> Optional[Rating]:
        result = await db.execute(select(Rating).where(Rating.order_id == order_id))
        return result.scalars().first()

    async def get_by_driver_id(self, db: AsyncSession, driver_id: uuid.UUID) -> List[Rating]:
        result = await db.execute(
            select(Rating)
            .where(Rating.driver_id == driver_id)
            .order_by(Rating.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_water_source_id(self, db: AsyncSession, water_source_id: uuid.UUID) -> List[Rating]:
        result = await db.execute(
            select(Rating)
            .where(Rating.water_source_id == water_source_id)
            .order_by(Rating.created_at.desc())
        )
        return list(result.scalars().all())

ratings_repo = RatingsRepository()
