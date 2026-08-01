from garimpo_pipeline.pipeline.ocr import parse


def test_normalize_strips_accents_and_collapses_whitespace():
    assert parse.normalize("  Composição:\t100% algodão \n\n ") == "COMPOSICAO: 100% ALGODAO"


def test_extract_composition_country_and_dates():
    text = parse.normalize(
        "80% Algodão 20% Poliéster\nMade in Vietnam\nFabricado no Brasil\n10/2019\n03/05/2021"
    )
    extracted = parse.extract(text)
    assert "80% ALGODAO" in extracted["composition"]
    assert "20% POLIESTER" in extracted["composition"]
    assert "VIETNAM" in extracted["countries"]
    assert "BRASIL" in extracted["countries"]
    assert "10/2019" in extracted["dates"]
    assert "03/05/2021" in extracted["dates"]


def test_extract_rn_ca_and_style_codes():
    text = parse.normalize("RN 123.456 CA 12345 Estilo DD1391-100 serial ABC1234XYZ")
    extracted = parse.extract(text)
    assert extracted["rn"] == ["123456"]
    assert extracted["ca"] == ["12345"]
    assert "DD1391-100" in extracted["style_codes"]
    assert "ABC1234XYZ" in extracted["serials"]


def test_suspicious_tokens_detected():
    extracted = parse.extract(parse.normalize("100% cottom official quality"))
    assert "COTTOM" in extracted["suspicious_tokens"]


def test_serial_matches_formats():
    assert parse.serial_matches_formats(["DD1391-100"], [r"[A-Z]{2}\d{4}-\d{3}"]) is True
    assert parse.serial_matches_formats(["XXXX"], [r"[A-Z]{2}\d{4}-\d{3}"]) is False
    assert parse.serial_matches_formats([], [r"[A-Z]{2}\d{4}-\d{3}"]) is False
    assert parse.serial_matches_formats(["DD1391-100"], []) is None


def test_extract_qr_free_text_does_not_crash():
    assert parse.extract("") == {
        "dates": [],
        "countries": [],
        "composition": [],
        "rn": [],
        "ca": [],
        "serials": [],
        "style_codes": [],
        "internal_codes": [],
        "suspicious_tokens": [],
    }
