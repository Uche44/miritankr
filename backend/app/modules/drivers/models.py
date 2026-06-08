import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Float, ForeignKey, func
from app.core.database import Base

class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), 
        primary_key=True, 
        nullable=False
    )
    tanker_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("tankers.id"), 
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), 
        default="OFFLINE", 
        nullable=False  # AVAILABLE, OFFLINE, BUSY
    )
    latitude: Mapped[Optional[float]] = mapped_column(
        Float, 
        nullable=True
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Float, 
        nullable=True
    )
    last_location_update: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(), 
        nullable=False
    )

    # Relationships
    user = relationship("User", foreign_keys=[id])
    tanker = relationship("Tanker", foreign_keys=[tanker_id])
