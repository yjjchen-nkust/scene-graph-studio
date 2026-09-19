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
    """Filter a ranked list. The pair key is the ORDERED (subject, object) class pair."""
    if mode == "none":
        return list(ranked)
    cap = 1 if mode == "graph" else max(1, max_per_pair)
    counts: dict[tuple[str, str], int] = {}
    out: list[Triplet] = []
    for p in ranked:
        key = (p.subject_name, p.object_name)
        if counts.get(key, 0) >= cap:
            continue
        counts[key] = counts.get(key, 0) + 1
        out.append(p)
    return out
