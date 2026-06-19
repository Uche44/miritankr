import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.payments.models import Payment

class PaymentRepository:
    async def get_by_id(
        self,
        db: AsyncSession,
        payment_id: uuid.UUID
    ) -> Optional[Payment]:
        result = await db.execute(
            select(Payment).where(Payment.id == payment_id)
        )
        return result.scalars().first()

    async def get_by_reference(
        self,
        db: AsyncSession,
        reference: str
    ) -> Optional[Payment]:
        result = await db.execute(
            select(Payment).where(Payment.reference == reference)
        )
        return result.scalars().first()

    async def get_by_order_id(
        self,
        db: AsyncSession,
        order_id: uuid.UUID
    ) -> Optional[Payment]:
        result = await db.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        return result.scalars().first()

    async def create(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        amount: float,
        reference: str,
        provider: str = "Paystack Mock"
    ) -> Payment:
        db_payment = Payment(
            order_id=order_id,
            amount=amount,
            reference=reference,
            provider=provider,
            status="PENDING"
        )
        db.add(db_payment)
        await db.flush()
        return db_payment

    async def update_status(
        self,
        db: AsyncSession,
        payment: Payment,
        status: str
    ) -> Payment:
        payment.status = status
        db.add(payment)
        await db.flush()
        return payment

payment_repo = PaymentRepository()
