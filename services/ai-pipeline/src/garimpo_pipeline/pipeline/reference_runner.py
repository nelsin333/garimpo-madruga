"""Pipeline de ingestão de referências: processa as fotos de uma peça do
acervo (validação, OCR, regiões, embeddings) e as torna comparáveis pelo
motor de autenticação."""

import logging
from typing import Any

from .. import db, db_admin, storage
from ..config import settings
from . import embeddings, images
from .ocr import parse as ocr_parse
from .ocr import provider as ocr_provider
from .ocr import qr as ocr_qr
from .regions import LABEL_REGIONS, crop_bbox, detect_regions_for_photo

log = logging.getLogger(__name__)

OCR_REGIONS = LABEL_REGIONS | {"serial", "qr_code", "packaging"}

STAGES = {
    "preparing": 15,
    "extracting_regions": 35,
    "analyzing_details": 60,
    "embedding": 85,
    "finalizing": 95,
}


def process_reference_job(job_id: str, item_id: str) -> None:
    item = db_admin.load_reference_context(item_id)
    if item is None:
        raise RuntimeError(f"referência {item_id} não encontrada")
    photos: list[dict[str, Any]] = item["photos"]
    bucket = settings().reference_photos_bucket

    # ---- preparing: download + validação ----
    db_admin.update_reference_job(job_id, "preparing", STAGES["preparing"])
    loaded: list[dict[str, Any]] = []
    for photo in photos:
        data = storage.download(bucket, photo["storage_path"])
        image = images.decode(data)
        validation = images.validate_photo(str(photo["id"]), photo["region"], image)
        loaded.append(
            {
                "photo": photo,
                "data": data,
                "image": image,
                "validation": validation,
            }
        )

    # ---- extracting_regions: detecção CV ----
    db_admin.update_reference_job(job_id, "extracting_regions", STAGES["extracting_regions"])
    for entry in loaded:
        proposals = detect_regions_for_photo(entry["photo"]["region"], entry["image"])
        entry["regions"] = [
            {"label": p.label, "bbox": p.bbox.as_json(), "confidence": p.confidence}
            for p in proposals
        ]
        label = next((p for p in proposals if p.label == "etiqueta"), None)
        entry["label_bbox"] = label.bbox if label is not None else None

    # ---- analyzing_details: OCR + QR ----
    db_admin.update_reference_job(job_id, "analyzing_details", STAGES["analyzing_details"])
    ocr_ran = ocr_provider.is_configured()
    for entry in loaded:
        region = entry["photo"]["region"]
        entry["ocr_raw"] = ""
        entry["qr_payloads"] = []
        if region not in OCR_REGIONS:
            continue
        entry["qr_payloads"] = ocr_qr.decode_qr_payloads(entry["image"])
        if ocr_ran:
            try:
                entry["ocr_raw"] = ocr_provider.recognize(entry["data"])
            except Exception:
                log.exception("OCR falhou para foto de referência %s", entry["photo"]["id"])

    # ---- embedding: um vetor por foto, rotulado com a autenticidade da peça ----
    db_admin.update_reference_job(job_id, "embedding", STAGES["embedding"])
    model = settings().embedding_model_name
    for entry in loaded:
        bbox = entry["label_bbox"]
        target = crop_bbox(entry["image"], bbox) if bbox is not None else entry["image"]
        vector = embeddings.embed_image(target)
        db.upsert_embedding(
            photo_kind="reference",
            photo_id=str(entry["photo"]["id"]),
            region=entry["photo"]["region"],
            model=model,
            embedding=vector,
            brand_id=str(item["brand_id"]),
            category_id=str(item["category_id"]),
            product_id=str(item["product_id"]) if item["product_id"] else None,
            authenticity=item["authenticity"],
        )

    # ---- finalizing: persiste a análise por foto ----
    db_admin.update_reference_job(job_id, "finalizing", STAGES["finalizing"])
    for entry in loaded:
        validation: images.ImageValidation = entry["validation"]
        normalized = ocr_parse.normalize(entry["ocr_raw"])
        db_admin.save_reference_analysis(
            {
                "photo_id": str(entry["photo"]["id"]),
                "phash": validation.phash,
                "width": validation.width,
                "height": validation.height,
                "sharpness": validation.sharpness,
                "ocr_provider": ocr_provider.PROVIDER_NAME if entry["ocr_raw"] else None,
                "ocr_raw": entry["ocr_raw"],
                "ocr_normalized": normalized,
                "extracted": ocr_parse.extract(normalized) if normalized else {},
                "qr_payloads": entry["qr_payloads"],
                "regions": entry["regions"],
            }
        )

    db_admin.finish_reference_job(job_id)
    log.info("referência %s processada (%d fotos)", item_id, len(loaded))
