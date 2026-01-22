import re
from typing import Optional, Literal, List, Dict, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr

from backend.db import get_conn
from backend.security import decode_token, hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

EMAIL_RE = re.compile(r"^[a-z]+[a-z]@(student|teacher|admin)\.connected\.com$")


# -----------------------------
# Auth helpers
# -----------------------------
def get_token_from_header(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    return authorization.split(" ", 1)[1].strip()


def require_admin(token: str = Depends(get_token_from_header)):
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return payload


# -----------------------------
# Schemas
# -----------------------------
Role = Literal["student", "teacher", "admin"]


class CreateUserIn(BaseModel):
    role: Role
    full_name: str
    email: EmailStr
    password: str

    # student only
    class_id: Optional[int] = None

    # teacher only
    subject_id: Optional[int] = None
    class_ids: Optional[List[int]] = None  # many classes


# -----------------------------
# GET USERS
# -----------------------------
@router.get("/users")
def list_users(
    role: Role = Query(..., description="student | teacher | admin"),
    _admin=Depends(require_admin),
):
    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    try:
        if role == "student":
            cur.execute(
                """
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.status,
                    c.name AS class_name
                FROM users u
                JOIN roles r ON r.id = u.role_id
                LEFT JOIN student_profile sp ON sp.user_id = u.id
                LEFT JOIN classes c ON c.id = sp.class_id
                WHERE r.name = 'student'
                ORDER BY u.full_name ASC
                """
            )
            rows = cur.fetchall()
            return [
                {
                    "id": row["id"],
                    "full_name": row["full_name"],
                    "email": row["email"],
                    "status": row["status"],
                    "class": row["class_name"],
                }
                for row in rows
            ]

        if role == "teacher":
            # NOTE: teacher_classes uses teacher_user_id (NOT teacher_id / user_id)
            cur.execute(
                """
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.status,
                    s.name AS subject_name,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS class_names
                FROM users u
                JOIN roles r ON r.id = u.role_id
                LEFT JOIN teacher_profile tp ON tp.user_id = u.id
                LEFT JOIN subjects s ON s.id = tp.subject_id
                LEFT JOIN teacher_classes tc ON tc.teacher_user_id = u.id
                LEFT JOIN classes c ON c.id = tc.class_id
                WHERE r.name = 'teacher'
                GROUP BY u.id, u.full_name, u.email, u.status, s.name
                ORDER BY u.full_name ASC
                """
            )
            rows = cur.fetchall()
            return [
                {
                    "id": row["id"],
                    "full_name": row["full_name"],
                    "email": row["email"],
                    "status": row["status"],
                    "subject": row["subject_name"],
                    "classes": row["class_names"] or "",
                }
                for row in rows
            ]

        # admin
        cur.execute(
            """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.status
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE r.name = 'admin'
            ORDER BY u.full_name ASC
            """
        )
        rows = cur.fetchall()
        return [
            {
                "id": row["id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "status": row["status"],
            }
            for row in rows
        ]

    finally:
        cur.close()
        conn.close()


# -----------------------------
# CREATE USER
# -----------------------------
@router.post("/users")
def create_user(payload: CreateUserIn, _admin=Depends(require_admin)):
    # optional format enforcement
    if not EMAIL_RE.match(payload.email.lower()):
        raise HTTPException(status_code=400, detail="Invalid ConnectEd email format")

    conn = get_conn()
    cur = conn.cursor(dictionary=True)

    try:
        # role_id
        cur.execute("SELECT id FROM roles WHERE name=%s", (payload.role,))
        role_row = cur.fetchone()
        if not role_row:
            raise HTTPException(status_code=400, detail="Unknown role")
        role_id = role_row["id"]

        pw_hash = hash_password(payload.password)

        # create base user
        cur.execute(
            """
            INSERT INTO users (role_id, full_name, email, password_hash, status)
            VALUES (%s, %s, %s, %s, 'active')
            """,
            (role_id, payload.full_name, payload.email.lower(), pw_hash),
        )
        user_id = cur.lastrowid

        # role-specific inserts
        if payload.role == "student":
            if not payload.class_id:
                raise HTTPException(status_code=400, detail="class_id is required for student")

            cur.execute(
                "INSERT INTO student_profile (user_id, class_id) VALUES (%s, %s)",
                (user_id, payload.class_id),
            )

        elif payload.role == "teacher":
            if not payload.subject_id:
                raise HTTPException(status_code=400, detail="subject_id is required for teacher")

            cur.execute(
                "INSERT INTO teacher_profile (user_id, subject_id) VALUES (%s, %s)",
                (user_id, payload.subject_id),
            )

            class_ids = payload.class_ids or []
            for cid in class_ids:
                cur.execute(
                    "INSERT INTO teacher_classes (teacher_user_id, class_id) VALUES (%s, %s)",
                    (user_id, cid),
                )

        conn.commit()
        return {"ok": True, "user_id": user_id}

    finally:
        cur.close()
        conn.close()
