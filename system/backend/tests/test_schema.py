from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schema import SceneGraph


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
    # and the API answered schema_invalid where contracts §1.1 gives dangling_reference (D101).
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
