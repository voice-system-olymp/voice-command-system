import json
import wave
import io
import logging

from vosk import Model, KaldiRecognizer

from app.services.audio_service import convert_to_wav

logger = logging.getLogger(__name__)


class ASRService:
    def __init__(self, model_path: str):
        logger.info("Loading VOSK model from %s ...", model_path)
        self.model = Model(model_path)
        logger.info("VOSK model loaded")

    def transcribe(self, audio_bytes: bytes) -> tuple[str, int]:
        """Transcribe audio bytes. Returns (text, duration_ms)."""
        wav_bytes = convert_to_wav(audio_bytes)
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            assert wf.getnchannels() == 1
            assert wf.getsampwidth() == 2
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            duration_ms = int(n_frames / sample_rate * 1000)
            recognizer = KaldiRecognizer(self.model, sample_rate)
            recognizer.SetWords(True)
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                recognizer.AcceptWaveform(data)
            result = json.loads(recognizer.FinalResult())
            text = result.get("text", "")
        return text, duration_ms
