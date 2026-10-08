from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from app.datasets.licences import Gates
from scripts import data_bundles as db


def _open_gates(dataset: str) -> Gates:
    return Gates(dataset, "", "", "", True, dataset in {"placeholder", "mini-isg"})


@pytest.fixture(autouse=True)
def licences(monkeypatch):
    monkeypatch.setattr(db, "gates_for", _open_gates)


def _manifest(path: Path, **core) -> Path:
    entry = {
        "kind": "archive",
        "name": "core.zip",
        "file_id": "",
        "files": 0,
        "bytes": 0,
        "sha256": "",
    }
    entry.update(core)
    path.write_text(json.dumps({"folder": "", "bundles": {"core": entry}}), encoding="utf-8")
    return path


def test_images_of_a_closed_dataset_stay_home_and_its_annotations_travel():
    share = db.is_shareable
    assert share(Path("slices/psg/annotations.json"))
    assert not share(Path("slices/psg/images/1.jpg"))
    assert share(Path("slices/mini-isg/images/1.png"))
    assert share(Path("demos/m0/clip.mp4"))


def test_papers_and_raw_corpora_never_enter_the_core_bundle():
    assert not db.is_shareable(Path("@@paper.pdf"))
    assert not db.is_shareable(Path("_raw/industreal/all_rgb_videos.zip"))


def test_pack_then_fetch_round_trips_through_the_checksum(tmp_path):
    source = tmp_path / "data"
    (source / "slices" / "psg").mkdir(parents=True)
    (source / "slices" / "psg" / "annotations.json").write_text("{}", encoding="utf-8")
    (source / "slices" / "psg" / "1.jpg").write_bytes(b"photo")
    manifest = _manifest(tmp_path / "data.drive.json")
    packed = db.pack(source, tmp_path / "out", manifest)["bundles"]["core"]
    assert packed["files"] == 1

    shipped = tmp_path / "out" / "core.zip"
    packed["file_id"] = "abc"
    db.write_manifest({"bundles": {"core": packed}}, manifest)
    dest = tmp_path / "fetched"
    db.fetch(["core"], dest, lambda _id, target: target.write_bytes(shipped.read_bytes()), manifest)
    assert (dest / "slices" / "psg" / "annotations.json").is_file()
    assert not (dest / "slices" / "psg" / "1.jpg").exists()


def test_a_download_that_fails_its_checksum_places_nothing(tmp_path):
    manifest = _manifest(tmp_path / "m.json", file_id="abc", sha256="0" * 64)
    dest = tmp_path / "data"
    with pytest.raises(db.BundleError, match="checksum"):
        db.fetch(["core"], dest, lambda _id, target: target.write_bytes(b"other"), manifest)
    assert list(dest.iterdir()) == []


def test_an_archive_cannot_write_outside_data(tmp_path):
    hostile = tmp_path / "hostile.zip"
    with zipfile.ZipFile(hostile, "w") as archive:
        archive.writestr("../escaped.txt", "x")
    manifest = _manifest(tmp_path / "m.json", file_id="abc", sha256=db.sha256_of(hostile))
    with pytest.raises(db.BundleError, match="outside"):
        db.fetch(
            ["core"],
            tmp_path / "data",
            lambda _id, t: t.write_bytes(hostile.read_bytes()),
            manifest,
        )
    assert not (tmp_path / "escaped.txt").exists()


def test_a_bundle_not_uploaded_yet_says_so(tmp_path):
    with pytest.raises(db.BundleError, match="not uploaded"):
        db.fetch(["core"], tmp_path / "data", lambda *_: None, _manifest(tmp_path / "m.json"))


def test_fetch_refuses_to_write_through_a_link(tmp_path):
    target = tmp_path / "nas"
    target.mkdir()
    link = tmp_path / "data"
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("symbolic links are not permitted here")
    with pytest.raises(db.BundleError, match="link"):
        db.fetch(["core"], link, lambda *_: None, _manifest(tmp_path / "m.json", file_id="a"))
