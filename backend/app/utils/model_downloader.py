import os
import urllib.request
import zipfile
import logging

logger = logging.getLogger(__name__)

MODELS = {
    "small": ("vosk-model-small-ru-0.22", "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip"),
    "large": ("vosk-model-ru-0.42", "https://alphacephei.com/vosk/models/vosk-model-ru-0.42.zip"),
}


def ensure_model(model_dir: str, model_size: str = "small") -> str:
    model_name, url = MODELS[model_size]
    model_path = os.path.join(model_dir, model_name)
    if os.path.isdir(model_path):
        logger.info("VOSK model found at %s", model_path)
        return model_path
    os.makedirs(model_dir, exist_ok=True)
    zip_path = os.path.join(model_dir, "model.zip")
    logger.info("Downloading VOSK model from %s ...", url)
    urllib.request.urlretrieve(url, zip_path)
    logger.info("Extracting model...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(model_dir)
    os.remove(zip_path)
    logger.info("VOSK model ready at %s", model_path)
    return model_path
