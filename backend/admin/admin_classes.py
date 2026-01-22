# admin_classes.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Path
from pydantic import BaseModel

from backend.db import get_conn
from backend.security import decode_token


router = APIRouter(prefix="/admin", tags=["admin"])


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


def _dict_cursor(conn):
    return conn.cursor(dictionary=True)


# ---------------------------
# Schemas
# ---------------------------
class AssignStudentsIn(BaseModel):
    class_id: int
    student_ids: List[int]


class AssignTeachersIn(BaseModel):
    class_id: int
    teacher_ids: List[int]  # replace teachers for this class


# ---------------------------
# Existing endpoints (subjects/teachers/students) stay the same
# ---------------------------

@router.get("/subjects")
def list_subjects(_admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)
    cur.execute("SELECT id, name FROM subjects ORDER BY name")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@router.get("/teachers")
def list_teachers(_admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)

    cur.execute(
        """
        SELECT
          u.id,
          u.full_name,
          u.email,
          tp.subject_id,
          s.name AS subject_name
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
        LEFT JOIN teacher_profile tp ON tp.user_id = u.id
        LEFT JOIN subjects s ON s.id = tp.subject_id
        WHERE u.status = 'active'
        ORDER BY u.full_name
        """
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "full_name": r["full_name"],
            "email": r["email"],
            "subject": None if r["subject_id"] is None else {"id": r["subject_id"], "name": r["subject_name"]},
        })
    return out


@router.get("/students")
def list_students(_admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)

    cur.execute(
        """
        SELECT
          u.id,
          u.full_name,
          u.email,
          sp.class_id,
          c.name AS class_name
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'student'
        LEFT JOIN student_profile sp ON sp.user_id = u.id
        LEFT JOIN classes c ON c.id = sp.class_id
        WHERE u.status = 'active'
        ORDER BY u.full_name
        """
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "full_name": r["full_name"],
            "email": r["email"],
            "class": None if r["class_id"] is None else {"id": r["class_id"], "name": r["class_name"]},
        })
    return out


# ---------------------------
# ✅ UPDATED: Classes list now uses teacher_classes + teacher_profile(subject)
# ---------------------------
@router.get("/classes")
def list_classes(_admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)

    cur.execute(
        """
        SELECT
          c.id,
          c.name,
          (
            SELECT COUNT(*)
            FROM student_profile sp
            WHERE sp.class_id = c.id
          ) AS students_count,
          COUNT(DISTINCT tc.teacher_user_id) AS teachers_count,
          GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR '||') AS subject_names
        FROM classes c
        LEFT JOIN teacher_classes tc ON tc.class_id = c.id
        LEFT JOIN teacher_profile tp ON tp.user_id = tc.teacher_user_id
        LEFT JOIN subjects s ON s.id = tp.subject_id
        GROUP BY c.id, c.name
        ORDER BY c.name
        """
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    out = []
    for r in rows:
        subject_names = r["subject_names"] or ""
        subjects = [x for x in subject_names.split("||") if x.strip()] if subject_names else []
        out.append({
            "id": r["id"],
            "name": r["name"],
            "students_count": int(r["students_count"] or 0),
            "teachers_count": int(r["teachers_count"] or 0),
            "subjects": subjects,  # aggregated subject labels (unique)
        })
    return out


# ---------------------------
# ✅ New: list teachers assigned to a specific class
# ---------------------------
@router.get("/classes/{class_id}/teachers")
def list_teachers_in_class(
    class_id: int = Path(..., gt=0),
    _admin=Depends(require_admin)
):
    conn = get_conn()
    cur = _dict_cursor(conn)

    cur.execute(
        """
        SELECT
          u.id,
          u.full_name,
          u.email,
          tp.subject_id,
          s.name AS subject_name
        FROM teacher_classes tc
        JOIN users u ON u.id = tc.teacher_user_id
        JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
        LEFT JOIN teacher_profile tp ON tp.user_id = u.id
        LEFT JOIN subjects s ON s.id = tp.subject_id
        WHERE tc.class_id = %s
          AND u.status = 'active'
        ORDER BY u.full_name
        """,
        (class_id,),
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "full_name": r["full_name"],
            "email": r["email"],
            "subject": None if r["subject_id"] is None else {"id": r["subject_id"], "name": r["subject_name"]},
        })
    return out


# ---------------------------
# ✅ New: assign teachers to class (replace mode)
# ---------------------------
@router.post("/assign-teachers")
def assign_teachers(payload: AssignTeachersIn, _admin=Depends(require_admin)):
    if payload.teacher_ids is None:
        raise HTTPException(status_code=400, detail="teacher_ids is required")

    conn = get_conn()
    conn.autocommit = False
    cur = _dict_cursor(conn)

    try:
        # Validate class exists
        cur.execute("SELECT id FROM classes WHERE id=%s", (payload.class_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Class not found")

        # Replace teachers for this class
        cur.execute("DELETE FROM teacher_classes WHERE class_id=%s", (payload.class_id,))

        if payload.teacher_ids:
            values = [(tid, payload.class_id) for tid in payload.teacher_ids]
            cur.executemany(
                """
                INSERT INTO teacher_classes (teacher_user_id, class_id)
                VALUES (%s, %s)
                """,
                values,
            )

        conn.commit()
        return {"ok": True, "assigned": len(payload.teacher_ids)}

    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ---------------------------
# Existing: students in class (keep yours)
# ---------------------------
@router.get("/classes/{class_id}/students")
def list_students_in_class(
    class_id: int = Path(..., gt=0),
    _admin=Depends(require_admin)
):
    conn = get_conn()
    cur = _dict_cursor(conn)

    cur.execute(
        """
        SELECT
          u.id,
          u.full_name,
          u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'student'
        JOIN student_profile sp ON sp.user_id = u.id
        WHERE sp.class_id = %s
          AND u.status = 'active'
        ORDER BY u.full_name
        """,
        (class_id,),
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@router.post("/assign-students")
def assign_students(payload: AssignStudentsIn, _admin=Depends(require_admin)):
    if not payload.student_ids:
        raise HTTPException(status_code=400, detail="student_ids cannot be empty")

    conn = get_conn()
    conn.autocommit = False
    cur = _dict_cursor(conn)

    try:
        cur.execute("SELECT id FROM classes WHERE id=%s", (payload.class_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Class not found")

        values = [(sid, payload.class_id) for sid in payload.student_ids]
        cur.executemany(
            """
            INSERT INTO student_profile (user_id, class_id)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE class_id = VALUES(class_id)
            """,
            values,
        )

        conn.commit()
        return {"ok": True, "assigned": len(payload.student_ids)}

    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
