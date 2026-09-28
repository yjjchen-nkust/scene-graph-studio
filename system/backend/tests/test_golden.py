from __future__ import annotations

import json

import pytest

from app.eval.engine import EvalRequest, evaluate
from app.settings import DATA_DIR

CASES = json.loads(
    (DATA_DIR / "golden" / "vectors.json").read_text(encoding="utf-8")
)["cases"]
TOL = 1e-9

REQUIRED_IDS = {
    "gv-001-trivial-exact-match",
    "gv-002-empty-ground-truth",
    "gv-003-empty-prediction",
    "gv-004-all-tied-scores",
    "gv-005-duplicate-predictions",
    "gv-006-iou-exactly-at-threshold",
    "gv-007-single-instance-predicate-class",
    "gv-008-greedy-vs-maximum-matching",
    "gv-009-mask-iou",
    "gv-010-constraint-gap",
}


def test_every_required_case_is_present():
    assert REQUIRED_IDS <= {c["id"] for c in CASES}


def test_every_case_is_hand_checked():
    assert [c["id"] for c in CASES if not c.get("hand_checked")] == []


def test_every_case_says_why_it_exists():
    assert [c["id"] for c in CASES if not c.get("why")] == []


def test_every_case_lists_its_warnings():
    # A case that lists none would leave the engine's warnings unchecked (D103).
    assert [c["id"] for c in CASES if "warnings" not in c["expect"]] == []


def test_every_case_derives_its_warnings_in_why():
    # The list is computed on paper like every other expectation, so its derivation is written
    # out, naming each warning it lists (D103's review).
    assert [
        c["id"]
        for c in CASES
        if "Warnings:" not in c["why"] or any(w not in c["why"] for w in c["expect"]["warnings"])
    ] == []


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_engine_matches_the_hand_computed_expectation(case):
    body = evaluate(
        EvalRequest.model_validate({"gt": case["gt"], "pred": case["pred"], **case["params"]})
    )
    got = {(m["metric"], str(m["k"])): m["value"] for m in body["metrics"]}
    for metric, by_k in case["expect"].items():
        if metric in ("verdicts", "warnings"):
            continue
        for k, want in by_k.items():
            have = got[(metric, k)]
            if want is None:
                assert have is None, f"{case['id']} {metric}@{k}: expected null, got {have}"
            else:
                assert have is not None and abs(have - want) < TOL, (
                    f"{case['id']} {metric}@{k}: expected {want}, got {have}"
                )
    for want in case["expect"].get("verdicts", []):
        row = next(v for v in body["verdicts"] if v["pred_index"] == want["pred_index"])
        assert row["verdict"] == want["verdict"], f"{case['id']} pred {want['pred_index']}"
    # The exact set, so a warning the engine should not emit fails too (D103).
    assert sorted(w["code"] for w in body["warnings"]) == sorted(case["expect"]["warnings"]), (
        f"{case['id']} warnings"
    )
