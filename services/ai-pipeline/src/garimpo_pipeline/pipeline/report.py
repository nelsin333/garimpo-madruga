"""Composição do laudo: transforma os sinais reais do pipeline em findings
explicáveis (com foto, bbox e comparações) e nos textos do verdict em pt-BR."""

import secrets

from ..types import (
    Finding,
    OcrResult,
    Polarity,
    RegionComparison,
    ScoreResult,
    Severity,
    VisualEvidence,
)

KIND_TITLES: dict[str, str] = {
    "typography": "Tipografia",
    "embroidery": "Bordado",
    "stitching": "Costura",
    "label_layout": "Layout da etiqueta",
    "label_content": "Conteúdo da etiqueta",
    "print_quality": "Qualidade da estampa",
    "hardware": "Aviamentos e ferragens",
    "material": "Material",
    "construction": "Construção",
    "logo_geometry": "Geometria do logo",
    "other": "Observação visual",
}

REGION_TITLES: dict[str, str] = {
    "front": "frente",
    "back": "costas",
    "neck_tag": "etiqueta principal",
    "wash_tag": "etiqueta de composição",
    "size_tag": "etiqueta de tamanho",
    "interior_label": "etiqueta interna",
    "hang_tag": "tag",
    "logo": "logo",
    "embroidery": "bordado",
    "print": "estampa",
    "collar_stitch": "costura da gola",
    "hem_stitch": "costura da barra",
    "pocket_stitch": "costura do bolso",
    "stitching": "costura",
    "cuffs": "punhos",
    "zipper": "zíper",
    "buttons": "botões",
    "hardware": "ferragens",
    "lining": "forro",
    "serial": "serial",
    "qr_code": "QR code",
    "insole": "palmilha",
    "outsole": "solado",
    "heel_tab": "heel tab",
    "box_label": "etiqueta da caixa",
    "packaging": "embalagem",
    "receipt": "nota fiscal",
    "defects": "defeitos",
}

KNN_POSITIVE_MARGIN = 0.03
KNN_SUSPICIOUS_MARGIN = -0.03


def region_title(region: str) -> str:
    return REGION_TITLES.get(region, region.replace("_", " "))


def findings_from_evidences(evidences: list[VisualEvidence]) -> list[Finding]:
    findings: list[Finding] = []
    for evidence in evidences:
        kind_title = KIND_TITLES.get(evidence.kind, "Observação visual")
        title = f"{kind_title} — {region_title(evidence.region)}"
        if evidence.polarity is Polarity.SUSPICIOUS:
            conclusion = {
                Severity.MINOR: "Desvio pequeno — peso limitado na análise.",
                Severity.MODERATE: "Desvio relevante em relação ao esperado.",
                Severity.MAJOR: "Desvio grave — forte indicador negativo.",
            }[evidence.severity]
            score = {Severity.MINOR: 0.4, Severity.MODERATE: 0.25, Severity.MAJOR: 0.1}[
                evidence.severity
            ]
        elif evidence.polarity is Polarity.POSITIVE:
            conclusion = "Consistente com o padrão de produção esperado."
            score = 0.85
        else:
            conclusion = "As fotos enviadas não permitem avaliar este ponto."
            score = None
        findings.append(
            Finding(
                photo_id=evidence.photo_id,
                region=evidence.region,
                kind=evidence.kind,
                polarity=evidence.polarity,
                score=score,
                title=title,
                detail_md=evidence.observation,
                conclusion_md=conclusion,
                bbox=evidence.bbox.as_json() if evidence.bbox else None,
                comparison=None,
            )
        )
    return findings


