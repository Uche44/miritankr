import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, ForeignKey, Integer, func
from app.core.database import Base

class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id"),
        unique=True,  # Ensure one rating per order
        nullable=False,
        index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    water_source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("water_sources.id"),
        nullable=False,
        index=True
    )
    rating_water_quality: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    rating_delivery_speed: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    rating_driver_professionalism: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    comments: Mapped[str] = mapped_column(
        String(1000),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )

    # Relationships
    order = relationship("Order", foreign_keys=[order_id], back_populates="rating")
    customer = relationship("User", foreign_keys=[customer_id])
    driver = relationship("User", foreign_keys=[driver_id])
    water_source = relationship("WaterSource", foreign_keys=[water_source_id])

# Inject relationship back to Order model to enable access from Order instances
from app.modules.orders.models import Order
Order.rating = relationship("Rating", foreign_keys=[Rating.order_id], back_populates="order", uselist=False, cascade="all, delete-orphan")
