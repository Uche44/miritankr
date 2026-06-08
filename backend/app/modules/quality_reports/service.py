import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.water_sources.service import water_source_service
from app.modules.water_sources.repository import water_source_repo
from app.modules.quality_reports.models import WaterQualityReport
from app.modules.quality_reports.schemas import QualityReportCreate
from app.modules.quality_reports.repository import quality_report_repo

class QualityReportService:
    async def submit_report(
        self,
        db: AsyncSession,
        source_id: uuid.UUID,
        report_in: QualityReportCreate,
        current_user: User
    ) -> WaterQualityReport:
        """
        Submit a new water quality report for a water source.
        Only ADMIN and FACILITY roles are allowed.
        Updates the water source's quality grade.
        """
        if current_user.role not in {"FACILITY", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only administrators or facility operators can submit quality reports.",
            )

        # Verify source exists
        source = await water_source_service.get_source_by_id(db, source_id)

        # Create report
        db_report = await quality_report_repo.create(
            db=db,
            report_in=report_in,
            source_id=source_id,
            inspector_id=current_user.id
        )

        # Update water source quality grade
        await water_source_repo.update(db, source, {"quality_grade": report_in.grade})

        await db.commit()
        return db_report

    async def get_reports_for_source(
        self,
        db: AsyncSession,
        source_id: uuid.UUID
    ) -> List[WaterQualityReport]:
        """
        Retrieve all quality reports for a specific water source.
        Raises 404 if water source does not exist.
        """
        # Validate source exists
        await water_source_service.get_source_by_id(db, source_id)
        
        return await quality_report_repo.get_by_source(db, source_id)

    async def get_report_detail(
        self,
        db: AsyncSession,
        source_id: uuid.UUID,
        report_id: uuid.UUID
    ) -> WaterQualityReport:
        """
        Retrieve details of a specific quality report under a source.
        """
        # Validate source exists
        await water_source_service.get_source_by_id(db, source_id)

        report = await quality_report_repo.get_by_id(db, report_id)
        if not report or report.source_id != source_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Water quality report not found for this water source.",
            )
        return report

quality_report_service = QualityReportService()
