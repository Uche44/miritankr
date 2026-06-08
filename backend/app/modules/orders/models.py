import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Integer, ForeignKey, Numeric, func
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), 
        nullable=False
    )
    water_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False  # DRINKING, UTILITY
    )
    quantity_litres: Mapped[int] = mapped_column(
        Integer, 
        nullable=False
    )
    delivery_address: Mapped[str] = mapped_column(
        String(500), 
        nullable=False
    )
    latitude: Mapped[float] = mapped_column(
        Numeric(10, 6), 
        nullable=False
    )
    longitude: Mapped[float] = mapped_column(
        Numeric(10, 6), 
        nullable=False
    )
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), 
        default="PENDING", 
        nullable=False  # PENDING, ACCEPTED, GOING_TO_SOURCE, LOADING_WATER, EN_ROUTE, ARRIVED, DELIVERED, CANCELLED
    )
    assigned_tanker_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("tankers.id"), 
        nullable=True
    )
    assigned_driver_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id"), 
        nullable=True
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("water_sources.id"), 
        nullable=True
    )
    price: Mapped[float] = mapped_column(
        Numeric(12, 2), 
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

    # Relationships
    customer = relationship("User", foreign_keys=[customer_id], back_populates="orders_placed")
    assigned_driver = relationship("User", foreign_keys=[assigned_driver_id])
    assigned_tanker = relationship("Tanker", foreign_keys=[assigned_tanker_id])
    source = relationship("WaterSource", foreign_keys=[source_id])

# Inject relationship back to User
from app.modules.auth.models import User
User.orders_placed = relationship("Order", foreign_keys=[Order.customer_id], back_populates="customer")
