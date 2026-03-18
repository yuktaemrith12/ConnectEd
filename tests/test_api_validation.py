"""
Test suite: API Endpoint Validation
Covers: valid data → 200, missing fields → 422, data integrity tests.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from conftest import (
    client, admin_token, teacher_token, student_token, parent_token, auth_header,
)

# Known IDs from seed data
KNOWN_CLASS_ID = 1          # Grade 1-A
KNOWN_SUBJECT_ID = 1        # Math (from class_subject_teachers: teacher_id=8, class_id=1, subject_id=1)
KNOWN_TEACHER_ID = 8        # sarah.johnson@teacher.connected.com teaches subject 1 in class 1
KNOWN_STUDENT_ID = 18       # alice.wang@student.connected.com in Grade 1-A
KNOWN_PARENT_STUDENT_ID = 18  # john.smith's child is student_id=19

# Teacher 8 (sarah.johnson) maps to class 1, subject 1
SARAH_EMAIL = "sarah.johnson@teacher.connected.com"


@pytest.fixture(scope="module")
def sarah_token(client):
    r = client.post("/api/v1/auth/login", json={"email": SARAH_EMAIL, "password": "12345"})
    assert r.status_code == 200, f"Sarah login failed: {r.text}"
    return r.json()["access_token"]


class TestAdminEndpointValidation:
    def test_admin_create_class_valid(self, client, admin_token):
        """UT-VAL-01: POST /admin/classes with valid data → 201."""
        import time
        unique_name = f"TestClass_{int(time.time())}"
        r = client.post(
            "/api/v1/admin/classes",
            json={"name": unique_name},
            headers=auth_header(admin_token),
        )
        assert r.status_code in (200, 201), f"Unexpected status: {r.status_code} {r.text}"

    def test_admin_create_class_missing_name(self, client, admin_token):
        """UT-VAL-02: POST /admin/classes with missing name → 422 validation error."""
        r = client.post(
            "/api/v1/admin/classes",
            json={},
            headers=auth_header(admin_token),
        )
        assert r.status_code == 422

    def test_admin_get_classes(self, client, admin_token):
        """UT-VAL-03: GET /admin/classes → 200 with list."""
        r = client.get("/api/v1/admin/classes", headers=auth_header(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_get_timetable(self, client, admin_token):
        """UT-VAL-04: GET /admin/timetable?class_id=1 → 200."""
        r = client.get(f"/api/v1/admin/timetable?class_id={KNOWN_CLASS_ID}", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_admin_dashboard_stats(self, client, admin_token):
        """UT-VAL-05: GET /admin/dashboard → 200 with stats fields."""
        r = client.get("/api/v1/admin/dashboard", headers=auth_header(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "total_students" in data or "students" in str(data)


class TestTeacherEndpointValidation:
    def test_teacher_get_timetable(self, client, teacher_token):
        """UT-VAL-06: GET /teachers/timetable → 200."""
        r = client.get("/api/v1/teachers/timetable", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_teacher_get_homework_list(self, client, teacher_token):
        """UT-VAL-07: GET /homework/teacher → 200 with list."""
        r = client.get("/api/v1/homework/teacher", headers=auth_header(teacher_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_teacher_create_homework_valid(self, client, sarah_token):
        """UT-VAL-08: POST /homework/teacher with valid data → 200."""
        r = client.post(
            f"/api/v1/homework/teacher?class_id={KNOWN_CLASS_ID}&subject_id={KNOWN_SUBJECT_ID}&title=Test+Homework",
            headers=auth_header(sarah_token),
        )
        assert r.status_code == 200, f"Unexpected: {r.status_code} {r.text}"

    def test_teacher_create_homework_missing_title(self, client, sarah_token):
        """UT-VAL-09: POST /homework/teacher without title → 422."""
        r = client.post(
            f"/api/v1/homework/teacher?class_id={KNOWN_CLASS_ID}&subject_id={KNOWN_SUBJECT_ID}",
            headers=auth_header(sarah_token),
        )
        assert r.status_code == 422

    def test_teacher_get_my_classes(self, client, teacher_token):
        """UT-VAL-10: GET /homework/teacher/my-classes → 200."""
        r = client.get("/api/v1/homework/teacher/my-classes", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_teacher_get_attendance_classes(self, client, teacher_token):
        """UT-VAL-11: GET /teachers/attendance/my-classes → 200."""
        r = client.get("/api/v1/teachers/attendance/my-classes", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_teacher_get_assignments(self, client, teacher_token):
        """UT-VAL-12: GET /assignments/teacher → 200."""
        r = client.get("/api/v1/assignments/teacher", headers=auth_header(teacher_token))
        assert r.status_code == 200


class TestStudentEndpointValidation:
    def test_student_get_timetable(self, client, student_token):
        """UT-VAL-13: GET /students/timetable → 200."""
        r = client.get("/api/v1/students/timetable", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_student_get_homework(self, client, student_token):
        """UT-VAL-14: GET /homework/student → 200 with list."""
        r = client.get("/api/v1/homework/student", headers=auth_header(student_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_student_get_attendance(self, client, student_token):
        """UT-VAL-15: GET /students/attendance → 200."""
        r = client.get("/api/v1/students/attendance", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_student_get_assignments(self, client, student_token):
        """UT-VAL-16: GET /assignments/student → 200."""
        r = client.get("/api/v1/assignments/student", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_student_get_profile(self, client, student_token):
        """UT-VAL-17: GET /students/profile → 200."""
        r = client.get("/api/v1/students/profile", headers=auth_header(student_token))
        assert r.status_code == 200


class TestParentEndpointValidation:
    def test_parent_get_children(self, client, parent_token):
        """UT-VAL-18: GET /parents/children → 200."""
        r = client.get("/api/v1/parents/children", headers=auth_header(parent_token))
        assert r.status_code == 200

    def test_parent_get_child_attendance(self, client, parent_token):
        """UT-VAL-19: GET /parents/attendance/{student_id} for own child → 200."""
        # john.smith's child is student 19 (bob.smith)
        r = client.get(f"/api/v1/parents/attendance/19", headers=auth_header(parent_token))
        assert r.status_code == 200

    def test_parent_get_child_grades(self, client, parent_token):
        """UT-VAL-20: GET /parents/{student_id}/grades for own child → 200."""
        r = client.get(f"/api/v1/parents/19/grades", headers=auth_header(parent_token))
        assert r.status_code == 200


class TestMessagingEndpointValidation:
    def test_get_contacts(self, client, teacher_token):
        """UT-VAL-21: GET /messages/contacts → 200."""
        r = client.get("/api/v1/messages/contacts", headers=auth_header(teacher_token))
        assert r.status_code == 200

    def test_get_conversations(self, client, student_token):
        """UT-VAL-22: GET /messages/conversations → 200."""
        r = client.get("/api/v1/messages/conversations", headers=auth_header(student_token))
        assert r.status_code == 200

    def test_send_message_missing_fields(self, client, teacher_token):
        """UT-VAL-23: POST /messages/conversations/{id}/send without body → 422."""
        r = client.post(
            "/api/v1/messages/conversations/1/send",
            json={},
            headers=auth_header(teacher_token),
        )
        assert r.status_code == 422
