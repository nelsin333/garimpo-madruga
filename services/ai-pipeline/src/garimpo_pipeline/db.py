"""Acesso ao Postgres (service role) — pool sync + registro do pgvector."""

import json
from typing import Any

from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings().database_url,
            min_size=1,
            max_size=8,
            kwargs={"row_factory": dict_row},
            configure=register_vector,
            open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


# ---------- Fila ----------


def claim_next_job() -> dict[str, Any] | None:
    with pool().connection() as conn:
        row = conn.execute(
            """
            update check_jobs
            set status = 'running', started_at = now()
            where id = (
              select id from check_jobs
              where status = 'queued'
              order by created_at
              for update skip locked
              limit 1
            )
            returning id, check_id
            """
        ).fetchone()
        return row


def update_job_stage(job_id: str, stage: str, progress: int) -> None:
    with pool().connection() as conn:
        conn.execute(
            "update check_jobs set stage = %s, progress = %s where id = %s",
            (stage, progress, job_id),
        )


def finish_job(job_id: str, *, error: str | None = None) -> None:
    with pool().connection() as conn:
        if error is None:
            conn.execute(
                "update check_jobs set status='completed', progress=100, finished_at=now() "
                "where id=%s",
                (job_id,),
            )
        else:
            conn.execute(
                "update check_jobs set status='failed', error=%s, finished_at=now() where id=%s",
                (error[:2000], job_id),
            )


def set_check_status(check_id: str, status: str) -> None:
    with pool().connection() as conn:
        conn.execute("update checks set status=%s where id=%s", (status, check_id))


def check_is_cancelled(check_id: str) -> bool:
    with pool().connection() as conn:
        row = conn.execute("select status from checks where id=%s", (check_id,)).fetchone()
        return bool(row and row["status"] == "cancelled")


# ---------- Contexto do check ----------


def load_check_context(check_id: str) -> dict[str, Any] | None:
    with pool().connection() as conn:
        row = conn.execute(
            """
            select c.id, c.profile_id, c.brand_id, c.category_id, c.product_id, c.declared,
                   b.name as brand_name, b.auth_guide,
                   cat.slug as category_slug, cat.name as category_name,
                   cat.photo_checklist as category_checklist,
                   p.name as product_name
            from checks c
            left join brands b on b.id = c.brand_id
            left join categories cat on cat.id = c.category_id
            left join products p on p.id = c.product_id
            where c.id = %s
            """,
            (check_id,),
        ).fetchone()
        if row is None:
            return None
        photos = conn.execute(
            "select id, region, storage_path from check_photos where check_id=%s "
            "order by created_at",
            (check_id,),
        ).fetchall()
        formats = conn.execute(
            """
            select distinct serial_format from reference_items
            where brand_id is not distinct from %s
              and category_id is not distinct from %s
              and serial_format is not null
            """,
            (row["brand_id"], row["category_id"]),
        ).fetchall()
        row["photos"] = photos
        row["serial_formats"] = [f["serial_format"] for f in formats]
        return row


# ---------- Persistência dos estágios ----------


def update_photo_phash(photo_id: str, phash: str) -> None:
    with pool().connection() as conn:
        conn.execute("update check_photos set phash=%s where id=%s", (phash, photo_id))


def find_phash_reuse(check_id: str, phash: str) -> int:
    """Fotos de OUTROS checks com o mesmo hash perceptual (fraude de submissão)."""
    with pool().connection() as conn:
        row = conn.execute(
            "select count(*) as n from check_photos where phash=%s and check_id <> %s",
            (phash, check_id),
        ).fetchone()
        return int(row["n"]) if row else 0


def save_ocr(result_rows: list[dict[str, Any]]) -> None:
    if not result_rows:
        return
    with pool().connection() as conn:
        for r in result_rows:
            conn.execute(
                """
                insert into check_ocr
                  (check_id, photo_id, provider, raw_text, normalized_text, extracted, qr_payloads)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (photo_id, provider) do update set
                  raw_text = excluded.raw_text,
                  normalized_text = excluded.normalized_text,
                  extracted = excluded.extracted,
                  qr_payloads = excluded.qr_payloads
                """,
                (
                    r["check_id"],
                    r["photo_id"],
                    r["provider"],
                    r["raw_text"],
                    r["normalized_text"],
                    Json(r["extracted"]),
                    r["qr_payloads"],
                ),
            )


def save_photo_regions(photo_id: str, regions: list[dict[str, Any]]) -> None:
    with pool().connection() as conn:
        conn.execute("delete from photo_regions where photo_id=%s", (photo_id,))
        for r in regions:
            conn.execute(
                "insert into photo_regions (photo_id, label, bbox, source, confidence) "
                "values (%s, %s, %s, %s, %s)",
                (photo_id, r["label"], Json(r["bbox"]), r["source"], r.get("confidence")),
            )


def upsert_embedding(
    *,
    photo_kind: str,
    photo_id: str,
    region: str,
    model: str,
    embedding: Any,
    brand_id: str | None,
    category_id: str | None,
    product_id: str | None,
    authenticity: str | None,
) -> None:
    with pool().connection() as conn:
        conn.execute(
            """
            insert into embeddings
              (photo_kind, photo_id, region, model, embedding,
               brand_id, category_id, product_id, authenticity)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (photo_kind, photo_id, region, model)
            do update set embedding = excluded.embedding
            """,
            (
                photo_kind,
                photo_id,
                region,
                model,
                embedding,
                brand_id,
                category_id,
                product_id,
                authenticity,
            ),
        )


