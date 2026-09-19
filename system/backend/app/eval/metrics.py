from __future__ import annotations

from dataclasses import dataclass, field

from app.eval.match import Triplet, Verdict, classify


@dataclass
class Assignment:
    gts: list[Triplet]
    matched_gt: list[bool]
    verdicts: list[tuple[int, Verdict, int | None, float | None, float | None]]
    matched_at: list[int | None] = field(default_factory=list)
    """matched_at[i] is the 1-based rank at which gt i was matched, else None."""


def assign(
    ranked_preds: list[Triplet],
    gts: list[Triplet],
    k: int,
    iou_thresh: float,
    use_masks: bool,
) -> Assignment:
    """Greedy one-to-one assignment over the top-k of a ranked prediction list."""
    used = [False] * len(gts)
    matched_at: list[int | None] = [None] * len(gts)
    verdicts: list[tuple[int, Verdict, int | None, float | None, float | None]] = []
    for position, pred in enumerate(ranked_preds[:k], start=1):
        verdict, gi, ious, iuo = classify(pred, gts, used, iou_thresh, use_masks)
        if verdict == "match" and gi is not None:
            used[gi] = True
            matched_at[gi] = position
        verdicts.append((pred.index, verdict, gi, ious, iuo))
    return Assignment(gts=gts, matched_gt=used, verdicts=verdicts, matched_at=matched_at)


def recall_at_k(a: Assignment, k: int) -> float | None:
    """R@K. None -- not zero -- when there is no ground truth to recall."""
    if not a.gts:
        return None
    hit = sum(1 for m in a.matched_at if m is not None and m <= k)
    return hit / len(a.gts)


def mean_recall_at_k(a: Assignment, k: int) -> float | None:
    """mR@K: R@K per predicate class, averaged unweighted over classes present in the GT."""
    if not a.gts:
        return None
    totals: dict[str, int] = {}
    hits: dict[str, int] = {}
    for i, gt in enumerate(a.gts):
        totals[gt.predicate] = totals.get(gt.predicate, 0) + 1
        at = a.matched_at[i]
        if at is not None and at <= k:
            hits[gt.predicate] = hits.get(gt.predicate, 0) + 1
    per_class = [hits.get(p, 0) / n for p, n in totals.items()]
    return sum(per_class) / len(per_class)


def zero_shot_recall_at_k(
    a: Assignment,
    gts: list[Triplet],
    train_triplets: set[tuple[str, str, str]],
    k: int,
) -> float | None:
    """zR@K: R@K restricted to GT triplet types absent from the training split."""
    zero_shot = [i for i, gt in enumerate(gts) if gt.classes not in train_triplets]
    if not zero_shot:
        return None
    hit = sum(1 for i in zero_shot if (at := a.matched_at[i]) is not None and at <= k)
    return hit / len(zero_shot)
