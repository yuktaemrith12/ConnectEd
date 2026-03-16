"""
FastAPI RBAC dependencies.

Usage:
    from app.core.dependencies import get_current_user, require_role, require_ownership

    @router.get("/admin-only")
    def admin_endpoint(user=Depends(require_role("admin"))):
        ...

    @router.get("/grades/{id}")
    def get_grade(id: int, record=Depends(require_ownership(Grade, "student_id"))):
        return record
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the active User, or raise 401."""
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or disabled",
        )
    return user


def require_role(*allowed_roles: str):
    """Return a dependency that enforces one of the given roles."""

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}",
            )
        return user

    return _check


def require_ownership(model, owner_field: str):
    """
    Dependency factory that fetches a record by path param `id` and verifies
    the current user owns it (i.e. record.<owner_field> == current_user.id).

    Usage:
        @router.get("/submissions/{id}")
        def get_submission(record=Depends(require_ownership(Submission, "student_id"))):
            return record

    Raises:
        404 if the record does not exist.
        403 if the record exists but is owned by another user.
    """

    def _check(
        id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        record = db.query(model).filter(model.id == id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found",
            )
        owner_id = getattr(record, owner_field, None)
        if owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not own this resource",
            )
        return record

    return _check
