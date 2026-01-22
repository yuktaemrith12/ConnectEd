import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt
from passlib.context import CryptContext

load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_now")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "120"))

# bcrypt only uses the first 72 bytes of the password
BCRYPT_MAX_BYTES = 72


def _normalize_password(password: str) -> str:
    """
    Ensures bcrypt never receives a password longer than 72 bytes.
    We slice the string; for typical ASCII passwords this matches 72 bytes.
    (If you later support emojis/non-ascii passwords, we can upgrade this to a byte-safe approach.)
    """
    if password is None:
        return ""
    return password[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    password = _normalize_password(password)
    return pwd_ctx.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    password = _normalize_password(password)
    return pwd_ctx.verify(password, password_hash)


def create_token(payload: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MIN)
    to_encode = {**payload, "exp": exp}
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
