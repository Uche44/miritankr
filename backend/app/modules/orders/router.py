import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user, RoleChecker
from app.modules.orders.schemas import (
    OrderCreate,
    OrderStatusUpdate,
    OrderResponse,
    OrderRegistrationEnvelope,
    OrderRegistrationData,
    OrderEnvelope,
    OrderListEnvelope,
    OrderStatusEnvelope,
)
from app.modules.orders.service import order_service

router = APIRouter()


def _order_to_response(o) -> OrderResponse:
    """Convert an Order ORM object to OrderResponse schema."""
    return OrderResponse(
        id=o.id,
        customer_id=o.customer_id,
        water_type=o.water_type,
        quantity_litres=o.quantity_litres,
        delivery_address=o.delivery_address,
        latitude=float(o.latitude),
        longitude=float(o.longitude),
        scheduled_at=o.scheduled_at,
        status=o.status,
        assigned_tanker_id=o.assigned_tanker_id,
        assigned_driver_id=o.assigned_driver_id,
        source_id=o.source_id,
        price=float(o.price),
        created_at=o.created_at,
        updated_at=o.updated_at,
    )


# ---------------------------------------------------------------------------
# Order Placement
# ---------------------------------------------------------------------------

@router.post("/orders", response_model=OrderRegistrationEnvelope, status_code=201, tags=["Orders"])
async def place_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["CUSTOMER"])),
):
    """
    Place a new water delivery order directed at a specific driver.

    The customer must supply a `driver_id`. The system will:
    - Validate the driver exists and has an ACTIVE tanker.
    - For DRINKING orders, validate the driver's default source is VERIFIED.
    - Create the order with status **PENDING** — the driver must ACCEPT or REJECT it.

    Allowed roles: **CUSTOMER**.
    """
    order = await order_service.create_order(db, order_in, current_user)
    return OrderRegistrationEnvelope(
        success=True,
        message="Order placed successfully. Waiting for driver to accept.",
        data=OrderRegistrationData(order_id=order.id, status=order.status),
    )


# ---------------------------------------------------------------------------
# Order Queries
# ---------------------------------------------------------------------------

@router.get("/orders", response_model=OrderListEnvelope, tags=["Orders"])
async def get_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve orders based on role:
    - **CUSTOMER**: Orders they placed (all statuses).
    - **DRIVER**: All orders directed at them (all statuses).
    - **ADMIN**: Every order in the system.
    """
    orders = await order_service.list_orders(db, current_user)
    return OrderListEnvelope(
        success=True,
        message="Orders retrieved successfully",
        data=[_order_to_response(o) for o in orders],
    )


@router.get("/orders/pending", response_model=OrderListEnvelope, tags=["Orders"])
async def get_pending_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve PENDING orders.
    - **DRIVER**: Their own pending requests (inbox — orders awaiting accept/reject).
    - **ADMIN**: All pending orders system-wide.

    Allowed roles: **DRIVER**, **ADMIN**.
    """
    orders = await order_service.list_pending_orders(db, current_user)
    return OrderListEnvelope(
        success=True,
        message="Pending orders retrieved successfully",
        data=[_order_to_response(o) for o in orders],
    )


@router.get("/orders/{id}", response_model=OrderEnvelope, tags=["Orders"])
async def get_order_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve details of a specific order.
    Allowed: the placing Customer, the assigned Driver, or an Admin.
    """
    order = await order_service.get_order_by_id(db, id, current_user)
    return OrderEnvelope(
        success=True,
        message="Order details retrieved successfully",
        data=_order_to_response(order),
    )


# ---------------------------------------------------------------------------
# Status Transitions  (Accept / Reject / Delivery Lifecycle / Cancel)
# ---------------------------------------------------------------------------

@router.patch("/orders/{id}/status", response_model=OrderStatusEnvelope, tags=["Orders"])
async def update_order_status(
    id: uuid.UUID,
    update_in: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the status of an order.

    **Driver transitions** (for their assigned order):
    - `PENDING` → `ACCEPTED` *(driver agrees to deliver)*
    - `PENDING` → `REJECTED` *(driver turns it down)*
    - `ACCEPTED` → `GOING_TO_SOURCE`
    - `GOING_TO_SOURCE` → `LOADING_WATER`
    - `LOADING_WATER` → `EN_ROUTE`
    - `EN_ROUTE` → `ARRIVED`
    - `ARRIVED` → `DELIVERED`
    - Any non-terminal → `CANCELLED`

    **Customer transitions** (for their own order):
    - `PENDING` → `CANCELLED` *(before driver accepts)*

    **Admin transitions**:
    - Any non-terminal → `CANCELLED`
    """
    order = await order_service.update_order_status(db, id, update_in, current_user)
    status_messages = {
        "ACCEPTED":        "Driver has accepted the order.",
        "REJECTED":        "Driver has rejected the order.",
        "GOING_TO_SOURCE": "Driver is heading to the water source.",
        "LOADING_WATER":   "Driver is loading water.",
        "EN_ROUTE":        "Driver is on the way to your address.",
        "ARRIVED":         "Driver has arrived at the delivery location.",
        "DELIVERED":       "Order delivered successfully.",
        "CANCELLED":       "Order has been cancelled.",
    }
    message = status_messages.get(order.status, f"Order status updated to {order.status}.")
    return OrderStatusEnvelope(
        success=True,
        message=message,
        data=_order_to_response(order),
    )
