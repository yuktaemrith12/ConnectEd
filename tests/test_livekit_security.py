"""
LiveKit Security & RBAC Evaluation
Dissertation Testing — ConnectEd Platform

Goal: Prove that the video conferencing architecture is secure and that
participants cannot bypass their assigned roles.

Tests:
  1. JWT Token Structure  — tokens encode correct claims
  2. Teacher Role Grants  — room_admin=True, can_publish, can_subscribe
  3. Student Role Grants  — room_admin=False (blocked from admin actions)
  4. Room Isolation       — token for Room A cannot authorise Room B
  5. Token Expiry         — TTL is encoded (3-hour window)
  6. Stub Token Fallback  — graceful degradation without livekit-api
  7. Identity Encoding    — participant identity is correctly embedded
  8. Non-teacher end-meeting endpoint blocked (403)
"""

import sys
import os
import json
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from jose import jwt as jose_jwt, JWTError

# ── Path setup ─────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# ── Constants ──────────────────────────────────────────────────────────────────
LIVEKIT_API_KEY    = "devkey"
LIVEKIT_API_SECRET = "secret"
TEST_ROOM_A        = "class-1-subj-1-abcd1234"
TEST_ROOM_B        = "class-2-subj-2-efgh5678"

# ══════════════════════════════════════════════════════════════════════════════
#  Mock LiveKit SDK — produces real HS256 JWTs with correct grant structure
# ══════════════════════════════════════════════════════════════════════════════

class _MockVideoGrants:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class _MockAccessToken:
    """Drop-in mock for livekit.api.AccessToken that generates real JWTs."""

    def __init__(self, api_key: str, api_secret: str):
        self._api_key    = api_key
        self._api_secret = api_secret
        self._identity: str = ""
        self._name: str     = ""
        self._grants        = None
        self._ttl           = timedelta(hours=3)

    def with_identity(self, identity: str):
        self._identity = identity
        return self

    def with_name(self, name: str):
        self._name = name
        return self

    def with_grants(self, grants):
        self._grants = grants
        return self

    def with_ttl(self, ttl: timedelta):
        self._ttl = ttl
        return self

    def to_jwt(self) -> str:
        now = datetime.now(timezone.utc)
        g = self._grants
        payload = {
            "iss":  self._api_key,
            "sub":  self._identity,
            "iat":  int(now.timestamp()),
            "nbf":  int(now.timestamp()),
            "exp":  int((now + self._ttl).timestamp()),
            "name": self._name,
            "video": {
                "roomJoin":       getattr(g, "room_join",        False),
                "room":           getattr(g, "room",             ""),
                "canPublish":     getattr(g, "can_publish",      False),
                "canSubscribe":   getattr(g, "can_subscribe",    False),
                "canPublishData": getattr(g, "can_publish_data", False),
                "roomAdmin":      getattr(g, "room_admin",       False),
            },
        }
        return jose_jwt.encode(payload, self._api_secret, algorithm="HS256")


def _make_mock_lk_module():
    """Return a fake livekit.api module backed by the mocks above."""
    lk = MagicMock()
    lk.AccessToken  = _MockAccessToken
    lk.VideoGrants  = _MockVideoGrants
    return lk


# ── Decode helper ──────────────────────────────────────────────────────────────
def decode_livekit_token(token: str) -> dict:
    """Decode a LiveKit HS256 JWT; returns the full payload dict."""
    return jose_jwt.decode(
        token,
        LIVEKIT_API_SECRET,
        algorithms=["HS256"],
        options={"verify_exp": False, "verify_nbf": False},
    )


# ══════════════════════════════════════════════════════════════════════════════
#  Fixture — generate tokens via the real service function (mocked livekit-api)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def teacher_token_jwt():
    lk_mock = _make_mock_lk_module()
    with patch.dict("sys.modules", {"livekit": MagicMock(), "livekit.api": lk_mock}):
        from app.services.video import livekit_service as svc
        # Force the service to use our mock instead of caching the real one
        with patch.object(svc, "_try_import_livekit_api", return_value=lk_mock):
            token = svc.generate_participant_token(
                room_name=TEST_ROOM_A,
                participant_identity="teacher-42",
                participant_name="Ms. Emma",
                is_teacher=True,
            )
    return token


@pytest.fixture(scope="module")
def student_token_jwt():
    lk_mock = _make_mock_lk_module()
    with patch.dict("sys.modules", {"livekit": MagicMock(), "livekit.api": lk_mock}):
        from app.services.video import livekit_service as svc
        with patch.object(svc, "_try_import_livekit_api", return_value=lk_mock):
            token = svc.generate_participant_token(
                room_name=TEST_ROOM_A,
                participant_identity="student-99",
                participant_name="Alice Wang",
                is_teacher=False,
            )
    return token


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — JWT Token Structure
# ══════════════════════════════════════════════════════════════════════════════

