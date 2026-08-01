"""Estágio 0 — validação server-side: decodificação, resolução, blur e
hash perceptual (duplicatas dentro do check e reuso entre checks)."""

from dataclasses import dataclass

import cv2
import numpy as np

MIN_SHORT_SIDE = 700
BLUR_THRESHOLD = 40.0
DUPLICATE_HAMMING = 6


@dataclass
class ImageValidation:
    photo_id: str
    region: str
    width: int
    height: int
    sharpness: float
    phash: str
    issues: list[str]


def decode(data: bytes) -> np.ndarray:
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("imagem inválida (não decodificável)")
    return image


def perceptual_hash(image: np.ndarray) -> str:
    """pHash 64 bits: DCT 32x32 → bloco 8x8 de baixas frequências → mediana."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    dct = cv2.dct(small)
    block = dct[:8, :8].flatten()
    coefficients = block[1:]  # descarta o termo DC
    median = float(np.median(coefficients))
    bits = 0
    for i, value in enumerate(coefficients):
        if value > median:
            bits |= 1 << i
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def sharpness_score(image: np.ndarray) -> float:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    scale = 640.0 / max(gray.shape)
    if scale < 1.0:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def validate_photo(photo_id: str, region: str, image: np.ndarray) -> ImageValidation:
    height, width = image.shape[:2]
    issues: list[str] = []
    if min(width, height) < MIN_SHORT_SIDE:
        issues.append("low_resolution")
    sharp = sharpness_score(image)
    if sharp < BLUR_THRESHOLD:
        issues.append("blurry")
    return ImageValidation(
        photo_id=photo_id,
        region=region,
        width=width,
        height=height,
        sharpness=round(sharp, 2),
        phash=perceptual_hash(image),
        issues=issues,
    )


def find_internal_duplicates(validations: list[ImageValidation]) -> list[tuple[str, str]]:
    """Pares de fotos praticamente idênticas dentro do mesmo check."""
    pairs: list[tuple[str, str]] = []
    for i in range(len(validations)):
        for j in range(i + 1, len(validations)):
            if hamming(validations[i].phash, validations[j].phash) <= DUPLICATE_HAMMING:
                pairs.append((validations[i].region, validations[j].region))
    return pairs
