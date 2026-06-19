import uuid
import json
import asyncio
from fastapi import APIRouter, Depends, status, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user
from app.modules.notifications.schemas import (
    NotificationEnvelope,
    NotificationListEnvelope,
    BaseEnvelope
)
from app.modules.notifications.service import notification_service

router = APIRouter()

async def get_current_user_from_query(
    token: str,
    db: AsyncSession = Depends(get_db)
) -> User:
    from jose import jwt, JWTError
    from app.core.config import settings
    from app.core.security import ALGORITHM
    from app.modules.auth.repository import user_repo
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user."
        )
    return user

@router.get(
    "/notifications",
    response_model=NotificationListEnvelope,
    tags=["Notifications"]
)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve list of notifications for the authenticated user, ordered from newest to oldest.
    """
    notifications = await notification_service.get_user_notifications(db, current_user)
    return NotificationListEnvelope(
        success=True,
        message="Notifications retrieved successfully",
        data=notifications
    )

@router.put(
    "/notifications/{id}/read",
    response_model=NotificationEnvelope,
    tags=["Notifications"]
)
async def mark_notification_as_read(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a single notification as read.
    """
    notification = await notification_service.mark_as_read(db, id, current_user)
    return NotificationEnvelope(
        success=True,
        message="Notification marked as read successfully",
        data=notification
    )

@router.put(
    "/notifications/read-all",
    response_model=BaseEnvelope,
    tags=["Notifications"]
)
async def mark_all_notifications_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all unread notifications for the current user as read.
    """
    await notification_service.mark_all_as_read(db, current_user)
    return BaseEnvelope(
        success=True,
        message="All notifications marked as read successfully"
    )

@router.get(
    "/notifications/stream",
    tags=["Notifications"]
)
async def stream_notifications(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events (SSE) endpoint to stream new notifications to the authenticated user.
    """
    # Authenticate user from query parameter
    current_user = await get_current_user_from_query(token, db)
    
    async def event_generator():
        # Create an async queue for this connection
        queue = asyncio.Queue()
        # Subscribe the queue to the user's notifications channel
        from app.modules.notifications.service import notification_broadcaster
        notification_broadcaster.subscribe(current_user.id, queue)
        
        try:
            # Yield an welcome event to confirm connection is established
            yield "event: welcome\ndata: Connected to real-time notification stream\n\n"
            
            while True:
                try:
                    # Wait for a new notification with a timeout to send keep-alive pings
                    # This keeps the connection alive and avoids proxy timeout drops
                    notification_data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {json.dumps(notification_data)}\n\n"
                    queue.task_done()
                except asyncio.TimeoutError:
                    # Send keep-alive ping comment
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            # Clean up on client disconnect
            pass
        finally:
            notification_broadcaster.unsubscribe(current_user.id, queue)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
