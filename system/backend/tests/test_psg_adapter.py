"""The PSG adapter, against a synthetic fixture and — when present — the real corpus.

PSG is the only Tier-1 dataset with masks, which is what makes L6 Protocol Forensics possible
at all. It is also the one whose conventions are easiest to get plausibly wrong, so each of the
three is pinned by a test that would fail loudly rather than quietly.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.datasets.adapters.psg import read as read_psg
from app.eval.rle import decode
from app.schema import SceneGraph

FIXTURE = Path(__file__).parent / "fixtures" / "psg"

CORPUS = Path(os.environ["SGS_CORPUS_ROOT"]) if os.environ.get("SGS_CORPUS_ROOT") else None
needs_corpus = pytest.mark.skipif(
    CORPUS is None or not (CORPUS / "psg" / "psg.json").is_file(),
    reason="no PSG corpus on this machine; set SGS_CORPUS_ROOT to run",
)


def graphs() -> list[SceneGraph]:
    return list(read_psg(FIXTURE))


def test_every_record_becomes_a_valid_scene_graph():
    gs = graphs()
    assert len(gs) == 3
    for g in gs:
        SceneGraph.model_validate(g.model_dump())
        assert g.dataset == "psg"
        assert g.provenance.kind == "ground_truth"


def test_bbox_is_read_as_xyxy_not_xywh():
    """bbox_mode 0 is Detectron2 XYXY_ABS. Reading it as w/h gives plausible, wrong boxes."""
    g = graphs()[0]
    person = g.objects[0]
    # fixture box is (1, 1, 5, 7) in XYXY -> x=1 y=1 w=4 h=6
    assert (person.bbox.x, person.bbox.y) == (1.0, 1.0)
    assert (person.bbox.w, person.bbox.h) == (4.0, 6.0)


def test_category_ids_index_thing_and_stuff_concatenated():
    g = graphs()[0]
    assert [o.name for o in g.objects] == ["person", "bench", "tree-merged"]


def test_relations_are_positional_not_object_ids():
    """[0, 2, 0] means annotations[0] -> annotations[2] with predicate_classes[0]."""
    g = graphs()[0]
    ids = [o.object_id for o in g.objects]
    first = g.relationships[0]
    assert (first.subject_id, first.object_id) == (ids[0], ids[2])
    assert first.predicate == "over"
    assert {r.predicate for r in g.relationships} == {"over", "sitting on", "beside"}


def test_masks_come_from_the_panoptic_png():
    g = graphs()[0]
    person = g.objects[0]
    assert person.mask is not None
    assert person.mask.size == (10, 12)          # (height, width)
    bitmap = decode(person.mask)
    # the fixture paints segment 1 over x in [1,5), y in [1,7) -> 4 * 6 = 24 pixels
    assert sum(bitmap) == 24
    # column-major: index = x * height + y
    assert bitmap[1 * 10 + 1] == 1
    assert bitmap[0 * 10 + 0] == 0


def test_a_record_without_its_panoptic_png_still_reads_without_masks():
    """A missing PNG loses the masks for that image, not the image."""
    g = next(x for x in graphs() if x.image_id == "000000000002")
    assert g.objects
    assert all(o.mask is None for o in g.objects)


def test_a_relation_indexing_past_the_annotations_is_dropped():
    g = next(x for x in graphs() if x.image_id == "000000000002")
    assert len(g.relationships) == 1


def test_a_zero_area_box_is_dropped_and_takes_its_relations_with_it():
    g = next(x for x in graphs() if x.image_id == "000000000003")
    assert len(g.objects) == 1
    assert g.relationships == []


def test_a_record_whose_photograph_is_absent_is_dropped_and_counted():
    """psg.json spans COCO train2017 and val2017, which are separate downloads.

    Yielding a scene the studio cannot display would let cut_slice.py write annotations naming
    images it has no bytes for -- a slice that passes every schema check and teaches nothing.
    """
    from app.datasets.adapters import psg

    ids = [g.image_id for g in graphs()]
    assert "000000000004" not in ids
    assert psg.last_repairs.rows_dropped == 1
    assert psg.last_repairs.reasons["photograph not on disk"] == 1
    assert psg.last_repairs.rows == 3


def test_image_bytes_finds_the_photograph_and_declines_the_absent_one():
    from app.datasets.adapters.psg import image_bytes

    assert image_bytes(FIXTURE, "000000000001")[:2] == bytes([0xFF, 0xD8])  # JPEG SOI
    assert image_bytes(FIXTURE, "000000000004") is None
    assert image_bytes(FIXTURE, "no-such-image") is None


def test_ground_truth_carries_no_score():
    for g in graphs():
        assert all(r.score is None for r in g.relationships)


def test_psg_is_registered():
    from app.datasets.adapters import _REGISTRY

    assert "psg" in _REGISTRY


# ── the real corpus ──────────────────────────────────────────────────────────────────────


@needs_corpus
def test_the_real_psg_reads_and_validates():
    root = CORPUS / "psg"
    seen = 0
    for g in read_psg(root):
        SceneGraph.model_validate(g.model_dump())
        seen += 1
        if seen >= 50:
            break
    assert seen == 50


@needs_corpus
def test_the_real_corpus_agrees_with_its_own_class_counts():
    """133 classes = 80 thing + 53 stuff, and 56 predicates. The design document's figures."""
    import json

    blob = json.loads((CORPUS / "psg" / "psg.json").read_text(encoding="utf-8"))
    assert len(blob["thing_classes"]) == 80
    assert len(blob["stuff_classes"]) == 53
    assert len(blob["predicate_classes"]) == 56
