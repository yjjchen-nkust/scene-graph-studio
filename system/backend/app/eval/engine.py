from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.eval.constraint import apply_constraint, has_ties, rank
from app.eval.match import to_triplets
from app.eval.metrics import assign, mean_recall_at_k, recall_at_k, zero_shot_recall_at_k
from app.eval.pairing import apply_pairing
from app.schema import Constraint, MaskPairing, Protocol, SceneGraph, Strict

WARNINGS: dict[str, tuple[str, str]] = {
    "gt_boxes_not_pairs": (
        "PredCls and SGCls supply ground-truth boxes, not ground-truth pairs.",
        "PredCls 與 SGCls 提供的是 ground-truth boxes，不是 ground-truth pairs。",
    ),
    "empty_ground_truth": (
        "There is no ground truth; recall is undefined.",
        "沒有 ground truth，recall 無定義。",
    ),
    "empty_prediction": ("No predictions were supplied.", "未提供任何預測。"),
    "ties_broken_by_index": (
        "Two or more predictions share a score; ties break by relationship_id ascending.",
        "有預測分數相同，並列時依 relationship_id 由小至大排序。",
    ),
    "masks_ignored": (
        "One graph carries masks and the other does not; boxes were used.",
        "僅一方帶有 mask，故改用 box 計算。",
    ),
    "zero_shot_unavailable": (
        "No training split was supplied, so zero-shot recall is not computed.",
        "未提供訓練集三元組，因此不計算 zero-shot recall。",
    ),
}

VALID_K = (20, 50, 100)


class EvalRequest(Strict):
    gt: SceneGraph
    pred: SceneGraph
    protocol: Protocol
    constraint: Constraint
    k: list[int] = Field(default_factory=lambda: list(VALID_K))
    iou_thresh: float = Field(default=0.5, ge=0.0, le=1.0)
    mask_pairing: MaskPairing = "single_mpo"
    zero_shot_train_triplets: list[tuple[str, str, str]] | None = None
    semi_constraint_max_per_pair: int = Field(default=2, ge=1)

    @field_validator("k")
    @classmethod
    def _k_is_a_known_cutoff(cls, v: list[int]) -> list[int]:
        unknown = sorted(set(v) - set(VALID_K))
        if unknown:
            raise ValueError(f"k must be drawn from {list(VALID_K)}; got {unknown}")
        if not v:
            raise ValueError("k must not be empty")
        return sorted(set(v))


class MetricValue(BaseModel):
    value: float | None
    metric: str
    k: int
    protocol: Protocol
    constraint: Constraint
    source: str = "engine"
    verified: bool = True
    fidelity: str = "measured"


def _warn(code: str) -> dict[str, str]:
    en, zh = WARNINGS[code]
    return {"code": code, "message_en": en, "message_zh": zh}


def evaluate(req: EvalRequest) -> dict[str, Any]:
    gts = to_triplets(req.gt)
    preds = to_triplets(req.pred)
    # Pairing sits between ranking and constraint filtering, so the survivor at each mask pair is
    # the highest-scoring one and both pools below inherit the cap. E13.
    ranked = apply_pairing(rank(preds), req.mask_pairing)
    ks = sorted(req.k)

    gt_masked = any(o.mask for o in req.gt.objects)
    pred_masked = any(o.mask for o in req.pred.objects)
    use_masks = gt_masked and pred_masked

    constrained = apply_constraint(ranked, req.constraint, req.semi_constraint_max_per_pair)
    unconstrained = apply_constraint(ranked, "none", 1)
    train = set(req.zero_shot_train_triplets or [])

    metrics: list[MetricValue] = []
    per_predicate: dict[str, dict[str, Any]] = {}
    for gt in gts:
        row = per_predicate.setdefault(
            gt.predicate, {"predicate": gt.predicate, "gt_count": 0, "matched": {}}
        )
        row["gt_count"] += 1

    widest = assign(constrained, gts, max(ks), req.iou_thresh, use_masks)

    for k in ks:
        a = assign(constrained, gts, k, req.iou_thresh, use_masks)
        ng = assign(unconstrained, gts, k, req.iou_thresh, use_masks)
        tag = {"k": k, "protocol": req.protocol, "constraint": req.constraint}
        metrics.append(MetricValue(value=recall_at_k(a, k), metric="R", **tag))
        metrics.append(MetricValue(value=mean_recall_at_k(a, k), metric="mR", **tag))
        metrics.append(MetricValue(value=recall_at_k(ng, k), metric="ngR", **tag))
        metrics.append(
            MetricValue(
                value=zero_shot_recall_at_k(a, gts, train, k) if train else None,
                metric="zR",
                **tag,
            )
        )
        for i, gt in enumerate(gts):
            at = a.matched_at[i]
            row = per_predicate[gt.predicate]
            row["matched"][str(k)] = row["matched"].get(str(k), 0) + (
                1 if at is not None and at <= k else 0
            )

    verdict_rows: list[dict[str, Any]] = []
    matched_gt_indices: set[int] = set()
    for position, (pred_index, verdict, gi, ious, iuo) in enumerate(widest.verdicts, start=1):
        if verdict == "match" and gi is not None:
            matched_gt_indices.add(gi)
        verdict_rows.append(
            {
                "pred_index": pred_index,
                "gt_index": gi,
                "verdict": verdict,
                "iou_subject": ious,
                "iou_object": iuo,
                "rank": position,
                "entered_top_k": {str(k): position <= k for k in ks},
            }
        )
    for gi in range(len(gts)):
        if gi not in matched_gt_indices:
            verdict_rows.append(
                {
                    "pred_index": -1,
                    "gt_index": gi,
                    "verdict": "missed",
                    "iou_subject": None,
                    "iou_object": None,
                    "rank": 0,
                    "entered_top_k": {str(k): False for k in ks},
                }
            )

    warnings: list[dict[str, str]] = []
    if req.protocol in ("predcls", "sgcls"):
        warnings.append(_warn("gt_boxes_not_pairs"))
    if not gts:
        warnings.append(_warn("empty_ground_truth"))
    if not preds:
        warnings.append(_warn("empty_prediction"))
    if has_ties(preds):
        warnings.append(_warn("ties_broken_by_index"))
    if gt_masked != pred_masked:
        warnings.append(_warn("masks_ignored"))
    if not train:
        warnings.append(_warn("zero_shot_unavailable"))

    return {
        "metrics": [m.model_dump() for m in metrics],
        "verdicts": verdict_rows,
        "matched_count": sum(1 for m in widest.matched_gt if m),
        "gt_count": len(gts),
        "pred_count_considered": len(constrained),
        "per_predicate": list(per_predicate.values()),
        "warnings": warnings,
        "params_echo": req.model_dump(),
    }
