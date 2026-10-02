from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.eval.rle import encode_counts
from app.schema import RLEMask, SceneGraph
from app.settings import DATA_DIR


def _graph(rels: list[dict]) -> dict:
    return {
        "image_id": "img-1",
        "dataset": "vg150-sgb",
        "width": 100,
        "height": 80,
        "objects": [
            {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
            {"object_id": 2, "names": ["table"], "bbox": {"x": 5, "y": 5, "w": 20, "h": 20}},
        ],
        "relationships": rels,
        "provenance": {"kind": "ground_truth", "fidelity": "measured"},
    }


def test_valid_graph_round_trips():
    g = SceneGraph.model_validate(_graph([
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}
    ]))
    assert g.relationships[0].predicate == "on"
    assert SceneGraph.model_validate(g.model_dump()) == g


def test_dangling_subject_is_rejected():
    with pytest.raises(ValidationError) as e:
        SceneGraph.model_validate(_graph([
            {"relationship_id": 7, "subject_id": 99, "object_id": 2, "predicate": "on"}
        ]))
    assert "99" in str(e.value)


def test_repeated_object_id_is_rejected():
    # Python resolved the first of two objects sharing an id and TypeScript the last, and the
    # constraint key is the id pair (D99), so both engines refuse such a graph (D100).
    g = _graph([{"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}])
    g["objects"].append(
        {"object_id": 2, "names": ["chair"], "bbox": {"x": 50, "y": 5, "w": 20, "h": 20}}
    )
    with pytest.raises(ValidationError) as e:
        SceneGraph.model_validate(g)
    assert "object_ids [2] appear more than once in this graph" in str(e.value)


def test_a_dangling_reference_is_reported_beside_a_repeated_id():
    # The repeated-id check ran first and raised alone, so the dangling reference went unreported
    # and the API answered schema_invalid where contracts §1.1 gives dangling_reference (D102).
    g = _graph([{"relationship_id": 7, "subject_id": 99, "object_id": 2, "predicate": "on"}])
    g["objects"].append(
        {"object_id": 2, "names": ["chair"], "bbox": {"x": 50, "y": 5, "w": 20, "h": 20}}
    )
    with pytest.raises(ValidationError) as e:
        SceneGraph.model_validate(g)
    assert "object_ids [2] appear more than once in this graph" in str(e.value)
    assert "relationships [7] reference object_ids not present in this graph: [99]" in str(e.value)


def test_reconstructed_fidelity_requires_a_note():
    bad = _graph([])
    bad["provenance"] = {"kind": "model", "fidelity": "reconstructed", "model": "motifs"}
    with pytest.raises(ValidationError):
        SceneGraph.model_validate(bad)


def test_bare_vg150_is_not_a_dataset():
    bad = _graph([])
    bad["dataset"] = "vg150"
    with pytest.raises(ValidationError):
        SceneGraph.model_validate(bad)


@pytest.mark.parametrize("size", [(100000, 100000), (1, 4096 * 4096 + 1), (0, 4), (-2, -2)])
def test_a_mask_size_no_frame_has_is_refused(size):
    """A mask is decoded to `height * width` pixels, and nothing bounded that product or kept it
    positive; `(-2, -2)` was a mask of four pixels (D120's review)."""
    with pytest.raises(ValidationError, match="mask size"):
        RLEMask(counts="", size=size)


@pytest.mark.parametrize("size", [(4, 4), (640, 633), (1, 100001), (4096, 4096)])
def test_every_mask_size_the_data_holds_is_admitted(size):
    """The golden vectors' 4 × 4, PSG's largest, `test_rle`'s long run, and the bound itself,
    each with counts that cover it: one background run of the whole area."""
    h, w = size
    assert RLEMask(counts=encode_counts([h * w]), size=size).size == size


def _masks_under(*roots: Path) -> list[dict]:
    found: list[dict] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            if "counts" in node and "size" in node:
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for root in roots:
        for path in sorted(root.rglob("*.json")):
            walk(json.loads(path.read_text(encoding="utf-8")))
    return found


def test_every_mask_on_the_nas_is_admitted():
    """Both rules, the size's and the counts', admit every mask the data holds: the golden
    vectors' and the PSG slice's, each of whose runs sum to its area exactly."""
    masks = _masks_under(DATA_DIR / "golden", DATA_DIR / "slices", DATA_DIR / "predictions")
    assert masks
    for m in masks:
        RLEMask.model_validate(m)


@pytest.mark.parametrize("runs", [
    [0, 8],         # short: the rest of the mask was read as background
    [0, 2**31],     # long: 2**31 pixels in Python, -2**31 in the 32-bit TypeScript of D120
    [8, -1, 9],     # a negative run: no pixel, but the colour still flipped
    [],             # no runs at all
], ids=["short", "long", "negative", "empty"])
def test_counts_that_do_not_cover_the_mask_exactly_are_refused(runs):
    """Every run non-negative and the runs summing to `height * width`, as a COCO mask's do. The
    engines read anything else by rules of their own, and they did not read it alike."""
    with pytest.raises(ValidationError, match="mask counts"):
        RLEMask(counts=encode_counts(runs), size=(4, 4))