def findings_from_ocr(
    ocr_results: list[OcrResult],
    *,
    serial_check: bool | None,
) -> list[Finding]:
    findings: list[Finding] = []

    label_results = [r for r in ocr_results if r.extracted]
    all_extracted: dict[str, list[str]] = {}
    for result in label_results:
        for key, values in result.extracted.items():
            all_extracted.setdefault(key, []).extend(values)

    serial_photo = next(
        (r for r in ocr_results if r.extracted.get("serials") or r.extracted.get("style_codes")),
        None,
    )
    if serial_check is True and serial_photo is not None:
        codes = all_extracted.get("serials") or all_extracted.get("style_codes") or []
        findings.append(
            Finding(
                photo_id=serial_photo.photo_id,
                region=serial_photo.region,
                kind="serial_format",
                polarity=Polarity.POSITIVE,
                score=0.9,
                title="Serial — formato válido",
                detail_md=(
                    f"O código identificado ({', '.join(codes[:2])}) "
                    "segue o formato documentado para esta marca e categoria."
                ),
                conclusion_md="Formato de serial compatível com o gabarito.",
                bbox=None,
                comparison=None,
            )
        )
    elif serial_check is False:
        anchor = serial_photo or (label_results[0] if label_results else None)
        findings.append(
            Finding(
                photo_id=anchor.photo_id if anchor else None,
                region=anchor.region if anchor else "serial",
                kind="serial_format",
                polarity=Polarity.SUSPICIOUS,
                score=0.15,
                title="Serial — formato não confere",
                detail_md=(
                    "Nenhum código identificado nas etiquetas corresponde aos formatos de "
                    "serial documentados para esta marca e categoria."
                ),
                conclusion_md="Formato de serial incompatível com o gabarito.",
                bbox=None,
                comparison=None,
            )
        )

    suspicious_tokens = all_extracted.get("suspicious_tokens", [])
    if suspicious_tokens:
        anchor = next(
            (r for r in label_results if r.extracted.get("suspicious_tokens")), label_results[0]
        )
        findings.append(
            Finding(
                photo_id=anchor.photo_id,
                region=anchor.region,
                kind="label_content",
                polarity=Polarity.SUSPICIOUS,
                score=0.1,
                title="Texto da etiqueta com grafia atípica",
                detail_md=(
                    "O texto reconhecido contém termos com grafia recorrente em etiquetas "
                    f"falsificadas: {', '.join(suspicious_tokens[:3])}."
                ),
                conclusion_md="Grafia incompatível com etiquetas de produção original.",
                bbox=None,
                comparison=None,
            )
        )

    completeness_fields = [
        ("countries", "país de fabricação"),
        ("composition", "composição"),
        ("rn", "RN"),
    ]
    present = [label for key, label in completeness_fields if all_extracted.get(key)]
    if label_results:
        anchor = label_results[0]
        if len(present) >= 2:
            findings.append(
                Finding(
                    photo_id=anchor.photo_id,
                    region=anchor.region,
                    kind="label_content",
                    polarity=Polarity.POSITIVE,
                    score=0.75,
                    title="Etiquetagem completa",
                    detail_md=(
                        "As etiquetas trazem os campos regulatórios esperados: "
                        f"{', '.join(present)}."
                    ),
                    conclusion_md="Etiquetagem consistente com produto regular.",
                    bbox=None,
                    comparison=None,
                )
            )
        else:
            findings.append(
                Finding(
                    photo_id=anchor.photo_id,
                    region=anchor.region,
                    kind="label_content",
                    polarity=Polarity.NEUTRAL,
                    score=None,
                    title="Etiquetagem parcialmente legível",
                    detail_md=(
                        "Não foi possível reconhecer todos os campos regulatórios "
                        "(país, composição, RN) nas fotos enviadas."
                    ),
                    conclusion_md="Item inconclusivo — refazer fotos das etiquetas ajuda.",
                    bbox=None,
                    comparison=None,
                )
            )

    qr_result = next((r for r in ocr_results if r.qr_payloads), None)
    if qr_result is not None:
        findings.append(
            Finding(
                photo_id=qr_result.photo_id,
                region=qr_result.region,
                kind="code_validation",
                polarity=Polarity.NEUTRAL,
                score=None,
                title="QR code decodificado",
                detail_md=f"Conteúdo lido: {qr_result.qr_payloads[0][:120]}",
                conclusion_md="Payload registrado para validação contra a base da marca.",
                bbox=None,
                comparison=None,
            )
        )

    return findings


