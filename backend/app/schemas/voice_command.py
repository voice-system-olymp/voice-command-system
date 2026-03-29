import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CommandOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: Optional[str] = None
    audio_duration_ms: Optional[int] = None
    raw_transcription: str
    corrected_transcription: Optional[str] = None
    command_type: Optional[str] = None
    identifier: Optional[str] = None
    is_confirmed: bool
    parse_success: bool
    created_at: datetime
    confirmed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CommandListOut(BaseModel):
    items: list[CommandOut]
    total: int
    page: int
    size: int


class CommandUpdate(BaseModel):
    corrected_transcription: Optional[str] = None
    command_type: Optional[str] = None
    identifier: Optional[str] = None
    is_confirmed: Optional[bool] = None


class CommandReparse(BaseModel):
    text: str
