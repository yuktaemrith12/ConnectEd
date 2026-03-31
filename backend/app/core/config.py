from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Silently ignore any .env keys not listed here
    )

    # App
    APP_NAME: str = "ConnectEd"
    DEBUG: bool = True

    # Database — individual components (used by manage_db.py and for reference)
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "connected_app"

    # Fully-qualified SQLAlchemy URL (takes precedence; built from components if blank)
    DATABASE_URL: str = ""

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Reduced from 60 for security

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # AI
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GOOGLE_GENAI_API_KEY: str = ""

    # Meta WhatsApp Cloud API
    META_WHATSAPP_TOKEN:       str  = ""    # permanent system-user access token (see docs)
    META_PHONE_NUMBER_ID:      str  = ""    # phone number ID from Meta Developer Console
    META_WABA_ID:              str  = ""    # WhatsApp Business Account ID
    META_WEBHOOK_VERIFY_TOKEN: str  = ""    # arbitrary secret — must match Meta Dev Console
    WHATSAPP_USE_TEMPLATES:    bool = False # set True in production after templates are approved
    FRONTEND_URL:              str  = ""    # base URL of the frontend, e.g. https://yourapp.com

    def get_database_url(self) -> str:
        """Return DATABASE_URL from .env if set, otherwise build from DB_* components."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()
