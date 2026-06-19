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

async def seed_mock_sources(db: AsyncSession):
    from app.modules.water_sources.models import WaterSource
    from sqlalchemy import select
    
    mock_sources = [
        {
            "name": "9th Mile Water Treatment Plant",
            "type": "TREATMENT_PLANT",
            "verification_status": "VERIFIED",
            "quality_grade": "A",
            "address": "9th Mile Corner, Ngwo, Enugu State",
            "latitude": 6.4253,
            "longitude": 7.4042,
        },
        {
            "name": "Artisan Market Borehole Depot",
            "type": "BOREHOLE",
            "verification_status": "VERIFIED",
            "quality_grade": "B",
            "address": "Ogui Road, Asata, Enugu State",
            "latitude": 6.4428,
            "longitude": 7.5186,
        },
        {
            "name": "Independence Layout Reservoir",
            "type": "RESERVOIR",
            "verification_status": "PENDING",
            "quality_grade": None,
            "address": "Independence Layout, Enugu State",
            "latitude": 6.4281,
            "longitude": 7.5024,
        }
    ]
    
    for src_data in mock_sources:
        result = await db.execute(
            select(WaterSource).where(WaterSource.name == src_data["name"])
        )
        existing = result.scalars().first()
        if not existing:
            new_source = WaterSource(
                name=src_data["name"],
                type=src_data["type"],
                verification_status=src_data["verification_status"],
                quality_grade=src_data["quality_grade"],
                address=src_data["address"],
                latitude=src_data["latitude"],
                longitude=src_data["longitude"],
            )
            db.add(new_source)
    await db.commit()
