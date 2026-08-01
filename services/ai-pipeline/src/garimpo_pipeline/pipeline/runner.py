"""Orquestrador do pipeline: executa os estágios do contrato sobre um job,
atualizando progresso em tempo real e persistindo cada resultado intermediário."""

import json
import logging
from typing import Any

from .. import db, storage
from ..config import settings
from ..types import (
    CheckContext,
    DetectedRegion,
    OcrResult,
    PhotoBundle,
    Polarity,
    RegionComparison,
    VisualEvidence,
)
from . import claude, compare, embeddings, images, report, scoring
from .ocr import parse as ocr_parse
from .ocr import provider as ocr_provider
from .ocr import qr as ocr_qr
from .regions import LABEL_REGIONS, crop_bbox, detect_regions_for_photo

log = logging.getLogger(__name__)

OCR_REGIONS = LABEL_REGIONS | {"serial", "qr_code", "packaging"}

STAGE_PROGRESS = {
    "preparing": 10,
    "extracting_regions": 25,
    "analyzing_details": 45,
    "comparing_references": 65,
    "scoring": 78,
    "generating_report": 90,
    "finalizing": 97,
}


class CancelledError(Exception):
    pass


def _enter_stage(job_id: str, check_id: str, stage: str) -> None:
    if db.check_is_cancelled(check_id):
        raise CancelledError()
    db.update_job_stage(job_id, stage, STAGE_PROGRESS[stage])


def process_job(job_id: str, check_id: str) -> None:
    try:
        _process(job_id, check_id)
    except CancelledError:
        log.info("check %s cancelado durante o processamento", check_id)
        db.finish_job(job_id, error="cancelled")


