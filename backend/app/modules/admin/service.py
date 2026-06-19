import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Dict, Any
from datetime import datetime, timedelta

from app.modules.orders.models import Order
from app.modules.payments.models import Payment
from app.modules.tankers.models import Tanker
from app.modules.water_sources.models import WaterSource
from app.modules.auth.models import User
from app.modules.quality_reports.models import WaterQualityReport

class AdminService:
    async def get_system_metrics(self, db: AsyncSession) -> Dict[str, Any]:
        # 1. Total volume & breakdown for DELIVERED orders
        volume_stmt = (
            select(
                func.sum(Order.quantity_litres).label("total"),
                func.sum(func.coalesce(Order.quantity_litres, 0)).filter(Order.water_type == "DRINKING").label("drinking"),
                func.sum(func.coalesce(Order.quantity_litres, 0)).filter(Order.water_type == "UTILITY").label("utility")
            )
            .where(Order.status == "DELIVERED")
        )
        volume_res = await db.execute(volume_stmt)
        vol_row = volume_res.first()
        
        total_vol = float(vol_row.total or 0.0)
        drinking_vol = float(vol_row.drinking or 0.0)
        utility_vol = float(vol_row.utility or 0.0)

        # 2. Orders count
        orders_stmt = select(
            func.count(Order.id).label("total"),
            func.count(Order.id).filter(Order.status == "DELIVERED").label("delivered")
        )
        orders_res = await db.execute(orders_stmt)
        ord_row = orders_res.first()
        total_ord = int(ord_row.total or 0)
        delivered_ord = int(ord_row.delivered or 0)

        # 3. Tankers count
        tankers_stmt = select(func.count(Tanker.id)).where(Tanker.status == "ACTIVE")
        tankers_res = await db.execute(tankers_stmt)
        active_tankers = int(tankers_res.scalar_one() or 0)

        # 4. Verified water sources
        sources_stmt = select(func.count(WaterSource.id)).where(WaterSource.verification_status == "VERIFIED")
        sources_res = await db.execute(sources_stmt)
        verified_sources = int(sources_res.scalar_one() or 0)

        # 5. User counts
        users_stmt = select(
            func.count(User.id).filter(User.role == "CUSTOMER").label("customers"),
            func.count(User.id).filter(User.role == "DRIVER").label("drivers")
        )
        users_res = await db.execute(users_stmt)
        usr_row = users_res.first()
        customers_cnt = int(usr_row.customers or 0)
        drivers_cnt = int(usr_row.drivers or 0)

        # 6. Daily volume metrics for the last 7 days
        volume_by_date = []
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = datetime.combine(day, datetime.max.time())
            
            day_vol_stmt = (
                select(
                    func.sum(Order.quantity_litres).label("total"),
                    func.sum(func.coalesce(Order.quantity_litres, 0)).filter(Order.water_type == "DRINKING").label("drinking"),
                    func.sum(func.coalesce(Order.quantity_litres, 0)).filter(Order.water_type == "UTILITY").label("utility")
                )
                .where(
                    and_(
                        Order.status == "DELIVERED",
                        Order.created_at >= day_start,
                        Order.created_at <= day_end
                    )
                )
            )
            day_vol_res = await db.execute(day_vol_stmt)
            day_row = day_vol_res.first()
            
            volume_by_date.append({
                "date": day.strftime("%Y-%m-%d"),
                "drinking_volume": float(day_row.drinking or 0.0),
                "utility_volume": float(day_row.utility or 0.0),
                "total_volume": float(day_row.total or 0.0)
            })

        return {
            "total_volume_litres": total_vol,
            "drinking_volume_litres": drinking_vol,
            "utility_volume_litres": utility_vol,
            "total_orders_count": total_ord,
            "delivered_orders_count": delivered_ord,
            "active_tankers_count": active_tankers,
            "verified_sources_count": verified_sources,
            "total_customers_count": customers_cnt,
            "total_drivers_count": drivers_cnt,
            "volume_by_date": volume_by_date
        }

    async def get_all_quality_reports(self, db: AsyncSession) -> List[Dict[str, Any]]:
        stmt = (
            select(WaterQualityReport, WaterSource, User)
            .join(WaterSource, WaterQualityReport.source_id == WaterSource.id)
            .join(User, WaterQualityReport.inspector_id == User.id)
            .order_by(WaterQualityReport.tested_at.desc())
        )
        res = await db.execute(stmt)
        rows = res.all()
        
        reports_logs = []
        for report, source, inspector in rows:
            reports_logs.append({
                "id": report.id,
                "source_id": report.source_id,
                "source_name": source.name,
                "tested_at": report.tested_at,
                "ph": report.ph,
                "tds": report.tds,
                "turbidity": report.turbidity,
                "grade": report.grade,
                "inspector_id": report.inspector_id,
                "inspector_name": f"{inspector.first_name} {inspector.last_name}"
            })
        return reports_logs

admin_service = AdminService()
