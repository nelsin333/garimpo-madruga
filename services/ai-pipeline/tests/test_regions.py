import cv2
import numpy as np

from garimpo_pipeline.pipeline import regions
from garimpo_pipeline.types import BBox


def label_photo() -> np.ndarray:
    """Fundo escuro com uma 'etiqueta' clara retangular com texto simulado."""
    image = np.full((800, 1000, 3), 40, dtype=np.uint8)
    cv2.rectangle(image, (250, 220), (750, 560), (235, 235, 230), -1)
    for i, y in enumerate(range(270, 520, 40)):
        cv2.putText(
            image,
            f"NIKE TEE {i} 100% COTTON",
            (280, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (30, 30, 30),
            2,
        )
    return image


def stitch_photo() -> np.ndarray:
    """Faixa central com pontos periódicos simulando costura."""
    image = np.full((600, 800, 3), 120, dtype=np.uint8)
    for x in range(20, 780, 18):
        cv2.line(image, (x, 290), (x + 8, 310), (30, 30, 30), 2)
    return image


def test_detect_label_area_finds_the_tag():
    proposal = regions.detect_label_area(label_photo())
    assert proposal is not None
    assert proposal.label == "etiqueta"
    b = proposal.bbox
    # a etiqueta sintética ocupa aproximadamente x:[0.25,0.75], y:[0.27,0.7]
    assert 0.1 <= b.x <= 0.4
    assert b.w >= 0.3
    assert proposal.confidence > 0.4


def test_detect_stitch_band_targets_the_seam_row():
    proposal = regions.detect_stitch_band(stitch_photo())
    assert proposal is not None
    center = proposal.bbox.y + proposal.bbox.h / 2
    assert 0.35 <= center <= 0.65


def test_detect_regions_for_photo_dispatches_by_region():
    assert any(
        p.label == "etiqueta" for p in regions.detect_regions_for_photo("neck_tag", label_photo())
    )
    assert regions.detect_regions_for_photo("qr_code", label_photo()) == []


def test_crop_bbox_returns_subimage():
    image = label_photo()
    crop = regions.crop_bbox(image, BBox(0.25, 0.25, 0.5, 0.4))
    assert crop.shape[0] < image.shape[0]
    assert crop.shape[1] < image.shape[1]
    assert crop.size > 0


def test_detail_regions_on_flat_image_is_empty_or_low():
    flat = np.full((512, 512, 3), 128, dtype=np.uint8)
    proposals = regions.detect_detail_regions(flat)
    assert all(p.confidence <= 0.9 for p in proposals)
