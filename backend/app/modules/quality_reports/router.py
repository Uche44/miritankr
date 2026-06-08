import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.service import RoleChecker
from app.modules.quality_reports.schemas import (
    QualityReportCreate,
    QualityReportEnvelope,
    QualityReportListEnvelope
)
from app.modules.quality_reports.service import quality_report_service

router = APIRouter()

@router.post(
    "/water-sources/{id}/quality-reports",
    response_model=QualityReportEnvelope,
    status_code=status.HTTP_201_CREATED,
    tags=["Water Quality Reports"]
)
async def submit_quality_report(
    id: uuid.UUID,
    report_in: QualityReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(allowed_roles=["FACILITY", "ADMIN"]))
):
    """
    Submit a lab report for a water source.
    Allowed roles: FACILITY, ADMIN.
    """
    report = await quality_report_service.submit_report(
        db=db,
        source_id=id,
        report_in=report_in,
        current_user=current_user
    )
    return QualityReportEnvelope(
        success=True,
        message="Water quality report submitted successfully",
        data=report
    )

@router.get(
    "/water-sources/{id}/quality-reports",
    response_model=QualityReportListEnvelope,
    tags=["Water Quality Reports"]
)
async def list_quality_reports(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all quality reports for a water source.
    Ordered newest first (by tested_at DESC).
    """
    reports = await quality_report_service.get_reports_for_source(db, id)
    return QualityReportListEnvelope(
        success=True,
        message="Water quality reports retrieved successfully",
        data=reports
    )

@router.get(
    "/water-sources/{id}/quality-reports/{report_id}",
    response_model=QualityReportEnvelope,
    tags=["Water Quality Reports"]
)
async def get_quality_report_detail(
    id: uuid.UUID,
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific water quality report.
    """
    report = await quality_report_service.get_report_detail(db, id, report_id)
    return QualityReportEnvelope(
        success=True,
        message="Water quality report details retrieved successfully",
        data=report
    )
