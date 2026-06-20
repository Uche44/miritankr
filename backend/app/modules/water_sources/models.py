import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Float, ForeignKey, func, Text
from app.core.database import Base, SoftDeleteMixin

class WaterSource(Base, SoftDeleteMixin):
    __tablename__ = "water_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False  # BOREHOLE, TREATMENT_PLANT, RESERVOIR, GOVERNMENT_FACILITY, COMMERCIAL_VENDOR
    )
    verification_status: Mapped[str] = mapped_column(
        String(50), 
        default="PENDING", 
        nullable=False  # PENDING, VERIFIED, SUSPENDED, REJECTED
    )
    price_per_litre: Mapped[float] = mapped_column(
        Float,
        default=2.0,
        server_default="2.0",
        nullable=False
    )
    quality_grade: Mapped[Optional[str]] = mapped_column(
        String(5), 
        nullable=True   # A, B, C, D
    )
    address: Mapped[str] = mapped_column(
        Text, 
        nullable=False
    )
    latitude: Mapped[float] = mapped_column(
        Float, 
        nullable=False
    )
    longitude: Mapped[float] = mapped_column(
        Float, 
        nullable=False
    )
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id"), 
        nullable=True
    )
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(), 
        nullable=False
    )

    # Optional relationship to Owner (User model)
    owner = relationship("User", foreign_keys=[owner_id])