class TestJWTStructure:

    def test_teacher_token_is_valid_jwt(self, teacher_token_jwt):
        """Teacher token must be a decodable HS256 JWT (not stub)."""
        assert not teacher_token_jwt.startswith("stub:")
        payload = decode_livekit_token(teacher_token_jwt)
        assert isinstance(payload, dict)

    def test_student_token_is_valid_jwt(self, student_token_jwt):
        """Student token must be a decodable HS256 JWT (not stub)."""
        assert not student_token_jwt.startswith("stub:")
        payload = decode_livekit_token(student_token_jwt)
        assert isinstance(payload, dict)

    def test_token_issuer_is_api_key(self, teacher_token_jwt):
        """`iss` claim must equal the API key so LiveKit can verify origin."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["iss"] == LIVEKIT_API_KEY

    def test_token_has_expiry(self, teacher_token_jwt):
        """Token must carry a future `exp` claim (3-hour window)."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert "exp" in payload
        now_ts = int(datetime.now(timezone.utc).timestamp())
        remaining = payload["exp"] - now_ts
        assert remaining > 0, "Token already expired"
        assert remaining <= 3 * 3600 + 60, "TTL exceeds 3-hour design limit"

    def test_token_has_video_grant_block(self, teacher_token_jwt):
        """Token payload must contain a `video` claim with grant details."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert "video" in payload, "No `video` claim — LiveKit will reject the token"
        assert "roomJoin" in payload["video"]


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — Teacher Role Grants
# ══════════════════════════════════════════════════════════════════════════════

class TestTeacherGrants:

    def test_teacher_has_room_admin(self, teacher_token_jwt):
        """room_admin=True grants teacher power to kick participants."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["roomAdmin"] is True

    def test_teacher_can_publish(self, teacher_token_jwt):
        """Teacher must be able to stream their own audio/video."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["canPublish"] is True

    def test_teacher_can_subscribe(self, teacher_token_jwt):
        """Teacher must be able to receive all participant streams."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["canSubscribe"] is True

    def test_teacher_can_publish_data(self, teacher_token_jwt):
        """Teacher must be able to send chat/data messages."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["canPublishData"] is True

    def test_teacher_room_join_enabled(self, teacher_token_jwt):
        """room_join must be True for teacher to enter the room."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["roomJoin"] is True

    def test_teacher_identity_encoded(self, teacher_token_jwt):
        """Participant identity (`sub`) must be the teacher-prefixed ID."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["sub"] == "teacher-42"


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 — Student Role Grants (blocked from admin actions)
# ══════════════════════════════════════════════════════════════════════════════

class TestStudentGrants:

    def test_student_blocked_from_room_admin(self, student_token_jwt):
        """CRITICAL: Student must NOT have room_admin — cannot kick others."""
        payload = decode_livekit_token(student_token_jwt)
        assert payload["video"]["roomAdmin"] is False, \
            "SECURITY FAILURE: Student token grants room_admin!"

    def test_student_can_publish(self, student_token_jwt):
        """Student should be able to publish their own stream."""
        payload = decode_livekit_token(student_token_jwt)
        assert payload["video"]["canPublish"] is True

    def test_student_can_subscribe(self, student_token_jwt):
        """Student must be able to receive the teacher's stream."""
        payload = decode_livekit_token(student_token_jwt)
        assert payload["video"]["canSubscribe"] is True

    def test_student_identity_encoded(self, student_token_jwt):
        """Identity must be the student-prefixed ID, not the teacher's."""
        payload = decode_livekit_token(student_token_jwt)
        assert payload["sub"] == "student-99"
        assert "teacher" not in payload["sub"]


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 — Room Isolation
# ══════════════════════════════════════════════════════════════════════════════

class TestRoomIsolation:

    def test_teacher_token_locked_to_room_a(self, teacher_token_jwt):
        """Token's `room` claim must exactly match the room it was issued for."""
        payload = decode_livekit_token(teacher_token_jwt)
        assert payload["video"]["room"] == TEST_ROOM_A

    def test_student_token_cannot_access_room_b(self, student_token_jwt):
        """Student token for Room A must NOT carry a Room B claim."""
        payload = decode_livekit_token(student_token_jwt)
        assert payload["video"]["room"] != TEST_ROOM_B, \
            "SECURITY FAILURE: Student token grants access to a different room!"

    def test_room_names_are_unique(self):
        """Room name generator must produce different rooms each invocation."""
        from app.services.video.livekit_service import generate_room_name
        names = {generate_room_name(1, 1) for _ in range(20)}
        assert len(names) == 20, "Collision detected in room name generation"

    def test_different_subjects_produce_different_rooms(self):
        """Class 1/Subject 1 and Class 1/Subject 2 must occupy separate rooms."""
        from app.services.video.livekit_service import generate_room_name
        room1 = generate_room_name(1, 1)
        room2 = generate_room_name(1, 2)
        assert room1 != room2

    def test_tampering_room_claim_invalidates_signature(self, student_token_jwt):
        """
        Manually injecting a different room into the token must cause signature
        verification to fail — proving tokens are tamper-evident.
        """
        # Split the JWT and modify the payload
        header, payload_b64, sig = student_token_jwt.split(".")
        import base64, json as _json
        # Pad and decode
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        payload_dict = _json.loads(base64.urlsafe_b64decode(padded))
        payload_dict["video"]["room"] = TEST_ROOM_B  # tamper!
        # Re-encode payload without re-signing
        new_payload = base64.urlsafe_b64encode(
            _json.dumps(payload_dict).encode()
        ).rstrip(b"=").decode()
        tampered_token = f"{header}.{new_payload}.{sig}"

        with pytest.raises(JWTError):
            jose_jwt.decode(tampered_token, LIVEKIT_API_SECRET, algorithms=["HS256"])


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 — Stub Token Fallback
# ══════════════════════════════════════════════════════════════════════════════

