from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://app:app_secret@localhost:5432/voice_commands"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    VOSK_MODEL_SIZE: str = "small"
    VOSK_MODEL_DIR: str = "./vosk-model"
    AUDIO_STORAGE_DIR: str = "./audio_storage"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"

    model_config = {"env_file": ".env"}


settings = Settings()
