"""
Admin-domain SQLAlchemy models.

Tables (in migration order):
  02_admin_features.sql:
    subjects          — master list of subjects
    classes           — classroom entities
    class_subjects    — M:M junction between classes and subjects
    student_profiles  — extends User for students (class assignment, internal code)
    timetable_entries — weekly slot scheduling per class

  03_user_management_upgrade.sql:
    teacher_profiles  — extends User for teachers (staff_id, bio, etc.)
    parent_students   — M:M parent ↔ student with relationship_type
    teacher_subjects  — M:M teacher ↔ subject
"""

from sqlalchemy import (
    Column, Integer, String, ForeignKey, UniqueConstraint, Date, Text,
    Boolean, Time, DateTime, SmallInteger, func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

    timetable_entries = relationship("TimetableEntry", back_populates="subject")


class Class(Base):
    __tablename__ = "classes"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(100), unique=True, nullable=False)
    head_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    head_teacher     = relationship("User", foreign_keys=[head_teacher_id])
    subjects         = relationship("Subject", secondary="class_subjects", viewonly=True)
    student_profiles = relationship("StudentProfile", back_populates="class_")
    timetable_entries = relationship("TimetableEntry", back_populates="class_")


class ClassSubject(Base):
    __tablename__ = "class_subjects"

    class_id   = Column(Integer, ForeignKey("classes.id"),  primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    class_id     = Column(Integer, ForeignKey("classes.id"), nullable=True)
    student_code = Column(String(20), unique=True, nullable=True)   # e.g. ST0001
    dob          = Column(Date, nullable=True)
    address      = Column(String(255), nullable=True)
    phone        = Column(String(20), nullable=True)

    user   = relationship("User",  foreign_keys=[user_id])
    class_ = relationship("Class", back_populates="student_profiles")


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id       = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    staff_id = Column(String(20), unique=True, nullable=True)   # e.g. TCH001
    dob      = Column(Date, nullable=True)
    address  = Column(String(255), nullable=True)
    phone    = Column(String(20), nullable=True)
    bio      = Column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class ParentStudent(Base):
    """Many-to-many: parent user ↔ student user."""
    __tablename__ = "parent_students"

    parent_id         = Column(Integer, ForeignKey("users.id"), primary_key=True)
    student_id        = Column(Integer, ForeignKey("users.id"), primary_key=True)
    relationship_type = Column(String(50), default="Guardian")


class TeacherSubject(Base):
    """Many-to-many: teacher user ↔ subject."""
    __tablename__ = "teacher_subjects"

    teacher_id = Column(Integer, ForeignKey("users.id"),    primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)


class ClassSubjectTeacher(Base):
    """Many-to-many: which teacher teaches which subject in which class."""
    __tablename__ = "class_subject_teachers"

    class_id   = Column(Integer, ForeignKey("classes.id"),  primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)
    teacher_id = Column(Integer, ForeignKey("users.id"),    primary_key=True)

    teacher = relationship("User", foreign_keys=[teacher_id])
    subject = relationship("Subject", foreign_keys=[subject_id])


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id           = Column(Integer, primary_key=True, index=True)
    class_id     = Column(Integer, ForeignKey("classes.id"),   nullable=False)
    subject_id   = Column(Integer, ForeignKey("subjects.id"),  nullable=False)
    teacher_id   = Column(Integer, ForeignKey("users.id"),     nullable=True)
    is_published = Column(Boolean, nullable=False, default=False)
    day          = Column(String(10), nullable=False)          # Monday … Friday
    day_of_week  = Column(SmallInteger, nullable=True)         # 0=Mon, 4=Fri
    time_slot    = Column(String(10), nullable=False)           # 9:00, 10:00 …
    start_time   = Column(Time, nullable=True)
    end_time     = Column(Time, nullable=True)
    room            = Column(String(100), nullable=True)
    online_link     = Column(String(500), nullable=True)
    delivery_mode   = Column(String(10), nullable=False, default="ONSITE")   # "ONLINE" | "ONSITE"
    location_id     = Column(Integer, ForeignKey("locations.id"), nullable=True)
    online_join_url = Column(String(500), nullable=True)
    online_provider = Column(String(50), nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("class_id", "day", "time_slot", name="uq_timetable_slot"),
    )

    class_   = relationship("Class",   back_populates="timetable_entries")
    subject  = relationship("Subject", back_populates="timetable_entries")
    teacher  = relationship("User",    foreign_keys=[teacher_id])
    location = relationship("Location", foreign_keys=[location_id])
