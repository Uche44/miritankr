import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_miritankr.db"

# Enforce mock payment modes during test runs
from app.core.config import settings
settings.PAYSTACK_SECRET_KEY = ""
settings.PAYSTACK_PUBLIC_KEY = ""

@pytest.fixture(scope="session")
def event_loop():
    """
    Create an instance of the default event loop for the test session.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine(event_loop):
    """
    Set up the test database engine and schema.
    """
    engine = create_async_engine(
        TEST_DATABASE_URL, 
        connect_args={"check_same_thread": False, "timeout": 30}
    )
    
    # Create tables synchronously using run_sync
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    yield engine
    
    # Clean up schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a database session bound to a rollback transaction for isolation.
    """
    AsyncSessionLocal = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()
        await session.close()

@pytest.fixture(autouse=True)
def override_database_sessions(test_engine, db_session):
    """
    Override the production get_db dependency and AsyncSessionLocal
    with the test database engine session makers.
    """
    import app.core.database as core_db
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    original_session_local = core_db.AsyncSessionLocal

    test_session_maker = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
        class_=AsyncSession,
    )
    core_db.AsyncSessionLocal = test_session_maker

    async def _override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = _override_get_db

    yield

    core_db.AsyncSessionLocal = original_session_local
    app.dependency_overrides.clear()
