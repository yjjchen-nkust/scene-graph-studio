"""The M0 demonstrations' clip and ten frames, cut from one IndustReal video.

Read from `data/demos/m0/MANIFEST.json`, which `backend/scripts/cut_demo_m0.py` writes. Every later
task of the demonstrations reads the same manifest, so a drift here is a drift everywhere.
"""

from __future__ import annotations

import hashlib
import json

from app.datasets.loader import load_slice
from app.settings import DATA_DIR
from app.vlm.indvissgg import parse_triplets
from scripts.build_demo_m0 import (
    INDVISSGG,
    TRADITIONAL,
    build_indvissgg,
    build_traditional,
)
from scripts.record_demo_traditional import (
    classify,
    frequency_table,
    map_class,
    most_frequent,
    slice_classes,
)

DEMO_DIR = DATA_DIR / "demos" / "m0"
MANIFEST = DEMO_DIR / "MANIFEST.json"


def _manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_the_manifest_lists_ten_frames_two_seconds_apart():
    frames = _manifest()["frames"]
    assert [f["timestamp_seconds"] for f in frames] == [88.0 + 2.0 * i for i in range(10)]
    assert [f["image_id"] for f in frames] == [f"m0-demo-{88 + 2 * i:03d}" for i in range(10)]


def test_the_keyframes_are_90_96_and_102_seconds():
    keyed = [f["timestamp_seconds"] for f in _manifest()["frames"] if f["keyframe"]]
    assert keyed == [90.0, 96.0, 102.0]


def test_every_file_matches_its_hash():
    manifest = _manifest()
    entries = [manifest["clip"], *manifest["frames"]]
    for entry in entries:
        raw = (DEMO_DIR / entry["file"]).read_bytes()
        assert len(raw) == entry["bytes"], entry["file"]
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"], entry["file"]


def test_the_clip_is_within_its_budget_and_carries_no_audio():
    clip = _manifest()["clip"]
    assert clip["bytes"] <= 5_000_000
    assert clip["audio"] is False
    assert clip["codec"] == "h264"
    assert clip["seconds"] == 18.0


def test_the_licence_row_is_written_and_clears_the_bundle():
    lines = (DATA_DIR / "LICENCES.md").read_text(encoding="utf-8").splitlines()
    rows = [line.rstrip() for line in lines if line.startswith("| demos-m0 |")]
    assert len(rows) == 1
    assert rows[0].endswith("| YES | YES |")


TRANSCRIPT = DATA_DIR / "vlm" / "transcripts" / "m0-demo.json"


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _completions() -> dict[str, str]:
    return {e["case"]: e["completion"] for e in _load(TRANSCRIPT)["exchanges"]}


def test_the_derived_files_are_what_the_sources_produce():
    assert build_traditional() == _load(TRADITIONAL)
    assert build_indvissgg() == _load(INDVISSGG)


def test_every_derived_frame_is_a_manifest_frame_in_order():
    ids = [f["image_id"] for f in _manifest()["frames"]]
    assert [f["image_id"] for f in _load(TRADITIONAL)["frames"]] == ids
    assert [f["image_id"] for f in _load(INDVISSGG)["frames"]] == ids


def test_the_summary_is_the_step3_completion_parsed():
    completions = _completions()
    for frame in _load(INDVISSGG)["frames"]:
        expected = [list(t) for t in parse_triplets(completions[f"{frame['image_id']}/step3"])]
        assert frame["summary"] == expected


def test_an_expert_revision_excludes_the_triplets_its_analysis_quotes():
    completions = _completions()
    quoting = 0
    for frame in _load(INDVISSGG)["frames"]:
        for expert in frame["experts"]:
            text = completions[f"{frame['image_id']}/expert{expert['index']}"]
            whole = [list(t) for t in parse_triplets(text)]
            quoting += len(whole) != len(expert["revision"])
            head = text.split("ANALYSIS_", 1)[0]
            assert expert["revision"] == [list(t) for t in parse_triplets(head)]
    assert quoting > 0


def test_the_class_map_covers_every_detected_label():
    derived = _load(TRADITIONAL)
    labels = {d["label"] for f in derived["frames"] for d in f["detections"]}
    assert set(derived["class_map"]) == labels


def test_every_relation_source_matches_the_recorded_predicate():
    graphs = load_slice("vg150-sgb")
    table, classes, fallback = frequency_table(graphs), slice_classes(graphs), most_frequent(graphs)
    for frame in _load(TRADITIONAL)["frames"]:
        recorded = _load(DATA_DIR / "demos" / "m0" / "traditional" / f"{frame['image_id']}.json")
        label = {d["object_id"]: d["label"] for d in frame["detections"]}
        assert len(frame["relations"]) == len(recorded["relationships"])
        for rel, rec in zip(frame["relations"], recorded["relationships"], strict=True):
            predicate, source = classify(
                map_class(label[rel["subject_id"]], classes),
                map_class(label[rel["object_id"]], classes),
                table,
                fallback,
            )
            assert predicate == rec["predicate"] == rel["predicate"]
            assert rel["from"] == source
