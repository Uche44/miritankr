import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.tracking.models import TrackingEvent
from app.modules.tracking.repository import tracking_repo
from app.modules.tracking.schemas import (
    TrackingEventResponse,
    LiveTrackingResponse,
    DriverLocationSnapshot,
    SourceLocationSnapshot,
)
from app.modules.auth.models import User

# ---------------------------------------------------------------------------
# Order status → tracking event type mapping
# ---------------------------------------------------------------------------
STATUS_TO_EVENT: dict[str, str] = {
    "ACCEPTED":        "ORDER_ACCEPTED",
    "REJECTED":        "ORDER_REJECTED",
    "GOING_TO_SOURCE": "GOING_TO_SOURCE",
    "LOADING_WATER":   "WATER_LOADED",
    "EN_ROUTE":        "EN_ROUTE",
    "ARRIVED":         "ARRIVED",
    "DELIVERED":       "DELIVERED",
    "CANCELLED":       "CANCELLED",
}


class TrackingService:
    # -----------------------------------------------------------------------
    # Internal: append event (called by orders service hooks)
    # -----------------------------------------------------------------------
    async def append_event(
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
        Write one immutable tracking event.
        Called automatically by the orders service on every status change.
        Never call this directly from a route handler.
        """
        event = await tracking_repo.create(
            db,
            order_id=order_id,
            event_type=event_type,
            actor_id=actor_id,
            latitude=latitude,
            longitude=longitude,
            metadata=metadata,
        )
        return event

    async def append_for_status_change(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        new_status: str,
        actor_id: Optional[uuid.UUID],
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Optional[TrackingEvent]:
        """
        Translate an order status into a tracking event and append it.
        Returns None for statuses that have no event mapping.
        """
        event_type = STATUS_TO_EVENT.get(new_status)
        if not event_type:
            return None
        return await self.append_event(
            db,
            order_id=order_id,
            event_type=event_type,
            actor_id=actor_id,
            latitude=latitude,
            longitude=longitude,
        )

    # -----------------------------------------------------------------------
    # Queries (called from router)
    # -----------------------------------------------------------------------
    def _check_access(self, order, current_user: User) -> None:
        """Raise 403 if the current user has no business viewing this order's tracking."""
        is_authorized = (
            current_user.id == order.customer_id
            or current_user.id == order.assigned_driver_id
            or current_user.role == "ADMIN"
        )
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view this order's tracking.",
            )

    async def get_timeline(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User,
    ) -> List[TrackingEvent]:
        """
        Return the full immutable event log for an order (oldest-first).
        Access: placing Customer, assigned Driver, or Admin.
        """
        from app.modules.orders.repository import order_repo
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        self._check_access(order, current_user)
        return await tracking_repo.get_by_order(db, order_id)

    async def get_live_tracking(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User,
    ) -> LiveTrackingResponse:
        """
        Return a full live tracking snapshot:
        - Driver's last known GPS position
        - Water source details
        - Current order status
        - Full event timeline

        Access: placing Customer, assigned Driver, or Admin.
        """
        from app.modules.orders.repository import order_repo
        from app.modules.water_sources.models import WaterSource

        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        self._check_access(order, current_user)

        timeline = await tracking_repo.get_by_order(db, order_id)

        # Find last event with GPS coordinates for live driver location
        driver_location = DriverLocationSnapshot()
        for event in reversed(timeline):
            if event.latitude is not None and event.longitude is not None:
                driver_location = DriverLocationSnapshot(
                    latitude=event.latitude,
                    longitude=event.longitude,
                    last_updated_at=event.created_at,
                )
                break

        # Resolve water source details
        source_location = SourceLocationSnapshot()
        if order.source_id:
            src_result = await db.execute(
                select(WaterSource).where(WaterSource.id == order.source_id)
            )
            source = src_result.scalars().first()
            if source:
                source_location = SourceLocationSnapshot(
                    id=source.id,
                    name=source.name,
                    address=source.address,
                    latitude=source.latitude,
                    longitude=source.longitude,
                    verification_status=source.verification_status,
                    quality_grade=source.quality_grade,
                )

        # Convert ORM events to response schema
        timeline_responses = [
            TrackingEventResponse(
                id=e.id,
                order_id=e.order_id,
                event_type=e.event_type,
                actor_id=e.actor_id,
                latitude=e.latitude,
                longitude=e.longitude,
                event_metadata=e.event_metadata,
                created_at=e.created_at,
            )
            for e in timeline
        ]

        return LiveTrackingResponse(
            order_id=order.id,
            order_status=order.status,
            driver_location=driver_location,
            source_location=source_location,
            estimated_arrival_minutes=None,  # stub — integrate routing API later
            timeline=timeline_responses,
        )


tracking_service = TrackingService()
