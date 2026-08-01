"""Score engine — agregador aggregator-v1.

Combina sinais independentes (OCR, kNN de embeddings, evidências visuais do
Claude, validação de imagem, histórico de reuso de fotos) numa probabilidade
via regressão logística com pesos explícitos e auditáveis. O resultado NUNCA
é binário: probabilidade + risco + confiança + breakdown por feature.

Assimetria deliberada: aprovar uma réplica custa muito mais caro que mandar
um original para revisão — os pesos negativos são maiores e o teto de
probabilidade depende de evidência POSITIVA real, não da ausência de sinal.
"""

import math
from dataclasses import dataclass
from typing import Any

from ..types import Polarity, RegionComparison, ScoreResult, VisualEvidence

VERSION = "aggregator-v1"

# Pesos por feature (contribuição no logit). Auditáveis no score_breakdown.
WEIGHTS: dict[str, float] = {
    "serial_valid": 1.2,
    "serial_invalid": -2.4,
    "label_completeness": 0.5,
    "suspicious_tokens": -1.6,
    "knn_margin": 3.0,
    "claude_positive": 0.35,
    "claude_suspicious_minor": -0.45,
    "claude_suspicious_moderate": -0.9,
    "claude_suspicious_major": -1.8,
    "photo_reuse": -2.0,
    "internal_duplicates": -0.6,
}

BASE_LOGIT = 0.4  # prior levemente positivo: quem paga check costuma ter peça real

# Caps de contribuição por família de sinal (nenhum sinal domina sozinho).
CLAUDE_POSITIVE_CAP = 1.4
CLAUDE_SUSPICIOUS_CAP = -4.5
SUSPICIOUS_TOKENS_CAP = 2

# Evidência mínima para sair de "inconclusivo".
MIN_EVIDENCE_MASS = 2.0


@dataclass
class ScoreInputs:
    serial_check: bool | None  # None = sem gabarito de formato
    label_fields_present: int  # país + composição + RN/CA presentes (0–3)
    suspicious_token_count: int
    comparisons: list[RegionComparison]
    evidences: list[VisualEvidence]
    photo_reuse_count: int
    internal_duplicate_count: int
    required_photo_coverage: float  # 0–1
    ocr_ran: bool
    claude_ran: bool


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def compute(inputs: ScoreInputs) -> ScoreResult:
    contributions: dict[str, float] = {}
    evidence_mass = 0.0

    # --- OCR ---
    if inputs.serial_check is True:
        contributions["serial_valid"] = WEIGHTS["serial_valid"]
        evidence_mass += 1.0
    elif inputs.serial_check is False:
        contributions["serial_invalid"] = WEIGHTS["serial_invalid"]
        evidence_mass += 1.0

    if inputs.ocr_ran:
        completeness = min(inputs.label_fields_present, 3) / 3.0
        contributions["label_completeness"] = WEIGHTS["label_completeness"] * completeness
        evidence_mass += 0.5 * completeness

        tokens = min(inputs.suspicious_token_count, SUSPICIOUS_TOKENS_CAP)
        if tokens > 0:
            contributions["suspicious_tokens"] = WEIGHTS["suspicious_tokens"] * tokens
            evidence_mass += 1.0

    # --- kNN de embeddings ---
    margins = [c.margin for c in inputs.comparisons if c.margin is not None]
    if margins:
        mean_margin = sum(margins) / len(margins)
        # margem típica fica em [-0.15, 0.15]; escala para [-1, 1]
        scaled = max(-1.0, min(1.0, mean_margin / 0.15))
        contributions["knn_margin"] = WEIGHTS["knn_margin"] * scaled
        evidence_mass += min(2.0, 0.5 * len(margins))

    # --- Evidências visuais (Claude) ---
    if inputs.claude_ran:
        positive_total = 0.0
        suspicious_total = 0.0
        for evidence in inputs.evidences:
            if evidence.polarity is Polarity.POSITIVE:
                positive_total += WEIGHTS["claude_positive"]
            elif evidence.polarity is Polarity.SUSPICIOUS:
                key = f"claude_suspicious_{evidence.severity.value}"
                suspicious_total += WEIGHTS.get(key, WEIGHTS["claude_suspicious_moderate"])
        positive_total = min(positive_total, CLAUDE_POSITIVE_CAP)
        suspicious_total = max(suspicious_total, CLAUDE_SUSPICIOUS_CAP)
        if positive_total:
            contributions["claude_positive"] = round(positive_total, 4)
        if suspicious_total:
            contributions["claude_suspicious"] = round(suspicious_total, 4)
        graded = [e for e in inputs.evidences if e.polarity is not Polarity.NEUTRAL]
        evidence_mass += min(2.0, 0.35 * len(graded))

    # --- Antifraude / integridade ---
    if inputs.photo_reuse_count > 0:
        contributions["photo_reuse"] = WEIGHTS["photo_reuse"]
        evidence_mass += 1.0
    if inputs.internal_duplicate_count > 0:
        contributions["internal_duplicates"] = WEIGHTS["internal_duplicates"]

    logit = BASE_LOGIT + sum(contributions.values())
    probability = _sigmoid(logit)

    # Cobertura incompleta de fotos reduz o teto (não dá "baixo risco" sem ver a peça).
    coverage = max(0.0, min(1.0, inputs.required_photo_coverage))
    ceiling = 0.55 + 0.44 * coverage
    probability = min(probability, ceiling)

    inconclusive = evidence_mass < MIN_EVIDENCE_MASS
    if inconclusive:
        # sem evidência suficiente, puxa para o centro — honestidade estatística
        probability = 0.5 + (probability - 0.5) * 0.4

    probability = round(min(0.99, max(0.01, probability)), 3)

    if inconclusive:
        risk = "inconclusive"
    elif probability >= 0.9:
        risk = "low"
    elif probability >= 0.7:
        risk = "medium"
    else:
        risk = "high"

    # Mesma regra de produto do contrato (outcomeFromVerdict).
    if risk == "inconclusive":
        outcome = "inconclusive"
    elif probability >= 0.85 and risk == "low":
        outcome = "original"
    elif probability <= 0.35:
        outcome = "replica"
    else:
        outcome = "inconclusive"

    if evidence_mass >= 4.0 and margins:
        confidence = "high"
    elif evidence_mass >= MIN_EVIDENCE_MASS:
        confidence = "medium"
    else:
        confidence = "low"

    breakdown: dict[str, Any] = {
        "version": VERSION,
        "base_logit": BASE_LOGIT,
        "contributions": {k: round(v, 4) for k, v in contributions.items()},
        "evidence_mass": round(evidence_mass, 2),
        "coverage": round(coverage, 3),
        "signals": {
            "ocr_ran": inputs.ocr_ran,
            "claude_ran": inputs.claude_ran,
            "knn_regions_compared": len(margins),
            "photo_reuse_count": inputs.photo_reuse_count,
            "internal_duplicate_count": inputs.internal_duplicate_count,
        },
    }

    return ScoreResult(
        probability=probability,
        risk=risk,
        outcome=outcome,
        confidence=confidence,
        breakdown=breakdown,
    )