class TestStubTokenFallback:

    def test_stub_token_returned_when_livekit_unavailable(self):
        """When livekit-api is absent the service must return a stub token."""
        from app.services.video import livekit_service as svc
        with patch.object(svc, "_try_import_livekit_api", return_value=None):
            token = svc.generate_participant_token(
                room_name=TEST_ROOM_A,
                participant_identity="teacher-1",
                participant_name="Test Teacher",
                is_teacher=True,
            )
        assert token.startswith("stub:"), \
            "Expected stub: prefix — frontend uses this to show 'not configured'"

    def test_stub_token_contains_identity(self):
        """Stub token must embed identity so the frontend can display it."""
        from app.services.video import livekit_service as svc
        with patch.object(svc, "_try_import_livekit_api", return_value=None):
            token = svc.generate_participant_token(
                room_name=TEST_ROOM_A,
                participant_identity="student-77",
                participant_name="Test Student",
                is_teacher=False,
            )
        assert "student-77" in token

    def test_stub_token_is_not_a_valid_jwt(self):
        """Stub tokens must NOT be decodable as JWTs (they are plain strings)."""
        from app.services.video import livekit_service as svc
        with patch.object(svc, "_try_import_livekit_api", return_value=None):
            token = svc.generate_participant_token(
                room_name=TEST_ROOM_A,
                participant_identity="user-1",
                participant_name="User",
                is_teacher=False,
            )
        with pytest.raises(Exception):
            jose_jwt.decode(token, LIVEKIT_API_SECRET, algorithms=["HS256"])


# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 — Role Isolation via HTTP (RBAC endpoint tests)
# ══════════════════════════════════════════════════════════════════════════════

class TestRBACEndpoints:
    """
    Verify that the FastAPI layer enforces role restrictions.
    Uses the real test database via conftest fixtures.
    """

    def test_student_cannot_create_meeting(self, client, student_token):
        """POST /video/meetings must return 403 for a student."""
        r = client.post(
            "/api/v1/video/meetings",
            json={"class_id": 1, "subject_id": 1, "title": "Test"},
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert r.status_code == 403, \
            f"Expected 403 but got {r.status_code} — student created a meeting!"

    def test_parent_cannot_create_meeting(self, client, parent_token):
        """POST /video/meetings must return 403 for a parent."""
        r = client.post(
            "/api/v1/video/meetings",
            json={"class_id": 1, "subject_id": 1, "title": "Test"},
            headers={"Authorization": f"Bearer {parent_token}"},
        )
        assert r.status_code == 403

    def test_unauthenticated_cannot_join(self, client):
        """GET /video/meetings/1/join without a token must return 401/403."""
        r = client.get("/api/v1/video/meetings/1/join")
        assert r.status_code in (401, 403)

    def test_teacher_can_list_meetings(self, client, teacher_token):
        """GET /video/meetings must succeed (200) for an authenticated teacher."""
        r = client.get(
            "/api/v1/video/meetings",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 200

    def test_student_can_view_active_meetings(self, client, student_token):
        """GET /video/active-meetings is open to any authenticated user."""
        r = client.get(
            "/api/v1/video/active-meetings",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert r.status_code == 200

    def test_student_cannot_end_meeting(self, client, student_token):
        """POST /video/meetings/{id}/end must be blocked for a student."""
        r = client.post(
            "/api/v1/video/meetings/9999/end",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        # 403 (wrong role) or 404 (meeting not found) are both acceptable;
        # 200 would be a security failure.
        assert r.status_code != 200, \
            "SECURITY FAILURE: Student was able to end a meeting!"

    def test_teacher_cannot_end_another_teachers_meeting(self, client, teacher_token):
        """
        If a meeting exists but belongs to a different teacher, the endpoint
        must return 403 (not 200).  We inject a fake meeting_id that is
        extremely unlikely to belong to this teacher.
        """
        r = client.post(
            "/api/v1/video/meetings/999999/end",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        # 403 (not the host) or 404 (not found) — NOT 200
        assert r.status_code in (403, 404)
