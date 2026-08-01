"""Modelos internos do pipeline — espelham o contrato em @garimpo/contracts."""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

JOB_STAGES = [
    "preparing",
    "extracting_regions",
    "analyzing_details",
    "comparing_references",
    "scoring",
    "generating_report",
    "finalizing",
]


class Polarity(StrEnum):
    POSITIVE = "positive"
    SUSPICIOUS = "suspicious"
    NEUTRAL = "neutral"


class Severity(StrEnum):
    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"


@dataclass(frozen=True)
class BBox:
    x: float
    y: float
    w: float
    h: float

    def clamped(self) -> "BBox":
        x = min(max(self.x, 0.0), 1.0)
        y = min(max(self.y, 0.0), 1.0)
        return BBox(x, y, min(max(self.w, 0.0), 1.0 - x), min(max(self.h, 0.0), 1.0 - y))

    def as_json(self) -> dict[str, float]:
        b = self.clamped()
        return {"x": round(b.x, 4), "y": round(b.y, 4), "w": round(b.w, 4), "h": round(b.h, 4)}


@dataclass
class PhotoBundle:
    photo_id: str
    region: str
    storage_path: str
    data: bytes


@dataclass
class CheckContext:
    check_id: str
    job_id: str
    profile_id: str
    brand_id: str | None
    brand_name: str | None
    category_id: str | None
    category_slug: str | None
    category_name: str | None
    product_id: str | None
    product_name: str | None
    auth_guide: dict[str, Any]
    serial_formats: list[str]
    photos: list[PhotoBundle] = field(default_factory=list)


@dataclass
class OcrResult:
    photo_id: str
    region: str
    provider: str
    raw_text: str
    normalized_text: str
    extracted: dict[str, list[str]]
    qr_payloads: list[str]


@dataclass
class DetectedRegion:
    photo_id: str
    label: str
    bbox: BBox
    source: str  # 'cv' | 'claude'
    confidence: float | None


@dataclass
class RegionComparison:
    photo_id: str
    region: str
    similarity_authentic: float | None
    similarity_replica: float | None
    n_authentic: int
    n_replica: int

    @property
    def margin(self) -> float | None:
        if self.similarity_authentic is None:
            return None
        replica = self.similarity_replica if self.similarity_replica is not None else 0.0
        return self.similarity_authentic - replica


@dataclass
class VisualEvidence:
    photo_id: str
    region: str
    kind: str
    polarity: Polarity
    severity: Severity
    observation: str
    bbox: BBox | None


@dataclass
class Finding:
    photo_id: str | None
    region: str
    kind: str
    polarity: Polarity
    score: float | None
    title: str
    detail_md: str
    conclusion_md: str
    bbox: dict[str, float] | None
    comparison: dict[str, Any] | None


@dataclass
class ScoreResult:
    probability: float
    risk: str
    outcome: str
    confidence: str
    breakdown: dict[str, Any]
