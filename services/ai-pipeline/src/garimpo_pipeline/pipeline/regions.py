"""Detecção automática de regiões de interesse por CV clássico.

Três detectores determinísticos:
- etiquetas/tags: região retangular clara de alto contraste (threshold adaptativo
  + contornos + aproximação poligonal);
- logo/estampa/bordado/impressão: blocos de alta densidade de gradiente;
- costura/acabamento/zíper/botão: faixas com padrão periódico de gradiente
  (assinatura de pontos regulares e trilhos).

O Claude complementa com bboxes semânticas (source='claude') no estágio
multimodal; aqui é o baseline barato e offline.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from ..types import BBox

# Que detectores rodar para cada região do checklist.
LABEL_REGIONS = frozenset(
    {"neck_tag", "wash_tag", "size_tag", "interior_label", "hang_tag", "box_label", "receipt"}
)
DETAIL_REGIONS = frozenset({"front", "back", "logo", "embroidery", "print", "insole", "outsole"})
STITCH_REGIONS = frozenset(
    {
        "stitching",
        "collar_stitch",
        "hem_stitch",
        "pocket_stitch",
        "cuffs",
        "heel_tab",
        "zipper",
        "buttons",
        "hardware",
        "lining",
    }
)

_LABEL_FOR_REGION = {
    "logo": "logo",
    "embroidery": "bordado",
    "print": "estampa",
    "zipper": "ziper",
    "buttons": "botao",
    "hardware": "acabamento",
    "lining": "impressao_interna",
}


@dataclass
class RegionProposal:
    label: str
    bbox: BBox
    confidence: float


def _resized(image: np.ndarray, max_side: int = 1024) -> tuple[np.ndarray, float]:
    scale = max_side / max(image.shape[:2])
    if scale >= 1.0:
        return image, 1.0
    resized = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return resized, scale


def detect_label_area(image: np.ndarray) -> RegionProposal | None:
    """Maior região retangular clara — a etiqueta em fotos de tag."""
    work, _ = _resized(image)
    height, width = work.shape[:2]
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 51, -5
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best: RegionProposal | None = None
    image_area = float(width * height)
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area_ratio = (w * h) / image_area
        if not 0.04 <= area_ratio <= 0.85:
            continue
        aspect = max(w, h) / max(1, min(w, h))
        if aspect > 8:
            continue
        rect_fill = cv2.contourArea(contour) / max(1.0, float(w * h))
        if rect_fill < 0.5:
            continue
        confidence = min(0.95, 0.4 + 0.4 * rect_fill + 0.2 * min(area_ratio * 2, 1.0))
        proposal = RegionProposal(
            label="etiqueta",
            bbox=BBox(x / width, y / height, w / width, h / height),
            confidence=round(confidence, 3),
        )
        if best is None or proposal.confidence > best.confidence:
            best = proposal
    return best


def detect_detail_regions(image: np.ndarray, max_regions: int = 3) -> list[RegionProposal]:
    """Blocos de alta densidade de gradiente — logos, estampas, bordados."""
    work, _ = _resized(image, 512)
    height, width = work.shape[:2]
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(grad_x, grad_y)

    grid = 8
    cell_h, cell_w = height // grid, width // grid
    if cell_h == 0 or cell_w == 0:
        return []
    density = np.zeros((grid, grid), dtype=np.float32)
    for gy in range(grid):
        for gx in range(grid):
            cell = magnitude[gy * cell_h : (gy + 1) * cell_h, gx * cell_w : (gx + 1) * cell_w]
            density[gy, gx] = float(cell.mean())

    threshold = float(density.mean() + density.std())
    mask = (density >= threshold).astype(np.uint8)
    n_components, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)

    proposals: list[RegionProposal] = []
    peak = float(density.max()) or 1.0
    for component in range(1, n_components):
        gx, gy, gw, gh, cells = stats[component]
        if cells < 2:
            continue
        strength = float(density[labels == component].mean()) / peak
        proposals.append(
            RegionProposal(
                label="logo",
                bbox=BBox(gx / grid, gy / grid, gw / grid, gh / grid),
                confidence=round(min(0.9, 0.35 + 0.55 * strength), 3),
            )
        )
    proposals.sort(key=lambda p: p.confidence, reverse=True)
    return proposals[:max_regions]


def detect_stitch_band(image: np.ndarray) -> RegionProposal | None:
    """Faixa com gradiente periódico — costuras, ribbing, trilho de zíper."""
    work, _ = _resized(image, 512)
    height = work.shape[0]
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    grad = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)) + np.abs(
        cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    )

    bands = 10
    band_h = height // bands
    if band_h == 0:
        return None
    scores = []
    for b in range(bands):
        band = grad[b * band_h : (b + 1) * band_h, :]
        profile = band.mean(axis=0)
        # periodicidade: energia do espectro fora do DC, normalizada
        spectrum = np.abs(np.fft.rfft(profile - profile.mean()))
        periodicity = float(spectrum[2:].max() / (spectrum.sum() + 1e-6))
        scores.append((periodicity * float(band.mean()), b))

    scores.sort(reverse=True)
    best_score, best_band = scores[0]
    if best_score <= 0:
        return None
    return RegionProposal(
        label="costura",
        bbox=BBox(0.02, best_band / bands, 0.96, 1 / bands),
        confidence=round(min(0.85, 0.3 + best_score / 40.0), 3),
    )


def detect_regions_for_photo(region: str, image: np.ndarray) -> list[RegionProposal]:
    proposals: list[RegionProposal] = []
    if region in LABEL_REGIONS:
        label = detect_label_area(image)
        if label is not None:
            proposals.append(label)
    if region in DETAIL_REGIONS:
        detected = detect_detail_regions(image)
        for p in detected:
            p.label = _LABEL_FOR_REGION.get(region, "logo" if region != "print" else "estampa")
        proposals.extend(detected)
    if region in STITCH_REGIONS:
        band = detect_stitch_band(image)
        if band is not None:
            band.label = _LABEL_FOR_REGION.get(region, "costura")
            proposals.append(band)
    return proposals


def crop_bbox(image: np.ndarray, bbox: BBox) -> np.ndarray:
    height, width = image.shape[:2]
    b = bbox.clamped()
    x0, y0 = int(b.x * width), int(b.y * height)
    x1, y1 = int((b.x + b.w) * width), int((b.y + b.h) * height)
    if x1 <= x0 or y1 <= y0:
        return image
    return image[y0:y1, x0:x1]
