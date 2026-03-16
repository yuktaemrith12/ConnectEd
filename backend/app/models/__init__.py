from app.models.user import Role, User  # noqa: F401 — ensures models are registered with Base
from app.models.admin import (  # noqa: F401
    Class, ClassSubject, StudentProfile, Subject, TimetableEntry,
    TeacherProfile, ParentStudent, TeacherSubject,
)
