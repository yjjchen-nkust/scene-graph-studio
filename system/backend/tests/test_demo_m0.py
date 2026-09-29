"""The M0 demonstrations' clip and ten frames, cut from one IndustReal video.

Read from `data/demos/m0/MANIFEST.json`, which `backend/scripts/cut_demo_m0.py` writes. Every later
task of the demonstrations reads the same manifest, so a drift here is a drift everywhere.
"""

from __future__ import annotations

import hashlib
import json

from app.settings import DATA_DIR

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
