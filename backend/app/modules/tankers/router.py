import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user, RoleChecker
from app.modules.tankers.schemas import (
    TankerCreate,
    TankerResponse,
    TankerEnvelope,
    TankerListEnvelope,
    TankerRegistrationEnvelope,
    TankerRegistrationData,
    TankerStatusUpdateRequest
)
from app.modules.tankers.service import tanker_service
from app.modules.tankers.models import Tanker

router = APIRouter()

async def format_tanker_response(db: AsyncSession, tanker: Tanker) -> TankerResponse:
    is_eligible = await tanker_service.calculate_drinking_eligibility(db, tanker)
    return TankerResponse(
        id=tanker.id,
        owner_id=tanker.owner_id,
        plate_number=tanker.plate_number,
        capacity_litres=tanker.capacity_litres,
        default_source_id=tanker.default_source_id,
        license_documents=tanker.license_documents,
        tanker_image=tanker.tanker_image,
        status=tanker.status,
        created_at=tanker.created_at,
        is_eligible_for_drinking=is_eligible
    )

@router.post("/tankers", response_model=TankerRegistrationEnvelope, status_code=201, tags=["Tankers"])
async def register_tanker(
    tanker_in: TankerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Register a new tanker.
    Allowed roles: DRIVER.
    """
    tanker = await tanker_service.register_tanker(db, tanker_in, current_user)
    return TankerRegistrationEnvelope(
        success=True,
        message="Tanker registered successfully and is pending approval",
        data=TankerRegistrationData(id=tanker.id)
    )

@router.get("/tankers/me", response_model=TankerEnvelope, tags=["Tankers"])
async def get_my_tanker(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Retrieve the current driver's registered tanker.
    """
    tanker = await tanker_service.get_tanker_by_driver_id(db, current_user.id)
    response_data = await format_tanker_response(db, tanker)
    return TankerEnvelope(
        success=True,
        message="Driver tanker retrieved successfully",
        data=response_data
    )

@router.get("/tankers/{id}", response_model=TankerEnvelope, tags=["Tankers"])
async def get_tanker_detail(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific tanker.
    """
    tanker = await tanker_service.get_tanker_by_id(db, id)
    response_data = await format_tanker_response(db, tanker)
    return TankerEnvelope(
        success=True,
        message="Tanker details retrieved successfully",
        data=response_data
    )

@router.get("/admin/tankers", response_model=TankerListEnvelope, tags=["Admin Tankers"])
async def list_all_tankers(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(RoleChecker(allowed_roles=["ADMIN"]))
):
    """
    List all registered tankers in the system.
    Allowed roles: ADMIN.
    """
    tankers = await tanker_service.get_all_tankers(db)
    response_list = [await format_tanker_response(db, t) for t in tankers]
    return TankerListEnvelope(
        success=True,
        message="All tankers retrieved successfully",
        data=response_list
    )

@router.put("/admin/tankers/{id}/status", response_model=TankerEnvelope, tags=["Admin Tankers"])
async def update_tanker_status(
    id: uuid.UUID,
    update_in: TankerStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(RoleChecker(allowed_roles=["ADMIN"]))
):
    """
    Approve, suspend, or reject a tanker vehicle registration.
    Allowed roles: ADMIN.
    """
    tanker = await tanker_service.update_tanker_status(db, id, update_in, admin_user)
    response_data = await format_tanker_response(db, tanker)
    return TankerEnvelope(
        success=True,
        message="Tanker status updated successfully",
        data=response_data
    )
