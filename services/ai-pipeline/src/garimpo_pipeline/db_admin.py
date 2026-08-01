"""Acesso a dados do domínio de referências (fila, contexto, API admin)."""

from typing import Any

from psycopg.types.json import Json

from .db import pool

# ---------- Fila de referências ----------


def claim_next_reference_job() -> dict[str, Any] | None:
    with pool().connection() as conn:
        return conn.execute(
            """
            update reference_jobs
            set status = 'running', started_at = now()
            where id = (
              select id from reference_jobs
              where status = 'queued'
              order by created_at
              for update skip locked
              limit 1
            )
            returning id, reference_item_id
            """
        ).fetchone()


def update_reference_job(job_id: str, stage: str, progress: int) -> None:
    with pool().connection() as conn:
        conn.execute(
            "update reference_jobs set stage=%s, progress=%s where id=%s",
            (stage, progress, job_id),
        )


def finish_reference_job(job_id: str, *, error: str | None = None) -> None:
    with pool().connection() as conn:
        if error is None:
            conn.execute(
                "update reference_jobs set status='completed', progress=100, finished_at=now() "
                "where id=%s",
                (job_id,),
            )
        else:
            conn.execute(
                "update reference_jobs set status='failed', error=%s, finished_at=now() "
                "where id=%s",
                (error[:2000], job_id),
            )


def load_reference_context(item_id: str) -> dict[str, Any] | None:
    with pool().connection() as conn:
        item = conn.execute("select * from reference_items where id=%s", (item_id,)).fetchone()
        if item is None:
            return None
        photos = conn.execute(
            "select id, region, storage_path from reference_photos "
            "where reference_item_id=%s order by created_at",
            (item_id,),
        ).fetchall()
        item["photos"] = photos
        return item


def save_reference_analysis(row: dict[str, Any]) -> None:
    with pool().connection() as conn:
        conn.execute(
            """
            insert into reference_photo_analysis
              (photo_id, phash, width, height, sharpness, ocr_provider,
               ocr_raw, ocr_normalized, extracted, qr_payloads, regions, processed_at)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (photo_id) do update set
              phash = excluded.phash,
              width = excluded.width,
              height = excluded.height,
              sharpness = excluded.sharpness,
              ocr_provider = excluded.ocr_provider,
              ocr_raw = excluded.ocr_raw,
              ocr_normalized = excluded.ocr_normalized,
              extracted = excluded.extracted,
              qr_payloads = excluded.qr_payloads,
              regions = excluded.regions,
              processed_at = now()
            """,
            (
                row["photo_id"],
                row.get("phash"),
                row.get("width"),
                row.get("height"),
                row.get("sharpness"),
                row.get("ocr_provider"),
                row.get("ocr_raw", ""),
                row.get("ocr_normalized", ""),
                Json(row.get("extracted", {})),
                row.get("qr_payloads", []),
                Json(row.get("regions", [])),
            ),
        )


# ---------- API admin ----------


def get_user_role(user_id: str) -> str | None:
    with pool().connection() as conn:
        row = conn.execute("select role from profiles where id=%s", (user_id,)).fetchone()
        return row["role"] if row else None


REFERENCE_SELECT = """
select ri.*, b.name as brand_name, c.name as category_name, p.name as product_name,
       (select count(*) from reference_photos rp where rp.reference_item_id = ri.id)
         as photo_count
from reference_items ri
left join brands b on b.id = ri.brand_id
left join categories c on c.id = ri.category_id
left join products p on p.id = ri.product_id
"""


def list_references(
    where_sql: str, args: list[Any], *, limit: int, offset: int
) -> list[dict[str, Any]]:
    sql = REFERENCE_SELECT
    if where_sql:
        sql += f" where {where_sql}"
    sql += " order by ri.created_at desc limit %s offset %s"
    with pool().connection() as conn:
        return conn.execute(sql, [*args, limit, offset]).fetchall()


def get_reference_detail(item_id: str) -> dict[str, Any] | None:
    with pool().connection() as conn:
        item = conn.execute(REFERENCE_SELECT + " where ri.id = %s", (item_id,)).fetchone()
        if item is None:
            return None
        item["photos"] = conn.execute(
            """
            select rp.id, rp.region, rp.storage_path, rp.meta, rp.created_at,
                   to_jsonb(a.*) as analysis
            from reference_photos rp
            left join reference_photo_analysis a on a.photo_id = rp.id
            where rp.reference_item_id = %s
            order by rp.region, rp.created_at
            """,
            (item_id,),
        ).fetchall()
        item["annotations"] = conn.execute(
            """
            select ra.*, pr.username as author
            from reference_annotations ra
            join profiles pr on pr.id = ra.created_by
            where ra.reference_item_id = %s
            order by ra.created_at desc
            """,
            (item_id,),
        ).fetchall()
        item["versions"] = conn.execute(
            "select id, version, changed_by, changed_at from reference_item_versions "
            "where reference_item_id=%s order by version desc",
            (item_id,),
        ).fetchall()
        item["jobs"] = conn.execute(
            "select id, status, stage, progress, error, created_at from reference_jobs "
            "where reference_item_id=%s order by created_at desc limit 5",
            (item_id,),
        ).fetchall()
        return item


