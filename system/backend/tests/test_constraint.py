from __future__ import annotations

from app.eval.constraint import apply_constraint, has_ties, rank
from app.eval.match import Triplet
from app.schema import BBox

B = BBox(x=0, y=0, w=1, h=1)


_IDS: dict[str, int] = {}


def _id(name: str) -> int:
    return _IDS.setdefault(name, len(_IDS) + 1)


def t(index: int, rid: int, s: str, p: str, o: str, score: float | None, *,
      sid: int | None = None, oid: int | None = None) -> Triplet:
    """A ranked prediction. Without `sid`/`oid` each name stands for one object."""
    return Triplet(index=index, relationship_id=rid,
                   subject_id=_id(s) if sid is None else sid,
                   object_id=_id(o) if oid is None else oid,
                   subject_name=s, predicate=p,
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


# ---- The key is the ordered object pair (D99) -------------------------------------------------
# Tang's sgg_eval.py (fca9860, line 66) keeps the arg-max predicate for each pair of predicted object
# indices; M4's E4 writes pi(<s,p,o>) = (s,o). Two objects of one class are two pairs.


def test_graph_keeps_one_predicate_per_object_pair_not_per_class_pair():
    two_pairs = [t(0, 1, "hand", "holding", "assembly", 0.9, sid=1, oid=3),
                 t(1, 2, "hand", "assembling", "assembly", 0.8, sid=2, oid=3)]
    assert [x.relationship_id for x in apply_constraint(rank(two_pairs), "graph", 1)] == [1, 2]


def test_graph_still_keeps_one_on_a_single_object_pair():
    one_pair = [t(0, 1, "hand", "holding", "assembly", 0.9, sid=1, oid=3),
                t(1, 2, "hand", "assembling", "assembly", 0.8, sid=1, oid=3)]
    assert [x.relationship_id for x in apply_constraint(rank(one_pair), "graph", 1)] == [1]


def test_duplicate_detections_are_two_pairs():
    dup = [t(0, 1, "man", "on", "street", 0.9, sid=1, oid=9),
           t(1, 2, "man", "on", "street", 0.8, sid=2, oid=9)]
    assert len(apply_constraint(rank(dup), "graph", 1)) == 2


def test_semi_caps_per_object_pair():
    preds = [t(i, i + 1, "hand", p, "assembly", 0.9 - i / 10, sid=1 + i // 3, oid=9)
             for i, p in enumerate(["holding", "assembling", "near", "holding", "assembling", "near"])]
    assert [x.relationship_id for x in apply_constraint(rank(preds), "semi", 2)] == [1, 2, 4, 5]
    assert len(apply_constraint(rank(preds), "semi", 1)) == 2
    assert len(apply_constraint(rank(preds), "semi", 0)) == 2


def test_a_self_pair_is_a_pair():
    same = [t(0, 1, "arm", "near", "arm", 0.9, sid=4, oid=4),
            t(1, 2, "arm", "on", "arm", 0.8, sid=4, oid=4)]
    assert len(apply_constraint(rank(same), "graph", 1)) == 1
