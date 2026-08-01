from garimpo_pipeline.api.filters import reference_filters


def test_empty_params_yield_empty_where():
    where, args = reference_filters({})
    assert where == ""
    assert args == []


def test_exact_and_ilike_fields():
    where, args = reference_filters(
        {"brand_id": "b1", "authenticity": "replica", "sku": "DD1391", "release_year": 2021}
    )
    assert "ri.brand_id = %s" in where
    assert "ri.authenticity = %s" in where
    assert "ri.sku ilike %s" in where
    assert "ri.release_year = %s" in where
    assert args == ["b1", "replica", 2021, "%DD1391%"]


def test_free_text_query_spans_brand_product_sku_collection():
    where, args = reference_filters({"query": "panda"})
    assert "b.name ilike %s" in where
    assert "p.name ilike %s" in where
    assert args == ["%panda%"] * 4


def test_quarantined_boolean_and_empty_strings_ignored():
    where, args = reference_filters({"quarantined": False, "sku": "", "collection": None})
    assert where == "ri.quarantined = %s"
    assert args == [False]


def test_clauses_joined_with_and():
    where, _ = reference_filters({"brand_id": "b", "category_id": "c"})
    assert where.count(" and ") == 1
