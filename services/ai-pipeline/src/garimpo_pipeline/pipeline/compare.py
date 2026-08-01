"""Comparação com o banco de referência: kNN filtrado por marca, categoria e
região, contra originais e réplicas conhecidas separadamente."""

import numpy as np

from .. import db
from ..config import settings
from ..types import CheckContext, RegionComparison


def compare_photo(
    context: CheckContext,
    *,
    photo_id: str,
    region: str,
    embedding: np.ndarray,
    k: int = 5,
) -> RegionComparison:
    model = settings().embedding_model_name

    authentic = db.knn_references(
        embedding=embedding,
        region=region,
        model=model,
        brand_id=context.brand_id,
        category_id=context.category_id,
        authenticity="authentic",
        limit=k,
    )
    replica = db.knn_references(
        embedding=embedding,
        region=region,
        model=model,
        brand_id=context.brand_id,
        category_id=context.category_id,
        authenticity="replica",
        limit=k,
    )

    return RegionComparison(
        photo_id=photo_id,
        region=region,
        similarity_authentic=_mean_similarity(authentic),
        similarity_replica=_mean_similarity(replica),
        n_authentic=len(authentic),
        n_replica=len(replica),
    )


def _mean_similarity(rows: list[dict]) -> float | None:
    if not rows:
        return None
    return round(float(np.mean([float(r["similarity"]) for r in rows])), 4)
