import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Float, ForeignKey, JSON, func
from app.core.database import Base


class TrackingEvent(Base):
    """
    Immutable, append-only record of every significant event in an order's lifecycle.
    Events are NEVER updated or deleted — they form the water provenance audit trail.
    """
    __tablename__ = "tracking_events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        # Allowed: ORDER_CREATED, ORDER_ACCEPTED, ORDER_REJECTED,
        #          GOING_TO_SOURCE, WATER_LOADED, EN_ROUTE,
        #          ARRIVED, DELIVERED, CANCELLED
    )
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    latitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,   # Driver's GPS coordinates at time of event
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    event_metadata: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,   # Extensible: source name, load volume, notes, etc.
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
        # No onupdate — events are write-once
    )

    # Relationships (read-only helpers)
    order = relationship("Order", foreign_keys=[order_id])
    actor = relationship("User", foreign_keys=[actor_id])
