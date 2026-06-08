import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_current_user, RoleChecker
from app.modules.drivers.schemas import (
    DriverStatusUpdate,
    DriverLocationUpdate,
    DriverTankerUpdate,
    DriverEnvelope,
    DriverDetailEnvelope,
    DriverListEnvelope
)
from app.modules.drivers.service import driver_service

router = APIRouter()

@router.get("/drivers/me", response_model=DriverDetailEnvelope, tags=["Drivers"])
async def get_my_driver_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Get current driver profile including active vehicle and telemetry.
    """
    driver = await driver_service.get_driver_or_create(db, current_user.id)
    response_data = await driver_service.build_detail_response(db, driver)
    return DriverDetailEnvelope(
        success=True,
        message="Driver profile retrieved successfully",
        data=response_data
    )

@router.put("/drivers/me/status", response_model=DriverEnvelope, tags=["Drivers"])
async def update_driver_status(
    status_in: DriverStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Update driver availability status (AVAILABLE, OFFLINE, BUSY).
    Cannot set to AVAILABLE without an assigned active tanker.
    """
    driver = await driver_service.update_status(db, current_user.id, status_in)
    return DriverEnvelope(
        success=True,
        message="Driver availability status updated successfully",
        data=driver
    )

@router.put("/drivers/me/location", response_model=DriverEnvelope, tags=["Drivers"])
async def update_driver_location(
    location_in: DriverLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Update driver live GPS telemetry coordinates.
    """
    driver = await driver_service.update_location(db, current_user.id, location_in)
    return DriverEnvelope(
        success=True,
        message="Driver location coordinates updated successfully",
        data=driver
    )

@router.put("/drivers/me/tanker", response_model=DriverEnvelope, tags=["Drivers"])
async def assign_driver_tanker(
    tanker_in: DriverTankerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["DRIVER"]))
):
    """
    Assign an approved vehicle to the driver. The driver must own the tanker and it must be ACTIVE.
    """
    driver = await driver_service.assign_tanker(db, current_user.id, tanker_in)
    return DriverEnvelope(
        success=True,
        message="Driver vehicle assignment updated successfully",
        data=driver
    )

@router.get("/drivers/active", response_model=DriverListEnvelope, tags=["Drivers"])
async def list_active_drivers(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active AVAILABLE drivers with their locations and tanker info.
    (Accessible to any logged-in user or customer for tracking and dispatch purposes)
    """
    drivers = await driver_service.list_active_drivers(db)
    response_list = [await driver_service.build_detail_response(db, d) for d in drivers]
    return DriverListEnvelope(
        success=True,
        message="Active available drivers list retrieved successfully",
        data=response_list
    )