def create_reference(fields: dict[str, Any], created_by: str) -> dict[str, Any]:
    columns = [*fields.keys(), "created_by"]
    values = [*fields.values(), created_by]
    placeholders = ", ".join(["%s"] * len(values))
    with pool().connection() as conn:
        row = conn.execute(
            f"insert into reference_items ({', '.join(columns)}) "
            f"values ({placeholders}) returning id",
            values,
        ).fetchone()
        assert row is not None
        return row


def update_reference(item_id: str, fields: dict[str, Any]) -> bool:
    if not fields:
        return True
    assignments = ", ".join(f"{column} = %s" for column in fields)
    with pool().connection() as conn:
        result = conn.execute(
            f"update reference_items set {assignments} where id = %s",
            [*fields.values(), item_id],
        )
        return result.rowcount > 0


def add_reference_photo(
    item_id: str, region: str, storage_path: str, meta: dict[str, Any]
) -> dict[str, Any]:
    with pool().connection() as conn:
        row = conn.execute(
            "insert into reference_photos (reference_item_id, region, storage_path, meta) "
            "values (%s, %s, %s, %s) returning id",
            (item_id, region, storage_path, Json(meta)),
        ).fetchone()
        assert row is not None
        return row


def enqueue_reference_job(item_id: str) -> dict[str, Any]:
    with pool().connection() as conn:
        existing = conn.execute(
            "select id from reference_jobs where reference_item_id=%s "
            "and status in ('queued','running') limit 1",
            (item_id,),
        ).fetchone()
        if existing is not None:
            return existing
        row = conn.execute(
            "insert into reference_jobs (reference_item_id) values (%s) returning id",
            (item_id,),
        ).fetchone()
        assert row is not None
        return row


def add_annotation(fields: dict[str, Any], created_by: str) -> dict[str, Any]:
    with pool().connection() as conn:
        row = conn.execute(
            """
            insert into reference_annotations
              (reference_item_id, photo_id, aspect, assessment, note, created_by)
            values (%s, %s, %s, %s, %s, %s)
            returning id, created_at
            """,
            (
                fields["reference_item_id"],
                fields.get("photo_id"),
                fields["aspect"],
                fields["assessment"],
                fields.get("note", ""),
                created_by,
            ),
        ).fetchone()
        assert row is not None
        return row


def delete_annotation(annotation_id: str, created_by: str) -> bool:
    with pool().connection() as conn:
        result = conn.execute(
            "delete from reference_annotations where id=%s and created_by=%s",
            (annotation_id, created_by),
        )
        return result.rowcount > 0


def dashboard_stats() -> dict[str, Any]:
    with pool().connection() as conn:
        row = conn.execute(
            """
            select
              (select count(*) from reference_items) as items_total,
              (select count(*) from reference_items where authenticity='authentic')
                as items_authentic,
              (select count(*) from reference_items where authenticity='replica')
                as items_replica,
              (select count(*) from reference_items where quarantined) as items_quarantined,
              (select count(distinct brand_id) from reference_items) as brands_covered,
              (select count(distinct product_id) from reference_items
                where product_id is not null) as products_covered,
              (select count(*) from reference_photos) as photos_total,
              (select count(*) from reference_photo_analysis) as photos_processed,
              (select count(*) from embeddings where photo_kind='reference') as embeddings_total,
              (select count(*) from reference_annotations) as annotations_total,
              (select coalesce(sum((meta->>'bytes')::bigint), 0) from reference_photos
                where meta ? 'bytes') as storage_bytes
            """
        ).fetchone()
        assert row is not None
        return row


def similar_reference_photos(photo_id: str, limit: int) -> list[dict[str, Any]]:
    """kNN direto (o papel já foi validado na camada da API — a função SQL
    admin_similar_reference_photos serve os clientes Supabase com RLS)."""
    with pool().connection() as conn:
        query = conn.execute(
            "select embedding, region from embeddings "
            "where photo_kind='reference' and photo_id=%s limit 1",
            (photo_id,),
        ).fetchone()
        if query is None:
            return []
        return conn.execute(
            """
            select e.photo_id, rp.reference_item_id, e.region,
                   round((1 - (e.embedding <=> %s))::numeric, 4) as similarity,
                   ri.authenticity, b.name as brand_name, p.name as product_name
            from embeddings e
            join reference_photos rp on rp.id = e.photo_id
            join reference_items ri on ri.id = rp.reference_item_id
            left join brands b on b.id = ri.brand_id
            left join products p on p.id = ri.product_id
            where e.photo_kind = 'reference'
              and e.region = %s
              and e.photo_id <> %s
            order by e.embedding <=> %s
            limit %s
            """,
            (query["embedding"], query["region"], photo_id, query["embedding"], limit),
        ).fetchall()
