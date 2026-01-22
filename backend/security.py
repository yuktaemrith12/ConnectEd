import os
import hashlib
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt
from passlib.context import CryptContext

load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_now")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "120"))

BCRYPT_MAX_BYTES = 72


def _bcrypt_safe_password(password: str) -> str:
    """
    bcrypt only uses the first 72 bytes.
    If password is longer, we pre-hash with SHA-256 so bcrypt gets a fixed short value.
    """
    if password is None:
        return ""

    pw_bytes = password.encode("utf-8")

    if len(pw_bytes) <= BCRYPT_MAX_BYTES:
        return password

    # Pre-hash long passwords to avoid bcrypt 72-byte limit issues
    return hashlib.sha256(pw_bytes).hexdigest()  # 64 chars


def hash_password(password: str) -> str:
    password = _bcrypt_safe_password(password)
    return pwd_ctx.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    password = _bcrypt_safe_password(password)
    return pwd_ctx.verify(password, password_hash)


def create_token(payload: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MIN)
    to_encode = {**payload, "exp": exp}
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