def knn_references(
    *,
    embedding: Any,
    region: str,
    model: str,
    brand_id: str | None,
    category_id: str | None,
    authenticity: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Vizinhos mais próximos no banco de referência (fora de quarentena)."""
    with pool().connection() as conn:
        return conn.execute(
            """
            select e.photo_id, 1 - (e.embedding <=> %s) as similarity
            from embeddings e
            join reference_photos rp on rp.id = e.photo_id
            join reference_items ri on ri.id = rp.reference_item_id
            where e.photo_kind = 'reference'
              and e.region = %s
              and e.model = %s
              and e.authenticity = %s
              and ri.quarantined = false
              and (%s::uuid is null or e.brand_id = %s)
              and (%s::uuid is null or e.category_id = %s)
            order by e.embedding <=> %s
            limit %s
            """,
            (
                embedding,
                region,
                model,
                authenticity,
                brand_id,
                brand_id,
                category_id,
                category_id,
                embedding,
                limit,
            ),
        ).fetchall()


def replace_findings(check_id: str, findings: list[dict[str, Any]]) -> None:
    with pool().connection() as conn:
        conn.execute("delete from check_findings where check_id=%s", (check_id,))
        for i, f in enumerate(findings):
            conn.execute(
                """
                insert into check_findings
                  (check_id, photo_id, region, kind, polarity, score, title,
                   detail_md, conclusion_md, bbox, comparison, position)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    check_id,
                    f.get("photo_id"),
                    f["region"],
                    f["kind"],
                    f["polarity"],
                    f.get("score"),
                    f["title"],
                    f["detail_md"],
                    f.get("conclusion_md", ""),
                    Json(f["bbox"]) if f.get("bbox") is not None else None,
                    Json(f["comparison"]) if f.get("comparison") is not None else None,
                    i,
                ),
            )


def upsert_verdict(check_id: str, verdict: dict[str, Any]) -> None:
    with pool().connection() as conn:
        conn.execute(
            """
            insert into verdicts
              (check_id, authenticity_probability, risk, outcome, confidence, source,
               summary_md, recommendations_md, next_steps_md, ai_model_version,
               score_breakdown)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (check_id) do update set
              authenticity_probability = excluded.authenticity_probability,
              risk = excluded.risk,
              outcome = excluded.outcome,
              confidence = excluded.confidence,
              source = excluded.source,
              summary_md = excluded.summary_md,
              recommendations_md = excluded.recommendations_md,
              next_steps_md = excluded.next_steps_md,
              ai_model_version = excluded.ai_model_version,
              score_breakdown = excluded.score_breakdown
            """,
            (
                check_id,
                verdict["probability"],
                verdict["risk"],
                verdict["outcome"],
                verdict["confidence"],
                "ai_auto",
                verdict["summary_md"],
                verdict["recommendations_md"],
                verdict["next_steps_md"],
                verdict["ai_model_version"],
                Json(verdict["breakdown"]),
            ),
        )


def upsert_certificate(check_id: str, public_code: str) -> None:
    with pool().connection() as conn:
        conn.execute(
            "insert into certificates (check_id, public_code) values (%s, %s) "
            "on conflict (check_id) do nothing",
            (check_id, public_code),
        )


# ---------- Consultas da API ----------


def api_get_check(check_id: str, profile_id: str) -> dict[str, Any] | None:
    with pool().connection() as conn:
        row = conn.execute(
            """
            select c.id, c.status, c.created_at, c.submitted_at, c.declared,
                   b.name as brand, cat.name as category, p.name as product,
                   (select json_build_object(
                        'status', j.status, 'stage', j.stage, 'progress', j.progress,
                        'error', j.error)
                    from check_jobs j where j.check_id = c.id
                    order by j.created_at desc limit 1) as job
            from checks c
            left join brands b on b.id = c.brand_id
            left join categories cat on cat.id = c.category_id
            left join products p on p.id = c.product_id
            where c.id = %s and c.profile_id = %s
            """,
            (check_id, profile_id),
        ).fetchone()
        return row


def api_get_report(check_id: str, profile_id: str) -> dict[str, Any] | None:
    with pool().connection() as conn:
        owner = conn.execute(
            "select 1 from checks where id=%s and profile_id=%s", (check_id, profile_id)
        ).fetchone()
        if owner is None:
            return None
        verdict = conn.execute("select * from verdicts where check_id=%s", (check_id,)).fetchone()
        findings = conn.execute(
            "select * from check_findings where check_id=%s order by position", (check_id,)
        ).fetchall()
        certificate = conn.execute(
            "select public_code, revoked from certificates where check_id=%s", (check_id,)
        ).fetchone()
        return {"verdict": verdict, "findings": findings, "certificate": certificate}


def api_get_photos(check_id: str, profile_id: str) -> list[dict[str, Any]] | None:
    with pool().connection() as conn:
        owner = conn.execute(
            "select 1 from checks where id=%s and profile_id=%s", (check_id, profile_id)
        ).fetchone()
        if owner is None:
            return None
        return conn.execute(
            "select id, region, storage_path, quality from check_photos where check_id=%s",
            (check_id,),
        ).fetchall()


def api_create_check(
    profile_id: str,
    *,
    brand_id: str | None,
    category_id: str | None,
    product_id: str | None,
    declared: dict[str, Any],
) -> dict[str, Any]:
    with pool().connection() as conn:
        row = conn.execute(
            """
            insert into checks (profile_id, brand_id, category_id, product_id, declared)
            values (%s, %s, %s, %s, %s)
            returning id, status, created_at
            """,
            (profile_id, brand_id, category_id, product_id, json.dumps(declared)),
        ).fetchone()
        assert row is not None
        return row
