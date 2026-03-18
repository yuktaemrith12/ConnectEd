"""
Test suite: Role-Based Access Control (RBAC)
Covers: teacher/student/admin/parent role enforcement.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from conftest import (
    client, admin_token, teacher_token, student_token, parent_token, auth_header,
)


class TestRBACEnforcement:
    # ── Teacher-only endpoints ─────────────────────────────────────────────────

    def test_teacher_can_access_teacher_timetable(self, client, teacher_token):
        """UT-RBAC-01: Teacher accessing GET /teachers/timetable → 200."""
        r = client.get("/api/v1/teachers/timetable", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_student_cannot_access_teacher_timetable(self, client, student_token):
        """UT-RBAC-02: Student accessing GET /teachers/timetable → 403."""
        r = client.get("/api/v1/teachers/timetable", headers=auth_header(student_token))
        assert r.status_code == 403

    def test_parent_cannot_access_teacher_timetable(self, client, parent_token):
        """UT-RBAC-03: Parent accessing GET /teachers/timetable → 403."""
        r = client.get("/api/v1/teachers/timetable", headers=auth_header(parent_token))
        assert r.status_code == 403

    def test_teacher_can_access_homework_teacher(self, client, teacher_token):
        """UT-RBAC-04: Teacher accessing GET /homework/teacher → 200."""
        r = client.get("/api/v1/homework/teacher", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_student_cannot_access_homework_teacher(self, client, student_token):
        """UT-RBAC-05: Student accessing GET /homework/teacher → 403."""
        r = client.get("/api/v1/homework/teacher", headers=auth_header(student_token))
        assert r.status_code == 403

    # ── Admin-only endpoints ───────────────────────────────────────────────────

    def test_admin_can_access_dashboard(self, client, admin_token):
        """UT-RBAC-06: Admin accessing GET /admin/dashboard → 200."""
        r = client.get("/api/v1/admin/dashboard", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_teacher_cannot_access_admin_dashboard(self, client, teacher_token):
        """UT-RBAC-07: Teacher accessing GET /admin/dashboard → 403."""
        r = client.get("/api/v1/admin/dashboard", headers=auth_header(teacher_token))
        assert r.status_code == 403

    def test_parent_cannot_access_admin_dashboard(self, client, parent_token):
        """UT-RBAC-08: Parent accessing GET /admin/dashboard → 403."""
        r = client.get("/api/v1/admin/dashboard", headers=auth_header(parent_token))
        assert r.status_code == 403

    def test_student_cannot_access_admin_dashboard(self, client, student_token):
        """UT-RBAC-09: Student accessing GET /admin/dashboard → 403."""
        r = client.get("/api/v1/admin/dashboard", headers=auth_header(student_token))
        assert r.status_code == 403

    def test_admin_can_list_users(self, client, admin_token):
        """UT-RBAC-10: Admin accessing GET /admin/users → 200."""
        r = client.get("/api/v1/admin/users", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_teacher_cannot_list_admin_users(self, client, teacher_token):
        """UT-RBAC-11: Teacher accessing GET /admin/users → 403."""
        r = client.get("/api/v1/admin/users", headers=auth_header(teacher_token))
        assert r.status_code == 403

    # ── Student-only endpoints ─────────────────────────────────────────────────

    def test_student_can_access_student_timetable(self, client, student_token):
        """UT-RBAC-12: Student accessing GET /students/timetable → 200."""
        r = client.get("/api/v1/students/timetable", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_teacher_cannot_access_student_timetable(self, client, teacher_token):
        """UT-RBAC-13: Teacher accessing GET /students/timetable → 403."""
        r = client.get("/api/v1/students/timetable", headers=auth_header(teacher_token))
        assert r.status_code == 403

    def test_student_can_access_homework_student(self, client, student_token):
        """UT-RBAC-14: Student accessing GET /homework/student → 200."""
        r = client.get("/api/v1/homework/student", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_parent_cannot_access_homework_student(self, client, parent_token):
        """UT-RBAC-15: Parent accessing GET /homework/student → 403."""
        r = client.get("/api/v1/homework/student", headers=auth_header(parent_token))
        assert r.status_code == 403

    # ── Parent-only endpoints ──────────────────────────────────────────────────

    def test_parent_can_access_children(self, client, parent_token):
        """UT-RBAC-16: Parent accessing GET /parents/children → 200."""
        r = client.get("/api/v1/parents/children", headers=auth_header(parent_token))
        assert r.status_code == 200

    def test_student_cannot_access_parent_children(self, client, student_token):
        """UT-RBAC-17: Student accessing GET /parents/children → 403."""
        r = client.get("/api/v1/parents/children", headers=auth_header(student_token))
        assert r.status_code == 403

    def test_teacher_cannot_access_parent_children(self, client, teacher_token):
        """UT-RBAC-18: Teacher accessing GET /parents/children → 403."""
        r = client.get("/api/v1/parents/children", headers=auth_header(teacher_token))
        assert r.status_code == 403
