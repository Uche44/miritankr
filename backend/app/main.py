from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

@app.on_event("startup")
async def on_startup():
    from app.core.database import AsyncSessionLocal, seed_mock_sources
    import logging
    logger = logging.getLogger("uvicorn.error")
    if settings.SECRET_KEY == "SUPER_SECRET_KEY_FOR_LOCAL_DEV_CHANGE_IN_PROD_12345":
        logger.warning(
            "SECURITY WARNING: SECRET_KEY is set to default development value. "
            "Please configure a secure SECRET_KEY environment variable in production!"
        )
    async with AsyncSessionLocal() as db:
        await seed_mock_sources(db)

@app.get("/", include_in_schema=False)
async def redirect_to_docs():
    return RedirectResponse(url=f"{settings.API_V1_STR}/docs")


# Configure CORS Middleware for Next.js frontend communication
origins = [o.strip() for o in settings.BACKEND_CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for verification.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "database_url_scheme": settings.DATABASE_URL.split(":")[0]
    }

# We will mount routing modules here in subsequent milestones
from app.api.v1.router import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)

