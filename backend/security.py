import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt
from passlib.context import CryptContext

load_dotenv()

# ✅ Use PBKDF2 (pure-python) so Render won't break like bcrypt did
pwd_ctx = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)

JWT_SECRET = os.getenv("JWT_SECRET", "change_me_now")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "120"))


def hash_password(password: str) -> str:
    # PBKDF2 has no 72-byte limit like bcrypt
    return pwd_ctx.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_ctx.verify(password, password_hash)


def create_token(payload: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MIN)
    to_encode = {**payload, "exp": exp}
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
