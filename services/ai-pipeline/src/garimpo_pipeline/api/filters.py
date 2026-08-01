"""Construção de filtros SQL da busca de referências (função pura, testada)."""

from typing import Any

_EXACT_FIELDS = {
    "brand_id": "ri.brand_id = %s",
    "category_id": "ri.category_id = %s",
    "product_id": "ri.product_id = %s",
    "authenticity": "ri.authenticity = %s",
    "release_year": "ri.release_year = %s",
}

_ILIKE_FIELDS = {
    "sku": "ri.sku ilike %s",
    "collection": "ri.collection ilike %s",
    "replica_batch": "ri.replica_batch ilike %s",
}


def reference_filters(params: dict[str, Any]) -> tuple[str, list[Any]]:
    """Retorna (cláusula WHERE sem o 'where', argumentos posicionais)."""
    clauses: list[str] = []
    args: list[Any] = []

    for field, sql in _EXACT_FIELDS.items():
        value = params.get(field)
        if value not in (None, ""):
            clauses.append(sql)
            args.append(value)

    for field, sql in _ILIKE_FIELDS.items():
        value = params.get(field)
        if value not in (None, ""):
            clauses.append(sql)
            args.append(f"%{value}%")

    query = params.get("query")
    if query not in (None, ""):
        clauses.append(
            "(b.name ilike %s or p.name ilike %s or ri.sku ilike %s or ri.collection ilike %s)"
        )
        pattern = f"%{query}%"
        args.extend([pattern, pattern, pattern, pattern])

    quarantined = params.get("quarantined")
    if quarantined is not None:
        clauses.append("ri.quarantined = %s")
        args.append(bool(quarantined))

    return " and ".join(clauses), args
