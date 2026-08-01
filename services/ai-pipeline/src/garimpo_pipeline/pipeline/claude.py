"""Análise visual multimodal com Claude.

Papel estrito: produzir EVIDÊNCIAS observáveis ("bordado com pontos
espaçados na curva", "tipografia com kerning irregular"), cada uma ancorada
em foto + bbox. O modelo é explicitamente proibido de concluir autenticidade
— a decisão é do agregador (scoring.py). Saída estruturada via tool use.
"""

import base64
import io
import logging
from typing import Any

from anthropic import Anthropic
from PIL import Image

from ..config import settings
from ..types import BBox, CheckContext, DetectedRegion, Polarity, Severity, VisualEvidence

log = logging.getLogger(__name__)

EVIDENCE_TOOL: dict[str, Any] = {
    "name": "record_visual_evidence",
    "description": "Registra evidências visuais observadas nas fotos da peça.",
    "input_schema": {
        "type": "object",
        "properties": {
            "evidences": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "photo_index": {
                            "type": "integer",
                            "description": "Índice da foto (0-based) a que a evidência se refere.",
                        },
                        "kind": {
                            "type": "string",
                            "enum": [
                                "typography",
                                "embroidery",
                                "stitching",
                                "label_layout",
                                "label_content",
                                "print_quality",
                                "hardware",
                                "material",
                                "construction",
                                "logo_geometry",
                                "other",
                            ],
                        },
                        "polarity": {
                            "type": "string",
                            "enum": ["positive", "suspicious", "neutral"],
                            "description": (
                                "positive = consistente com produção original; "
                                "suspicious = desvio observável; neutral = não conclusivo."
                            ),
                        },
                        "severity": {
                            "type": "string",
                            "enum": ["minor", "moderate", "major"],
                        },
                        "observation": {
                            "type": "string",
                            "description": "Observação objetiva em pt-BR, 1–2 frases.",
                        },
                        "bbox": {
                            "type": "object",
                            "description": "Região da observação, normalizada 0–1.",
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "w": {"type": "number"},
                                "h": {"type": "number"},
                            },
                            "required": ["x", "y", "w", "h"],
                        },
                        "region_label": {
                            "type": "string",
                            "description": (
                                "Elemento observado: logo, etiqueta, costura, bordado, "
                                "estampa, ziper, botao, acabamento, impressao_interna."
                            ),
                        },
                    },
                    "required": ["photo_index", "kind", "polarity", "severity", "observation"],
                },
            }
        },
        "required": ["evidences"],
    },
}

SYSTEM_PROMPT = """Você é um analista forense de vestuário e calçados do Garimpo Madruga.

Sua única tarefa é OBSERVAR as fotos de uma peça e registrar evidências visuais \
objetivas usando a ferramenta record_visual_evidence.

Regras invioláveis:
1. NUNCA conclua se a peça é original ou falsa. Você não decide autenticidade — \
apenas descreve o que vê. Não use as palavras "original", "autêntica", "falsa" ou \
"réplica" como conclusão.
2. Cada evidência deve ser verificável na foto: tipografia, kerning, alinhamento, \
densidade e regularidade de costura, qualidade de bordado, layout de etiqueta, \
acabamento de zíper/botão, textura de material, geometria de logo.
3. Sempre que possível, inclua a bbox da região observada (coordenadas normalizadas).
4. Escreva as observações em português brasileiro, tom técnico e neutro.
5. Registre também evidências POSITIVAS (elementos bem executados) e NEUTRAS \
(elementos que as fotos não permitem avaliar).
6. Se uma foto não permite análise (borrada, escura), registre evidência neutral \
com kind "other" explicando a limitação."""


def is_configured() -> bool:
    return bool(settings().anthropic_api_key)


def _image_block(data: bytes) -> dict[str, Any]:
    s = settings()
    image = Image.open(io.BytesIO(data)).convert("RGB")
    image.thumbnail((s.claude_image_max_px, s.claude_image_max_px))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=70)
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": base64.b64encode(buffer.getvalue()).decode("ascii"),
        },
    }


def analyze(
    context: CheckContext,
) -> tuple[list[VisualEvidence], list[DetectedRegion], str]:
    """Retorna (evidências, regiões propostas pelo modelo, versão do modelo)."""
    s = settings()
    photos = context.photos[: s.claude_max_photos]

    content: list[dict[str, Any]] = []
    piece = " ".join(
        p for p in [context.brand_name, context.product_name, context.category_name] if p
    )
    guide_notes = ""
    if context.auth_guide:
        slug = context.category_slug or ""
        notes = context.auth_guide.get(slug) or context.auth_guide.get("default")
        if isinstance(notes, str) and notes.strip():
            guide_notes = f"\n\nPontos de verificação conhecidos para esta marca:\n{notes.strip()}"

    content.append(
        {
            "type": "text",
            "text": (
                f"Peça declarada: {piece or 'não identificada'}."
                f"{guide_notes}\n\nFotos enviadas (analise cada uma):"
            ),
        }
    )
    for index, photo in enumerate(photos):
        content.append({"type": "text", "text": f"Foto {index} — região: {photo.region}"})
        content.append(_image_block(photo.data))

    anthropic_client = Anthropic(api_key=s.anthropic_api_key)
    response = anthropic_client.messages.create(
        model=s.claude_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[EVIDENCE_TOOL],
        tool_choice={"type": "tool", "name": "record_visual_evidence"},
        messages=[{"role": "user", "content": content}],
    )

    evidences: list[VisualEvidence] = []
    regions: list[DetectedRegion] = []
    for block in response.content:
        if block.type != "tool_use" or block.name != EVIDENCE_TOOL["name"]:
            continue
        raw_items = block.input.get("evidences", []) if isinstance(block.input, dict) else []
        for item in raw_items:
            parsed = _parse_evidence(item, photos)
            if parsed is None:
                continue
            evidence, region = parsed
            evidences.append(evidence)
            if region is not None:
                regions.append(region)

    return evidences, regions, response.model


def _parse_evidence(item: Any, photos: list) -> tuple[VisualEvidence, DetectedRegion | None] | None:
    if not isinstance(item, dict):
        return None
    try:
        index = int(item["photo_index"])
        if not 0 <= index < len(photos):
            return None
        photo = photos[index]
        observation = str(item["observation"]).strip()
        if not observation:
            return None
        polarity = Polarity(str(item["polarity"]))
        severity = Severity(str(item["severity"]))
        kind = str(item.get("kind", "other"))
    except (KeyError, ValueError, TypeError):
        return None

    bbox: BBox | None = None
    raw_bbox = item.get("bbox")
    if isinstance(raw_bbox, dict):
        try:
            bbox = BBox(
                float(raw_bbox["x"]),
                float(raw_bbox["y"]),
                float(raw_bbox["w"]),
                float(raw_bbox["h"]),
            ).clamped()
        except (KeyError, ValueError, TypeError):
            bbox = None

    evidence = VisualEvidence(
        photo_id=photo.photo_id,
        region=photo.region,
        kind=kind,
        polarity=polarity,
        severity=severity,
        observation=observation,
        bbox=bbox,
    )
    region: DetectedRegion | None = None
    label = item.get("region_label")
    if bbox is not None and isinstance(label, str) and label.strip():
        region = DetectedRegion(
            photo_id=photo.photo_id,
            label=label.strip().lower()[:40],
            bbox=bbox,
            source="claude",
            confidence=None,
        )
    return evidence, region
