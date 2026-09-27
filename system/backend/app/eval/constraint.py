from __future__ import annotations

from app.eval.match import Triplet
from app.schema import Constraint


def rank(preds: list[Triplet]) -> list[Triplet]:
    """Score-descending, ties broken by relationship_id ascending. NFR-4.

    A prediction with no score sorts after every scored prediction, keeping input order.
    """
    scored = [p for p in preds if p.score is not None]
    unscored = [p for p in preds if p.score is None]
    scored.sort(key=lambda p: (-(p.score or 0.0), p.relationship_id))
    return scored + unscored


def has_ties(preds: list[Triplet]) -> bool:
    seen: set[float] = set()
    for p in preds:
        if p.score is None:
            continue
        if p.score in seen:
            return True
        seen.add(p.score)
    return False


def apply_constraint(ranked: list[Triplet], mode: Constraint, max_per_pair: int) -> list[Triplet]:
    """Filter a ranked list. The pair key is the ORDERED OBJECT pair (subject_id, object_id).

    Tang's `sgg_eval.py` (commit fca9860, line 66) keeps the arg-max predicate for each pair of
    predicted object indices, and M4's E4 writes pi(<s,p,o>) = (s,o) with s and o the objects. The
    key was the ordered class pair until D99, which kept one predicate between two hands holding one
    assembly where the reference keeps one each.

    `semi` caps predicates per ordered object pair at `max_per_pair`. It is not Action Genome's
    semi constraint, which STTran (`lib/evaluation_recall.py`, commit bcc72cf) evaluates as the
    top attention predicate plus every spatial or contacting predicate above 0.9 per pair (D99).
    """
    if mode == "none":
        return list(ranked)
    cap = 1 if mode == "graph" else max(1, max_per_pair)
    counts: dict[tuple[int, int], int] = {}
    out: list[Triplet] = []
    for p in ranked:
        key = (p.subject_id, p.object_id)
        if counts.get(key, 0) >= cap:
            continue
        counts[key] = counts.get(key, 0) + 1
        out.append(p)
    return out
