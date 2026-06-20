from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "MiriTankr"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Allowed CORS Origins (comma separated string)
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

    # Database configuration
    # Defaulting to an async SQLite fallback for testing, but PostgreSQL is the system of record
    DATABASE_URL: str = "sqlite+aiosqlite:///./miritankr.db"

    # Paystack configuration
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_PUBLIC_KEY: str = ""

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
