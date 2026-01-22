import os
import mysql.connector
from dotenv import load_dotenv

# Always load .env from the backend folder (reliable no matter where uvicorn is run from)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(dotenv_path=ENV_PATH)


def get_conn():
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    database = os.getenv("DB_NAME", "connected")

    # Optional: helpful error if env isn't loading
    if password == "":
        # This is the exact symptom that causes: (using password: NO)
        raise RuntimeError(
            "DB_PASSWORD is empty. Check backend/.env exists and is being loaded correctly."
        )

    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        autocommit=False,
    )
