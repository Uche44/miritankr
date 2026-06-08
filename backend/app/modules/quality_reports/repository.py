import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.modules.quality_reports.models import WaterQualityReport
from app.modules.quality_reports.schemas import QualityReportCreate

class QualityReportRepository:
    async def create(
        self,
        db: AsyncSession,
        report_in: QualityReportCreate,
        source_id: uuid.UUID,
        inspector_id: uuid.UUID
    ) -> WaterQualityReport:
        tested_at = report_in.tested_at
        if tested_at.tzinfo is not None:
            from datetime import timezone
            tested_at = tested_at.astimezone(timezone.utc).replace(tzinfo=None)

        db_report = WaterQualityReport(
            source_id=source_id,
            tested_at=tested_at,
            ph=report_in.ph,
            tds=report_in.tds,
            turbidity=report_in.turbidity,
            grade=report_in.grade,
            inspector_id=inspector_id
        )
        db.add(db_report)
        await db.flush()
        return db_report

    async def get_by_source(
        self,
        db: AsyncSession,
        source_id: uuid.UUID
    ) -> List[WaterQualityReport]:
        result = await db.execute(
            select(WaterQualityReport)
            .where(WaterQualityReport.source_id == source_id)
            .order_by(desc(WaterQualityReport.tested_at))
        )
        return list(result.scalars().all())

    async def get_by_id(
        self,
        db: AsyncSession,
        report_id: uuid.UUID
    ) -> Optional[WaterQualityReport]:
        result = await db.execute(
            select(WaterQualityReport)
            .where(WaterQualityReport.id == report_id)
        )
        return result.scalars().first()

quality_report_repo = QualityReportRepository()
