from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from db import get_conn
from security import decode_token


router = APIRouter(prefix="/admin", tags=["admin-dashboard"])


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
# Time helpers
# ---------------------------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_time_ago(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    now = _utcnow()
    # if DB returns naive, assume UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    delta = now - dt
    seconds = int(delta.total_seconds())

    if seconds < 60:
        return f"{seconds}s ago"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


# ---------------------------
# Queries
# ---------------------------
def _get_role_id(cur, role_name: str) -> Optional[int]:
    cur.execute("SELECT id FROM roles WHERE name=%s", (role_name,))
    row = cur.fetchone()
    return row["id"] if row else None


def _safe_int(x) -> int:
    try:
        return int(x or 0)
    except Exception:
        return 0


def _weekly_distribution_from_timetable(cur) -> List[Dict[str, Any]]:
    """
    Your current DB (from DESCRIBE) uses day_of_week ENUM('Monday'..'Friday') and `period` column.
    We compute recurring weekly distribution = number of timetable slots per day across all classes.
    """
    cur.execute(
        """
        SELECT
          day_of_week,
          COUNT(*) AS classes
        FROM class_timetable
        GROUP BY day_of_week
        """
    )
    rows = cur.fetchall() or []

    # normalize to Mon..Fri
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    short = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri"}
    counts = {r["day_of_week"]: _safe_int(r["classes"]) for r in rows}

    return [{"day": short[d], "classes": counts.get(d, 0)} for d in order]