def findings_from_comparisons(comparisons: list[RegionComparison]) -> list[Finding]:
    findings: list[Finding] = []
    for comparison in comparisons:
        title = f"Comparação com referências — {region_title(comparison.region)}"
        payload = {
            "similarity_authentic": comparison.similarity_authentic,
            "similarity_replica": comparison.similarity_replica,
            "n_authentic": comparison.n_authentic,
            "n_replica": comparison.n_replica,
        }
        margin = comparison.margin
        if margin is None:
            findings.append(
                Finding(
                    photo_id=comparison.photo_id,
                    region=comparison.region,
                    kind="reference_similarity",
                    polarity=Polarity.NEUTRAL,
                    score=None,
                    title=title,
                    detail_md=(
                        "Ainda não há referências catalogadas desta marca/categoria para "
                        "esta região — a comparação vetorial não pôde ser feita."
                    ),
                    conclusion_md="Item inconclusivo por falta de referências.",
                    bbox=None,
                    comparison=payload,
                )
            )
        elif margin >= KNN_POSITIVE_MARGIN:
            findings.append(
                Finding(
                    photo_id=comparison.photo_id,
                    region=comparison.region,
                    kind="reference_similarity",
                    polarity=Polarity.POSITIVE,
                    score=min(0.95, 0.6 + margin * 2),
                    title=title,
                    detail_md=(
                        f"A região está {_fmt(comparison.similarity_authentic)} similar às "
                        f"referências autênticas ({comparison.n_authentic} exemplares) e "
                        "mais distante das réplicas catalogadas."
                    ),
                    conclusion_md="Assinatura visual próxima do padrão autêntico.",
                    bbox=None,
                    comparison=payload,
                )
            )
        elif margin <= KNN_SUSPICIOUS_MARGIN:
            findings.append(
                Finding(
                    photo_id=comparison.photo_id,
                    region=comparison.region,
                    kind="reference_similarity",
                    polarity=Polarity.SUSPICIOUS,
                    score=max(0.05, 0.4 + margin * 2),
                    title=title,
                    detail_md=(
                        "A região está mais próxima de réplicas catalogadas "
                        f"({comparison.n_replica} exemplares) do que das referências "
                        "autênticas desta marca."
                    ),
                    conclusion_md="Assinatura visual mais próxima de réplicas conhecidas.",
                    bbox=None,
                    comparison=payload,
                )
            )
        else:
            findings.append(
                Finding(
                    photo_id=comparison.photo_id,
                    region=comparison.region,
                    kind="reference_similarity",
                    polarity=Polarity.NEUTRAL,
                    score=None,
                    title=title,
                    detail_md=(
                        "A similaridade com referências autênticas e com réplicas ficou "
                        "equilibrada — a comparação vetorial não separa as hipóteses."
                    ),
                    conclusion_md="Comparação vetorial não decisiva para esta região.",
                    bbox=None,
                    comparison=payload,
                )
            )
    return findings


def compose_verdict_texts(
    *,
    piece_name: str,
    score: ScoreResult,
    findings: list[Finding],
) -> dict[str, str]:
    positives = [f for f in findings if f.polarity is Polarity.POSITIVE]
    suspicious = [f for f in findings if f.polarity is Polarity.SUSPICIOUS]
    neutral = [f for f in findings if f.polarity is Polarity.NEUTRAL]

    drivers = sorted(
        suspicious,
        key=lambda f: f.score if f.score is not None else 0.5,
    )[:2]
    if drivers:
        driver_text = (
            " Principais pontos de atenção: " + "; ".join(d.title.lower() for d in drivers) + "."
        )
    else:
        driver_text = ""
    inconclusive_text = (
        f" {len(neutral)} itens ficaram inconclusivos com as fotos enviadas." if neutral else ""
    )

    summary = (
        f"Analisamos {len(findings)} evidências de {piece_name}. "
        f"{len(positives)} conferem com o padrão esperado e {len(suspicious)} apresentam "
        f"desvios.{driver_text}{inconclusive_text}"
    )

    if score.outcome == "original":
        recommendations = (
            "- Guarde o certificado digital junto da peça.\n"
            "- Ao anunciar, inclua o link do laudo para valorizar a venda."
        )
        next_steps = (
            "1. Salve o certificado.\n"
            "2. Compartilhe o laudo com o comprador.\n"
            "3. Anuncie a peça com o selo."
        )
    elif score.outcome == "replica":
        recommendations = (
            "- Não recomendamos a compra/venda desta peça como original.\n"
            "- Se você comprou recentemente, acione o vendedor com este laudo.\n"
            "- Este resultado é uma análise probabilística, não uma acusação."
        )
        next_steps = (
            "1. Revise as evidências marcadas.\n"
            "2. Solicite revisão humana se discordar.\n"
            "3. Consulte nossos guias sobre devolução."
        )
    else:
        refazer = (
            "- Refaça as fotos dos itens inconclusivos com boa iluminação.\n" if neutral else ""
        )
        recommendations = (
            f"{refazer}- Adicione fotos opcionais (tag, QR, nota fiscal) se disponíveis.\n"
            "- Uma segunda análise não será cobrada."
        )
        next_steps = (
            "1. Refaça as fotos indicadas.\n"
            "2. Reenvie para análise.\n"
            "3. Solicite revisão humana se preferir."
        )

    return {
        "summary_md": summary,
        "recommendations_md": recommendations,
        "next_steps_md": next_steps,
    }


def generate_certificate_code() -> str:
    def block() -> str:
        alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sem 0/O/1/I/L
        return "".join(secrets.choice(alphabet) for _ in range(4))

    return f"GM-{block()}-{block()}"


def _fmt(similarity: float | None) -> str:
    if similarity is None:
        return "—"
    return f"{similarity:.0%}"
