"""
Test suite: Database Model Tests
Covers: model creation, soft delete, unique constraints, relationships.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

from conftest import real_db
from app.models.user import User, Role
from app.models.admin import Class, StudentProfile
from app.core.security import hash_password


class TestUserModel:
    def test_user_record_exists_in_db(self, real_db):
        """UT-MODEL-01: User model maps to users table and returns records."""
        users = real_db.query(User).filter(User.deleted_at.is_(None)).all()
        assert len(users) > 0, "Expected users in database"

    def test_user_has_required_fields(self, real_db):
        """UT-MODEL-02: User model has id, email, hashed_password, full_name, role_id."""
        user = real_db.query(User).filter(User.email == "yuktae@admin.connected.com").first()
        assert user is not None
        assert user.id is not None
        assert user.email == "yuktae@admin.connected.com"
        assert user.hashed_password is not None
        assert user.full_name is not None
        assert user.role_id is not None

    def test_user_role_relationship_loads(self, real_db):
        """UT-MODEL-03: User.role relationship loads the Role object."""
        user = real_db.query(User).filter(User.email == "yuktae@admin.connected.com").first()
        assert user.role is not None
        assert user.role.name == "admin"

    def test_soft_deleted_user_has_deleted_at(self, real_db):
        """UT-MODEL-04: Soft-deleted user has deleted_at set and is_active=False."""
        # renveerr@student was soft-deleted in seed data
        deleted_user = real_db.query(User).filter(
            User.email == "renveerr@student.connected.com"
        ).first()
        assert deleted_user is not None
        assert deleted_user.deleted_at is not None
        assert deleted_user.is_active is False

    def test_soft_delete_filter_excludes_deleted(self, real_db):
        """UT-MODEL-05: Filtering User.deleted_at == None excludes soft-deleted."""
        active_users = real_db.query(User).filter(
            User.deleted_at == None  # noqa: E711
        ).all()
        emails = [u.email for u in active_users]
        assert "renveerr@student.connected.com" not in emails

    def test_all_role_types_exist(self, real_db):
        """UT-MODEL-06: Roles table has admin, teacher, student, parent."""
        roles = real_db.query(Role).all()
        role_names = {r.name for r in roles}
        assert {"admin", "teacher", "student", "parent"}.issubset(role_names)

    def test_user_email_is_unique(self, real_db):
        """UT-MODEL-07: Inserting duplicate email raises IntegrityError."""
        import time
        unique_email = f"dup_test_{int(time.time())}@test.com"
        admin_role = real_db.query(Role).filter(Role.name == "admin").first()

        user1 = User(
            email=unique_email,
            full_name="Dup Test 1",
            hashed_password=hash_password("pass"),
            role_id=admin_role.id,
        )
        real_db.add(user1)
        real_db.commit()

        user2 = User(
            email=unique_email,
            full_name="Dup Test 2",
            hashed_password=hash_password("pass"),
            role_id=admin_role.id,
        )
        real_db.add(user2)
        with pytest.raises(IntegrityError):
            real_db.commit()
        real_db.rollback()

        # Cleanup
        real_db.query(User).filter(User.email == unique_email).delete()
        real_db.commit()


class TestClassModel:
    def test_classes_exist_in_db(self, real_db):
        """UT-MODEL-08: Class model returns existing class records."""
        classes = real_db.query(Class).all()
        assert len(classes) > 0

    def test_class_has_name_field(self, real_db):
        """UT-MODEL-09: Class record has id and name fields."""
        cls = real_db.query(Class).first()
        assert cls.id is not None
        assert cls.name is not None

    def test_duplicate_class_name_raises_integrity_error(self, real_db):
        """UT-MODEL-10: Duplicate class name raises IntegrityError (unique constraint)."""
        import time
        unique_name = f"UniqueClass_{int(time.time())}"
        c1 = Class(name=unique_name)
        real_db.add(c1)
        real_db.commit()

        c2 = Class(name=unique_name)
        real_db.add(c2)
        with pytest.raises(IntegrityError):
            real_db.commit()
        real_db.rollback()

        # Cleanup
        real_db.query(Class).filter(Class.name == unique_name).delete()
        real_db.commit()


class TestStudentProfileModel:
    def test_student_profile_links_to_user(self, real_db):
        """UT-MODEL-11: StudentProfile.user_id is a valid foreign key to User."""
        profile = real_db.query(StudentProfile).first()
        assert profile is not None
        user = real_db.query(User).filter(User.id == profile.user_id).first()
        assert user is not None

    def test_student_profile_links_to_class(self, real_db):
        """UT-MODEL-12: StudentProfile.class_id is a valid foreign key to Class."""
        profile = real_db.query(StudentProfile).filter(
            StudentProfile.class_id.isnot(None)
        ).first()
        if profile:
            cls = real_db.query(Class).filter(Class.id == profile.class_id).first()
            assert cls is not None
