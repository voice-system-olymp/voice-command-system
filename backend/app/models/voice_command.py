import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VoiceCommand(Base):
    __tablename__ = "voice_commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    audio_path: Mapped[str] = mapped_column(String(512), nullable=False)
    audio_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    raw_transcription: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_transcription: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    command_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    identifier: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parse_success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="commands")
