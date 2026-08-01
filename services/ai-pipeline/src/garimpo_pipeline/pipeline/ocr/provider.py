"""OCR — Google Cloud Vision (DOCUMENT_TEXT_DETECTION) via REST.

Integração completa; requer GOOGLE_VISION_API_KEY. Sem a chave o estágio é
registrado como pulado no score_breakdown (nunca inventamos texto).
"""

import base64

import httpx

from ...config import settings

PROVIDER_NAME = "google-vision"
_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"


class OcrConfigurationError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings().google_vision_api_key)


def recognize(image_bytes: bytes) -> str:
    """Retorna o texto completo reconhecido na imagem (string vazia se nada)."""
    key = settings().google_vision_api_key
    if not key:
        raise OcrConfigurationError("GOOGLE_VISION_API_KEY não configurada")

    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "imageContext": {"languageHints": ["pt", "en"]},
            }
        ]
    }
    response = httpx.post(_ENDPOINT, params={"key": key}, json=payload, timeout=60.0)
    response.raise_for_status()
    body = response.json()
    result = body["responses"][0]
    if "error" in result:
        raise RuntimeError(f"Google Vision: {result['error'].get('message', 'erro')}")
    annotation = result.get("fullTextAnnotation")
    return annotation.get("text", "") if annotation else ""
