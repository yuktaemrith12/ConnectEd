from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, time


# ── Users — Base ──────────────────────────────────────────────────────────────

class AdminUserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    class_name: Optional[str] = None   # only populated for students
    is_active: bool

    class Config:
        from_attributes = True


class StatusToggle(BaseModel):
    is_active: bool


class AssignClass(BaseModel):
    class_id: int


# ── Users — Create ────────────────────────────────────────────────────────────

class StudentCreateData(BaseModel):
    class_id: Optional[int] = None
    dob: Optional[date] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class TeacherCreateData(BaseModel):
    subject_ids: Optional[List[int]] = None  # None = don't touch; [] = clear all
    dob: Optional[date] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


class ParentCreateData(BaseModel):
    student_ids: List[int] = []
    relationship: str = "Guardian"
    phone: Optional[str] = None
    address: Optional[str] = None


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    role: str                                   # student | teacher | parent
    student: Optional[StudentCreateData] = None
    teacher: Optional[TeacherCreateData] = None
    parent: Optional[ParentCreateData] = None


# ── Users — Detail ────────────────────────────────────────────────────────────

class UserDetailRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    class_name: Optional[str] = None
    student_code: Optional[str] = None
    staff_id: Optional[str] = None
    dob: Optional[date] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    subject_ids: List[int] = []
    linked_student_ids: List[int] = []
    linked_parent_ids: List[int] = []

    class Config:
        from_attributes = True


# ── Users — Links ─────────────────────────────────────────────────────────────

class LinkCreate(BaseModel):
    type: str               # "parent_student" or "teacher_subject"
    target_ids: List[int]
    relationship: str = "Guardian"


# ── Users — Update ────────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    student: Optional[StudentCreateData] = None
    teacher: Optional[TeacherCreateData] = None
    parent: Optional[ParentCreateData] = None


# ── Users — Password Reset ────────────────────────────────────────────────────

class PasswordReset(BaseModel):
    new_password: str = "12345"


# ── Students — Lightweight Search Result ─────────────────────────────────────

class StudentSearchResult(BaseModel):
    id: int
    full_name: str
    class_name: Optional[str] = None


# ── Subjects ─────────────────────────────────────────────────────────────────

class SubjectRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ── Classes ──────────────────────────────────────────────────────────────────

class ClassRead(BaseModel):
    id: int
    name: str
    head_teacher_id: Optional[int] = None
    head_teacher_name: Optional[str] = None
    student_count: int = 0
    subject_count: int = 0

    class Config:
        from_attributes = True


class ClassCreate(BaseModel):
    name: str


class SubjectTeacherMapping(BaseModel):
    subject_id: int
    teacher_id: int


class ManageClass(BaseModel):
    teacher_id: Optional[int] = None   # Head teacher
    subject_ids: List[int] = []        # Standard subject list (fallback)
    mappings: List[SubjectTeacherMapping] = [] # Detailed mappings


# ── Timetable ────────────────────────────────────────────────────────────────

class TimetableSlot(BaseModel):
    day: str
    time_slot: str
    subject_id: int
    subject_name: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    delivery_mode: Optional[str] = "ONSITE"  # "ONLINE" | "ONSITE"
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    online_join_url: Optional[str] = None


class TimetableBulk(BaseModel):
    slots: List[TimetableSlot]


class TimetableEntryCreate(BaseModel):
    """Create a single timetable entry (draft by default)."""
    class_id: int
    subject_id: int
    teacher_id: Optional[int] = None
    day: str                             # Monday … Friday
    time_slot: str                       # 9:00, 10:00 …
    start_time: Optional[str] = None     # HH:MM
    end_time: Optional[str] = None
    room: Optional[str] = None
    online_link: Optional[str] = None


class TimetableEntryUpdate(BaseModel):
    """Partial update for a timetable entry."""
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day: Optional[str] = None
    time_slot: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    online_link: Optional[str] = None


class TimetablePublish(BaseModel):
    """Publish all draft entries for a class group."""
    class_id: int
    publish_all: bool = True


class TimetableEntryOut(BaseModel):
    """Shared response DTO for student + teacher timetable views."""
    id: int
    class_id: int
    class_name: Optional[str] = None
    subject_id: int
    subject_name: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    day: str
    day_of_week: Optional[int] = None
    time_slot: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    online_link: Optional[str] = None
    is_published: bool = False
    delivery_mode: Optional[str] = None
    location_name: Optional[str] = None
    online_join_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Teacher read (lightweight, for dropdowns) ────────────────────────────────

class TeacherRead(BaseModel):
    id: int
    full_name: str

    class Config:
        from_attributes = True


# ── Class Config (aggregated view) ───────────────────────────────────────────

class ClassConfigRead(BaseModel):
    head_teacher_id: Optional[int] = None
    subjects: List[SubjectRead] = []
    teacher_assignment: Dict[int, Optional[int]] = {}        # subject_id → teacher_id
    eligible_teachers_by_subject: Dict[int, List[TeacherRead]] = {}  # subject_id → teachers

    class Config:
        from_attributes = True


class ClassConfigUpdate(BaseModel):
    head_teacher_id: Optional[int] = None
    subjects: List[int] = []
    subject_teacher_map: Dict[int, int] = {}  # subject_id → teacher_id

