import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tankers.models import Tanker
from app.modules.tankers.schemas import TankerCreate, TankerStatusUpdateRequest
from app.modules.tankers.repository import tanker_repo
from app.modules.water_sources.models import WaterSource
from app.modules.auth.models import User

class TankerService:
    async def register_tanker(
        self, 
        db: AsyncSession, 
        tanker_in: TankerCreate, 
        current_user: User
    ) -> Tanker:
        """
        Register a new tanker.
        Allowed roles: DRIVER.
        """
        if current_user.role != "DRIVER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only Drivers can register tankers.",
            )
        
        # Check if driver already has a tanker
        existing_tanker = await tanker_repo.get_by_owner_id(db, current_user.id)
        if existing_tanker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already registered a tanker.",
            )

        # Check plate number uniqueness
        plate_exists = await tanker_repo.get_by_plate_number(db, tanker_in.plate_number)
        if plate_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A tanker with this plate number is already registered.",
            )

        # Verify default source exists if provided
        if tanker_in.default_source_id:
            source = await db.get(WaterSource, tanker_in.default_source_id)
            if not source or source.deleted_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Default water source not found.",
                )

        db_tanker = await tanker_repo.create(db, tanker_in, owner_id=current_user.id)
        await db.commit()
        return db_tanker

    async def get_tanker_by_id(self, db: AsyncSession, tanker_id: uuid.UUID) -> Tanker:
        """
        Retrieve a tanker by its ID.
        """
        tanker = await tanker_repo.get_by_id(db, tanker_id)
        if not tanker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tanker not found.",
            )
        return tanker

    async def get_tanker_by_driver_id(self, db: AsyncSession, driver_id: uuid.UUID) -> Tanker:
        """
        Retrieve the tanker registered to a driver.
        """
        tanker = await tanker_repo.get_by_owner_id(db, driver_id)
        if not tanker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No tanker is registered to this driver.",
            )
        return tanker

    async def get_all_tankers(self, db: AsyncSession) -> List[Tanker]:
        """
        Retrieve all registered tankers.
        """
        return await tanker_repo.get_all(db)

    async def update_tanker_status(
        self, 
        db: AsyncSession, 
        tanker_id: uuid.UUID, 
        update_in: TankerStatusUpdateRequest,
        admin_user: User
    ) -> Tanker:
        """
        Update the status of a tanker (e.g. Admin approving or suspending vehicle).
        Allowed roles: ADMIN.
        """
        if admin_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only administrators can verify tankers.",
            )

        db_tanker = await self.get_tanker_by_id(db, tanker_id)
        
        updated_tanker = await tanker_repo.update(
            db, 
            db_tanker, 
            {"status": update_in.status}
        )
        await db.commit()
        return updated_tanker

    async def calculate_drinking_eligibility(self, db: AsyncSession, tanker: Tanker) -> bool:
        """
        Determine if a tanker is eligible to deliver drinking water.
        Rule: Tanker status must be ACTIVE and default source verification status must be VERIFIED.
        """
        if tanker.status != "ACTIVE":
            return False
        if not tanker.default_source_id:
            return False

        source = await db.get(WaterSource, tanker.default_source_id)
        if not source or source.deleted_at is not None:
            return False

        return source.verification_status == "VERIFIED"

tanker_service = TankerService()
