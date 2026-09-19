"""Build data/golden/vectors.json.

This script constructs the *graphs*. Every number under `expect` is hand-computed from the
definitions in SRS section 4 and written here as a literal, before the engine was run against
it. Engine output is never pasted into an expectation; the arithmetic for each case is written
out in its `why` field so a reader can check it on paper.

Re-running this script must be a no-op unless a case is deliberately changed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.eval.rle import encode_counts  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402

Box = tuple[float, float, float, float]


def obj(oid: int, name: str, box: Box, mask_counts: list[int] | None = None) -> dict[str, Any]:
    o: dict[str, Any] = {
        "object_id": oid,
        "names": [name],
        "bbox": {"x": box[0], "y": box[1], "w": box[2], "h": box[3]},
    }
    if mask_counts is not None:
        o["mask"] = {"counts": encode_counts(mask_counts), "size": [4, 4]}
    return o


def rel(rid: int, s: int, p: str, o: int, score: float | None = None) -> dict[str, Any]:
    r: dict[str, Any] = {
        "relationship_id": rid,
        "subject_id": s,
        "object_id": o,
        "predicate": p,
    }
    if score is not None:
        r["score"] = score
    return r


def graph(image_id: str, objects: list[dict], rels: list[dict], kind: str) -> dict[str, Any]:
    return {
        "image_id": image_id,
        "dataset": "vg150-sgb",
        "width": 200,
        "height": 200,
        "objects": objects,
        "relationships": rels,
        "provenance": (
            {"kind": "ground_truth", "fidelity": "measured"}
            if kind == "gt"
            else {"kind": "model", "fidelity": "measured", "model": "fixture"}
        ),
    }


P_NONE = {
    "protocol": "predcls",
    "constraint": "none",
    "k": [20],
    "iou_thresh": 0.5,
    "mask_pairing": "single_mpo",
}
P_GRAPH = {**P_NONE, "constraint": "graph"}

PERSON = (0.0, 0.0, 10.0, 10.0)
TABLE = (20.0, 20.0, 10.0, 10.0)

cases: list[dict[str, Any]] = []


# ---------------------------------------------------------------- gv-001
cases.append({
    "id": "gv-001-trivial-exact-match",
    "why": (
        "One GT, one identical prediction. Subject IoU 1.0, object IoU 1.0, classes and "
        "predicate agree, so the match relation holds on all five conjuncts. "
        "R = 1/1 = 1. One predicate class 'on' with 1 GT and 1 hit, so mR = 1/1 = 1. "
        "No constraint filtering applies to a single pair, so ngR = R. "
        "No training split supplied, so zR is null."
    ),
    "hand_checked": True,
    "gt": graph("gv1", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                [rel(1, 1, "on", 2)], "gt"),
    "pred": graph("gv1", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                  [rel(1, 1, "on", 2, 0.9)], "pred"),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": 1.0}, "mR": {"20": 1.0}, "ngR": {"20": 1.0}, "zR": {"20": None},
        "verdicts": [{"pred_index": 0, "verdict": "match"}],
        "warnings": ["gt_boxes_not_pairs", "zero_shot_unavailable"],
    },
})


# ---------------------------------------------------------------- gv-002
cases.append({
    "id": "gv-002-empty-ground-truth",
    "why": (
        "GT carries objects but no relationships. Recall is |matched| / |GT| and |GT| = 0, so "
        "every metric is undefined and must be null -- never 0, which would read as 'the model "
        "scored nothing' rather than 'the question does not apply'. The prediction cannot match "
        "anything, so it is spurious."
    ),
    "hand_checked": True,
    "gt": graph("gv2", [obj(1, "person", PERSON), obj(2, "table", TABLE)], [], "gt"),
    "pred": graph("gv2", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                  [rel(1, 1, "on", 2, 0.9)], "pred"),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": None}, "mR": {"20": None}, "ngR": {"20": None}, "zR": {"20": None},
        "verdicts": [{"pred_index": 0, "verdict": "spurious"}],
        "warnings": ["empty_ground_truth"],
    },
})


# ---------------------------------------------------------------- gv-003
BOX3 = (40.0, 40.0, 10.0, 10.0)
cases.append({
    "id": "gv-003-empty-prediction",
    "why": (
        "Three GT relationships, no predictions. R = 0/3 = 0. Predicate classes present in GT "
        "are 'on' (2 instances, 0 hits) and 'near' (1 instance, 0 hits), so "
        "mR = (0/2 + 0/1)/2 = 0. Every GT is reported missed."
    ),
    "hand_checked": True,
    "gt": graph("gv3", [obj(1, "person", PERSON), obj(2, "table", TABLE), obj(3, "box", BOX3)],
                [rel(1, 1, "on", 2), rel(2, 3, "on", 2), rel(3, 1, "near", 3)], "gt"),
    "pred": graph("gv3", [obj(1, "person", PERSON), obj(2, "table", TABLE), obj(3, "box", BOX3)],
                  [], "pred"),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": 0.0}, "mR": {"20": 0.0}, "ngR": {"20": 0.0}, "zR": {"20": None},
        "verdicts": [{"pred_index": -1, "verdict": "missed"}],
        "warnings": ["empty_prediction"],
    },
})


# ---------------------------------------------------------------- gv-004
cases.append({
    "id": "gv-004-all-tied-scores",
    "why": (
        "Two predictions of the same triplet, both scoring 0.5, submitted in the order "
        "relationship_id 7 then 3. The tie-break is (-score, relationship_id) ascending, so "
        "rid 3 -- submitted second, at pred_index 1 -- ranks first and takes the single GT; "
        "rid 7 then finds it consumed and is reported localization. Reversing the tie-break "
        "would swap the two verdicts, which is why the verdicts and not only the metrics are "
        "pinned here. Both subject boxes clear tau: IoU((0,0,10,10),(1,1,10,10)) = 81/119 = "
        "0.6807. R = 1/1 = 1, mR = 1, ngR = 1."
    ),
    "hand_checked": True,
    "gt": graph("gv4", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                [rel(1, 1, "on", 2)], "gt"),
    "pred": graph(
        "gv4",
        [obj(1, "person", PERSON), obj(2, "table", TABLE),
         obj(3, "person", (1.0, 1.0, 10.0, 10.0))],
        [rel(7, 1, "on", 2, 0.5), rel(3, 3, "on", 2, 0.5)],
        "pred",
    ),
    "params": dict(P_NONE),
    "expect": {
        "R": {"20": 1.0}, "mR": {"20": 1.0}, "ngR": {"20": 1.0}, "zR": {"20": None},
        "verdicts": [
            {"pred_index": 1, "verdict": "match"},
            {"pred_index": 0, "verdict": "localization"},
        ],
        "warnings": ["ties_broken_by_index"],
    },
})


# ---------------------------------------------------------------- gv-005
cases.append({
    "id": "gv-005-duplicate-predictions",
    "why": (
        "The same triplet predicted twice at 0.9 and 0.8 against three GT relationships. "
        "Assignment is one-to-one, so the GT is credited once: R = 1/3. The second copy finds "
        "its only candidate consumed and is reported localization, not a second match. "
        "Predicate classes: 'on' has 2 GT and 1 hit, 'near' has 1 GT and 0 hits, so "
        "mR = (1/2 + 0/1)/2 = 0.25."
    ),
    "hand_checked": True,
    "gt": graph("gv5", [obj(1, "person", PERSON), obj(2, "table", TABLE), obj(3, "box", BOX3)],
                [rel(1, 1, "on", 2), rel(2, 3, "on", 2), rel(3, 1, "near", 3)], "gt"),
    "pred": graph("gv5", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                  [rel(1, 1, "on", 2, 0.9), rel(2, 1, "on", 2, 0.8)], "pred"),
    "params": dict(P_NONE),
    "expect": {
        "R": {"20": 1 / 3}, "mR": {"20": 0.25}, "ngR": {"20": 1 / 3}, "zR": {"20": None},
        "verdicts": [
            {"pred_index": 0, "verdict": "match"},
            {"pred_index": 1, "verdict": "localization"},
        ],
    },
})


# ---------------------------------------------------------------- gv-006
cases.append({
    "id": "gv-006-iou-exactly-at-threshold",
    "why": (
        "The match relation is IoU >= tau, so tau itself must match. The construction must land "
        "on 0.5 with no rounding: a 10x20 predicted subject box containing the 10x10 GT subject "
        "box gives inter = 100, union = 100 + 200 - 100 = 200, IoU = 0.5 exactly. Offsetting two "
        "10x10 boxes by 10/3 does NOT -- it yields 0.4999999999999999 and silently tests the "
        "wrong side of the boundary (deviation D4). Object boxes are identical, IoU 1.0. "
        "Verdict match, so R = mR = ngR = 1."
    ),
    "hand_checked": True,
    "gt": graph("gv6", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                [rel(1, 1, "on", 2)], "gt"),
    "pred": graph("gv6", [obj(1, "person", (0.0, 0.0, 10.0, 20.0)), obj(2, "table", TABLE)],
                  [rel(1, 1, "on", 2, 0.9)], "pred"),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": 1.0}, "mR": {"20": 1.0}, "ngR": {"20": 1.0}, "zR": {"20": None},
        "verdicts": [{"pred_index": 0, "verdict": "match"}],
    },
})


# ---------------------------------------------------------------- gv-007
gv7_objs = (
    [obj(i, "a", PERSON) for i in range(1, 10)]
    + [obj(10, "b", TABLE), obj(11, "c", BOX3), obj(12, "d", (60.0, 60.0, 10.0, 10.0))]
)
cases.append({
    "id": "gv-007-single-instance-predicate-class",
    "why": (
        "Nine GT instances of 'on' and one of 'rare'. All nine 'on' are predicted; 'rare' is not. "
        "R = 9/10 = 0.9, weighted by how often each class occurs. mR averages the per-class "
        "recalls without weighting: (9/9 + 0/1)/2 = 0.5. The single-instance class weighs exactly "
        "as much as the nine-instance one, which is the whole reason mean Recall exists and the "
        "denominator trap SRS section 8 names. Constraint is 'none' deliberately: every "
        "relationship here is the ordered class pair (a, b), so the graph constraint would "
        "collapse all nine predictions to one."
    ),
    "hand_checked": True,
    "gt": graph("gv7", gv7_objs,
                [rel(i, i, "on", 10) for i in range(1, 10)] + [rel(10, 11, "rare", 12)], "gt"),
    "pred": graph("gv7", gv7_objs,
                  [rel(i, i, "on", 10, 0.9 - (i - 1) / 100) for i in range(1, 10)], "pred"),
    "params": dict(P_NONE),
    "expect": {
        "R": {"20": 0.9}, "mR": {"20": 0.5}, "ngR": {"20": 0.9}, "zR": {"20": None},
    },
})


# ---------------------------------------------------------------- gv-008
cases.append({
    "id": "gv-008-greedy-vs-maximum-matching",
    "why": (
        "The adversarial fixture SRS section 11.2 requires: score-ordered greedy matching is an "
        "ASSUMPTION, not a theorem, and this case discharges it rather than asserting it. "
        "Two GT triplets share the class signature (a, on, b) and differ only in the object box: "
        "GT-A at (0,0,10,10) and GT-B at (6,0,10,10), whose mutual IoU is 40/160 = 0.25. "
        "P1 (score 0.9) has object box (3,0,10,10), whose IoU is 70/130 = 0.5385 against BOTH, so "
        "it can match either. P2 (score 0.8) has object box (0,0,10,10): IoU 1.0 against GT-A but "
        "0.25 against GT-B, so it can match only GT-A. Greedy takes P1 first and gives it GT-A "
        "(the lowest unused index), leaving P2 with nothing: R = 1/2 = 0.5. A maximum bipartite "
        "matching would pair P1 with GT-B and P2 with GT-A and score 2/2 = 1.0. The engine "
        "records the greedy answer, and this case is what makes the gap visible rather than "
        "hidden. mR = 1/2 over the single class 'on'."
    ),
    "hand_checked": True,
    "gt": graph(
        "gv8",
        [obj(1, "a", PERSON), obj(2, "b", (0.0, 0.0, 10.0, 10.0)),
         obj(3, "b", (6.0, 0.0, 10.0, 10.0))],
        [rel(1, 1, "on", 2), rel(2, 1, "on", 3)],
        "gt",
    ),
    "pred": graph(
        "gv8",
        [obj(1, "a", PERSON), obj(2, "b", (3.0, 0.0, 10.0, 10.0)),
         obj(3, "b", (0.0, 0.0, 10.0, 10.0))],
        [rel(1, 1, "on", 2, 0.9), rel(2, 1, "on", 3, 0.8)],
        "pred",
    ),
    "params": dict(P_NONE),
    "expect": {
        "R": {"20": 0.5}, "mR": {"20": 0.5}, "ngR": {"20": 0.5}, "zR": {"20": None},
        "verdicts": [
            {"pred_index": 0, "verdict": "match"},
            {"pred_index": 1, "verdict": "localization"},
        ],
    },
})


# ---------------------------------------------------------------- gv-009
cases.append({
    "id": "gv-009-mask-iou",
    "why": (
        "Both graphs carry COCO RLE masks on a 4x4 canvas, so mask IoU substitutes for box IoU "
        "(SRS section 4.1). GT subject mask covers pixels 0-7 (counts 0,8,8); predicted subject "
        "mask covers pixels 4-11 (counts 4,8,4). Intersection 4, union 12, IoU = 1/3 < 0.5, so "
        "the localization conjunct fails and the verdict is localization. The BOXES are identical "
        "in both graphs, so a build that quietly ignored masks would score this a match and R = 1 "
        "-- which is exactly what this case exists to catch. R = mR = ngR = 0."
    ),
    "hand_checked": True,
    "gt": graph(
        "gv9",
        [obj(1, "person", PERSON, [0, 8, 8]), obj(2, "table", TABLE, [2, 3, 11])],
        [rel(1, 1, "on", 2)],
        "gt",
    ),
    "pred": graph(
        "gv9",
        [obj(1, "person", PERSON, [4, 8, 4]), obj(2, "table", TABLE, [2, 3, 11])],
        [rel(1, 1, "on", 2, 0.9)],
        "pred",
    ),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": 0.0}, "mR": {"20": 0.0}, "ngR": {"20": 0.0}, "zR": {"20": None},
        "verdicts": [{"pred_index": 0, "verdict": "localization"}],
    },
})


# ---------------------------------------------------------------- gv-010
cases.append({
    "id": "gv-010-constraint-gap",
    "why": (
        "One ordered pair (person, table) with two predicted predicates, the wrong one scoring "
        "higher: 'near' at 0.9 and the correct 'on' at 0.8. The graph constraint admits at most "
        "one predicate per ordered pair and keeps the arg-max, so only 'near' survives and "
        "R = 0/1 = 0. ng-R is computed on the unconstrained pool by definition, where 'on' "
        "survives and matches, so ngR = 1/1 = 1. The gap between 0 and 1 on identical predictions "
        "is the constraint effect, and this is the fixture plan 04's verification item 3 leans "
        "on. mR follows R at 0, because the only GT class is 'on'."
    ),
    "hand_checked": True,
    "gt": graph("gv10", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                [rel(1, 1, "on", 2)], "gt"),
    "pred": graph("gv10", [obj(1, "person", PERSON), obj(2, "table", TABLE)],
                  [rel(1, 1, "near", 2, 0.9), rel(2, 1, "on", 2, 0.8)], "pred"),
    "params": dict(P_GRAPH),
    "expect": {
        "R": {"20": 0.0}, "mR": {"20": 0.0}, "ngR": {"20": 1.0}, "zR": {"20": None},
        "verdicts": [{"pred_index": 0, "verdict": "spurious"}],
    },
})


# ---------------------------------------------------------------- gv-011
cases.append({
    "id": "gv-011-zero-shot-recall",
    "why": (
        "Added beyond the ten the plan required, because no other case exercises zR with a "
        "non-null value and an always-null metric is not a tested metric. Three GT triplets; the "
        "training split contains (a,on,b) and (c,on,d), so only (e,under,f) is zero-shot and the "
        "zR denominator is 1, not 3. Predictions match (a,on,b) and (e,under,f). "
        "R = 2/3. mR over classes 'on' (2 GT, 1 hit) and 'under' (1 GT, 1 hit) = (0.5 + 1)/2 = "
        "0.75. zR = 1/1 = 1.0: the model got the only unseen triplet right, which R alone hides."
    ),
    "hand_checked": True,
    "gt": graph(
        "gv11",
        [obj(1, "a", PERSON), obj(2, "b", TABLE), obj(3, "c", BOX3),
         obj(4, "d", (60.0, 60.0, 10.0, 10.0)), obj(5, "e", (80.0, 80.0, 10.0, 10.0)),
         obj(6, "f", (100.0, 100.0, 10.0, 10.0))],
        [rel(1, 1, "on", 2), rel(2, 3, "on", 4), rel(3, 5, "under", 6)],
        "gt",
    ),
    "pred": graph(
        "gv11",
        [obj(1, "a", PERSON), obj(2, "b", TABLE),
         obj(5, "e", (80.0, 80.0, 10.0, 10.0)), obj(6, "f", (100.0, 100.0, 10.0, 10.0))],
        [rel(1, 1, "on", 2, 0.9), rel(2, 5, "under", 6, 0.8)],
        "pred",
    ),
    "params": {**P_NONE, "zero_shot_train_triplets": [["a", "on", "b"], ["c", "on", "d"]]},
    "expect": {
        "R": {"20": 2 / 3}, "mR": {"20": 0.75}, "ngR": {"20": 2 / 3}, "zR": {"20": 1.0},
    },
})


out = DATA_DIR / "golden" / "vectors.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps({"$schema_version": 1, "cases": cases}, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"wrote {len(cases)} cases to {out}")
