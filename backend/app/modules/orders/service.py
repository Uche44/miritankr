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

        # Get water source coordinates and price per litre
        source_lat, source_lng = 6.4253, 7.4042 # default to 9th mile
        price_per_litre = None
        
        if source_id:
            source_result = await db.execute(
                select(WaterSource).where(WaterSource.id == source_id)
            )
            source = source_result.scalars().first()
            if source:
                source_lat = source.latitude
                source_lng = source.longitude
                price_per_litre = source.price_per_litre

        if price_per_litre is None:
            price_per_litre = 2.5 if order_in.water_type == "DRINKING" else 1.5

        # Get driver coordinates
        from app.modules.drivers.models import Driver as DriverModel
        driver_model_result = await db.execute(
            select(DriverModel).where(DriverModel.id == order_in.driver_id)
        )
        driver_rec = driver_model_result.scalars().first()
        driver_lat = driver_rec.latitude if (driver_rec and driver_rec.latitude is not None) else 6.44
        driver_lng = driver_rec.longitude if (driver_rec and driver_rec.longitude is not None) else 7.50

        # Calculate distances using Haversine formula
        import math
        def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
            R = 6371.0 # Earth radius in km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        dist_driver_to_depot = calculate_haversine(driver_lat, driver_lng, source_lat, source_lng)
        dist_depot_to_customer = calculate_haversine(source_lat, source_lng, order_in.latitude, order_in.longitude)
        distance_km = dist_driver_to_depot + dist_depot_to_customer

        water_cost = float(order_in.quantity_litres * price_per_litre)
        transit_cost = float(500.0 + distance_km * 50.0)
        price = water_cost + transit_cost

        db_order = await order_repo.create(
            db,
            order_in=order_in,
            customer_id=current_user.id,
            driver_id=order_in.driver_id,
            tanker_id=tanker.id,
            source_id=source_id,
            calculated_price=price,
            water_cost=water_cost,
            transit_cost=transit_cost,
            distance_km=distance_km,
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

        # Auto-initialize pending payment record
        from app.modules.payments.repository import payment_repo
        reference = f"pay_mock_{uuid.uuid4().hex}"
        await payment_repo.create(
            db=db,
            order_id=db_order.id,
            amount=price,
            reference=reference
        )

        # Create notification for Driver
        from app.modules.notifications.service import notification_service
        customer_name = f"{current_user.first_name} {current_user.last_name}"
        await notification_service.create_notification(
            db=db,
            user_id=order_in.driver_id,
            order_id=db_order.id,
            title="New Order Request",
            message=f"You have received a new water order from {customer_name} for {db_order.quantity_litres}L.",
            notification_type="ORDER_CREATED"
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
            
            pass

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

        # Trigger notification based on status transitions
        from app.modules.notifications.service import notification_service
        actor_name = current_user.first_name

        if new_status == "ACCEPTED":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Order Accepted",
                message=f"Your order has been accepted by driver {actor_name}.",
                notification_type="ORDER_ACCEPTED"
            )
        elif new_status == "REJECTED":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Order Declined",
                message=f"Driver {actor_name} has declined your order request.",
                notification_type="ORDER_REJECTED"
            )
        elif new_status == "GOING_TO_SOURCE":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Driver Dispatched",
                message=f"Driver {actor_name} is now heading to the water source depot.",
                notification_type="ORDER_DISPATCHED"
            )
        elif new_status == "LOADING_WATER":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Loading Water",
                message=f"Driver {actor_name} is filling the tanker at the depot.",
                notification_type="ORDER_FILLED"
            )
        elif new_status == "EN_ROUTE":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Order En Route",
                message=f"Driver {actor_name} is en route to your delivery address.",
                notification_type="ORDER_EN_ROUTE"
            )
        elif new_status == "ARRIVED":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Driver Arrived",
                message=f"Driver {actor_name} has arrived at your address.",
                notification_type="ORDER_ARRIVED"
            )
        elif new_status == "DELIVERED":
            await notification_service.create_notification(
                db=db,
                user_id=updated_order.customer_id,
                order_id=updated_order.id,
                title="Order Delivered",
                message="Your water delivery is complete. Please review and process payment.",
                notification_type="ORDER_DELIVERED"
            )
        elif new_status == "CANCELLED":
            if current_user.role == "CUSTOMER":
                await notification_service.create_notification(
                    db=db,
                    user_id=updated_order.assigned_driver_id,
                    order_id=updated_order.id,
                    title="Order Cancelled",
                    message=f"The order has been cancelled by customer {actor_name}.",
                    notification_type="ORDER_CANCELLED"
                )
            elif current_user.role == "DRIVER":
                await notification_service.create_notification(
                    db=db,
                    user_id=updated_order.customer_id,
                    order_id=updated_order.id,
                    title="Order Cancelled",
                    message=f"Your order has been cancelled by driver {actor_name}.",
                    notification_type="ORDER_CANCELLED"
                )
            elif current_user.role == "ADMIN":
                await notification_service.create_notification(
                    db=db,
                    user_id=updated_order.customer_id,
                    order_id=updated_order.id,
                    title="Order Cancelled by Admin",
                    message="Your order was cancelled by the administrator.",
                    notification_type="ORDER_CANCELLED"
                )
                if updated_order.assigned_driver_id:
                    await notification_service.create_notification(
                        db=db,
                        user_id=updated_order.assigned_driver_id,
                        order_id=updated_order.id,
                        title="Order Cancelled by Admin",
                        message="The order was cancelled by the administrator.",
                        notification_type="ORDER_CANCELLED"
                    )

        await db.commit()
        await db.refresh(updated_order)

        # Broadcast status change to WebSocket tracking connections
        from app.modules.tracking.websocket import manager
        await manager.broadcast_to_order(
            str(updated_order.id),
            {
                "event": "ORDER_STATUS_CHANGED",
                "data": {
                    "order_id": str(updated_order.id),
                    "status": new_status,
                }
            }
        )

        # Manage Telemetry Simulation Background Tasks
        from app.modules.tracking.simulation import start_simulation, stop_simulation
        from app.modules.drivers.models import Driver
        from app.modules.water_sources.models import WaterSource

        if new_status == "GOING_TO_SOURCE":
            # 1. Fetch driver starting coordinates
            driver_result = await db.execute(
                select(Driver).where(Driver.id == updated_order.assigned_driver_id)
            )
            driver = driver_result.scalars().first()
            driver_lat = driver.latitude if (driver and driver.latitude is not None) else 6.44
            driver_lng = driver.longitude if (driver and driver.longitude is not None) else 7.50

            # 2. Fetch water source coordinates
            source_lat, source_lng = 6.4253, 7.4042 # default to 9th mile
            if updated_order.source_id:
                src_result = await db.execute(
                    select(WaterSource).where(WaterSource.id == updated_order.source_id)
                )
                source = src_result.scalars().first()
                if source:
                    source_lat = source.latitude
                    source_lng = source.longitude

            # 3. Start simulation
            start_simulation(
                order_id=updated_order.id,
                start_lat=driver_lat,
                start_lng=driver_lng,
                target_lat=source_lat,
                target_lng=source_lng,
                driver_id=updated_order.assigned_driver_id,
            )

        elif new_status == "EN_ROUTE":
            # 1. Start coordinates are the Water Source coordinates
            source_lat, source_lng = 6.4253, 7.4042 # default
            if updated_order.source_id:
                src_result = await db.execute(
                    select(WaterSource).where(WaterSource.id == updated_order.source_id)
                )
                source = src_result.scalars().first()
                if source:
                    source_lat = source.latitude
                    source_lng = source.longitude

            # 2. Target coordinates are the Customer coordinates
            customer_lat = updated_order.latitude
            customer_lng = updated_order.longitude

            # 3. Start simulation
            start_simulation(
                order_id=updated_order.id,
                start_lat=source_lat,
                start_lng=source_lng,
                target_lat=customer_lat,
                target_lng=customer_lng,
                driver_id=updated_order.assigned_driver_id,
            )

        elif new_status in ["DELIVERED", "ARRIVED", "CANCELLED", "REJECTED"]:
            stop_simulation(updated_order.id)

        return updated_order


order_service = OrderService()
