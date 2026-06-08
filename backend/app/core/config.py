from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "MiriTankr"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "SUPER_SECRET_KEY_FOR_LOCAL_DEV_CHANGE_IN_PROD_12345"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database configuration
    # Defaulting to an async SQLite fallback for testing, but PostgreSQL is the system of record
    DATABASE_URL: str = "sqlite+aiosqlite:///./miritankr.db"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
