from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.water_sources.router import router as water_sources_router
from app.modules.tankers.router import router as tankers_router
from app.modules.drivers.router import router as drivers_router
from app.modules.orders.router import router as orders_router
from app.modules.tracking.router import router as tracking_router
from app.modules.quality_reports.router import router as quality_reports_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(water_sources_router)
api_router.include_router(tankers_router)
api_router.include_router(drivers_router)
api_router.include_router(orders_router)
api_router.include_router(tracking_router)
api_router.include_router(quality_reports_router)
