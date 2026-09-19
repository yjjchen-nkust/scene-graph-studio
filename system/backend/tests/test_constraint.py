from __future__ import annotations

from app.eval.constraint import apply_constraint, has_ties, rank
from app.eval.match import Triplet
from app.schema import BBox

B = BBox(x=0, y=0, w=1, h=1)


def t(index: int, rid: int, s: str, p: str, o: str, score: float | None) -> Triplet:
    return Triplet(index=index, relationship_id=rid, subject_name=s, predicate=p,
                   object_name=o, subject_bbox=B, object_bbox=B,
                   subject_mask=None, object_mask=None, score=score)


PREDS = [
    t(0, 10, "person", "on", "table", 0.9),
    t(1, 11, "person", "near", "table", 0.8),
    t(2, 12, "person", "under", "table", 0.7),
    t(3, 13, "box", "on", "table", 0.6),
]


def test_rank_is_descending_by_score():
    assert [x.score for x in rank(PREDS)] == [0.9, 0.8, 0.7, 0.6]


def test_ties_break_by_relationship_id_ascending():
    a, b = t(0, 99, "a", "p", "b", 0.5), t(1, 7, "c", "p", "d", 0.5)
    assert [x.relationship_id for x in rank([a, b])] == [7, 99]
    assert has_ties([a, b]) is True
    assert has_ties(PREDS) is False


def test_missing_scores_sort_last_and_keep_input_order():
    u = t(4, 14, "z", "p", "y", None)
    assert rank([u, PREDS[0]])[0].relationship_id == 10


def test_graph_constraint_keeps_one_predicate_per_ordered_pair():
    kept = apply_constraint(rank(PREDS), "graph", 1)
    assert [x.predicate for x in kept] == ["on", "on"]
    assert len(kept) == 2


def test_none_constraint_keeps_everything():
    assert len(apply_constraint(rank(PREDS), "none", 1)) == 4


def test_semi_constraint_keeps_at_most_n_per_pair():
    kept = apply_constraint(rank(PREDS), "semi", 2)
    assert [x.predicate for x in kept] == ["on", "near", "on"]


def test_the_ordered_pair_is_direction_sensitive():
    pair = [t(0, 1, "a", "on", "b", 0.9), t(1, 2, "b", "on", "a", 0.8)]
    assert len(apply_constraint(rank(pair), "graph", 1)) == 2


def test_rank_does_not_mutate_its_input():
    before = [x.relationship_id for x in PREDS]
    rank(PREDS)
    assert [x.relationship_id for x in PREDS] == before
