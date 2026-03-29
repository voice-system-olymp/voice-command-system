import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.v1.router import api_router
from app.config import settings
from app.database import Base, engine, async_session
from app.models.user import User
from app.services.asr_service import ASRService
from app.services.auth_service import hash_password
from app.utils.model_downloader import ensure_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_asr_service: ASRService | None = None


def get_asr_service() -> ASRService:
    assert _asr_service is not None, "ASR service not initialized"
    return _asr_service


async def _seed_admin():
    """Create default admin user if not exists."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == settings.ADMIN_USERNAME))
        if not result.scalar_one_or_none():
            admin = User(
                username=settings.ADMIN_USERNAME,
                full_name="Администратор",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
            )
            db.add(admin)
            await db.commit()
            logger.info("Admin user '%s' created", settings.ADMIN_USERNAME)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _asr_service
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed admin
    await _seed_admin()
    # Download and load VOSK model
    model_path = await asyncio.to_thread(ensure_model, settings.VOSK_MODEL_DIR, settings.VOSK_MODEL_SIZE)
    _asr_service = await asyncio.to_thread(ASRService, model_path)
    logger.info("Application started")
    yield
    logger.info("Application shutting down")


app = FastAPI(title="Voice Command System", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
