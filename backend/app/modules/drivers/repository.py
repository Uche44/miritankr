import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.modules.drivers.models import Driver
from app.modules.auth.models import User

class DriverRepository:
    async def get_by_id(self, db: AsyncSession, driver_id: uuid.UUID) -> Optional[Driver]:
        """
        Fetch a driver by ID, eager loading user and tanker relationships.
        """
        result = await db.execute(
            select(Driver)
            .where(Driver.id == driver_id)
            .options(
                selectinload(Driver.user),
                selectinload(Driver.tanker)
            )
        )
        return result.scalars().first()

    async def create_default(self, db: AsyncSession, driver_id: uuid.UUID) -> Driver:
        """
        Create a default driver profile.
        """
        db_driver = Driver(
            id=driver_id,
            status="OFFLINE",
            tanker_id=None,
            latitude=None,
            longitude=None,
            last_location_update=None
        )
        db.add(db_driver)
        await db.flush()
        return db_driver

    async def get_active_drivers(self, db: AsyncSession) -> List[Driver]:
        """
        Fetch all drivers that are currently AVAILABLE, joined with active user and tanker.
        """
        result = await db.execute(
            select(Driver)
            .join(User, Driver.id == User.id)
            .where(
                Driver.status == "AVAILABLE",
                User.is_active == True,
                User.deleted_at == None
            )
            .options(
                selectinload(Driver.user),
                selectinload(Driver.tanker)
            )
        )
        return list(result.scalars().all())

    async def update(self, db: AsyncSession, db_driver: Driver, update_data: dict) -> Driver:
        """
        Update fields on a driver record.
        """
        for field, value in update_data.items():
            setattr(db_driver, field, value)
        db.add(db_driver)
        await db.flush()
        return db_driver

driver_repo = DriverRepository()
