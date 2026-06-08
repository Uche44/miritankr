import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.water_sources.models import WaterSource
from app.modules.water_sources.schemas import WaterSourceCreate

class WaterSourceRepository:
    async def get_by_id(self, db: AsyncSession, source_id: uuid.UUID) -> Optional[WaterSource]:
        """
        Retrieve a water source by its ID if not soft deleted.
        """
        result = await db.execute(
            select(WaterSource).where(
                WaterSource.id == source_id, 
                WaterSource.deleted_at == None
            )
        )
        return result.scalars().first()

    async def get_all(self, db: AsyncSession) -> List[WaterSource]:
        """
        Retrieve all active (not soft deleted) water sources.
        """
        result = await db.execute(
            select(WaterSource).where(WaterSource.deleted_at == None)
        )
        return list(result.scalars().all())

    async def create(
        self, 
        db: AsyncSession, 
        source_in: WaterSourceCreate, 
        owner_id: Optional[uuid.UUID] = None
    ) -> WaterSource:
        """
        Create a new water source.
        """
        db_source = WaterSource(
            name=source_in.name,
            type=source_in.type,
            address=source_in.address,
            latitude=source_in.latitude,
            longitude=source_in.longitude,
            owner_id=owner_id,
            verification_status="PENDING",
            quality_grade=None,
        )
        db.add(db_source)
        await db.flush()  # Populates id and created_at fields
        return db_source

    async def update(
        self, 
        db: AsyncSession, 
        db_source: WaterSource, 
        update_data: dict
    ) -> WaterSource:
        """
        Update a water source with provided data.
        """
        for field, value in update_data.items():
            setattr(db_source, field, value)
        db.add(db_source)
        await db.flush()
        return db_source

water_source_repo = WaterSourceRepository()
