"""API administrativa do banco de referências (papéis expert/admin).

POST   /admin/references                      cria peça
GET    /admin/references                      busca com filtros
GET    /admin/references/{id}                 detalhe completo
PATCH  /admin/references/{id}                 atualiza (versão anterior preservada)
POST   /admin/references/{id}/photos          registra foto enviada ao Storage
POST   /admin/references/{id}/process         enfileira processamento
POST   /admin/references/{id}/annotations     anota (modo especialista)
DELETE /admin/annotations/{id}                remove anotação própria
GET    /admin/references/{id}/similar         similares por embedding de uma foto
GET    /admin/dashboard                       métricas do acervo
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .. import db_admin, storage
from ..config import settings
from .auth import current_user_id
from .filters import reference_filters

router = APIRouter(prefix="/admin")

ITEM_FIELDS = [
    "brand_id",
    "category_id",
    "product_id",
    "authenticity",
    "sku",
    "colorway",
    "collection",
    "release_year",
    "country",
    "size_label",
    "material",
    "gender",
    "era",
    "serial_format",
    "notes_md",
    "replica_batch",
    "provenance_confidence",
    "quality_score",
    "quarantined",
    "source",
]


def require_expert(user_id: str = Depends(current_user_id)) -> str:
    role = db_admin.get_user_role(user_id)
    if role not in ("expert", "admin"):
        raise HTTPException(status_code=403, detail="expert_role_required")
    return user_id


Expert = Depends(require_expert)


class ReferenceItemBody(BaseModel):
    brand_id: str
    category_id: str
    product_id: str | None = None
    authenticity: Literal["authentic", "replica"]
    sku: str | None = None
    colorway: str | None = None
    collection: str | None = None
    release_year: int | None = Field(default=None, ge=1950, le=2100)
    country: str | None = None
    size_label: str | None = None
    material: str | None = None
    gender: Literal["masculino", "feminino", "unissex", "infantil"] | None = None
    era: str | None = None
    serial_format: str | None = None
    notes_md: str | None = None
    replica_batch: str | None = None
    provenance_confidence: int = Field(default=3, ge=1, le=5)
    quality_score: int = Field(default=3, ge=1, le=5)
    source: Literal["curated", "verified_check", "partner", "purchased"] = "curated"


class ReferenceItemPatch(BaseModel):
    product_id: str | None = None
    sku: str | None = None
    colorway: str | None = None
    collection: str | None = None
    release_year: int | None = Field(default=None, ge=1950, le=2100)
    country: str | None = None
    size_label: str | None = None
    material: str | None = None
    gender: Literal["masculino", "feminino", "unissex", "infantil"] | None = None
    era: str | None = None
    serial_format: str | None = None
    notes_md: str | None = None
    replica_batch: str | None = None
    provenance_confidence: int | None = Field(default=None, ge=1, le=5)
    quality_score: int | None = Field(default=None, ge=1, le=5)
    quarantined: bool | None = None


class ReferencePhotoBody(BaseModel):
    region: str
    storage_path: str
    meta: dict[str, Any] = Field(default_factory=dict)


class AnnotationBody(BaseModel):
    photo_id: str | None = None
    aspect: Literal[
        "stitching",
        "label",
        "logo",
        "typography",
        "qr",
        "embroidery",
        "wash_tag",
        "material",
        "hardware",
        "print",
        "other",
    ]
    assessment: Literal["correct", "incorrect", "uncertain"]
    note: str = ""


@router.post("/references", status_code=201)
def create_reference(body: ReferenceItemBody, user_id: str = Expert) -> dict[str, Any]:
    fields = {k: v for k, v in body.model_dump().items() if k in ITEM_FIELDS and v is not None}
    row = db_admin.create_reference(fields, user_id)
    return {"id": str(row["id"])}


@router.get("/references")
def search_references(
    query: Annotated[str | None, Query()] = None,
    brand_id: Annotated[str | None, Query()] = None,
    category_id: Annotated[str | None, Query()] = None,
    product_id: Annotated[str | None, Query()] = None,
    authenticity: Annotated[Literal["authentic", "replica"] | None, Query()] = None,
    sku: Annotated[str | None, Query()] = None,
    collection: Annotated[str | None, Query()] = None,
    release_year: Annotated[int | None, Query()] = None,
    replica_batch: Annotated[str | None, Query()] = None,
    quarantined: Annotated[bool | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
    _user: str = Expert,
) -> dict[str, Any]:
    where_sql, args = reference_filters(
        {
            "query": query,
            "brand_id": brand_id,
            "category_id": category_id,
            "product_id": product_id,
            "authenticity": authenticity,
            "sku": sku,
            "collection": collection,
            "release_year": release_year,
            "replica_batch": replica_batch,
            "quarantined": quarantined,
        }
    )
    return {"items": db_admin.list_references(where_sql, args, limit=limit, offset=offset)}


@router.get("/references/{item_id}")
def get_reference(item_id: str, _user: str = Expert) -> dict[str, Any]:
    item = db_admin.get_reference_detail(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="reference_not_found")
    bucket = settings().reference_photos_bucket
    for photo in item["photos"]:
        photo["url"] = storage.signed_url(bucket, photo["storage_path"])
    return item


@router.patch("/references/{item_id}")
def patch_reference(item_id: str, body: ReferenceItemPatch, _user: str = Expert) -> dict[str, Any]:
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k in ITEM_FIELDS}
    if not db_admin.update_reference(item_id, fields):
        raise HTTPException(status_code=404, detail="reference_not_found")
    return {"ok": True}


@router.post("/references/{item_id}/photos", status_code=201)
def add_photo(item_id: str, body: ReferencePhotoBody, _user: str = Expert) -> dict[str, Any]:
    row = db_admin.add_reference_photo(item_id, body.region, body.storage_path, body.meta)
    return {"id": str(row["id"])}


@router.post("/references/{item_id}/process", status_code=202)
def process_reference(item_id: str, _user: str = Expert) -> dict[str, Any]:
    if db_admin.load_reference_context(item_id) is None:
        raise HTTPException(status_code=404, detail="reference_not_found")
    row = db_admin.enqueue_reference_job(item_id)
    return {"job_id": str(row["id"])}


@router.post("/references/{item_id}/annotations", status_code=201)
def annotate(item_id: str, body: AnnotationBody, user_id: str = Expert) -> dict[str, Any]:
    row = db_admin.add_annotation(
        {
            "reference_item_id": item_id,
            "photo_id": body.photo_id,
            "aspect": body.aspect,
            "assessment": body.assessment,
            "note": body.note,
        },
        user_id,
    )
    return {"id": str(row["id"])}


@router.delete("/annotations/{annotation_id}")
def remove_annotation(annotation_id: str, user_id: str = Expert) -> dict[str, Any]:
    if not db_admin.delete_annotation(annotation_id, user_id):
        raise HTTPException(status_code=404, detail="annotation_not_found")
    return {"ok": True}


@router.get("/references/{item_id}/similar")
def similar(
    item_id: str,
    photo_id: Annotated[str, Query()],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    _user: str = Expert,
) -> dict[str, Any]:
    return {"similar": db_admin.similar_reference_photos(photo_id, limit)}


@router.get("/dashboard")
def dashboard(_user: str = Expert) -> dict[str, Any]:
    return db_admin.dashboard_stats()
