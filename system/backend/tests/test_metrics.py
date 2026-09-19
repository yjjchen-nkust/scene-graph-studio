from __future__ import annotations

from app.eval.constraint import apply_constraint, rank
from app.eval.match import Triplet
from app.eval.metrics import assign, mean_recall_at_k, recall_at_k, zero_shot_recall_at_k
from app.schema import BBox

B = BBox(x=0, y=0, w=10, h=10)


def t(i: int, s: str, p: str, o: str, score: float | None = None) -> Triplet:
    return Triplet(index=i, relationship_id=i, subject_name=s, predicate=p, object_name=o,
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
