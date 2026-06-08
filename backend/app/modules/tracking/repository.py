import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.tracking.models import TrackingEvent


class TrackingRepository:
    async def create(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        event_type: str,
        actor_id: Optional[uuid.UUID] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        metadata: Optional[dict] = None,
    ) -> TrackingEvent:
        """
        Append a new immutable tracking event.
        This is a write-once operation — never call update on these records.
        """
        event = TrackingEvent(
            order_id=order_id,
            event_type=event_type,
            actor_id=actor_id,
            latitude=latitude,
            longitude=longitude,
            event_metadata=metadata,
        )
        db.add(event)
        await db.flush()
        return event

    async def get_by_order(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
    ) -> List[TrackingEvent]:
        """
        Return all tracking events for an order, oldest-first.
        This is the complete, chronological delivery reconstruction.
        """
        result = await db.execute(
            select(TrackingEvent)
            .where(TrackingEvent.order_id == order_id)
            .order_by(TrackingEvent.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_latest(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
    ) -> Optional[TrackingEvent]:
        """
        Return the most recent event for an order (for live tracking state).
        """
        result = await db.execute(
            select(TrackingEvent)
            .where(TrackingEvent.order_id == order_id)
            .order_by(TrackingEvent.created_at.desc())
            .limit(1)
        )
        return result.scalars().first()


tracking_repo = TrackingRepository()
