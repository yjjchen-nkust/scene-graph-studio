"""Rule 10.4 of the devdata spec (D125): a generator writes through data/ and never creates it.

data/ is the link to the NAS that `devdata pull` makes. A writer that ran without it would create a
real directory in its place, which devdata then reports as `occupied`, and whatever the writer put
there would be on no NAS and in no checkout but this one. So every script that writes under
`DATA_DIR` stops first, names the remedy, and creates nothing.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from app import settings

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"

#: Every script that writes under DATA_DIR. `reconstruct_predictions.py` writes through
#: `app.infer.reconstruct.write_all` and names no DATA_DIR of its own.
WRITERS = (
    "build_demo_m0.py", "build_golden.py", "build_mini_isg.py", "bundle_slices.py",
    "cut_demo_m0.py", "cut_mini_isg.py", "cut_slice.py", "fetch_images.py", "make_placeholders.py",
    "reconstruct_predictions.py", "record_demo_indvissgg.py", "record_demo_traditional.py",
    "rekey_step2_transcripts.py",
)


def test_the_guard_stops_names_devdata_pull_and_creates_nothing(tmp_path, monkeypatch) -> None:
    absent = tmp_path / "data"
    monkeypatch.setattr(settings, "DATA_DIR", absent)
    with pytest.raises(SystemExit) as stop:
        settings.require_data_dir()
    assert "devdata pull" in str(stop.value)
    assert not absent.exists()


def test_the_guard_passes_a_data_directory_that_is_there(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)
    assert settings.require_data_dir() == tmp_path


def test_every_writer_under_data_calls_the_guard() -> None:
    for name in WRITERS:
        assert "require_data_dir()" in (SCRIPTS / name).read_text(encoding="utf-8"), name


def test_no_script_writes_under_data_without_being_a_listed_writer() -> None:
    # A script that names DATA_DIR and writes a file is a writer, and a writer not in WRITERS is one
    # the test above never checks.
    writes = re.compile(r"write_text|write_bytes|mkdir|\.save\(|copyfile|copy2")
    for path in SCRIPTS.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        if "DATA_DIR" in text and writes.search(text):
            assert path.name in WRITERS, path.name


def test_a_writer_run_without_data_stops_and_creates_nothing(tmp_path) -> None:
    absent = tmp_path / "data"
    run = subprocess.run(
        [sys.executable, str(SCRIPTS / "make_placeholders.py")],
        env={**os.environ, "SGS_DATA_DIR": str(absent)},
        capture_output=True, text=True, timeout=120,
    )
    assert run.returncode != 0
    assert "devdata pull" in run.stderr
    assert not absent.exists()
