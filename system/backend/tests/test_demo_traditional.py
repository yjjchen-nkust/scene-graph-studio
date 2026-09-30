"""D-T, the traditional pipeline: the pure functions of `scripts/record_demo_traditional.py`.

The detector is not run here (it needs torch and a GPU); `detect` is exercised once by the script
itself and its output is audited through `test_registry.py`. What is tested is everything that
turns detections into a scene graph.
"""

from __future__ import annotations

from collections import Counter

import pytest

from app.datasets.loader import load_slice
from app.schema import SceneGraph
from app.vlm.prompts import O_ISG
from scripts.record_demo_traditional import (
    CLASS_SYNONYMS,
    MODEL,
    O_ISG_COCO,
    classify,
    frequency_table,
    map_class,
    most_frequent,
    slice_classes,
    to_scene_graph,
)


def _graph(image_id: str, names: list[str], rels: list[tuple[int, int, str]]) -> SceneGraph:
    return SceneGraph.model_validate({
        "image_id": image_id, "dataset": "vg150-sgb", "width": 100, "height": 100,
        "objects": [
            {"object_id": i, "names": [n], "bbox": {"x": i, "y": i, "w": 10, "h": 10}}
            for i, n in enumerate(names)
        ],
        "relationships": [
            {"relationship_id": k, "subject_id": s, "object_id": o, "predicate": p}
            for k, (s, o, p) in enumerate(rels)
        ],
        "provenance": {"kind": "ground_truth", "fidelity": "published", "note": "test"},
    })


A = _graph("a", ["man", "table", "cup"], [(0, 1, "on"), (2, 1, "on"), (0, 2, "holding")])
B = _graph("b", ["man", "table"], [(0, 1, "on"), (0, 1, "near")])


def test_the_table_counts_each_row_under_its_class_pair():
    table = frequency_table([A, B])
    assert table[("man", "table")] == Counter({"on": 2, "near": 1})


def test_classify_takes_the_most_frequent_and_breaks_ties_by_name():
    extra = _graph("c", ["man", "table"], [(0, 1, "near")])
    table = frequency_table([A, B, extra])
    assert classify("man", "table", table, "on") == ("near", "prior")


def test_an_unseen_pair_or_an_unmapped_class_takes_the_fallback():
    table = frequency_table([A, B])
    assert classify("cup", "man", table, "on") == ("on", "fallback")
    assert classify(None, "table", table, "on") == ("on", "fallback")


def test_map_class_takes_the_name_or_a_stated_synonym():
    assert map_class("cup", {"cup"}) == "cup"
    assert map_class("dining table", {"table"}) == "table"
    assert map_class("scissors", {"table"}) is None


def test_every_synonym_target_is_a_class_of_the_slice():
    classes = slice_classes(load_slice("vg150-sgb"))
    for coco, target in CLASS_SYNONYMS.items():
        assert target in classes, (coco, target)


def test_the_slice_prior_is_the_one_the_spec_states():
    graphs = load_slice("vg150-sgb")
    rows = [r for g in graphs for r in g.relationships]
    assert len(graphs) == 80
    assert len(rows) == 892
    assert len({r.predicate for r in rows}) == 36
    assert most_frequent(graphs) == "on"


def test_to_scene_graph_classifies_every_ordered_pair_once():
    table = frequency_table([A, B])
    detections = [
        {"label": "man", "score": 0.9, "box": (0.0, 0.0, 10.0, 10.0)},
        {"label": "dining table", "score": 0.8, "box": (5.0, 5.0, 20.0, 20.0)},
        {"label": "cup", "score": 0.7, "box": (6.0, 6.0, 4.0, 4.0)},
    ]
    sg = to_scene_graph("m0-demo-088", 1280, 720, detections, table,
                        slice_classes([A, B]), "on", "2026-09-29T00:00:00Z")
    pairs = [(r.subject_id, r.object_id) for r in sg.relationships]
    assert pairs == [(0, 1), (0, 2), (1, 0), (1, 2), (2, 0), (2, 1)]
    assert [o.object_id for o in sg.objects] == [0, 1, 2]
    assert sg.provenance.fidelity == "measured" and sg.provenance.model == MODEL
    assert sg.dataset == "mini-isg"
    assert all(r.score is None for r in sg.relationships)
    assert SceneGraph.model_validate(sg.model_dump()) == sg


def test_o_isg_coco_names_only_detector_categories():
    assert set(O_ISG_COCO) == set(O_ISG)
    try:
        from torchvision.models.detection import FasterRCNN_ResNet50_FPN_Weights
    except ImportError as exc:
        pytest.skip(f"torchvision does not import: {exc}")
    categories = set(FasterRCNN_ResNet50_FPN_Weights.COCO_V1.meta["categories"])
    for value in O_ISG_COCO.values():
        assert value is None or value in categories
