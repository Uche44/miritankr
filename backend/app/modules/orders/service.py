import uuid
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.orders.models import Order
from app.modules.orders.schemas import OrderCreate, OrderStatusUpdate
from app.modules.orders.repository import order_repo
from app.modules.auth.models import User

# ---------------------------------------------------------------------------
# Status transition rules
# ---------------------------------------------------------------------------
# Maps current_status -> set of statuses the DRIVER is allowed to move to.
# PENDING is the only state where ACCEPT/REJECT applies.
DRIVER_TRANSITIONS: dict[str, set[str]] = {
    "PENDING":         {"ACCEPTED", "REJECTED"},
    "ACCEPTED":        {"GOING_TO_SOURCE", "CANCELLED"},
    "GOING_TO_SOURCE": {"LOADING_WATER",   "CANCELLED"},
    "LOADING_WATER":   {"EN_ROUTE",        "CANCELLED"},
    "EN_ROUTE":        {"ARRIVED",         "CANCELLED"},
    "ARRIVED":         {"DELIVERED"},
    # Terminal states — no further transitions
    "DELIVERED":       set(),
    "REJECTED":        set(),
    "CANCELLED":       set(),
}


class OrderService:
    # -----------------------------------------------------------------------
    # Pricing
    # -----------------------------------------------------------------------
    def calculate_price(self, water_type: str, quantity_litres: int) -> float:
        """
        DRINKING: NGN 2.5 per litre
        UTILITY:  NGN 1.5 per litre
        """
        rate = 2.5 if water_type.upper() == "DRINKING" else 1.5
        return float(quantity_litres * rate)

    # -----------------------------------------------------------------------
    # Order placement
    # -----------------------------------------------------------------------
    async def create_order(
        self,
        db: AsyncSession,
        order_in: OrderCreate,
        current_user: User,
    ) -> Order:
        """
        Customer places an order directed at a specific driver.

        Flow:
        1. Validate the target user is a DRIVER.
        2. Validate the driver has an ACTIVE registered tanker.
        3. For DRINKING orders, validate the tanker's default source is VERIFIED.
        4. Create the order (PENDING) with the driver + tanker pre-assigned.
        5. The driver must then ACCEPT or REJECT it.
        """
        if current_user.role != "CUSTOMER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Customers can place orders.",
            )

        from app.modules.auth.models import User as UserModel
        from app.modules.tankers.models import Tanker
        from app.modules.water_sources.models import WaterSource
        from app.modules.tankers.repository import tanker_repo

        # 1. Validate driver
        driver_result = await db.execute(
            select(UserModel).where(
                UserModel.id == order_in.driver_id,
                UserModel.role == "DRIVER",
            )
        )
        driver = driver_result.scalars().first()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The selected driver was not found or is not registered as a DRIVER.",
            )

        # 2. Validate the driver has an ACTIVE tanker
        tanker = await tanker_repo.get_by_owner_id(db, order_in.driver_id)
        if not tanker or tanker.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The selected driver does not have an active tanker available.",
            )

        # 3. For DRINKING orders, check the tanker's default source is verified
        source_id = tanker.default_source_id
        if order_in.water_type == "DRINKING":
            if not source_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="This driver's tanker has no default water source configured. Cannot fulfil DRINKING orders.",
                )
            source_result = await db.execute(
                select(WaterSource).where(WaterSource.id == source_id)
            )
            source = source_result.scalars().first()
            if not source or source.verification_status != "VERIFIED":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="DRINKING water orders require a driver whose default water source is VERIFIED.",
                )

        price = self.calculate_price(order_in.water_type, order_in.quantity_litres)
        db_order = await order_repo.create(
            db,
            order_in=order_in,
            customer_id=current_user.id,
            driver_id=order_in.driver_id,
            tanker_id=tanker.id,
            source_id=source_id,
            calculated_price=price,
        )

        # Append ORDER_CREATED tracking event (immutable audit trail)
        from app.modules.tracking.service import tracking_service
        await tracking_service.append_event(
            db,
            order_id=db_order.id,
            event_type="ORDER_CREATED",
            actor_id=current_user.id,
            metadata={
                "water_type": db_order.water_type,
                "quantity_litres": db_order.quantity_litres,
                "delivery_address": db_order.delivery_address,
            },
        )

        await db.commit()
        return db_order

    # -----------------------------------------------------------------------
    # Order queries
    # -----------------------------------------------------------------------
    async def get_order_by_id(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        current_user: User,
    ) -> Order:
        """
        Retrieve order details.
        Access: placing Customer, assigned Driver, or Admin.
        """
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        is_authorized = (
            current_user.id == order.customer_id
            or current_user.id == order.assigned_driver_id
            or current_user.role == "ADMIN"
        )
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view this order.",
            )
        return order

    async def list_orders(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> List[Order]:
        """
        Role-based order list:
        - CUSTOMER: orders they placed.
        - DRIVER: all orders directed at them (all statuses).
        - ADMIN: every order in the system.
        """
        if current_user.role == "ADMIN":
            return await order_repo.get_all(db)
        elif current_user.role == "CUSTOMER":
            return await order_repo.get_by_customer_id(db, current_user.id)
        elif current_user.role == "DRIVER":
            return await order_repo.get_by_driver_id(db, current_user.id)
        return []

    async def list_pending_orders(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> List[Order]:
        """
        Pending orders queue.
        - DRIVER: their own PENDING requests (inbox — orders awaiting their accept/reject).
        - ADMIN: all PENDING orders across the system.
        """
        if current_user.role == "DRIVER":
            return await order_repo.get_pending_for_driver(db, current_user.id)
        elif current_user.role == "ADMIN":
            return await order_repo.get_pending_all(db)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    # -----------------------------------------------------------------------
    # Status transitions
    # -----------------------------------------------------------------------
    async def update_order_status(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        update_in: OrderStatusUpdate,
        current_user: User,
    ) -> Order:
        """
        Advance or cancel the order status.

        DRIVER (for their assigned order):
          PENDING  → ACCEPTED  (driver agrees to fulfil)
          PENDING  → REJECTED  (driver turns it down)
          ACCEPTED → GOING_TO_SOURCE → LOADING_WATER → EN_ROUTE → ARRIVED → DELIVERED
          Any non-terminal state → CANCELLED

        CUSTOMER (for their own order):
          PENDING → CANCELLED only

        ADMIN:
          → CANCELLED on any non-terminal order
        """
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        new_status = update_in.status.upper()
        current_status = order.status

        if current_user.role == "DRIVER":
            if current_user.id != order.assigned_driver_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only update orders assigned to you.",
                )
            allowed_next = DRIVER_TRANSITIONS.get(current_status, set())
            if new_status not in allowed_next:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Cannot transition from '{current_status}' to '{new_status}'. "
                        f"Allowed next statuses: {sorted(allowed_next)}."
                    ),
                )

        elif current_user.role == "CUSTOMER":
            if current_user.id != order.customer_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only cancel your own orders.",
                )
            if new_status != "CANCELLED" or current_status != "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Customers can only cancel their own PENDING orders.",
                )

        elif current_user.role == "ADMIN":
            if new_status != "CANCELLED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins can only cancel orders via this endpoint.",
                )
            if current_status in {"DELIVERED", "REJECTED", "CANCELLED"}:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Order is already in a terminal state: '{current_status}'.",
                )

        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update order status.",
            )

        updated_order = await order_repo.update_status(db, order, new_status)

        # Append tracking event for this status transition
        from app.modules.tracking.service import tracking_service
        await tracking_service.append_for_status_change(
            db,
            order_id=updated_order.id,
            new_status=new_status,
            actor_id=current_user.id,
        )

        await db.commit()
        await db.refresh(updated_order)
        return updated_order


order_service = OrderService()
