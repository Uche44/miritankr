import uuid
import asyncio
import json
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification
from app.modules.notifications.repository import notifications_repo
from app.modules.auth.models import User

class NotificationBroadcaster:
    def __init__(self):
        self.listeners = {}

    def subscribe(self, user_id: uuid.UUID, queue: asyncio.Queue):
        if user_id not in self.listeners:
            self.listeners[user_id] = set()
        self.listeners[user_id].add(queue)

    def unsubscribe(self, user_id: uuid.UUID, queue: asyncio.Queue):
        if user_id in self.listeners:
            self.listeners[user_id].discard(queue)
            if not self.listeners[user_id]:
                del self.listeners[user_id]

    async def broadcast(self, user_id: uuid.UUID, notification_data: dict):
        if user_id in self.listeners:
            for queue in list(self.listeners[user_id]):
                await queue.put(notification_data)

notification_broadcaster = NotificationBroadcaster()

class NotificationService:
    async def create_notification(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        order_id: Optional[uuid.UUID],
        title: str,
        message: str,
        notification_type: str
    ) -> Notification:
        """
        Create a new notification. It will be saved as part of the current transaction.
        """
        db_notification = await notifications_repo.create(
            db=db,
            user_id=user_id,
            order_id=order_id,
            title=title,
            message=message,
            notification_type=notification_type
        )
        
        # Broadcast the new notification to listeners
        notification_data = {
            "id": str(db_notification.id) if db_notification.id else str(uuid.uuid4()),
            "user_id": str(db_notification.user_id),
            "order_id": str(db_notification.order_id) if db_notification.order_id else None,
            "title": db_notification.title,
            "message": db_notification.message,
            "type": db_notification.type,
            "is_read": db_notification.is_read or False,
            "created_at": (db_notification.created_at or datetime.utcnow()).isoformat()
        }
        await notification_broadcaster.broadcast(user_id, notification_data)
        
        return db_notification

    async def get_user_notifications(self, db: AsyncSession, current_user: User) -> List[Notification]:
        """
        Retrieve all notifications for the authenticated user.
        """
        return await notifications_repo.get_by_user_id(db, current_user.id)

    async def mark_as_read(self, db: AsyncSession, notification_id: uuid.UUID, current_user: User) -> Notification:
        """
        Mark a specific notification as read if it belongs to the authenticated user.
        """
        notification = await notifications_repo.get_by_id(db, notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found."
            )
        if notification.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You cannot read another user's notifications."
            )
        updated = await notifications_repo.mark_as_read(db, notification)
        await db.commit()
        return updated

    async def mark_all_as_read(self, db: AsyncSession, current_user: User) -> None:
        """
        Mark all notifications for the authenticated user as read.
        """
        await notifications_repo.mark_all_as_read(db, current_user.id)
        await db.commit()

notification_service = NotificationService()
