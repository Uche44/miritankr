from datetime import datetime
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime
from app.core.config import settings

# Determine if we're using SQLite fallback to set check_same_thread
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Create async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)

# Declarative base class for models
class Base(DeclarativeBase):
    pass

# Mixin for Soft Delete support
class SoftDeleteMixin:
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, 
        default=None, 
        nullable=True
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    async def soft_delete(self, db: AsyncSession) -> None:
        self.deleted_at = datetime.utcnow()
        db.add(self)
        await db.flush()

    async def restore(self, db: AsyncSession) -> None:
        self.deleted_at = None
        db.add(self)
        await db.flush()

# Dependency for API endpoints to get a DB session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
