from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.modules.auth.schemas import UserCreate, UserLogin, UserResponse, AuthResponse
from app.modules.auth.service import auth_service, get_current_user
from app.modules.auth.models import User

router = APIRouter()

@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(
    user_in: UserCreate, 
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user (CUSTOMER, DRIVER, FACILITY, ADMIN).
    """
    return await auth_service.register_user(db, user_in)

@router.post("/login", response_model=AuthResponse)
async def login(
    login_in: UserLogin, 
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate a user using email and password.
    """
    return await auth_service.authenticate_user(db, login_in)

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Get details of the currently logged-in user.
    """
    return current_user
