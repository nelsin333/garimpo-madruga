"""API do serviço de autenticação.

POST /checks              cria um check em rascunho
GET  /checks/{id}         status do check + job atual
GET  /checks/{id}/report  laudo completo (verdict + findings + certificado)
GET  /checks/{id}/images  URLs assinadas das fotos do check
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db, storage
from ..config import settings
from .auth import UserId

router = APIRouter()


class CreateCheckBody(BaseModel):
    brand_id: str | None = None
    category_id: str | None = None
    product_id: str | None = None
    declared: dict[str, Any] = Field(default_factory=dict)


@router.post("/checks", status_code=201)
def create_check(body: CreateCheckBody, user_id: str = UserId) -> dict[str, Any]:
    row = db.api_create_check(
        user_id,
        brand_id=body.brand_id,
        category_id=body.category_id,
        product_id=body.product_id,
        declared=body.declared,
    )
    return {"id": str(row["id"]), "status": row["status"], "created_at": row["created_at"]}


@router.get("/checks/{check_id}")
def get_check(check_id: str, user_id: str = UserId) -> dict[str, Any]:
    row = db.api_get_check(check_id, user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="check_not_found")
    return row


@router.get("/checks/{check_id}/report")
def get_report(check_id: str, user_id: str = UserId) -> dict[str, Any]:
    data = db.api_get_report(check_id, user_id)
    if data is None:
        raise HTTPException(status_code=404, detail="check_not_found")
    if data["verdict"] is None:
        raise HTTPException(status_code=409, detail="report_not_ready")
    return data


@router.get("/checks/{check_id}/images")
def get_images(check_id: str, user_id: str = UserId) -> dict[str, Any]:
    photos = db.api_get_photos(check_id, user_id)
    if photos is None:
        raise HTTPException(status_code=404, detail="check_not_found")
    bucket = settings().check_photos_bucket
    return {
        "images": [
            {
                "id": str(photo["id"]),
                "region": photo["region"],
                "quality": photo["quality"],
                "url": storage.signed_url(bucket, photo["storage_path"]),
            }
            for photo in photos
        ]
    }