def _process(job_id: str, check_id: str) -> None:
    db.set_check_status(check_id, "processing")

    raw = db.load_check_context(check_id)
    if raw is None:
        raise RuntimeError(f"check {check_id} não encontrado")

    context = CheckContext(
        check_id=check_id,
        job_id=job_id,
        profile_id=str(raw["profile_id"]),
        brand_id=str(raw["brand_id"]) if raw["brand_id"] else None,
        brand_name=raw["brand_name"],
        category_id=str(raw["category_id"]) if raw["category_id"] else None,
        category_slug=raw["category_slug"],
        category_name=raw["category_name"],
        product_id=str(raw["product_id"]) if raw["product_id"] else None,
        product_name=raw["product_name"] or _declared_model(raw["declared"]),
        auth_guide=raw["auth_guide"] or {},
        serial_formats=raw["serial_formats"],
    )

    # ---- preparing: download + validação + antifraude ----
    _enter_stage(job_id, check_id, "preparing")
    bucket = settings().check_photos_bucket
    decoded: dict[str, Any] = {}
    validations: list[images.ImageValidation] = []
    photo_reuse = 0
    for photo in raw["photos"]:
        photo_id = str(photo["id"])
        data = storage.download(bucket, photo["storage_path"])
        image = images.decode(data)
        bundle = PhotoBundle(
            photo_id=photo_id, region=photo["region"], storage_path=photo["storage_path"], data=data
        )
        context.photos.append(bundle)
        decoded[photo_id] = image

        validation = images.validate_photo(photo_id, photo["region"], image)
        validations.append(validation)
        db.update_photo_phash(photo_id, validation.phash)
        photo_reuse += db.find_phash_reuse(check_id, validation.phash)

    duplicates = images.find_internal_duplicates(validations)

    # ---- extracting_regions: detecção CV por foto ----
    _enter_stage(job_id, check_id, "extracting_regions")
    cv_regions: dict[str, list[DetectedRegion]] = {}
    label_bboxes: dict[str, Any] = {}
    for bundle in context.photos:
        proposals = detect_regions_for_photo(bundle.region, decoded[bundle.photo_id])
        cv_regions[bundle.photo_id] = [
            DetectedRegion(
                photo_id=bundle.photo_id,
                label=p.label,
                bbox=p.bbox,
                source="cv",
                confidence=p.confidence,
            )
            for p in proposals
        ]
        label = next((p for p in proposals if p.label == "etiqueta"), None)
        if label is not None:
            label_bboxes[bundle.photo_id] = label.bbox

    # ---- analyzing_details: OCR + QR + análise multimodal ----
    _enter_stage(job_id, check_id, "analyzing_details")
    ocr_results: list[OcrResult] = []
    ocr_ran = ocr_provider.is_configured()
    for bundle in context.photos:
        if bundle.region not in OCR_REGIONS:
            continue
        image = decoded[bundle.photo_id]
        qr_payloads = ocr_qr.decode_qr_payloads(image)
        raw_text = ""
        if ocr_ran:
            try:
                raw_text = ocr_provider.recognize(bundle.data)
            except Exception:
                log.exception("OCR falhou para foto %s", bundle.photo_id)
        normalized = ocr_parse.normalize(raw_text)
        extracted = ocr_parse.extract(normalized) if normalized else {}
        if raw_text or qr_payloads:
            ocr_results.append(
                OcrResult(
                    photo_id=bundle.photo_id,
                    region=bundle.region,
                    provider=ocr_provider.PROVIDER_NAME,
                    raw_text=raw_text,
                    normalized_text=normalized,
                    extracted=extracted,
                    qr_payloads=qr_payloads,
                )
            )
    db.save_ocr(
        [
            {
                "check_id": check_id,
                "photo_id": r.photo_id,
                "provider": r.provider,
                "raw_text": r.raw_text,
                "normalized_text": r.normalized_text,
                "extracted": r.extracted,
                "qr_payloads": r.qr_payloads,
            }
            for r in ocr_results
        ]
    )

    evidences: list[VisualEvidence] = []
    claude_regions: list[DetectedRegion] = []
    claude_model_used: str | None = None
    claude_ran = claude.is_configured()
    if claude_ran:
        try:
            evidences, claude_regions, claude_model_used = claude.analyze(context)
        except Exception:
            log.exception("análise multimodal falhou para check %s", check_id)
            claude_ran = False

    for bundle in context.photos:
        combined = cv_regions.get(bundle.photo_id, []) + [
            r for r in claude_regions if r.photo_id == bundle.photo_id
        ]
        db.save_photo_regions(
            bundle.photo_id,
            [
                {
                    "label": r.label,
                    "bbox": r.bbox.as_json(),
                    "source": r.source,
                    "confidence": r.confidence,
                }
                for r in combined
            ],
        )

    # ---- comparing_references: embeddings por região + kNN ----
    _enter_stage(job_id, check_id, "comparing_references")
    comparisons: list[RegionComparison] = []
    embeddings_ran = True
    try:
        for bundle in context.photos:
            image = decoded[bundle.photo_id]
            bbox = label_bboxes.get(bundle.photo_id)
            target = crop_bbox(image, bbox) if bbox is not None else image
            vector = embeddings.embed_image(target)
            db.upsert_embedding(
                photo_kind="check",
                photo_id=bundle.photo_id,
                region=bundle.region,
                model=settings().embedding_model_name,
                embedding=vector,
                brand_id=context.brand_id,
                category_id=context.category_id,
                product_id=context.product_id,
                authenticity=None,
            )
            comparisons.append(
                compare.compare_photo(
                    context, photo_id=bundle.photo_id, region=bundle.region, embedding=vector
                )
            )
    except Exception:
        log.exception("embeddings indisponíveis para check %s", check_id)
        embeddings_ran = False
        comparisons = []

    # ---- scoring ----
    _enter_stage(job_id, check_id, "scoring")
    all_extracted: dict[str, list[str]] = {}
    for result in ocr_results:
        for key, values in result.extracted.items():
            all_extracted.setdefault(key, []).extend(values)
    serials = all_extracted.get("serials", []) + all_extracted.get("style_codes", [])
    serial_check = ocr_parse.serial_matches_formats(serials, context.serial_formats)
    label_fields = sum(1 for key in ("countries", "composition") if all_extracted.get(key)) + (
        1 if (all_extracted.get("rn") or all_extracted.get("ca")) else 0
    )

    score = scoring.compute(
        scoring.ScoreInputs(
            serial_check=serial_check,
            label_fields_present=label_fields,
            suspicious_token_count=len(all_extracted.get("suspicious_tokens", [])),
            comparisons=comparisons,
            evidences=evidences,
            photo_reuse_count=photo_reuse,
            internal_duplicate_count=len(duplicates),
            required_photo_coverage=_required_coverage(raw),
            ocr_ran=ocr_ran,
            claude_ran=claude_ran,
        )
    )
    score.breakdown["signals"]["embeddings_ran"] = embeddings_ran
    score.breakdown["signals"]["internal_duplicate_pairs"] = duplicates

    # ---- generating_report ----
    _enter_stage(job_id, check_id, "generating_report")
    findings = (
        report.findings_from_evidences(evidences)
        + report.findings_from_comparisons(comparisons)
        + report.findings_from_ocr(ocr_results, serial_check=serial_check)
    )
    polarity_order = {Polarity.SUSPICIOUS: 0, Polarity.POSITIVE: 1, Polarity.NEUTRAL: 2}
    findings.sort(key=lambda f: polarity_order[f.polarity])

    piece_name = (
        " ".join(p for p in [context.brand_name, context.product_name] if p)
        or context.category_name
        or "peça analisada"
    )
    texts = report.compose_verdict_texts(piece_name=piece_name, score=score, findings=findings)

    db.replace_findings(
        check_id,
        [
            {
                "photo_id": f.photo_id,
                "region": f.region,
                "kind": f.kind,
                "polarity": f.polarity.value,
                "score": f.score,
                "title": f.title,
                "detail_md": f.detail_md,
                "conclusion_md": f.conclusion_md,
                "bbox": f.bbox,
                "comparison": f.comparison,
            }
            for f in findings
        ],
    )
    db.upsert_verdict(
        check_id,
        {
            "probability": score.probability,
            "risk": score.risk,
            "outcome": score.outcome,
            "confidence": score.confidence,
            "ai_model_version": _model_version(claude_model_used),
            "breakdown": score.breakdown,
            **texts,
        },
    )

    # ---- finalizing ----
    _enter_stage(job_id, check_id, "finalizing")
    if score.outcome == "original":
        db.upsert_certificate(check_id, report.generate_certificate_code())
    db.finish_job(job_id)
    db.set_check_status(check_id, "completed")


def _declared_model(declared: Any) -> str | None:
    if isinstance(declared, str):
        try:
            declared = json.loads(declared)
        except json.JSONDecodeError:
            return None
    if isinstance(declared, dict):
        value = declared.get("model_name")
        return str(value) if value else None
    return None


def _required_coverage(raw: dict[str, Any]) -> float:
    checklist = raw.get("category_checklist") or []
    required = [step for step in checklist if isinstance(step, dict) and step.get("required")]
    if not required:
        return 1.0
    captured = {photo["region"] for photo in raw["photos"]}
    done = sum(1 for step in required if step.get("region") in captured)
    return done / len(required)


def _model_version(claude_model_used: str | None) -> str:
    base = f"{scoring.VERSION}+{settings().embedding_model_name}"
    if claude_model_used:
        return f"{base}+{claude_model_used}"
    return base
