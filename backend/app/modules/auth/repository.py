import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.auth.models import User
from app.modules.auth.schemas import UserCreate
from app.core.security import get_password_hash

class UserRepository:
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """
        Fetch an active user by email.
        """
        result = await db.execute(
            select(User).where(User.email == email.lower(), User.deleted_at == None)
        )
        return result.scalars().first()

    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        """
        Fetch an active user by ID.
        """
        result = await db.execute(
            select(User).where(User.id == user_id, User.deleted_at == None)
        )
        return result.scalars().first()

    async def create(self, db: AsyncSession, user_in: UserCreate) -> User:
        """
        Create a new user in the database.
        """
        db_user = User(
            email=user_in.email.lower(),
            hashed_password=get_password_hash(user_in.password),
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            phone=user_in.phone,
            role=user_in.role,
        )
        db.add(db_user)
        await db.flush()  # Generate UUID id without committing yet
        return db_user

user_repo = UserRepository()
