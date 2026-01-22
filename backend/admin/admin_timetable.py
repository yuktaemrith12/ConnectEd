# admin_timetable.py
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Path
from pydantic import BaseModel, field_validator

from backend.db import get_conn
from backend.security import decode_token



router = APIRouter(prefix="/admin", tags=["admin-timetable"])


# ---------------------------
# AUTH (same style as yours)
# ---------------------------
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
# Day mapping (UI uses 1..5, DB uses ENUM names)
# ---------------------------
DAY_NUM_TO_NAME = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday"}
DAY_NAME_TO_NUM = {"Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5}
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


# ---------------------------
# Schemas (keep same as frontend expectations)
# ---------------------------
class TimetableSlotCreateIn(BaseModel):
    class_id: int
    day_of_week: int  # 1..5 (from UI)
    period_no: int    # 1..N (from UI) -> DB column is `period`
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"
    subject_id: int
    teacher_user_id: Optional[int] = None

    @field_validator("day_of_week")
    @classmethod
    def _day_range(cls, v):
        if v < 1 or v > 5:
            raise ValueError("day_of_week must be 1..5")
        return v

    @field_validator("period_no")
    @classmethod
    def _period_range(cls, v):
        if v < 1:
            raise ValueError("period_no must be >= 1")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def _time_format(cls, v):
        if not isinstance(v, str) or len(v) != 5 or v[2] != ":":
            raise ValueError("time must be HH:MM")
        hh = int(v[0:2])
        mm = int(v[3:5])
        if hh < 0 or hh > 23 or mm < 0 or mm > 59:
            raise ValueError("invalid time")
        return v


class TimetableSlotUpdateIn(BaseModel):
    day_of_week: int
    period_no: int
    start_time: str
    end_time: str
    subject_id: int
    teacher_user_id: Optional[int] = None

    @field_validator("day_of_week")
    @classmethod
    def _day_range(cls, v):
        if v < 1 or v > 5:
            raise ValueError("day_of_week must be 1..5")
        return v

    @field_validator("period_no")
    @classmethod
    def _period_range(cls, v):
        if v < 1:
            raise ValueError("period_no must be >= 1")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def _time_format(cls, v):
        if not isinstance(v, str) or len(v) != 5 or v[2] != ":":
            raise ValueError("time must be HH:MM")
        hh = int(v[0:2])
        mm = int(v[3:5])
        if hh < 0 or hh > 23 or mm < 0 or mm > 59:
            raise ValueError("invalid time")
        return v


# ---------------------------
# Helpers
# ---------------------------
def _ensure_class_exists(cur, class_id: int):
    cur.execute("SELECT id FROM classes WHERE id=%s", (class_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Class not found")


def _ensure_subject_exists(cur, subject_id: int):
    cur.execute("SELECT id FROM subjects WHERE id=%s", (subject_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Subject not found")


def _ensure_teacher_exists(cur, teacher_user_id: int):
    cur.execute(
        """
        SELECT u.id
        FROM users u
        JOIN roles r ON r.id=u.role_id AND r.name='teacher'
        WHERE u.id=%s
        """,
        (teacher_user_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Teacher not found")


def _check_teacher_conflict(
    cur,
    teacher_user_id: int,
    day_name: str,   # DB enum string
    start_time: str,
    end_time: str,
    exclude_slot_id: Optional[int] = None,
):
    """
    Overlap rule: (new_start < existing_end) AND (new_end > existing_start)
    day_name is enum string (Monday..Friday)
    """
    if exclude_slot_id is None:
        cur.execute(
            """
            SELECT id, class_id, day_of_week, start_time, end_time
            FROM class_timetable
            WHERE teacher_user_id = %s
              AND day_of_week = %s
              AND (%s < end_time AND %s > start_time)
            """,
            (teacher_user_id, day_name, start_time, end_time),
        )
    else:
        cur.execute(
            """
            SELECT id, class_id, day_of_week, start_time, end_time
            FROM class_timetable
            WHERE teacher_user_id = %s
              AND day_of_week = %s
              AND id <> %s
              AND (%s < end_time AND %s > start_time)
            """,
            (teacher_user_id, day_name, exclude_slot_id, start_time, end_time),
        )
    return cur.fetchall()


def _slot_to_api_row(r: Dict[str, Any]) -> Dict[str, Any]:
    # DB day_of_week is a string
    day_name = r["day_of_week"]
    day_num = DAY_NAME_TO_NUM.get(day_name, 0)

    return {
        "id": r["id"],
        "day_of_week": day_num,     # UI expects int
        "day": day_name,            # nice for UI
        "period_no": int(r["period"]),  # UI expects period_no
        "start_time": (str(r["start_time"])[:5] if r["start_time"] is not None else "—"),
        "end_time": (str(r["end_time"])[:5] if r["end_time"] is not None else "—"),
        "subject": {"id": r["subject_id"], "name": r["subject_name"]},
        "teacher": None
        if r["teacher_user_id"] is None
        else {
            "id": r["teacher_user_id"],
            "full_name": r["teacher_name"],
            "email": r["teacher_email"],
        },
    }


def _group_timetable(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {d: [] for d in DAY_ORDER}

    for r in rows:
        d = r["day_of_week"]
        if d not in grouped:
            # ignore unexpected enum values
            continue
        grouped[d].append(_slot_to_api_row(r))

    out: List[Dict[str, Any]] = []
    for d in DAY_ORDER:
        grouped[d].sort(key=lambda x: (x["start_time"], x["period_no"]))
        out.append({"day": d, "day_of_week": DAY_NAME_TO_NUM[d], "classes": grouped[d]})
    return out


# ---------------------------
# Endpoints
# ---------------------------
@router.get("/timetable/{class_id}")
def get_timetable(class_id: int = Path(..., gt=0), _admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)

    _ensure_class_exists(cur, class_id)

    cur.execute(
        """
        SELECT
          tt.id,
          tt.class_id,
          tt.day_of_week,
          tt.period,
          tt.start_time,
          tt.end_time,
          tt.subject_id,
          s.name AS subject_name,
          tt.teacher_user_id,
          u.full_name AS teacher_name,
          u.email AS teacher_email
        FROM class_timetable tt
        JOIN subjects s ON s.id = tt.subject_id
        LEFT JOIN users u ON u.id = tt.teacher_user_id
        WHERE tt.class_id = %s
        ORDER BY FIELD(tt.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'),
                 tt.start_time, tt.period
        """,
        (class_id,),
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {"class_id": class_id, "timetable": _group_timetable(rows)}


@router.get("/timetable/conflicts/{class_id}")
def get_conflicts(class_id: int = Path(..., gt=0), _admin=Depends(require_admin)):
    """
    Returns teacher double-booking conflicts (this class vs other classes).
    """
    conn = get_conn()
    cur = _dict_cursor(conn)
    _ensure_class_exists(cur, class_id)

    cur.execute(
        """
        SELECT
          a.id AS slot_id,
          a.teacher_user_id,
          u.full_name AS teacher_name,
          a.day_of_week,
          a.start_time,
          a.end_time,
          a.class_id,
          c.name AS class_name
        FROM class_timetable a
        JOIN users u ON u.id = a.teacher_user_id
        JOIN classes c ON c.id = a.class_id
        WHERE a.class_id = %s AND a.teacher_user_id IS NOT NULL
        """,
        (class_id,),
    )
    slots = cur.fetchall()

    conflicts = []
    for s in slots:
        cur.execute(
            """
            SELECT
              b.id AS conflict_slot_id,
              b.class_id AS conflict_class_id,
              c2.name AS conflict_class_name,
              b.day_of_week,
              b.start_time,
              b.end_time
            FROM class_timetable b
            JOIN classes c2 ON c2.id = b.class_id
            WHERE b.teacher_user_id = %s
              AND b.day_of_week = %s
              AND b.id <> %s
              AND (%s < b.end_time AND %s > b.start_time)
            """,
            (
                s["teacher_user_id"],
                s["day_of_week"],  # enum string
                s["slot_id"],
                str(s["start_time"])[:5],
                str(s["end_time"])[:5],
            ),
        )
        hits = cur.fetchall()
        for h in hits:
            conflicts.append(
                {
                    "teacher": {"id": s["teacher_user_id"], "full_name": s["teacher_name"]},
                    "slot": {
                        "id": s["slot_id"],
                        "class_id": s["class_id"],
                        "class_name": s["class_name"],
                        "day_of_week": DAY_NAME_TO_NUM.get(s["day_of_week"], 0),
                        "start_time": str(s["start_time"])[:5],
                        "end_time": str(s["end_time"])[:5],
                    },
                    "conflict_with": {
                        **h,
                        "day_of_week": DAY_NAME_TO_NUM.get(h["day_of_week"], 0),
                        "start_time": str(h["start_time"])[:5],
                        "end_time": str(h["end_time"])[:5],
                    },
                }
            )

    cur.close()
    conn.close()
    return {"class_id": class_id, "conflicts": conflicts}


@router.post("/timetable/slot")
def create_slot(payload: TimetableSlotCreateIn, _admin=Depends(require_admin)):
    conn = get_conn()
    conn.autocommit = False
    cur = _dict_cursor(conn)

    try:
        _ensure_class_exists(cur, payload.class_id)
        _ensure_subject_exists(cur, payload.subject_id)

        day_name = DAY_NUM_TO_NAME[payload.day_of_week]  # convert for DB
        period = payload.period_no  # DB column name is `period`

        if payload.teacher_user_id is not None:
            _ensure_teacher_exists(cur, payload.teacher_user_id)
            conflicts = _check_teacher_conflict(
                cur,
                payload.teacher_user_id,
                day_name,
                payload.start_time,
                payload.end_time,
                exclude_slot_id=None,
            )
            if conflicts:
                raise HTTPException(
                    status_code=409,
                    detail={"message": "Teacher scheduling conflict", "conflicts": conflicts},
                )

        cur.execute(
            """
            INSERT INTO class_timetable
              (class_id, day_of_week, period, start_time, end_time, subject_id, teacher_user_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                payload.class_id,
                day_name,
                period,
                payload.start_time,
                payload.end_time,
                payload.subject_id,
                payload.teacher_user_id,
            ),
        )

        slot_id = cur.lastrowid
        conn.commit()
        return {"ok": True, "id": slot_id}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.put("/timetable/slot/{slot_id}")
def update_slot(
    slot_id: int = Path(..., gt=0),
    payload: TimetableSlotUpdateIn = None,
    _admin=Depends(require_admin),
):
    conn = get_conn()
    conn.autocommit = False
    cur = _dict_cursor(conn)

    try:
        cur.execute("SELECT * FROM class_timetable WHERE id=%s", (slot_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Slot not found")

        _ensure_subject_exists(cur, payload.subject_id)

        day_name = DAY_NUM_TO_NAME[payload.day_of_week]
        period = payload.period_no

        if payload.teacher_user_id is not None:
            _ensure_teacher_exists(cur, payload.teacher_user_id)
            conflicts = _check_teacher_conflict(
                cur,
                payload.teacher_user_id,
                day_name,
                payload.start_time,
                payload.end_time,
                exclude_slot_id=slot_id,
            )
            if conflicts:
                raise HTTPException(
                    status_code=409,
                    detail={"message": "Teacher scheduling conflict", "conflicts": conflicts},
                )

        cur.execute(
            """
            UPDATE class_timetable
            SET day_of_week=%s,
                period=%s,
                start_time=%s,
                end_time=%s,
                subject_id=%s,
                teacher_user_id=%s
            WHERE id=%s
            """,
            (
                day_name,
                period,
                payload.start_time,
                payload.end_time,
                payload.subject_id,
                payload.teacher_user_id,
                slot_id,
            ),
        )

        conn.commit()
        return {"ok": True}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.delete("/timetable/slot/{slot_id}")
def delete_slot(slot_id: int = Path(..., gt=0), _admin=Depends(require_admin)):
    conn = get_conn()
    conn.autocommit = False
    cur = _dict_cursor(conn)

    try:
        cur.execute("SELECT id FROM class_timetable WHERE id=%s", (slot_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Slot not found")

        cur.execute("DELETE FROM class_timetable WHERE id=%s", (slot_id,))
        conn.commit()
        return {"ok": True}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()
