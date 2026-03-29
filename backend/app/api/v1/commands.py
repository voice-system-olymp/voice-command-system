import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.voice_command import VoiceCommand
from app.schemas.voice_command import CommandListOut, CommandOut, CommandReparse, CommandUpdate
from app.services.command_parser import parse_command

router = APIRouter(prefix="/commands", tags=["commands"])


def _command_to_out(cmd: VoiceCommand) -> CommandOut:
    return CommandOut(
        id=cmd.id,
        user_id=cmd.user_id,
        username=cmd.user.username if cmd.user else None,
        audio_duration_ms=cmd.audio_duration_ms,
        raw_transcription=cmd.raw_transcription,
        corrected_transcription=cmd.corrected_transcription,
        command_type=cmd.command_type,
        identifier=cmd.identifier,
        is_confirmed=cmd.is_confirmed,
        parse_success=cmd.parse_success,
        created_at=cmd.created_at,
        confirmed_at=cmd.confirmed_at,
    )


@router.post("/", response_model=CommandOut, status_code=status.HTTP_201_CREATED)
async def upload_command(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.main import get_asr_service
    import asyncio

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Save original audio
    os.makedirs(settings.AUDIO_STORAGE_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    audio_path = os.path.join(settings.AUDIO_STORAGE_DIR, f"{file_id}.wav")

    # Transcribe in thread pool (CPU-bound)
    asr = get_asr_service()
    text, duration_ms = await asyncio.to_thread(asr.transcribe, audio_bytes)

    # Save converted WAV
    from app.services.audio_service import convert_to_wav
    wav_bytes = await asyncio.to_thread(convert_to_wav, audio_bytes)
    with open(audio_path, "wb") as f:
        f.write(wav_bytes)

    # Parse command
    parsed = parse_command(text)

    cmd = VoiceCommand(
        user_id=user.id,
        audio_path=audio_path,
        audio_duration_ms=duration_ms,
        raw_transcription=text,
        command_type=parsed.command_type,
        identifier=parsed.identifier,
        parse_success=parsed.confidence == "full",
    )
    db.add(cmd)
    await db.commit()
    await db.refresh(cmd, ["user"])
    return _command_to_out(cmd)


@router.get("/", response_model=CommandListOut)
async def list_commands(
    command_type: Optional[str] = Query(None),
    identifier: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = []
    if user_id:
        filters.append(VoiceCommand.user_id == user_id)

    if command_type:
        filters.append(VoiceCommand.command_type == command_type)
    if identifier:
        filters.append(VoiceCommand.identifier.ilike(f"%{identifier}%"))
    if date_from:
        filters.append(VoiceCommand.created_at >= date_from)
    if date_to:
        filters.append(VoiceCommand.created_at <= date_to)

    where = and_(*filters) if filters else True

    total_q = await db.execute(select(func.count(VoiceCommand.id)).where(where))
    total = total_q.scalar()

    result = await db.execute(
        select(VoiceCommand)
        .options(joinedload(VoiceCommand.user))
        .where(where)
        .order_by(VoiceCommand.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    commands = result.scalars().all()
    return CommandListOut(
        items=[_command_to_out(c) for c in commands],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{command_id}", response_model=CommandOut)
async def get_command(
    command_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VoiceCommand).options(joinedload(VoiceCommand.user)).where(VoiceCommand.id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    return _command_to_out(cmd)


@router.patch("/{command_id}", response_model=CommandOut)
async def update_command(
    command_id: uuid.UUID,
    data: CommandUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VoiceCommand).options(joinedload(VoiceCommand.user)).where(VoiceCommand.id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    updates = data.model_dump(exclude_unset=True)

    # If corrected_transcription is provided, re-parse
    if "corrected_transcription" in updates and updates["corrected_transcription"]:
        parsed = parse_command(updates["corrected_transcription"])
        if "command_type" not in updates:
            updates["command_type"] = parsed.command_type
        if "identifier" not in updates:
            updates["identifier"] = parsed.identifier
        updates["parse_success"] = parsed.confidence == "full"

    if updates.get("is_confirmed"):
        updates["confirmed_at"] = datetime.now(timezone.utc)

    for field, value in updates.items():
        setattr(cmd, field, value)

    await db.commit()
    await db.refresh(cmd, ["user"])
    return _command_to_out(cmd)


@router.get("/{command_id}/audio")
async def get_audio(
    command_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VoiceCommand).options(joinedload(VoiceCommand.user)).where(VoiceCommand.id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    if not os.path.exists(cmd.audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(cmd.audio_path, media_type="audio/wav")


@router.delete("/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_command(
    command_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VoiceCommand).where(VoiceCommand.id == command_id))
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")
    # Remove audio file
    if cmd.audio_path and os.path.exists(cmd.audio_path):
        os.unlink(cmd.audio_path)
    await db.delete(cmd)
    await db.commit()


@router.post("/reparse")
async def reparse_text(data: CommandReparse):
    """Re-parse text without saving — for preview in UI."""
    parsed = parse_command(data.text)
    return {
        "command_type": parsed.command_type,
        "identifier": parsed.identifier,
        "confidence": parsed.confidence,
    }
