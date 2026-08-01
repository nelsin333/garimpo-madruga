"""Normalização e extração estruturada do texto de etiquetas.

Extrai: datas, país de fabricação, composição têxtil, RN (registro têxtil
brasileiro), CA (certificado de aprovação), seriais, style codes e códigos
internos — além de tokens tipicamente presentes em réplicas (erros de grafia
recorrentes em etiquetas falsificadas).
"""

import re
import unicodedata

FABRIC_WORDS = (
    "ALGODAO|COTTON|POLIESTER|POLYESTER|ELASTANO|SPANDEX|ELASTANE|LYCRA|"
    "LA|WOOL|NYLON|POLIAMIDA|POLYAMIDE|VISCOSE|RAYON|LINHO|LINEN|SEDA|SILK|ACRILICO|ACRYLIC"
)

_DATE_RE = re.compile(
    r"\b(?:(?:0[1-9]|[12]\d|3[01])[/.\-](?:0[1-9]|1[0-2])[/.\-](?:\d{2}|\d{4})"
    r"|(?:0[1-9]|1[0-2])[/.\-](?:19|20)\d{2}"
    r"|(?:19|20)\d{2})\b"
)
_COUNTRY_RE = re.compile(
    r"\b(?:MADE\s+IN|FABRICADO\s+(?:NO|NA|EM)|HECHO\s+EN|FABRIQUE\s+(?:AU|EN))\s+([A-Z]{3,20})"
    r"|(?:\b(INDUSTRIA\s+BRASILEIRA)\b)"
)
_COMPOSITION_RE = re.compile(rf"\b(\d{{1,3}})\s*%\s*({FABRIC_WORDS})\b")
_RN_RE = re.compile(r"\bRN[:.\s]*((?:\d[.\s]?){4,8}\d)\b")
_CA_RE = re.compile(r"\bCA[:.\s]*?(\d{4,6})\b")
_STYLE_CODE_RE = re.compile(r"\b([A-Z]{1,3}\d{4,6}-\d{3}|\d{6}-\d{3}|[A-Z]{2}\d{4})\b")
_SERIAL_RE = re.compile(r"\b(?=[A-Z0-9/-]{7,20}\b)(?=\w*\d)(?=\w*[A-Z])[A-Z0-9/-]{7,20}\b")
_INTERNAL_CODE_RE = re.compile(r"\b[A-Z]{1,4}[-/]?\d{3,8}\b")

# Erros de grafia recorrentes em etiquetas de réplica (dicionário curado).
SUSPICIOUS_TOKENS = frozenset(
    {
        "COTTOM",
        "COTTQN",
        "POLYSTER",
        "POLIESTERE",
        "ATHENTIC",
        "AUTHENTHIC",
        "OFFICAL",
        "ORGINAL",
        "GUARANTE",
        "QUALITTY",
        "MAED",
        "FABRIQUEE",
        "INDUSTRIA BRAZILEIRA",
    }
)


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize(raw: str) -> str:
    """Uppercase sem acentos, espaços colapsados — base de todas as extrações."""
    text = strip_accents(raw).upper()
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def extract(normalized: str) -> dict[str, list[str]]:
    dates = _dedupe(_DATE_RE.findall(normalized))
    countries = _dedupe(
        [next(g for g in m if g) for m in _COUNTRY_RE.findall(normalized)] if normalized else []
    )
    composition = _dedupe(
        [f"{pct}% {fabric}" for pct, fabric in _COMPOSITION_RE.findall(normalized)]
    )
    rn = _dedupe([re.sub(r"[.\s]", "", m) for m in _RN_RE.findall(normalized)])
    ca = _dedupe(_CA_RE.findall(normalized))
    style_codes = _dedupe(_STYLE_CODE_RE.findall(normalized))

    consumed = set(style_codes) | set(rn) | set(ca)
    serials = _dedupe([s for s in _SERIAL_RE.findall(normalized) if s not in consumed])
    internal_codes = _dedupe(
        [
            c
            for c in _INTERNAL_CODE_RE.findall(normalized)
            if c not in consumed and c not in set(serials)
        ]
    )
    suspicious = _dedupe([t for t in SUSPICIOUS_TOKENS if t in normalized])

    return {
        "dates": dates,
        "countries": countries,
        "composition": composition,
        "rn": rn,
        "ca": ca,
        "serials": serials,
        "style_codes": style_codes,
        "internal_codes": internal_codes,
        "suspicious_tokens": suspicious,
    }


def serial_matches_formats(serials: list[str], formats: list[str]) -> bool | None:
    """True/False se há formatos conhecidos para comparar; None sem gabarito."""
    if not formats:
        return None
    if not serials:
        return False
    for serial in serials:
        for fmt in formats:
            try:
                if re.fullmatch(fmt, serial):
                    return True
            except re.error:
                continue
    return False


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
