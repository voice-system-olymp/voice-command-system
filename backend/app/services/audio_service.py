import subprocess
import tempfile
import os


def convert_to_wav(audio_bytes: bytes) -> bytes:
    """Convert any audio format to 16kHz mono 16-bit PCM WAV using ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as inp:
        inp.write(audio_bytes)
        inp_path = inp.name
    out_path = inp_path + ".wav"
    try:
        proc = subprocess.run(
            [
                "ffmpeg", "-y", "-i", inp_path,
                "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
                "-f", "wav", out_path,
            ],
            capture_output=True,
            timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {proc.stderr.decode()}")
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        for p in (inp_path, out_path):
            if os.path.exists(p):
                os.unlink(p)
