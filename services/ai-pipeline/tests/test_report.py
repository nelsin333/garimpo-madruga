import re

from garimpo_pipeline.pipeline import report, scoring
from garimpo_pipeline.types import (
    BBox,
    OcrResult,
    Polarity,
    RegionComparison,
    Severity,
    VisualEvidence,
)


def test_findings_from_evidences_maps_polarity_and_bbox():
    evidences = [
        VisualEvidence(
            photo_id="p1",
            region="neck_tag",
            kind="typography",
            polarity=Polarity.SUSPICIOUS,
            severity=Severity.MAJOR,
            observation="Kerning irregular no logotipo da etiqueta.",
            bbox=BBox(0.1, 0.2, 0.3, 0.2),
        ),
        VisualEvidence(
            photo_id="p2",
            region="hem_stitch",
            kind="stitching",
            polarity=Polarity.POSITIVE,
            severity=Severity.MINOR,
            observation="Pontos regulares na barra.",
            bbox=None,
        ),
    ]
    findings = report.findings_from_evidences(evidences)
    assert findings[0].polarity is Polarity.SUSPICIOUS
    assert findings[0].bbox == {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.2}
    assert "Tipografia" in findings[0].title
    assert findings[1].polarity is Polarity.POSITIVE
    assert findings[1].bbox is None


def test_findings_from_comparisons_all_three_polarities():
    comparisons = [
        RegionComparison("p1", "neck_tag", 0.9, 0.8, 5, 5),  # margem positiva
        RegionComparison("p2", "logo", 0.78, 0.86, 5, 5),  # mais perto de réplicas
        RegionComparison("p3", "front", None, None, 0, 0),  # sem referências
    ]
    findings = report.findings_from_comparisons(comparisons)
    assert findings[0].polarity is Polarity.POSITIVE
    assert findings[1].polarity is Polarity.SUSPICIOUS
    assert findings[2].polarity is Polarity.NEUTRAL
    assert findings[2].comparison == {
        "similarity_authentic": None,
        "similarity_replica": None,
        "n_authentic": 0,
        "n_replica": 0,
    }


def test_findings_from_ocr_serial_and_suspicious_tokens():
    ocr = [
        OcrResult(
            photo_id="p1",
            region="neck_tag",
            provider="google-vision",
            raw_text="raw",
            normalized_text="norm",
            extracted={
                "serials": ["DD1391-100"],
                "style_codes": [],
                "suspicious_tokens": ["COTTOM"],
                "countries": ["BRASIL"],
                "composition": ["100% ALGODAO"],
                "rn": ["123456"],
            },
            qr_payloads=["https://example.com/x"],
        )
    ]
    valid = report.findings_from_ocr(ocr, serial_check=True)
    titles = [f.title for f in valid]
    assert any("Serial" in t and "válido" in t for t in titles)
    assert any("grafia atípica" in t for t in titles)
    assert any("Etiquetagem completa" in t for t in titles)
    assert any("QR code" in t for t in titles)

    invalid = report.findings_from_ocr(ocr, serial_check=False)
    assert any(f.polarity is Polarity.SUSPICIOUS and f.kind == "serial_format" for f in invalid)


def test_compose_verdict_texts_mentions_counts_and_inconclusive():
    comparisons = [RegionComparison("p3", "front", None, None, 0, 0)]
    findings = report.findings_from_comparisons(comparisons)
    score = scoring.compute(
        scoring.ScoreInputs(
            serial_check=None,
            label_fields_present=0,
            suspicious_token_count=0,
            comparisons=comparisons,
            evidences=[],
            photo_reuse_count=0,
            internal_duplicate_count=0,
            required_photo_coverage=1.0,
            ocr_ran=False,
            claude_ran=False,
        )
    )
    texts = report.compose_verdict_texts(piece_name="Nike Dunk Low", score=score, findings=findings)
    assert "Nike Dunk Low" in texts["summary_md"]
    assert "inconclusivos" in texts["summary_md"]
    assert texts["recommendations_md"]
    assert texts["next_steps_md"]


def test_certificate_code_format():
    code = report.generate_certificate_code()
    assert re.fullmatch(r"GM-[A-Z2-9]{4}-[A-Z2-9]{4}", code)
    assert not any(c in code[3:] for c in "01OIL")
