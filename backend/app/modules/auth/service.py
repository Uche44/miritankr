import uuid
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_password, create_access_token, ALGORITHM
from app.core.database import get_db
from app.modules.auth.models import User
from app.modules.auth.schemas import UserCreate, UserLogin, AuthResponse
from app.modules.auth.repository import user_repo

# OAuth2 schema for retrieving Bearer tokens
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

class AuthService:
    async def register_user(self, db: AsyncSession, user_in: UserCreate) -> AuthResponse:
        """
        Register a new user and return user details with an access token.
        """
        existing_user = await user_repo.get_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists.",
            )
        
        db_user = await user_repo.create(db, user_in)
        # Flush occurs in repo, session commit will happen via get_db middleware
        await db.commit()  # Make sure user is committed to issue token safely
        
        access_token = create_access_token(subject=db_user.id)
        return AuthResponse(user=db_user, access_token=access_token)

    async def authenticate_user(self, db: AsyncSession, login_in: UserLogin) -> AuthResponse:
        """
        Authenticate email and password; returns user and access token.
        """
        db_user = await user_repo.get_by_email(db, login_in.email)
        if not db_user or not verify_password(login_in.password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account has been deactivated.",
            )

        access_token = create_access_token(subject=db_user.id)
        return AuthResponse(user=db_user, access_token=access_token)

auth_service = AuthService()

# Dependency to fetch the currently authenticated user
async def get_current_user(
    db: AsyncSession = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user."
        )
    return user

# Factory dependency for role checks
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(self.allowed_roles)}",
            )
        return current_user
