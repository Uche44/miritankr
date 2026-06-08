import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.orders.models import Order
from app.modules.orders.schemas import OrderCreate


class OrderRepository:
    async def get_by_id(self, db: AsyncSession, order_id: uuid.UUID) -> Optional[Order]:
        """
        Retrieve a specific order by ID.
        """
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        return result.scalars().first()

    async def get_by_customer_id(self, db: AsyncSession, customer_id: uuid.UUID) -> List[Order]:
        """
        Retrieve all orders placed by a customer.
        """
        result = await db.execute(
            select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_driver_id(self, db: AsyncSession, driver_id: uuid.UUID) -> List[Order]:
        """
        Retrieve all orders assigned to (or requested from) a driver.
        """
        result = await db.execute(
            select(Order).where(Order.assigned_driver_id == driver_id).order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_pending_for_driver(self, db: AsyncSession, driver_id: uuid.UUID) -> List[Order]:
        """
        Retrieve all PENDING orders sent to a specific driver — their request inbox.
        """
        result = await db.execute(
            select(Order).where(
                Order.assigned_driver_id == driver_id,
                Order.status == "PENDING"
            ).order_by(Order.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_all(self, db: AsyncSession) -> List[Order]:
        """
        Retrieve all orders in the system (Admin view).
        """
        result = await db.execute(
            select(Order).order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_pending_all(self, db: AsyncSession) -> List[Order]:
        """
        Retrieve all PENDING orders in the system (Admin oversight view).
        """
        result = await db.execute(
            select(Order).where(Order.status == "PENDING").order_by(Order.created_at.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        db: AsyncSession,
        order_in: OrderCreate,
        customer_id: uuid.UUID,
        driver_id: uuid.UUID,
        tanker_id: uuid.UUID,
        source_id: Optional[uuid.UUID],
        calculated_price: float,
    ) -> Order:
        """
        Create a new order, immediately linked to the chosen driver and their tanker.
        Status starts as PENDING — driver must ACCEPT or REJECT.
        """
        db_order = Order(
            customer_id=customer_id,
            water_type=order_in.water_type.upper(),
            quantity_litres=order_in.quantity_litres,
            delivery_address=order_in.delivery_address,
            latitude=order_in.latitude,
            longitude=order_in.longitude,
            scheduled_at=order_in.scheduled_at,
            status="PENDING",
            price=calculated_price,
            assigned_driver_id=driver_id,
            assigned_tanker_id=tanker_id,
            source_id=source_id,
        )
        db.add(db_order)
        await db.flush()
        return db_order

    async def update_status(
        self,
        db: AsyncSession,
        order: Order,
        new_status: str,
    ) -> Order:
        """
        Transition the order to a new status.
        """
        order.status = new_status
        db.add(order)
        await db.flush()
        return order


order_repo = OrderRepository()
