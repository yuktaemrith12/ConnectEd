#!/usr/bin/env python3
"""
ConnectEd Database Manager
===========================
Automates database setup using the MySQL command-line client.

Usage:
    python manage_db.py --setup              # Create DB + run all migrations + seeds
    python manage_db.py --verify             # Run VERIFY.sql to check DB state
    python manage_db.py --setup --verify     # Both steps

    # Override credentials (falls back to backend/.env, then defaults):
    python manage_db.py --setup --user root --password secret --host 127.0.0.1

Requirements:
    - MySQL client installed and available on PATH  (mysql --version)
    - A running MySQL server
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# This script lives inside database/ — all SQL paths are relative to this directory.
DB_DIR = Path(__file__).parent.resolve()
BACKEND_ENV = DB_DIR.parent / "backend" / ".env"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env(env_file: Path) -> dict:
    """Parse key=value pairs from a .env file (skips comments and blank lines)."""
    env: dict = {}
    if not env_file.exists():
        return env
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def run_sql_file(sql_file: Path, user: str, password: str, host: str, port: int) -> bool:
    """
    Execute *sql_file* through the mysql CLI.

    The working directory is set to DB_DIR so that SOURCE directives inside
    RUN_ALL.sql resolve correctly (e.g. SOURCE migrations/01_users_admin.sql).
    """
    if not sql_file.exists():
        print(f"  ERROR: SQL file not found: {sql_file}", file=sys.stderr)
        return False

    cmd = [
        "mysql",
        f"--user={user}",
        f"--password={password}",
        f"--host={host}",
        f"--port={port}",
        "--default-character-set=utf8mb4",
        f"--execute=SOURCE {sql_file.name}",
    ]

    print(f"  Running: mysql --user={user} --host={host}:{port} SOURCE {sql_file.name}")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(DB_DIR),   # SOURCE paths are resolved relative to CWD
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            print(f"  Output:\n    {result.stdout.strip()}")
        if result.returncode != 0:
            stderr = result.stderr.strip()
            # mysql prints "Warning: Using a password on the command line..." to stderr
            # even on success — filter it out before failing.
            real_errors = [
                ln for ln in stderr.splitlines()
                if "warning" not in ln.lower() and ln.strip()
            ]
            if real_errors:
                print(f"  ERROR:\n    " + "\n    ".join(real_errors), file=sys.stderr)
                return False
        return True
    except FileNotFoundError:
        print(
            "  ERROR: 'mysql' command not found.\n"
            "  Install MySQL Community Server / MySQL Shell and add it to your PATH.\n"
            "  Then retry: python manage_db.py --setup",
            file=sys.stderr,
        )
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    env = load_env(BACKEND_ENV)

    parser = argparse.ArgumentParser(
        description="ConnectEd Database Manager — automates MySQL setup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--setup", action="store_true",
        help="Create the database and run all migrations + seeds (RUN_ALL.sql)",
    )
    parser.add_argument(
        "--verify", action="store_true",
        help="Run VERIFY.sql to validate the database state",
    )
    parser.add_argument("--user",     default=env.get("DB_USER",     "root"),  help="MySQL username  (default: root)")
    parser.add_argument("--password", default=env.get("DB_PASSWORD", ""),      help="MySQL password")
    parser.add_argument("--host",     default=env.get("DB_HOST",     "127.0.0.1"), help="MySQL host  (default: 127.0.0.1)")
    parser.add_argument("--port",     type=int, default=int(env.get("DB_PORT", "3306")), help="MySQL port  (default: 3306)")
    args = parser.parse_args()

    if not args.setup and not args.verify:
        parser.print_help()
        sys.exit(0)

    success = True

    if args.setup:
        print("\n[setup] Running RUN_ALL.sql ...")
        if run_sql_file(DB_DIR / "RUN_ALL.sql", args.user, args.password, args.host, args.port):
            print("[setup] Database setup complete.\n")
        else:
            print("[setup] Setup FAILED.\n", file=sys.stderr)
            success = False

    if args.verify and success:
        print("[verify] Running VERIFY.sql ...")
        if run_sql_file(DB_DIR / "VERIFY.sql", args.user, args.password, args.host, args.port):
            print("[verify] Verification complete.\n")
        else:
            print("[verify] Verification FAILED.\n", file=sys.stderr)
            success = False

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
