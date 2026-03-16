from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import CurrentUser, LoginRequest, Token, UserCreate, UserRead
from app.services.auth_service import authenticate_user, register_user

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    return register_user(db, payload)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT access token with user info."""
    token = authenticate_user(db, payload)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return token


@router.get("/me", response_model=CurrentUser)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return CurrentUser(
        email=current_user.email,
        role=current_user.role.name,
        is_active=current_user.is_active,
    )
