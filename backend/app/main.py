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

@app.get("/", include_in_schema=False)
async def redirect_to_docs():
    return RedirectResponse(url=f"{settings.API_V1_STR}/docs")


# Configure CORS Middleware for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
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

