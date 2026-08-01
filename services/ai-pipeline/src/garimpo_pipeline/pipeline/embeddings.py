"""Embeddings por região com CLIP ViT-B/32 (visual) em ONNX Runtime.

O modelo (512 dims) é baixado uma vez para o cache local e roda em CPU.
Cada foto gera um embedding independente — recortado para a bbox da
etiqueta quando o detector CV a encontrou (sinal mais limpo que a foto
inteira).
"""

import logging
import threading
from pathlib import Path

import cv2
import httpx
import numpy as np

from ..config import settings

log = logging.getLogger(__name__)

_CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
_CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
_INPUT_SIZE = 224

_session = None
_input_name: str | None = None
_lock = threading.Lock()


def _ensure_model_file() -> Path:
    s = settings()
    path = Path(s.embedding_model_path)
    if path.exists() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    log.info("baixando modelo de embedding: %s", s.embedding_model_url)
    tmp = path.with_suffix(".download")
    with httpx.stream("GET", s.embedding_model_url, follow_redirects=True, timeout=600.0) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(1024 * 1024):
                f.write(chunk)
    tmp.rename(path)
    log.info("modelo salvo em %s (%.1f MB)", path, path.stat().st_size / 1e6)
    return path


def _get_session():
    global _session, _input_name
    with _lock:
        if _session is None:
            import onnxruntime as ort

            model_path = _ensure_model_file()
            _session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
            _input_name = _session.get_inputs()[0].name
        return _session, _input_name


def preprocess(image_bgr: np.ndarray) -> np.ndarray:
    """Resize menor lado → 224, center crop, normalização CLIP, NCHW."""
    height, width = image_bgr.shape[:2]
    scale = _INPUT_SIZE / min(height, width)
    resized = cv2.resize(
        image_bgr,
        (max(_INPUT_SIZE, round(width * scale)), max(_INPUT_SIZE, round(height * scale))),
        interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC,
    )
    rh, rw = resized.shape[:2]
    top, left = (rh - _INPUT_SIZE) // 2, (rw - _INPUT_SIZE) // 2
    crop = resized[top : top + _INPUT_SIZE, left : left + _INPUT_SIZE]
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    normalized = (rgb - _CLIP_MEAN) / _CLIP_STD
    return normalized.transpose(2, 0, 1)[np.newaxis, :]


def embed_image(image_bgr: np.ndarray) -> np.ndarray:
    session, input_name = _get_session()
    outputs = session.run(None, {input_name: preprocess(image_bgr)})
    vector = np.asarray(outputs[0], dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(vector))
    if norm > 0:
        vector = vector / norm
    if vector.shape[0] != settings().embedding_dim:
        raise RuntimeError(
            f"dimensão inesperada do embedding: {vector.shape[0]} "
            f"(esperado {settings().embedding_dim})"
        )
    return vector
