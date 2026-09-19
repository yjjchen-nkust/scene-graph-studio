from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def graph(kind: str, rels: list[dict]) -> dict:
    return {
        "image_id": "i", "dataset": "vg150-sgb", "width": 100, "height": 100,
        "objects": [
            {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
            {"object_id": 2, "names": ["table"], "bbox": {"x": 20, "y": 20, "w": 10, "h": 10}},
        ],
        "relationships": rels,
        "provenance": {"kind": kind, "fidelity": "measured"},
    }


BASE = {
    "gt": graph("ground_truth", [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}]),
    "pred": graph("model", [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on",
         "score": 0.9}]),
    "protocol": "predcls", "constraint": "graph", "k": [20],
    "iou_thresh": 0.5, "mask_pairing": "single_mpo",
}


def test_every_metric_is_tagged():
    body = client.post("/api/eval", json=BASE).json()
    for m in body["metrics"]:
        assert set(m) >= {"value", "metric", "k", "protocol", "constraint",
                          "source", "verified", "fidelity"}
        assert m["protocol"] == "predcls" and m["constraint"] == "graph" and m["k"] == 20
    assert {m["metric"] for m in body["metrics"]} == {"R", "mR", "ngR", "zR"}


def test_predcls_always_warns_about_boxes_not_pairs():
    body = client.post("/api/eval", json=BASE).json()
    assert "gt_boxes_not_pairs" in {w["code"] for w in body["warnings"]}


def test_sgdet_does_not_carry_that_warning():
    body = client.post("/api/eval", json={**BASE, "protocol": "sgdet"}).json()
    assert "gt_boxes_not_pairs" not in {w["code"] for w in body["warnings"]}


def test_zero_shot_is_null_without_a_training_split():
    body = client.post("/api/eval", json=BASE).json()
    z = next(m for m in body["metrics"] if m["metric"] == "zR")
    assert z["value"] is None
    assert "zero_shot_unavailable" in {w["code"] for w in body["warnings"]}


def test_verdicts_drive_the_four_colour_diff():
    body = client.post("/api/eval", json=BASE).json()
    assert body["verdicts"][0]["verdict"] == "match"
    assert body["verdicts"][0]["rank"] == 1


def test_missed_ground_truth_is_reported():
    body = client.post("/api/eval", json={**BASE, "pred": graph("model", [])}).json()
    missed = [v for v in body["verdicts"] if v["verdict"] == "missed"]
    assert len(missed) == 1 and missed[0]["pred_index"] == -1 and missed[0]["gt_index"] == 0


def test_dangling_reference_is_422_and_names_the_id():
    bad = graph("model", [
        {"relationship_id": 1, "subject_id": 77, "object_id": 2, "predicate": "on", "score": 1.0}])
    r = client.post("/api/eval", json={**BASE, "pred": bad})
    assert r.status_code == 422
    assert "77" in str(r.json())


def test_an_unknown_k_is_rejected_rather_than_silently_accepted():
    r = client.post("/api/eval", json={**BASE, "k": [37]})
    assert r.status_code == 422


def test_identical_requests_return_identical_responses():
    a = client.post("/api/eval", json=BASE).json()
    b = client.post("/api/eval", json=BASE).json()
    assert a == b


def test_params_are_echoed():
    body = client.post("/api/eval", json=BASE).json()
    assert body["params_echo"]["iou_thresh"] == 0.5


def test_per_predicate_counts_the_ground_truth_once_per_k():
    body = client.post("/api/eval", json={**BASE, "k": [20, 50]}).json()
    row = body["per_predicate"][0]
    assert row["gt_count"] == 1
    assert row["matched"] == {"20": 1, "50": 1}
