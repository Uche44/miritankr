import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, ForeignKey, Numeric, func
from app.core.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4, 
        index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id"),
        nullable=False
    )
    reference: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False  # PENDING, SUCCESSFUL, FAILED
    )
    provider: Mapped[str] = mapped_column(
        String(100),
        default="Paystack Mock",
        nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )

    # Relationships
    order = relationship("Order", foreign_keys=[order_id], back_populates="payments")

# Inject relationship back to Order model to enable access from Order instances
from app.modules.orders.models import Order
Order.payments = relationship("Payment", foreign_keys=[Payment.order_id], back_populates="order", cascade="all, delete-orphan")
