import os
import mysql.connector
from dotenv import load_dotenv

# Load .env ONLY if it exists (local dev)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

if os.path.exists(ENV_PATH):
    load_dotenv(dotenv_path=ENV_PATH)
else:
    # On Render, env vars are injected automatically
    load_dotenv()


def get_conn():
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    database = os.getenv("DB_NAME", "connected")

    # Safety check (helps debug Render instantly)
    if not password:
        raise RuntimeError(
            "DB_PASSWORD is empty. Check environment variables on Render."
        )

    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=False,
    )
