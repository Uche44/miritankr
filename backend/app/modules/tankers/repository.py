import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.tankers.models import Tanker
from app.modules.tankers.schemas import TankerCreate

class TankerRepository:
    async def get_by_id(self, db: AsyncSession, tanker_id: uuid.UUID) -> Optional[Tanker]:
        """
        Retrieve a tanker by its ID if not soft deleted.
        """
        result = await db.execute(
            select(Tanker).where(
                Tanker.id == tanker_id, 
                Tanker.deleted_at == None
            )
        )
        return result.scalars().first()

    async def get_by_owner_id(self, db: AsyncSession, owner_id: uuid.UUID) -> Optional[Tanker]:
        """
        Retrieve a tanker registered to a specific owner (driver) if not soft deleted.
        """
        result = await db.execute(
            select(Tanker).where(
                Tanker.owner_id == owner_id, 
                Tanker.deleted_at == None
            )
        )
        return result.scalars().first()

    async def get_by_plate_number(self, db: AsyncSession, plate_number: str) -> Optional[Tanker]:
        """
        Retrieve a tanker by plate number if not soft deleted.
        """
        result = await db.execute(
            select(Tanker).where(
                Tanker.plate_number == plate_number.strip().upper(), 
                Tanker.deleted_at == None
            )
        )
        return result.scalars().first()

    async def get_all(self, db: AsyncSession) -> List[Tanker]:
        """
        Retrieve all active (not soft deleted) tankers.
        """
        result = await db.execute(
            select(Tanker).where(Tanker.deleted_at == None)
        )
        return list(result.scalars().all())

    async def create(
        self, 
        db: AsyncSession, 
        tanker_in: TankerCreate, 
        owner_id: uuid.UUID
    ) -> Tanker:
        """
        Create a new tanker.
        """
        db_tanker = Tanker(
            owner_id=owner_id,
            plate_number=tanker_in.plate_number.strip().upper(),
            capacity_litres=tanker_in.capacity_litres,
            default_source_id=tanker_in.default_source_id,
            license_documents=tanker_in.license_documents,
            tanker_image=tanker_in.tanker_image,
            status="PENDING",
        )
        db.add(db_tanker)
        await db.flush()
        return db_tanker

    async def update(
        self, 
        db: AsyncSession, 
        db_tanker: Tanker, 
        update_data: dict
    ) -> Tanker:
        """
        Update a tanker record.
        """
        for field, value in update_data.items():
            setattr(db_tanker, field, value)
        db.add(db_tanker)
        await db.flush()
        return db_tanker

tanker_repo = TankerRepository()
