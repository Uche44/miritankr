import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user, RoleChecker
from app.modules.water_sources.schemas import (
    WaterSourceCreate,
    WaterSourceVerifyRequest,
    WaterSourceEnvelope,
    WaterSourceListEnvelope,
    WaterSourceDetailEnvelope,
    WaterSourceDetail,
    SourceLocation
)
from app.modules.water_sources.service import water_source_service
from app.modules.quality_reports.repository import quality_report_repo

router = APIRouter()

@router.get("/water-sources", response_model=WaterSourceListEnvelope, tags=["Water Sources"])
async def get_water_sources(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active water sources catalog list.
    """
    sources = await water_source_service.get_all_sources(db)
    return WaterSourceListEnvelope(
        success=True,
        message="Water sources retrieved successfully",
        data=sources
    )

@router.get("/water-sources/{id}", response_model=WaterSourceDetailEnvelope, tags=["Water Sources"])
async def get_water_source_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific water source.
    """
    source = await water_source_service.get_source_by_id(db, id)
    reports = await quality_report_repo.get_by_source(db, id)
    detail = WaterSourceDetail(
        id=source.id,
        name=source.name,
        type=source.type,
        verification_status=source.verification_status,
        quality_grade=source.quality_grade,
        last_verified_at=source.last_verified_at,
        owner_id=source.owner_id,
        created_at=source.created_at,
        quality_reports=reports,
        location=SourceLocation(
            latitude=source.latitude,
            longitude=source.longitude,
            address=source.address
        )
    )
    return WaterSourceDetailEnvelope(
        success=True,
        message="Water source detail retrieved successfully",
        data=detail
    )

@router.post("/water-sources", response_model=WaterSourceEnvelope, status_code=201, tags=["Water Sources"])
async def register_water_source(
    source_in: WaterSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["FACILITY", "ADMIN"]))
):
    """
    Register a new water source.
    Allowed roles: FACILITY, ADMIN.
    """
    source = await water_source_service.register_source(db, source_in, current_user)
    return WaterSourceEnvelope(
        success=True,
        message="Water source registered successfully",
        data=source
    )

@router.put("/admin/water-sources/{id}/verify", response_model=WaterSourceEnvelope, tags=["Admin Water Sources"])
async def verify_water_source(
    id: uuid.UUID,
    verify_in: WaterSourceVerifyRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(RoleChecker(allowed_roles=["ADMIN"]))
):
    """
    Verify, suspend, or reject a water source.
    Allowed roles: ADMIN.
    """
    source = await water_source_service.verify_source(db, id, verify_in, admin_user)
    return WaterSourceEnvelope(
        success=True,
        message="Water source verification status updated successfully",
        data=source
    )
