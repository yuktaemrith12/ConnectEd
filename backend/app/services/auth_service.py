from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserCreate, UserInToken


def register_user(db: Session, payload: UserCreate) -> User:
    """Create a new user with a hashed password."""
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role_id=payload.role_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> Token | None:
    """Return a JWT token (with user info) if credentials are valid, else None."""
    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        return None
    token = create_access_token(subject=str(user.id), role=user.role.name)
    return Token(
        access_token=token,
        user=UserInToken(email=user.email, role=user.role.name, full_name=user.full_name),
    )
