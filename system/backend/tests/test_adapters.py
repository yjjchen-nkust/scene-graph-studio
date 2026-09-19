"""The COCO-parquet adapter, against a committed fixture and — when present — the real corpus.

D-08 has adapters written against files that actually exist. The fixture reproduces the shape
read off a real shard; the corpus tests run only on a machine that has one, so CI stays green on
a bare clone without ever needing a licence to redistribute anything.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.datasets.adapters import read_dataset
from app.datasets.adapters.coco_parquet import image_bytes, read_coco_parquet
from app.datasets.loader import selection_ok, top_predicates
from app.schema import SceneGraph

FIXTURE = Path(__file__).parent / "fixtures" / "coco_parquet"

CORPUS = Path(os.environ.get("SGS_CORPUS_ROOT", "")) if os.environ.get("SGS_CORPUS_ROOT") else None
needs_corpus = pytest.mark.skipif(
    CORPUS is None or not (CORPUS / "indoorvg" / "annotations").is_dir(),
    reason="no corpus on this machine; set SGS_CORPUS_ROOT to run",
)


def graphs() -> list[SceneGraph]:
    return list(read_coco_parquet(FIXTURE, "indoorvg"))


def test_every_row_becomes_a_valid_scene_graph():
    gs = graphs()
    assert len(gs) == 4
    for g in gs:
        SceneGraph.model_validate(g.model_dump())
        assert g.dataset == "indoorvg"
        assert g.provenance.kind == "ground_truth"
        assert g.provenance.fidelity == "measured"


def test_category_ids_are_resolved_to_names():
    g = graphs()[0]
    assert {o.name for o in g.objects} == {"table", "box", "lamp", "chair", "window"}
    assert {r.predicate for r in g.relationships} == {
        "wedged under", "draped over", "propped against", "balanced on",
    }


def test_a_degenerate_bbox_is_dropped_not_clamped():
    """BBox requires w > 0 and h > 0. Silently widening one would invent a measurement."""
    g = next(x for x in graphs() if x.image_id == "3")
    assert 34 not in {o.object_id for o in g.objects}
    assert len(g.objects) == 4


def test_a_relation_naming_a_missing_object_is_dropped():
    """SceneGraph forbids dangling references, so the adapter must drop them at the source."""
    g = next(x for x in graphs() if x.image_id == "3")
    known = {o.object_id for o in g.objects}
    assert all(r.subject_id in known and r.object_id in known for r in g.relationships)
    assert {r.relationship_id for r in g.relationships} == {300, 301, 302}


def test_ground_truth_relationships_carry_no_score():
    """A score on ground truth would make it rankable, which it is not."""
    for g in graphs():
        assert all(r.score is None for r in g.relationships)


def test_bbox_survives_the_round_trip_exactly():
    g = next(x for x in graphs() if x.image_id == "1")
    box = next(o for o in g.objects if o.object_id == 10).bbox
    assert (box.x, box.y, box.w, box.h) == (4.0, 4.0, 30.0, 20.0)


def test_the_selection_rule_can_both_accept_and_reject():
    gs = graphs()
    head = top_predicates(gs)
    assert selection_ok(next(x for x in gs if x.image_id == "1"), head) is True
    assert selection_ok(next(x for x in gs if x.image_id == "2"), head) is False


def test_image_bytes_come_back_as_a_real_jpeg():
    data = image_bytes(FIXTURE, "1")
    assert data is not None
    assert data[:3] == b"\xff\xd8\xff"          # JPEG SOI
    assert image_bytes(FIXTURE, "does-not-exist") is None


def test_both_datasets_are_registered_and_route_to_the_same_reader():
    from app.datasets.adapters import _REGISTRY

    assert {"vg150-sgb", "indoorvg"} <= set(_REGISTRY)


def test_an_unregistered_dataset_still_fails_with_its_expected_layout():
    with pytest.raises(SystemExit) as e:
        list(read_dataset("haystack", Path("nowhere")))
    assert "haystack" in str(e.value)


# ── the real corpus, when this machine has one ───────────────────────────────────────────


@needs_corpus
@pytest.mark.parametrize("ds", ["indoorvg", "vg150-sgb"])
def test_the_real_shard_reads_and_validates(ds):
    root = CORPUS / ds
    gs = []
    for i, g in enumerate(read_coco_parquet(root, ds)):
        SceneGraph.model_validate(g.model_dump())
        gs.append(g)
        if i >= 199:
            break
    assert len(gs) == 200
    assert all(g.dataset == ds for g in gs)
    assert any(g.relationships for g in gs)


@needs_corpus
def test_enough_real_images_satisfy_the_selection_rule_to_cut_a_slice():
    """D-10 asks for 20 IndoorVG images. If the rule rejects nearly everything, say so here."""
    gs = list(read_coco_parquet(CORPUS / "indoorvg", "indoorvg"))
    head = top_predicates(gs)
    eligible = [g for g in gs if selection_ok(g, head)]
    assert len(eligible) >= 20, f"only {len(eligible)} of {len(gs)} pass the selection rule"
