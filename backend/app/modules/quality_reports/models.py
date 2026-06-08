import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Float, ForeignKey
from app.core.database import Base

class WaterQualityReport(Base):
    __tablename__ = "water_quality_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("water_sources.id"),
        nullable=False
    )
    tested_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )
    ph: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    tds: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    turbidity: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    grade: Mapped[str] = mapped_column(
        String(5),
        nullable=False
    )
    inspector_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    source = relationship("WaterSource", foreign_keys=[source_id])
    inspector = relationship("User", foreign_keys=[inspector_id])
