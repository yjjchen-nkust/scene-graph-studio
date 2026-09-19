"""Mask-instance pairing: the one place single_mpo and multi_mpo differ.

The rule is knowledge point E13, stated there as

    SingleMPO: |{m : pi(m) = (s,o)}| = 1
    MultiMPO : |{m : pi(m) = (s,o)}| = d >= 1 permitted

so the unit that is capped is a *prediction at an ordered pair of instances*, and an instance in
a mask-annotated corpus is its mask. A one-stage model emits duplicate masks freely, so d > 1
costs it nothing and pays; a two-stage model emits one mask per instance, so d = 1 either way.
Measured on PSG by the ECCV 2024 correction: PSGTR 20.8 -> 11.62, HiLo 30.3 -> 18.33, VCTree
approximately unchanged.
"""

from __future__ import annotations

from app.eval.constraint import rank
from app.eval.engine import EvalRequest, evaluate
from app.eval.match import Triplet
from app.eval.pairing import apply_pairing
from app.eval.rle import encode_counts
from app.schema import BBox, RLEMask, SceneGraph

B = BBox(x=0, y=0, w=4, h=4)
SIZE = (4, 4)


def mask(offset: int) -> RLEMask:
    """A distinct four-pixel run, so two masks are equal exactly when `offset` is."""
    return RLEMask(counts=encode_counts([offset, 4, 16 - offset - 4]), size=SIZE)


SUBJ, OBJ, OTHER = mask(0), mask(4), mask(8)


def t(
    rid: int,
    predicate: str,
    score: float,
    *,
    s_mask: RLEMask | None = SUBJ,
    o_mask: RLEMask | None = OBJ,
    subject: str = "person",
    obj: str = "table",
) -> Triplet:
    return Triplet(
        index=rid,
        relationship_id=rid,
        subject_name=subject,
        predicate=predicate,
        object_name=obj,
        subject_bbox=B,
        object_bbox=B,
        subject_mask=s_mask,
        object_mask=o_mask,
        score=score,
    )


def test_single_mpo_admits_one_prediction_per_ordered_mask_pair():
    preds = [t(1, "on", 0.9), t(2, "near", 0.8), t(3, "on", 0.7, o_mask=OTHER)]
    assert len(apply_pairing(rank(preds), "single_mpo")) == 2


def test_multi_mpo_admits_every_one_of_them():
    preds = [t(1, "on", 0.9), t(2, "near", 0.8), t(3, "on", 0.7, o_mask=OTHER)]
    assert len(apply_pairing(rank(preds), "multi_mpo")) == 3


def test_single_mpo_keeps_the_highest_scoring_prediction_at_the_pair():
    kept = apply_pairing(rank([t(1, "near", 0.4), t(2, "on", 0.9)]), "single_mpo")
    assert [p.score for p in kept] == [0.9]


def test_the_pair_is_the_mask_instance_and_not_the_class_name():
    """E13's pi is defined on instances. Two labels for one mask are two hypotheses about one
    thing, so the cap applies to them as much as to two predicates."""
    preds = [t(1, "on", 0.9, subject="person"), t(2, "on", 0.8, subject="man")]
    assert len(apply_pairing(rank(preds), "single_mpo")) == 1


def test_a_prediction_missing_either_mask_passes_through_untouched():
    """pi is undefined without both masks, so the cap has nothing to apply to."""
    preds = [t(1, "on", 0.9, s_mask=None), t(2, "near", 0.8, s_mask=None)]
    assert len(apply_pairing(rank(preds), "single_mpo")) == 2


def test_boxes_only_graphs_are_unaffected_by_the_pairing_mode():
    preds = [t(1, "on", 0.9, s_mask=None, o_mask=None), t(2, "near", 0.8, s_mask=None, o_mask=None)]
    ranked = rank(preds)
    assert apply_pairing(ranked, "single_mpo") == apply_pairing(ranked, "multi_mpo")


# ── the engine, end to end ────────────────────────────────────────────────────────────────────


def graph(image_id: str, rels: list[tuple[int, int, int, str, float | None]], *, kind: str
          ) -> SceneGraph:
    return SceneGraph(
        image_id=image_id,
        dataset="placeholder",
        width=4,
        height=4,
        objects=[
            {"object_id": 1, "names": ["person"], "bbox": B, "mask": SUBJ},
            {"object_id": 2, "names": ["table"], "bbox": B, "mask": OBJ},
            {"object_id": 3, "names": ["cup"], "bbox": B, "mask": OTHER},
        ],
        relationships=[
            {"relationship_id": r, "subject_id": s, "object_id": o, "predicate": p, "score": sc}
            for r, s, o, p, sc in rels
        ],
        provenance={"kind": kind, "fidelity": "measured"},
    )


GT = graph(
    "img",
    [(1, 1, 2, "on", None), (2, 1, 2, "near", None)],
    kind="ground_truth",
)


def recall_under(pred: SceneGraph, mode: str) -> float | None:
    out = evaluate(
        EvalRequest(
            gt=GT,
            pred=pred,
            protocol="sgdet",
            constraint="none",
            k=[20],
            iou_thresh=0.5,
            mask_pairing=mode,
        )
    )
    hit = next(m for m in out["metrics"] if m["metric"] == "R" and m["k"] == 20)
    return hit["value"]


ONE_STAGE = graph(
    "img",
    [(1, 1, 2, "on", 0.9), (2, 1, 2, "near", 0.8), (3, 1, 2, "under", 0.7)],
    kind="model",
)
TWO_STAGE = graph("img", [(1, 1, 2, "on", 0.9), (2, 1, 3, "near", 0.8)], kind="model")


def test_a_one_stage_style_model_loses_recall_under_the_correction():
    assert recall_under(ONE_STAGE, "multi_mpo") == 1.0
    assert recall_under(ONE_STAGE, "single_mpo") == 0.5


def test_a_two_stage_style_model_is_unchanged():
    assert recall_under(TWO_STAGE, "multi_mpo") == recall_under(TWO_STAGE, "single_mpo")


def test_the_graph_constraint_already_caps_what_single_mpo_would_cap():
    """Under `graph` the constrained pool is one prediction per ordered *class* pair, which is
    coarser than one per mask pair, so R cannot move. ngR reads the unconstrained pool and does.
    This is why the correction shows up on the no-constraint numbers PSG leaderboards quote."""
    out = {
        mode: evaluate(
            EvalRequest(
                gt=GT,
                pred=ONE_STAGE,
                protocol="sgdet",
                constraint="graph",
                k=[20],
                iou_thresh=0.5,
                mask_pairing=mode,
            )
        )
        for mode in ("single_mpo", "multi_mpo")
    }
    value = {m: {x["metric"]: x["value"] for x in o["metrics"]} for m, o in out.items()}
    assert value["single_mpo"]["R"] == value["multi_mpo"]["R"]
    assert value["single_mpo"]["ngR"] < value["multi_mpo"]["ngR"]
