import uuid
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user
from app.modules.tracking.schemas import (
    TrackingEventResponse,
    TimelineEnvelope,
    LiveTrackingEnvelope,
)
from app.modules.tracking.service import tracking_service

router = APIRouter()


@router.get(
    "/orders/{id}/tracking",
    response_model=LiveTrackingEnvelope,
    tags=["Tracking"],
)
async def get_live_tracking(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the live tracking snapshot for an order.

    Returns:
    - **driver_location**: Driver's last known GPS coordinates.
    - **source_location**: The water source details (name, address, verification status, quality grade).
    - **order_status**: Current order status.
    - **timeline**: Full chronological list of all tracking events.

    This is the core **water provenance** screen — customers can see exactly where
    their water came from, who handled it, and when.

    Allowed: placing Customer, assigned Driver, or Admin.
    """
    snapshot = await tracking_service.get_live_tracking(db, id, current_user)
    return LiveTrackingEnvelope(
        success=True,
        message="Live tracking data retrieved successfully",
        data=snapshot,
    )


@router.get(
    "/orders/{id}/tracking/timeline",
    response_model=TimelineEnvelope,
    tags=["Tracking"],
)
async def get_order_timeline(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the complete immutable event timeline for an order.

    Returns every tracking event in chronological order — from ORDER_CREATED
    through to DELIVERED (or CANCELLED/REJECTED). Events are never modified or deleted.

    Allowed: placing Customer, assigned Driver, or Admin.
    """
    events = await tracking_service.get_timeline(db, id, current_user)
    return TimelineEnvelope(
        success=True,
        message=f"{len(events)} tracking event(s) found",
        data=[
            TrackingEventResponse(
                id=e.id,
                order_id=e.order_id,
                event_type=e.event_type,
                actor_id=e.actor_id,
                latitude=e.latitude,
                longitude=e.longitude,
                event_metadata=e.event_metadata,
                created_at=e.created_at,
            )
            for e in events
        ],
    )


@router.websocket("/ws/orders/{order_id}/tracking")
async def websocket_endpoint(
    websocket: WebSocket,
    order_id: uuid.UUID,
    token: str = Query(...),
):
    from app.core.database import AsyncSessionLocal
    from app.modules.auth.repository import user_repo
    from app.modules.orders.repository import order_repo
    from app.modules.tracking.websocket import manager
    from jose import jwt, JWTError
    from app.core.config import settings
    from app.core.security import ALGORITHM

    # 1. Decode token & verify user
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        user = await user_repo.get_by_id(db, user_id)
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 2. Get order
        order = await order_repo.get_by_id(db, order_id)
        if not order:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 3. Check access
        is_authorized = (
            user.id == order.customer_id
            or user.id == order.assigned_driver_id
            or user.role == "ADMIN"
        )
        if not is_authorized:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # Accept connection and add to manager
    await manager.connect(str(order_id), websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(str(order_id), websocket)
