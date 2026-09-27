from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.eval.iou import box_iou
from app.eval.rle import mask_iou
from app.schema import BBox, RLEMask, SceneGraph

Verdict = Literal["match", "spurious", "localization", "missed"]


@dataclass(frozen=True)
class Triplet:
    index: int
    relationship_id: int
    subject_id: int
    object_id: int
    subject_name: str
    predicate: str
    object_name: str
    subject_bbox: BBox
    object_bbox: BBox
    subject_mask: RLEMask | None
    object_mask: RLEMask | None
    score: float | None

    @property
    def classes(self) -> tuple[str, str, str]:
        return (self.subject_name, self.predicate, self.object_name)


def to_triplets(graph: SceneGraph) -> list[Triplet]:
    out: list[Triplet] = []
    for i, r in enumerate(graph.relationships):
        s, o = graph.object_by_id(r.subject_id), graph.object_by_id(r.object_id)
        out.append(
            Triplet(
                index=i,
                relationship_id=r.relationship_id,
                subject_id=r.subject_id,
                object_id=r.object_id,
                subject_name=s.name,
                predicate=r.predicate,
                object_name=o.name,
                subject_bbox=s.bbox,
                object_bbox=o.bbox,
                subject_mask=s.mask,
                object_mask=o.mask,
                score=r.score,
            )
        )
    return out


def _overlap(
    a_box: BBox,
    b_box: BBox,
    a_mask: RLEMask | None,
    b_mask: RLEMask | None,
    use_masks: bool,
) -> float:
    if use_masks and a_mask is not None and b_mask is not None:
        return mask_iou(a_mask, b_mask)
    return box_iou(a_box, b_box)


MatchOutcome = tuple[Verdict, int | None, float | None, float | None]


def classify(
    pred: Triplet,
    gts: list[Triplet],
    used: list[bool],
    iou_thresh: float,
    use_masks: bool,
) -> MatchOutcome:
    """Classify one prediction against the ground truth. Does not mutate `used`.

    Returns (verdict, gt_index, iou_subject, iou_object). The caller consumes the ground
    truth only on a 'match'.

    Among ground-truth triplets that are unused and satisfy all five conjuncts, the one with
    the lowest ground-truth index wins. If none satisfies all five but at least one agrees on
    subject class, object class and predicate, the verdict is 'localization' and the reported
    IoUs come from the candidate with the highest min(iou_subject, iou_object); that ground
    truth is not consumed. Otherwise the verdict is 'spurious'. SRS 4.2 makes this order part
    of the specification because it is observable in the diff view.
    """
    best_loc: tuple[float, int, float, float] | None = None
    for gi, gt in enumerate(gts):
        if pred.classes != gt.classes:
            continue
        ious = _overlap(
            pred.subject_bbox, gt.subject_bbox, pred.subject_mask, gt.subject_mask, use_masks
        )
        iuo = _overlap(
            pred.object_bbox, gt.object_bbox, pred.object_mask, gt.object_mask, use_masks
        )
        if not used[gi] and ious >= iou_thresh and iuo >= iou_thresh:
            return ("match", gi, ious, iuo)
        weakest = min(ious, iuo)
        if best_loc is None or weakest > best_loc[0]:
            best_loc = (weakest, gi, ious, iuo)
    if best_loc is not None:
        _, gi, ious, iuo = best_loc
        return ("localization", gi, ious, iuo)
    return ("spurious", None, None, None)
