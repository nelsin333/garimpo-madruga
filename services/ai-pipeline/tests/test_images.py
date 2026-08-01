import cv2
import numpy as np

from garimpo_pipeline.pipeline import images


def synthetic_photo(seed: int = 7, sharp: bool = True) -> np.ndarray:
    rng = np.random.default_rng(seed)
    image = rng.integers(0, 255, size=(900, 1200, 3), dtype=np.uint8)
    if not sharp:
        image = cv2.GaussianBlur(image, (31, 31), 12)
    return image


def test_phash_is_stable_and_format():
    image = synthetic_photo()
    h1 = images.perceptual_hash(image)
    h2 = images.perceptual_hash(image.copy())
    assert h1 == h2
    assert len(h1) == 16
    int(h1, 16)  # hex válido


def test_phash_detects_near_duplicates_and_differences():
    image = synthetic_photo()
    resized = cv2.resize(image, (600, 450))
    other = synthetic_photo(seed=99)
    assert images.hamming(images.perceptual_hash(image), images.perceptual_hash(resized)) <= 6
    assert images.hamming(images.perceptual_hash(image), images.perceptual_hash(other)) > 10


def test_validate_photo_flags_blur_and_resolution():
    sharp = images.validate_photo("a", "front", synthetic_photo(sharp=True))
    assert "blurry" not in sharp.issues

    blurry = images.validate_photo("b", "front", synthetic_photo(sharp=False))
    assert "blurry" in blurry.issues

    tiny = images.validate_photo("c", "front", synthetic_photo()[:300, :300])
    assert "low_resolution" in tiny.issues


def test_find_internal_duplicates():
    image = synthetic_photo()
    v1 = images.validate_photo("a", "front", image)
    v2 = images.validate_photo("b", "back", cv2.resize(image, (800, 600)))
    v3 = images.validate_photo("c", "neck_tag", synthetic_photo(seed=42))
    pairs = images.find_internal_duplicates([v1, v2, v3])
    assert ("front", "back") in pairs
    assert all("neck_tag" not in pair for pair in pairs)
