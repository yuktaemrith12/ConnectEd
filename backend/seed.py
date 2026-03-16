"""
Seed script: creates the connected_app database, tables, and the 4 seed users.

Run from the backend/ directory (with the venv activated):
    python seed.py
"""

import pymysql
from app.core.config import settings
from app.core.database import engine, Base
from app.core.security import hash_password
from app.models.user import Role, User  # noqa: F401 — imports register models with Base


# ── 1. Ensure the database exists ───────────────────────────────────────────
def create_database_if_missing() -> None:
    """Connect to MySQL without specifying a DB and CREATE DATABASE if needed."""
    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
        print(f"✓  Database '{settings.DB_NAME}' is ready.")
    finally:
        conn.close()


# ── 2. Create tables ─────────────────────────────────────────────────────────
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    print("✓  Tables created (roles, users).")


# ── 3. Seed roles and users ──────────────────────────────────────────────────
SEED_ROLES = ["admin", "teacher", "student", "parent"]

SEED_USERS = [
    {"email": "yuktae@admin.connected.com",     "full_name": "Yukta E",   "role": "admin"},
    {"email": "emmaak@teacher.connected.com",   "full_name": "Emma AK",   "role": "teacher"},
    {"email": "renveerr@student.connected.com", "full_name": "Renveer R", "role": "student"},
    {"email": "oormilae@parent.connected.com",  "full_name": "Oormila E", "role": "parent"},
]

PASSWORD = "12345"


def seed_data() -> None:
    from sqlalchemy.orm import Session

    with Session(engine) as db:
        # Seed roles (skip if already present)
        existing_roles = {r.name: r for r in db.query(Role).all()}
        for role_name in SEED_ROLES:
            if role_name not in existing_roles:
                role = Role(name=role_name)
                db.add(role)
        db.commit()

        roles = {r.name: r for r in db.query(Role).all()}
        print(f"✓  Roles seeded: {list(roles.keys())}")

        # Seed users (skip if email already exists)
        existing_emails = {u.email for u in db.query(User).all()}
        hashed_pw = hash_password(PASSWORD)

        for u in SEED_USERS:
            if u["email"] not in existing_emails:
                user = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=hashed_pw,
                    role_id=roles[u["role"]].id,
                    is_active=True,
                )
                db.add(user)
                print(f"  + Added user: {u['email']}  (role: {u['role']})")
            else:
                print(f"  ~ Skipped (exists): {u['email']}")

        db.commit()
        print(f"✓  Seed complete. Password for all users: '{PASSWORD}'")


if __name__ == "__main__":
    create_database_if_missing()
    create_tables()
    seed_data()
