import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Integer, ForeignKey, func
from app.core.database import Base, SoftDeleteMixin

class Tanker(Base, SoftDeleteMixin):
    __tablename__ = "tankers"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), 
        nullable=False
    )
    plate_number: Mapped[str] = mapped_column(
        String(50), 
        unique=True, 
        nullable=False
    )
    capacity_litres: Mapped[int] = mapped_column(
        Integer, 
        nullable=False
    )
    default_source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("water_sources.id"), 
        nullable=True
    )
    license_documents: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    tanker_image: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), 
        default="PENDING", 
        nullable=False  # PENDING, ACTIVE, OUT_OF_SERVICE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=func.now(), 
        nullable=False
    )

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    default_source = relationship("WaterSource", foreign_keys=[default_source_id])