def _enrollment_trend_students(cur, months_back: int = 5) -> List[Dict[str, Any]]:
    """
    Trend from users.created_at for STUDENT role.
    Returns last N months (including current) with cumulative total students up to each month end.
    """
    student_role_id = _get_role_id(cur, "student")
    if not student_role_id:
        return []

    now = _utcnow()
    # Month starts (UTC)
    # Build list of month starts for last N months
    month_starts = []
    y, m = now.year, now.month
    for i in range(months_back - 1, -1, -1):
        mm = m - i
        yy = y
        while mm <= 0:
            mm += 12
            yy -= 1
        month_starts.append(datetime(yy, mm, 1, tzinfo=timezone.utc))

    out = []
    for ms in month_starts:
        # end of that month: next month start
        ny, nm = ms.year, ms.month + 1
        if nm == 13:
            nm = 1
            ny += 1
        next_ms = datetime(ny, nm, 1, tzinfo=timezone.utc)

        # cumulative students up to end of month
        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM users
            WHERE role_id=%s
              AND status='active'
              AND created_at < %s
            """,
            (student_role_id, next_ms.replace(tzinfo=None)),  # mysql-connector often expects naive
        )
        cnt = _safe_int(cur.fetchone()["cnt"])
        out.append({"month": ms.strftime("%b"), "students": cnt})

    return out


def _recent_activities(cur, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Pull recent actions from admin_activity table (best),
    fallback to latest created records if table doesn't exist.
    """
    # Try activity table first
    try:
        cur.execute(
            """
            SELECT
              a.action,
              a.actor_name,
              a.created_at
            FROM admin_activity a
            ORDER BY a.created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall() or []
        return [
            {"action": r["action"], "user": r["actor_name"] or "System", "time": _fmt_time_ago(r["created_at"])}
            for r in rows
        ]
    except Exception:
        pass

    # Fallback: latest users/classes/timetable slots
    activities: List[Dict[str, Any]] = []

    # latest student
    try:
        student_role_id = _get_role_id(cur, "student")
        if student_role_id:
            cur.execute(
                """
                SELECT full_name, created_at
                FROM users
                WHERE role_id=%s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (student_role_id,),
            )
            r = cur.fetchone()
            if r:
                activities.append(
                    {"action": "New student enrolled", "user": r["full_name"], "time": _fmt_time_ago(r["created_at"])}
                )
    except Exception:
        pass

    # latest teacher
    try:
        teacher_role_id = _get_role_id(cur, "teacher")
        if teacher_role_id:
            cur.execute(
                """
                SELECT full_name, created_at
                FROM users
                WHERE role_id=%s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (teacher_role_id,),
            )
            r = cur.fetchone()
            if r:
                activities.append(
                    {"action": "Teacher added", "user": r["full_name"], "time": _fmt_time_ago(r["created_at"])}
                )
    except Exception:
        pass

    # latest class
    try:
        cur.execute(
            """
            SELECT name, id
            FROM classes
            ORDER BY id DESC
            LIMIT 1
            """
        )
        r = cur.fetchone()
        if r:
            activities.append({"action": "Class created", "user": r["name"], "time": "recently"})
    except Exception:
        pass

    # latest timetable slot
    try:
        cur.execute(
            """
            SELECT tt.id, c.name AS class_name
            FROM class_timetable tt
            JOIN classes c ON c.id = tt.class_id
            ORDER BY tt.id DESC
            LIMIT 1
            """
        )
        r = cur.fetchone()
        if r:
            activities.append({"action": "Timetable updated", "user": r["class_name"], "time": "recently"})
    except Exception:
        pass

    return activities[:limit]


def _stats(cur) -> Dict[str, Any]:
    # role ids
    student_role_id = _get_role_id(cur, "student")
    teacher_role_id = _get_role_id(cur, "teacher")

    # counts
    cur.execute("SELECT COUNT(*) AS cnt FROM classes")
    classes_cnt = _safe_int(cur.fetchone()["cnt"])

    cur.execute("SELECT COUNT(*) AS cnt FROM subjects")
    subjects_cnt = _safe_int(cur.fetchone()["cnt"])

    students_cnt = 0
    teachers_cnt = 0
    if student_role_id:
        cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE role_id=%s AND status='active'", (student_role_id,))
        students_cnt = _safe_int(cur.fetchone()["cnt"])
    if teacher_role_id:
        cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE role_id=%s AND status='active'", (teacher_role_id,))
        teachers_cnt = _safe_int(cur.fetchone()["cnt"])

    cur.execute("SELECT COUNT(*) AS cnt FROM class_timetable")
    sessions_cnt = _safe_int(cur.fetchone()["cnt"])

    # "this month" deltas
    # (based on users.created_at within current month)
    now = _utcnow()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).replace(tzinfo=None)

    students_delta = 0
    teachers_delta = 0
    if student_role_id:
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM users WHERE role_id=%s AND created_at >= %s",
            (student_role_id, month_start),
        )
        students_delta = _safe_int(cur.fetchone()["cnt"])
    if teacher_role_id:
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM users WHERE role_id=%s AND created_at >= %s",
            (teacher_role_id, month_start),
        )
        teachers_delta = _safe_int(cur.fetchone()["cnt"])

    return {
        "total_students": students_cnt,
        "students_delta_month": students_delta,
        "total_teachers": teachers_cnt,
        "teachers_delta_month": teachers_delta,
        "active_classes": classes_cnt,
        "subjects_count": subjects_cnt,
        "weekly_sessions": sessions_cnt,  # timetable slots (recurring weekly)
    }


# ---------------------------
# Endpoint
# ---------------------------
@router.get("/dashboard")
def get_dashboard(_admin=Depends(require_admin)):
    conn = get_conn()
    cur = _dict_cursor(conn)

    try:
        stats = _stats(cur)
        weekly = _weekly_distribution_from_timetable(cur)
        trend = _enrollment_trend_students(cur, months_back=5)
        activities = _recent_activities(cur, limit=6)

        # These are still “system-like” since you don’t have real infra tables:
        system_health = {"server_status": "Operational", "database": "Healthy", "active_sessions": 3}
        storage_usage = {"video_recordings": "2.4 TB", "documents": "156 GB", "total_available": "5 TB"}
        engagement_stats = {"avg_attendance": 92, "avg_engagement": 81, "sessions_recorded": 156}

        return {
            "stats": stats,
            "weekly_classes": weekly,
            "enrollment_trend": trend,
            "recent_activities": activities,
            "system_health": system_health,
            "storage_usage": storage_usage,
            "engagement_stats": engagement_stats,
        }
    finally:
        cur.close()
        conn.close()
