from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from db import get_conn
from security import verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginIn(BaseModel):
    email: EmailStr
    password: str

@router.post("/login")
def login(payload: LoginIn):
    email = payload.email.strip().lower()

    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    cur.execute(
        """
        SELECT u.id, u.full_name, u.email, u.password_hash, u.status, r.name AS role
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.email = %s
        """,
        (email,),
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(
        {
            "sub": str(user["id"]),
            "role": user["role"],
            "email": user["email"],
            "full_name": user["full_name"],
        }
    )

    return {
        "token": token,
        "role": user["role"],
        "full_name": user["full_name"],
        "email": user["email"],
    }
