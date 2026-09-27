from __future__ import annotations

from app.eval.constraint import apply_constraint, rank
from app.eval.match import Triplet
from app.eval.metrics import assign, mean_recall_at_k, recall_at_k, zero_shot_recall_at_k
from app.schema import BBox

B = BBox(x=0, y=0, w=10, h=10)


_IDS: dict[str, int] = {}


def _id(name: str) -> int:
    return _IDS.setdefault(name, len(_IDS) + 1)


def t(i: int, s: str, p: str, o: str, score: float | None = None) -> Triplet:
    return Triplet(index=i, relationship_id=i, subject_id=_id(s), object_id=_id(o),
                   subject_name=s, predicate=p, object_name=o,
                   subject_bbox=B, object_bbox=B, subject_mask=None, object_mask=None, score=score)


GT = [t(0, "a", "on", "b"), t(1, "c", "on", "d"), t(2, "e", "under", "f")]


def test_recall_counts_matched_over_total():
    preds = [t(0, "a", "on", "b", 0.9), t(1, "c", "on", "d", 0.8)]
    assert recall_at_k(assign(rank(preds), GT, 20, 0.5, False), 20) == 2 / 3


def test_recall_is_zero_on_empty_predictions():
    assert recall_at_k(assign([], GT, 20, 0.5, False), 20) == 0.0


def test_recall_is_none_on_empty_ground_truth():
    assert recall_at_k(assign([t(0, "a", "on", "b", 0.9)], [], 20, 0.5, False), 20) is None


def test_top_k_truncates_the_ranking():
    preds = [t(0, "x", "no", "y", 0.99), t(1, "a", "on", "b", 0.5)]
    assert recall_at_k(assign(rank(preds), GT, 1, 0.5, False), 1) == 0.0
    assert recall_at_k(assign(rank(preds), GT, 2, 0.5, False), 2) == 1 / 3


def test_mean_recall_averages_over_classes_present_in_ground_truth():
    preds = [t(0, "a", "on", "b", 0.9), t(1, "e", "under", "f", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert mean_recall_at_k(a, 20) == (0.5 + 1.0) / 2
    assert recall_at_k(a, 20) == 2 / 3


def test_the_mean_recall_denominator_trap():
    """A class with one GT instance weighs as much as a class with many."""
    gt = [t(i, "a", "on", "b") for i in range(9)] + [t(9, "c", "rare", "d")]
    preds = [t(i, "a", "on", "b", 0.9 - i / 100) for i in range(9)]
    a = assign(rank(preds), gt, 20, 0.5, False)
    assert recall_at_k(a, 20) == 0.9
    assert mean_recall_at_k(a, 20) == 0.5


def test_no_graph_constraint_raises_recall():
    preds = [t(0, "a", "near", "b", 0.9), t(1, "a", "on", "b", 0.8)]
    ranked = rank(preds)
    r = recall_at_k(assign(apply_constraint(ranked, "graph", 1), GT, 20, 0.5, False), 20)
    ng = recall_at_k(assign(apply_constraint(ranked, "none", 1), GT, 20, 0.5, False), 20)
    assert r == 0.0 and ng == 1 / 3 and ng > r


def test_zero_shot_restricts_the_denominator():
    seen = {("a", "on", "b"), ("c", "on", "d")}
    preds = [t(0, "a", "on", "b", 0.9), t(1, "e", "under", "f", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert zero_shot_recall_at_k(a, GT, seen, 20) == 1.0


def test_zero_shot_is_none_when_every_triplet_was_seen():
    seen = {tr.classes for tr in GT}
    a = assign(rank([]), GT, 20, 0.5, False)
    assert zero_shot_recall_at_k(a, GT, seen, 20) is None


def test_duplicate_predictions_credit_the_ground_truth_once():
    preds = [t(0, "a", "on", "b", 0.9), t(1, "a", "on", "b", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert recall_at_k(a, 20) == 1 / 3
    assert [v[1] for v in a.verdicts[:2]] == ["match", "localization"]


def test_recall_is_monotone_in_k():
    preds = [t(i, *trip, 0.9 - i / 100) for i, trip in enumerate(
        [("x", "no", "y"), ("a", "on", "b"), ("c", "on", "d"), ("e", "under", "f")])]
    ranked = rank(preds)
    values = [recall_at_k(assign(ranked, GT, k, 0.5, False), k) for k in (1, 2, 3, 4)]
    assert values == sorted(values)


def test_recall_ordering_between_protocols_is_not_forced():
    """Two annotated triplets on one object pair (D98, D99). Under the graph constraint a model
    handed the boxes keeps one predicate for the pair and recalls half; a model proposing its own
    boxes can put the two predicates on two box pairs, each at IoU 9604 / 10396 = 0.924 with the
    annotation, and recall both. Less input, more recall: no ordering holds for every model."""
    from app.eval.engine import EvalRequest, evaluate

    def box(x: float, y: float) -> dict:
        return {"x": x, "y": y, "w": 100, "h": 100}

    def graph(objects: list, rels: list, kind: str) -> dict:
        prov = {"kind": "ground_truth", "fidelity": "measured"} if kind == "gt" else \
            {"kind": "model", "fidelity": "measured", "model": "ordering"}
        return {"image_id": "ordering", "dataset": "placeholder", "width": 400, "height": 200,
                "objects": objects, "relationships": rels, "provenance": prov}

    man, table = {"object_id": 1, "names": ["man"], "bbox": box(0, 0)}, \
        {"object_id": 2, "names": ["table"], "bbox": box(200, 0)}
    gt = graph([man, table], [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"},
        {"relationship_id": 2, "subject_id": 1, "object_id": 2, "predicate": "near"},
    ], "gt")
    given = graph([man, table], [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on", "score": 0.9},
        {"relationship_id": 2, "subject_id": 1, "object_id": 2, "predicate": "near", "score": 0.8},
    ], "pred")
    own = graph([man, table,
                 {"object_id": 3, "names": ["man"], "bbox": box(2, 2)},
                 {"object_id": 4, "names": ["table"], "bbox": box(202, 2)}], [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on", "score": 0.9},
        {"relationship_id": 2, "subject_id": 3, "object_id": 4, "predicate": "near", "score": 0.8},
    ], "pred")

    def recall(pred: dict, protocol: str) -> float:
        body = evaluate(EvalRequest.model_validate(
            {"gt": gt, "pred": pred, "protocol": protocol, "constraint": "graph", "k": [50]}))
        return next(m["value"] for m in body["metrics"] if m["metric"] == "R" and m["k"] == 50)

    assert recall(given, "sgcls") == 0.5
    assert recall(own, "sgdet") == 1.0
