import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    order_id: Optional[uuid.UUID] = None
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class BaseEnvelope(BaseModel):
    success: bool = True
    message: Optional[str] = None

class NotificationEnvelope(BaseEnvelope):
    data: NotificationResponse

class NotificationListEnvelope(BaseEnvelope):
    data: List[NotificationResponse]
