import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.water_sources.models import WaterSource
from app.modules.water_sources.schemas import WaterSourceCreate, WaterSourceVerifyRequest
from app.modules.water_sources.repository import water_source_repo
from app.modules.auth.models import User

class WaterSourceService:
    async def register_source(
        self, 
        db: AsyncSession, 
        source_in: WaterSourceCreate, 
        current_user: User
    ) -> WaterSource:
        """
        Register a new water source.
        Only FACILITY and ADMIN can register a source.
        """
        if current_user.role not in {"FACILITY", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only Facilities or Admins can register water sources.",
            )
        
        # In Enugu State, coordinates must make sense.
        # Enugu is located roughly at Lat 6.4° - 6.6° N, Lon 7.4° - 7.6° E.
        # We can add general bounds check or just basic coordinates validity (handled by schema).
        
        db_source = await water_source_repo.create(db, source_in, owner_id=current_user.id)
        await db.commit()
        return db_source

    async def get_source_by_id(self, db: AsyncSession, source_id: uuid.UUID) -> WaterSource:
        """
        Get water source by ID.
        """
        source = await water_source_repo.get_by_id(db, source_id)
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Water source not found.",
            )
        return source

    async def get_all_sources(self, db: AsyncSession) -> List[WaterSource]:
        """
        Get all active water sources.
        """
        return await water_source_repo.get_all(db)

    async def verify_source(
        self, 
        db: AsyncSession, 
        source_id: uuid.UUID, 
        verify_in: WaterSourceVerifyRequest, 
        admin_user: User
    ) -> WaterSource:
        """
        Verify, suspend, or reject a water source.
        Requires ADMIN role.
        """
        if admin_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only administrators can verify water sources.",
            )

        db_source = await self.get_source_by_id(db, source_id)

        update_data = {
            "verification_status": verify_in.verification_status,
        }

        if verify_in.verification_status == "VERIFIED":
            update_data["last_verified_at"] = datetime.utcnow()
            # If a quality grade is supplied, update it; otherwise leave unchanged or default
            if verify_in.quality_grade:
                update_data["quality_grade"] = verify_in.quality_grade
        else:
            # If suspended or rejected, we can clear or keep quality grade. Usually clear it.
            update_data["quality_grade"] = None

        updated_source = await water_source_repo.update(db, db_source, update_data)
        await db.commit()
        return updated_source

    def is_eligible_for_drinking(self, source: WaterSource) -> bool:
        """
        Check if a water source is eligible to supply drinking water.
        Rule: Only verified water sources can supply drinking water.
        """
        return source.verification_status == "VERIFIED"

water_source_service = WaterSourceService()
