from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import RoleChecker
from app.modules.admin.schemas import (
    SystemMetricsEnvelope,
    AdminQualityReportListEnvelope
)
from app.modules.admin.service import admin_service

router = APIRouter()

@router.get(
    "/admin/metrics",
    response_model=SystemMetricsEnvelope,
    tags=["Admin Analytics"]
)
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["ADMIN"]))
):
    """
    Get system-wide water volume, order metrics, registry metrics and charts.
    """
    metrics = await admin_service.get_system_metrics(db)
    return SystemMetricsEnvelope(
        success=True,
        message="System metrics retrieved successfully",
        data=metrics
    )

@router.get(
    "/admin/quality-reports",
    response_model=AdminQualityReportListEnvelope,
    tags=["Admin Audit Trails"]
)
async def list_all_quality_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["ADMIN"]))
):
    """
    Get all safety quality logs / lab reports across the entire system.
    """
    reports = await admin_service.get_all_quality_reports(db)
    return AdminQualityReportListEnvelope(
        success=True,
        message="All water quality logs retrieved successfully",
        data=reports
    )
