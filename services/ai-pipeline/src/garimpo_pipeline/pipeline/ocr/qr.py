"""Decodificação de QR codes com OpenCV (sem dependência de sistema)."""

import cv2
import numpy as np

_detector = cv2.QRCodeDetector()


def decode_qr_payloads(image: np.ndarray) -> list[str]:
    payloads: list[str] = []
    try:
        ok, texts, _, _ = _detector.detectAndDecodeMulti(image)
        if ok:
            payloads = [t for t in texts if t]
    except cv2.error:
        payloads = []
    if payloads:
        return payloads
    # fallback single-QR (detectAndDecodeMulti falha em alguns crops pequenos)
    try:
        text, _, _ = _detector.detectAndDecode(image)
        return [text] if text else []
    except cv2.error:
        return []
