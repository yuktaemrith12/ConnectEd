"""
Test suite: Authentication & Security
Covers: registration, login, JWT, password hashing, protected endpoints.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from jose import jwt

from conftest import (
    client, admin_token, teacher_token, student_token, parent_token,
    auth_header, ADMIN_EMAIL, TEACHER_EMAIL, STUDENT_EMAIL, TEST_PASSWORD,
    DELETED_STUDENT_EMAIL,
)
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.config import settings


# ── UT-AUTH-01: Password Hashing ───────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_produces_valid_bcrypt_string(self):
        """UT-AUTH-01: hash_password returns a bcrypt hash string."""
        h = hash_password("mysecret")
        assert h.startswith("$2b$")

    def test_hash_is_different_each_time(self):
        """UT-AUTH-02: bcrypt salt produces different hash each call."""
        h1 = hash_password("samepassword")
        h2 = hash_password("samepassword")
        assert h1 != h2, "Two bcrypt hashes of same input must differ due to salt"

    def test_verify_correct_password(self):
        """UT-AUTH-03: verify_password returns True for matching plaintext."""
        h = hash_password("correct_horse")
        assert verify_password("correct_horse", h) is True

    def test_verify_wrong_password(self):
        """UT-AUTH-04: verify_password returns False for wrong plaintext."""
        h = hash_password("correct_horse")
        assert verify_password("wrong_horse", h) is False


# ── UT-AUTH-02: JWT Token Handling ────────────────────────────────────────────

class TestJWTToken:
    def test_create_token_returns_string(self):
        """UT-AUTH-05: create_access_token returns a non-empty string."""
        token = create_access_token(subject="42", role="teacher")
        assert isinstance(token, str) and len(token) > 0

    def test_token_contains_correct_claims(self):
        """UT-AUTH-06: JWT payload contains correct sub and role."""
        token = create_access_token(subject="42", role="teacher")
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role"] == "teacher"

    def test_token_has_expiry(self):
        """UT-AUTH-07: JWT payload includes exp claim."""
        token = create_access_token(subject="1", role="admin")
        payload = decode_access_token(token)
        assert "exp" in payload

    def test_decode_invalid_token_returns_none(self):
        """UT-AUTH-08: decode_access_token returns None for garbage input."""
        result = decode_access_token("not.a.real.token")
        assert result is None

    def test_decode_tampered_token_returns_none(self):
        """UT-AUTH-09: decode_access_token returns None for tampered signature."""
        token = create_access_token(subject="1", role="admin")
        tampered = token[:-5] + "XXXXX"
        assert decode_access_token(tampered) is None

    def test_expired_token_returns_none(self):
        """UT-AUTH-10: Expired JWT returns None from decode."""
        from datetime import timedelta
        token = create_access_token(subject="1", role="admin", expires_delta=timedelta(seconds=-1))
        assert decode_access_token(token) is None


# ── UT-AUTH-03: Login Endpoint ─────────────────────────────────────────────────

class TestLoginEndpoint:
    def test_login_valid_admin(self, client):
        """UT-AUTH-11: POST /auth/login with valid admin credentials → 200 + token."""
        r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["role"] == "admin"

    def test_login_valid_teacher(self, client):
        """UT-AUTH-12: POST /auth/login with valid teacher credentials → 200 + token."""
        r = client.post("/api/v1/auth/login", json={"email": TEACHER_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client):
        """UT-AUTH-13: POST /auth/login with wrong password → 401."""
        r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_nonexistent_email(self, client):
        """UT-AUTH-14: POST /auth/login with non-existent email → 401."""
        r = client.post("/api/v1/auth/login", json={"email": "ghost@nowhere.com", "password": "12345"})
        assert r.status_code == 401

    def test_login_deleted_account(self, client):
        """UT-AUTH-15: POST /auth/login with soft-deleted account → 401 (inactive)."""
        # renveerr@student has deleted_at set and is_active=False
        r = client.post("/api/v1/auth/login", json={"email": DELETED_STUDENT_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_login_returns_user_info(self, client):
        """UT-AUTH-16: Login response includes email, role, full_name."""
        r = client.post("/api/v1/auth/login", json={"email": TEACHER_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        user = r.json()["user"]
        assert "email" in user
        assert "role" in user
        assert "full_name" in user


# ── UT-AUTH-04: Protected Endpoint Access ─────────────────────────────────────

class TestProtectedEndpoints:
    def test_no_token_returns_403(self, client):
        """UT-AUTH-17: GET /auth/me without token → 403 (HTTPBearer scheme)."""
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 403

    def test_invalid_token_returns_401(self, client):
        """UT-AUTH-18: GET /auth/me with invalid token → 401."""
        r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert r.status_code == 401

    def test_valid_token_returns_user(self, client, admin_token):
        """UT-AUTH-19: GET /auth/me with valid token → 200 + user info."""
        r = client.get("/api/v1/auth/me", headers=auth_header(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert data["is_active"] is True

    def test_malformed_bearer_header(self, client):
        """UT-AUTH-20: GET /auth/me with malformed Authorization header → 403."""
        r = client.get("/api/v1/auth/me", headers={"Authorization": "NotBearer token"})
        assert r.status_code == 403
