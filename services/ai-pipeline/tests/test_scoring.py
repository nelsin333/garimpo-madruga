from garimpo_pipeline.pipeline import scoring
from garimpo_pipeline.types import BBox, Polarity, RegionComparison, Severity, VisualEvidence


def make_inputs(**overrides) -> scoring.ScoreInputs:
    base = {
        "serial_check": None,
        "label_fields_present": 0,
        "suspicious_token_count": 0,
        "comparisons": [],
        "evidences": [],
        "photo_reuse_count": 0,
        "internal_duplicate_count": 0,
        "required_photo_coverage": 1.0,
        "ocr_ran": True,
        "claude_ran": True,
    }
    base.update(overrides)
    return scoring.ScoreInputs(**base)


def comparison(margin: float, n: int = 5) -> RegionComparison:
    return RegionComparison(
        photo_id="p",
        region="neck_tag",
        similarity_authentic=0.8 + margin / 2,
        similarity_replica=0.8 - margin / 2,
        n_authentic=n,
        n_replica=n,
    )


def evidence(polarity: Polarity, severity: Severity = Severity.MODERATE) -> VisualEvidence:
    return VisualEvidence(
        photo_id="p",
        region="logo",
        kind="logo_geometry",
        polarity=polarity,
        severity=severity,
        observation="obs",
        bbox=BBox(0.1, 0.1, 0.2, 0.2),
    )


def test_no_evidence_is_inconclusive_near_half():
    result = scoring.compute(make_inputs(ocr_ran=False, claude_ran=False))
    assert result.risk == "inconclusive"
    assert result.outcome == "inconclusive"
    assert 0.35 <= result.probability <= 0.65


def test_strong_positive_signals_yield_original():
    result = scoring.compute(
        make_inputs(
            serial_check=True,
            label_fields_present=3,
            comparisons=[comparison(0.12), comparison(0.1), comparison(0.11)],
            evidences=[evidence(Polarity.POSITIVE) for _ in range(4)],
        )
    )
    assert result.probability >= 0.9
    assert result.risk == "low"
    assert result.outcome == "original"


def test_replica_signals_yield_low_probability():
    result = scoring.compute(
        make_inputs(
            serial_check=False,
            suspicious_token_count=2,
            comparisons=[comparison(-0.12), comparison(-0.1)],
            evidences=[
                evidence(Polarity.SUSPICIOUS, Severity.MAJOR),
                evidence(Polarity.SUSPICIOUS, Severity.MODERATE),
            ],
        )
    )
    assert result.probability <= 0.35
    assert result.outcome == "replica"
    assert result.risk == "high"


def test_probability_is_monotonic_in_knn_margin():
    low = scoring.compute(make_inputs(comparisons=[comparison(-0.1)]))
    mid = scoring.compute(make_inputs(comparisons=[comparison(0.0)]))
    high = scoring.compute(make_inputs(comparisons=[comparison(0.1)]))
    assert low.probability < mid.probability < high.probability


def test_incomplete_coverage_caps_probability():
    strong = make_inputs(
        serial_check=True,
        label_fields_present=3,
        comparisons=[comparison(0.12) for _ in range(4)],
        evidences=[evidence(Polarity.POSITIVE) for _ in range(4)],
    )
    full = scoring.compute(strong)
    partial = scoring.compute(
        make_inputs(
            serial_check=True,
            label_fields_present=3,
            comparisons=[comparison(0.12) for _ in range(4)],
            evidences=[evidence(Polarity.POSITIVE) for _ in range(4)],
            required_photo_coverage=0.5,
        )
    )
    assert partial.probability < full.probability
    assert partial.probability <= 0.78


def test_photo_reuse_is_heavily_penalized():
    clean = scoring.compute(make_inputs(comparisons=[comparison(0.1)]))
    reused = scoring.compute(make_inputs(comparisons=[comparison(0.1)], photo_reuse_count=2))
    assert reused.probability < clean.probability - 0.1


def test_absence_of_signal_never_yields_low_risk():
    # sem OCR, sem Claude, sem referências: nunca "baixo risco"
    result = scoring.compute(
        make_inputs(ocr_ran=False, claude_ran=False, comparisons=[], evidences=[])
    )
    assert result.risk != "low"


def test_breakdown_is_auditable():
    result = scoring.compute(make_inputs(serial_check=True, comparisons=[comparison(0.05)]))
    assert result.breakdown["version"] == scoring.VERSION
    assert "serial_valid" in result.breakdown["contributions"]
    assert "knn_margin" in result.breakdown["contributions"]
    assert result.breakdown["signals"]["knn_regions_compared"] == 1
