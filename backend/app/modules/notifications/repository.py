import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.modules.notifications.models import Notification

class NotificationRepository:
    async def create(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        order_id: Optional[uuid.UUID],
        title: str,
        message: str,
        notification_type: str
    ) -> Notification:
        db_notification = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            order_id=order_id,
            title=title,
            message=message,
            type=notification_type,
            created_at=datetime.utcnow()
        )
        db.add(db_notification)
        return db_notification

    async def get_by_id(self, db: AsyncSession, id: uuid.UUID) -> Optional[Notification]:
        result = await db.execute(select(Notification).where(Notification.id == id))
        return result.scalars().first()

    async def get_by_user_id(self, db: AsyncSession, user_id: uuid.UUID) -> List[Notification]:
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
        return list(result.scalars().all())

    async def mark_as_read(self, db: AsyncSession, db_notification: Notification) -> Notification:
        db_notification.is_read = True
        db.add(db_notification)
        return db_notification

    async def mark_all_as_read(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )

notifications_repo = NotificationRepository()
