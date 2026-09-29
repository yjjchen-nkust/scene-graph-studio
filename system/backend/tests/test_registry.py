"""The model registry, and the provenance audit trail of D-07.

Two of these tests would be vacuous today if they only walked `data/predictions/`, which plan 03
Task 4 has not yet filled. The audit rule is therefore written as a function, exercised against
fixtures that violate it, and then run over the real tree -- so the rule is known to work before
there is anything for it to work on. D19, D22 and D24 are all this same trap.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.infer import registry
from app.infer.provenance import audit
from app.main import create_app
from app.schema import SceneGraph
from app.settings import DATA_DIR

client = TestClient(create_app())
PAPERS = {p["key"] for p in json.loads(
    (DATA_DIR / "content" / "papers.json").read_text(encoding="utf-8"))}


def models() -> list[dict]:
    return client.get("/api/models").json()["models"]


# ── the registry ──────────────────────────────────────────────────────────────────────────────


def test_every_non_live_model_states_a_reason_in_both_languages():
    for m in models():
        if not m["live"]:
            assert m["live_blocked_reason_en"], m["id"]
            assert m["live_blocked_reason_zh"], m["id"]


def test_a_live_model_states_no_blocked_reason():
    for m in models():
        if m["live"]:
            assert m["live_blocked_reason_en"] is None, m["id"]
            assert m["live_blocked_reason_zh"] is None, m["id"]


def test_reltr_is_the_only_model_that_can_ever_be_live():
    assert {m["id"] for m in models() if m["live"]} <= {"reltr"}


def test_reltr_is_not_live_without_a_checkpoint(monkeypatch):
    """torch alone is not the capability. /api/health claimed live_models: ['reltr'] on the
    strength of `import torch` succeeding, on a machine with no weights anywhere. D37."""
    monkeypatch.setattr(registry, "torch_present", lambda: True)
    monkeypatch.setattr(registry, "checkpoint_present", lambda model: False)
    row = next(m for m in registry.describe_all() if m["id"] == "reltr")
    assert row["live"] is False
    assert "checkpoint" in row["live_blocked_reason_en"].lower()


def test_reltr_is_not_live_without_the_operator_s_own_clone(monkeypatch):
    """The third gate, and the one that is about licensing rather than hardware. `yrcong/RelTR`
    declares no licence, so its source is not carried here and can only be run from a clone the
    operator made. D41."""
    monkeypatch.setattr(registry, "torch_present", lambda: True)
    monkeypatch.setattr(registry, "checkpoint_present", lambda model: True)
    monkeypatch.delenv("SGS_RELTR_PATH", raising=False)
    row = next(m for m in registry.describe_all() if m["id"] == "reltr")
    assert row["live"] is False
    assert "SGS_RELTR_PATH" in row["live_blocked_reason_en"]
    assert "licence" in row["live_blocked_reason_en"]


def test_reltr_is_live_when_all_three_gates_are_open(monkeypatch, tmp_path):
    monkeypatch.setattr(registry, "torch_present", lambda: True)
    monkeypatch.setattr(registry, "checkpoint_present", lambda model: True)
    monkeypatch.setenv("SGS_RELTR_PATH", str(tmp_path))
    row = next(m for m in registry.describe_all() if m["id"] == "reltr")
    assert row["live"] is True


def test_health_and_models_do_not_disagree_about_what_is_live():
    health = client.get("/api/health").json()
    assert health["live_models"] == [m["id"] for m in models() if m["live"]]


def test_every_model_points_at_a_paper_that_exists():
    for m in models():
        assert m["paper_key"] in PAPERS, f"{m['id']} cites {m['paper_key']}"


def test_no_latency_estimate_is_guessed():
    """NFR-8 wants a *measured* estimate. Null until something has been timed; a plausible
    constant would be worse than no number, because it would be believed."""
    for m in models():
        est = m["estimated_seconds_per_image"]
        assert est is None or est > 0, m["id"]


# ── inference ─────────────────────────────────────────────────────────────────────────────────


def test_infer_on_a_detectron2_family_model_is_503_not_500():
    r = client.post("/api/infer/psgformer", json={"dataset": "placeholder", "image_id": "p1"})
    assert r.status_code == 503
    err = r.json()["error"]
    assert err["code"] == "inference_unavailable"
    assert "torch_present" in err["detail"]
    assert err["detail"]["reason_en"] and err["detail"]["reason_zh"]


def test_infer_on_a_maskrcnn_benchmark_model_is_503():
    for model in ("motifs", "vctree"):
        r = client.post("/api/infer/" + model, json={"dataset": "placeholder", "image_id": "p1"})
        assert r.status_code == 503, model


def test_infer_on_an_unknown_model_is_404():
    r = client.post("/api/infer/nosuchmodel", json={"dataset": "placeholder", "image_id": "p1"})
    assert r.status_code == 404


def test_reltr_without_torch_degrades_with_a_reason(monkeypatch):
    monkeypatch.setattr(registry, "torch_present", lambda: False)
    r = client.post("/api/infer/reltr", json={"dataset": "placeholder", "image_id": "p1"})
    assert r.status_code == 503
    assert r.json()["error"]["detail"]["torch_present"] is False


def test_predictions_404_when_nothing_is_committed_for_that_triple():
    r = client.get("/api/predictions/placeholder/reltr/no-such-image")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


# ── the provenance audit rule, D-07 ───────────────────────────────────────────────────────────

GOOD = {
    "image_id": "p1", "dataset": "placeholder", "width": 8, "height": 8,
    "objects": [{"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 2, "h": 2}},
                {"object_id": 2, "names": ["table"], "bbox": {"x": 2, "y": 2, "w": 2, "h": 2}}],
    "relationships": [{"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on",
                       "score": 0.5}],
    "provenance": {"kind": "model", "fidelity": "measured", "model": "reltr"},
}


def write(tmp_path, name, graph):
    path = tmp_path / name
    path.write_text(json.dumps(graph), encoding="utf-8")
    return path


def test_the_audit_passes_a_measured_prediction_recorded_in_provenance_md(tmp_path):
    write(tmp_path, "a.json", GOOD)
    assert audit(tmp_path, recorded="## reltr\nRun on DEV, 2026-09-18.") == []


def test_the_audit_fails_a_measured_prediction_absent_from_provenance_md(tmp_path):
    write(tmp_path, "a.json", GOOD)
    problems = audit(tmp_path, recorded="## egtr\nsomething else")
    assert len(problems) == 1
    assert "reltr" in problems[0]


def test_the_audit_fails_a_reconstructed_prediction_with_no_note(tmp_path):
    bad = json.loads(json.dumps(GOOD))
    bad["provenance"] = {"kind": "model", "fidelity": "reconstructed", "model": "egtr"}
    write(tmp_path, "b.json", bad)
    problems = audit(tmp_path, recorded="")
    assert problems and "note" in problems[0].lower()


def test_the_audit_fails_a_file_that_is_not_a_scene_graph(tmp_path):
    (tmp_path / "c.json").write_text('{"nope": 1}', encoding="utf-8")
    assert audit(tmp_path, recorded="") != []


def test_the_committed_predictions_pass_the_audit():
    root = DATA_DIR / "predictions"
    if not root.is_dir():
        pytest.skip("plan 03 Task 4 has not committed any predictions yet")
    recorded = (root / "PROVENANCE.md").read_text(encoding="utf-8")
    assert audit(root, recorded=recorded) == []


def test_a_reconstructed_prediction_is_never_described_as_measured():
    """Belt and braces on the schema itself: Provenance already refuses a non-measured
    fidelity with no note, so the audit and the model agree rather than duplicating."""
    with pytest.raises(ValueError):
        SceneGraph.model_validate({**GOOD, "provenance": {
            "kind": "model", "fidelity": "reconstructed", "model": "egtr"}})


def test_no_blocked_reason_claims_a_prediction_set_that_is_not_there():
    """A reason is read as a statement of fact about this checkout. Plan 03 words EGTR's as
    "Predictions are committed; live inference is not wired up", which was false when written
    and would go false again whenever a set is removed. D37."""
    for m in models():
        reason = (m["live_blocked_reason_en"] or "").lower()
        if "prediction" in reason and "committed" in reason:
            assert m["predictions_available"], f"{m['id']}: says committed, has none"


def test_health_does_not_walk_the_prediction_tree(monkeypatch):
    """NFR-8 gives /api/health 50 ms warm. Liveness is three cheap checks; `predictions_available`
    reads every committed file. Answering the first by computing the second put thirty file reads
    inside the budget and `test_health_answers_quickly_once_warm` went red. D44."""
    calls = []
    monkeypatch.setattr(registry, "predictions_available",
                        lambda model: calls.append(model) or [])
    registry.live_model_ids()
    assert calls == []


def test_the_demo_predictions_pass_the_same_audit():
    root = DATA_DIR / "demos" / "m0" / "traditional"
    manifest = json.loads((DATA_DIR / "demos" / "m0" / "MANIFEST.json").read_text(encoding="utf-8"))
    recorded = (DATA_DIR / "predictions" / "PROVENANCE.md").read_text(encoding="utf-8")
    assert sorted(p.stem for p in root.glob("*.json")) == sorted(
        f["image_id"] for f in manifest["frames"])
    assert audit(root, recorded=recorded) == []
