"""
HMAC-signed URL utilities for secure deep-linking.

Usage:
    from app.utils.link_security import generate_signed_token, verify_signed_token

    # Generate a signed token for a resource
    token = generate_signed_token(resource_id=42, ttl_seconds=3600)
    signed_url = f"https://myapp.com/resource/42?token={token}"

    # Verify on the receiving end
    payload = verify_signed_token(token)
    if payload:
        resource_id = payload["id"]
    else:
        raise HTTPException(403, "Invalid or expired link")
"""

import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

from app.core.config import settings


def _sign(data: str) -> str:
    """Return hex HMAC-SHA256 of *data* using the app SECRET_KEY."""
    return hmac.new(
        settings.SECRET_KEY.encode(),
        data.encode(),
        hashlib.sha256,
    ).hexdigest()


def generate_signed_token(
    resource_id: int,
    ttl_seconds: int = 3600,
    extra: Optional[dict] = None,
) -> str:
    """
    Build a compact signed token containing:
      - ``id``      : the resource ID
      - ``exp``     : Unix expiry timestamp
      - ``nonce``   : 16-byte random hex (prevents replay attacks)
      - ``sig``     : HMAC-SHA256 over the payload (hex)
      - any keys from *extra* are merged into the payload

    The returned value is a URL-safe base64-encoded JSON string.
    """
    payload: dict = {
        "id": resource_id,
        "exp": int(time.time()) + ttl_seconds,
        "nonce": secrets.token_hex(16),
    }
    if extra:
        payload.update(extra)

    # Canonical JSON (sorted keys) for deterministic signing
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["sig"] = _sign(body)

    import base64
    token_bytes = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(token_bytes).decode().rstrip("=")


def verify_signed_token(token: str) -> Optional[dict]:
    """
    Verify *token* produced by :func:`generate_signed_token`.

    Returns the payload dict on success, or ``None`` if:
      - the token is malformed / not base64-decodable
      - the signature does not match (tampered data)
      - the token has expired

    The ``sig`` key is removed from the returned dict.
    """
    import base64

    # Restore base64 padding
    padding = 4 - len(token) % 4
    try:
        token_bytes = base64.urlsafe_b64decode(token + "=" * (padding % 4))
        payload: dict = json.loads(token_bytes)
    except Exception:
        return None

    received_sig = payload.pop("sig", None)
    if received_sig is None:
        return None

    # Re-create the canonical body (same as during signing)
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    expected_sig = _sign(body)

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(received_sig, expected_sig):
        return None

    # Check expiry
    if int(time.time()) > payload.get("exp", 0):
        return None

    return payload


def build_signed_url(base_url: str, resource_id: int, ttl_seconds: int = 3600) -> str:
    """
    Convenience helper: append a ``?token=`` query parameter to *base_url*.

    Example::

        url = build_signed_url("https://myapp.com/resource/42", resource_id=42)
    """
    token = generate_signed_token(resource_id, ttl_seconds=ttl_seconds)
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}token={token}"
