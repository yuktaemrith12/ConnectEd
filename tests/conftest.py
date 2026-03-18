"""
Shared pytest fixtures for ConnectEd tests.
Uses the real MySQL database (read-only queries + isolated writes via rollback).
"""
import sys
import os

# Add the backend directory to sys.path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings

# ── Real DB fixtures ───────────────────────────────────────────────────────────

REAL_DB_URL = settings.get_database_url()

real_engine = create_engine(REAL_DB_URL, pool_pre_ping=True)
RealSession = sessionmaker(autocommit=False, autoflush=False, bind=real_engine)


def get_real_db():
    """Provide a real DB session for tests."""
    db = RealSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def real_db():
    """Session-scoped real DB connection."""
    db = RealSession()
    yield db
    db.close()


@pytest.fixture(scope="module")
def client():
    """TestClient using the real database."""
    app.dependency_overrides[get_db] = get_real_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Known test credentials (from seed file: password=12345) ───────────────────

ADMIN_EMAIL    = "yuktae@admin.connected.com"
TEACHER_EMAIL  = "emmaak@teacher.connected.com"
STUDENT_EMAIL  = "alice.wang@student.connected.com"
PARENT_EMAIL   = "john.smith@parent.connected.com"
TEST_PASSWORD  = "12345"

DELETED_STUDENT_EMAIL = "renveerr@student.connected.com"   # deleted_at is set


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def teacher_token(client):
    r = client.post("/api/v1/auth/login", json={"email": TEACHER_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Teacher login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def student_token(client):
    r = client.post("/api/v1/auth/login", json={"email": STUDENT_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Student login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def parent_token(client):
    r = client.post("/api/v1/auth/login", json={"email": PARENT_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Parent login failed: {r.text}"
    return r.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
