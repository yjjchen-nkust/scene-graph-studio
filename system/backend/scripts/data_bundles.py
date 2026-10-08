"""Share data/ through one Google Drive folder: pack it, and fetch it.

    python backend/scripts/data_bundles.py pack  --out <dir>
    python backend/scripts/data_bundles.py fetch [--bundle core|industreal|all]

The full corpus is too large for git (D109). gdown's folder download stops at 50 files, so the data
travels as a few bundles whose Drive file ids and SHA-256 values are recorded in `data.drive.json`
at the track root. A bundle is an `archive` (a zip extracted into data/) or a `file` (placed at its
`path` under data/ as it is).

`pack` runs where data/ is complete. It writes the core zip, records every checksum in the manifest,
and leaves the upload to the maintainer, who pastes each Drive file id into `file_id`.

What may leave the machine follows data/LICENCES.md. A dataset whose `bundle_distribute` is not YES
keeps its annotations in the bundle and loses its images, and the journal papers are left out
because their publisher holds the rights.

`fetch` needs `pip install -r backend/requirements-data.txt`. It checks each download against the
manifest before anything is placed in data/, and refuses to write through a link, because on the
author's machines data/ is a link to a NAS.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from collections.abc import Callable
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.licences import gates_for  # noqa: E402
from app.settings import DATA_DIR, TRACK_ROOT  # noqa: E402

MANIFEST = TRACK_ROOT / "data.drive.json"
CORE = "core"
CHUNK = 1 << 20
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
# `_raw` holds the unmodified source corpora; they travel as their own `file` bundles.
EXCLUDED_TOP = {"_raw"}
EXCLUDED_SUFFIXES = {".pdf"}

Downloader = Callable[[str, Path], None]


class BundleError(Exception):
    pass


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(CHUNK):
            digest.update(block)
    return digest.hexdigest()


def load_manifest(path: Path = MANIFEST) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_manifest(manifest: dict, path: Path = MANIFEST) -> None:
    # newline="" keeps LF on Windows, as every generator here does (see .gitattributes).
    with path.open("w", encoding="utf-8", newline="") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def is_shareable(relative: Path) -> bool:
    """Whether `relative` (a path under data/) may go into the core bundle."""
    parts = relative.parts
    if parts[0] in EXCLUDED_TOP or relative.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if parts[0] == "slices" and len(parts) > 2 and not gates_for(parts[1]).bundle_distribute:
        return relative.suffix.lower() not in IMAGE_SUFFIXES
    return True


def build_core(source: Path, target: Path) -> int:
    count = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(p for p in source.rglob("*") if p.is_file()):
            relative = path.relative_to(source)
            if is_shareable(relative):
                archive.write(path, relative.as_posix())
                count += 1
    return count


def pack(source: Path, out: Path, manifest_path: Path = MANIFEST) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(manifest_path)
    core = manifest["bundles"][CORE]
    target = out / core["name"]
    core["files"] = build_core(source, target)
    core["bytes"] = target.stat().st_size
    core["sha256"] = sha256_of(target)
    for name, bundle in manifest["bundles"].items():
        if bundle["kind"] != "file":
            continue
        held = source / bundle["path"]
        if held.is_file():
            bundle["bytes"] = held.stat().st_size
            bundle["sha256"] = sha256_of(held)
        else:
            print(f"{name}: {held} is absent, its checksum is left as it was.")
    write_manifest(manifest, manifest_path)
    return manifest


def gdown_download(file_id: str, target: Path) -> None:
    try:
        import gdown
    except ImportError as error:
        raise BundleError(
            "gdown is not installed: pip install -r backend/requirements-data.txt"
        ) from error
    if not gdown.download(id=file_id, output=str(target), quiet=False):
        raise BundleError(
            f"Drive refused file {file_id}: the share link may be restricted, or the daily "
            "download quota is spent. Retry later or ask the maintainer for a copy."
        )


def extract_safely(archive: Path, destination: Path) -> None:
    root = destination.resolve()
    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.namelist():
            if not (root / member).resolve().is_relative_to(root):
                raise BundleError(f"{archive.name} holds a path outside data/: {member}")
        bundle.extractall(destination)


def fetch_bundle(name: str, bundle: dict, data_dir: Path, download: Downloader) -> None:
    if not bundle.get("file_id"):
        raise BundleError(f"bundle '{name}' has no file_id in data.drive.json: not uploaded yet.")
    with tempfile.TemporaryDirectory() as scratch:
        received = Path(scratch) / bundle["name"]
        download(bundle["file_id"], received)
        found = sha256_of(received)
        if found != bundle["sha256"]:
            raise BundleError(
                f"bundle '{name}' failed its checksum: expected {bundle['sha256']}, got {found}."
            )
        if bundle["kind"] == "archive":
            extract_safely(received, data_dir)
        else:
            placed = data_dir / bundle["path"]
            placed.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(received, placed)


def fetch(
    names: list[str], dest: Path, download: Downloader, manifest_path: Path = MANIFEST
) -> None:
    bundles = load_manifest(manifest_path)["bundles"]
    chosen = list(bundles) if names == ["all"] else names
    unknown = [name for name in chosen if name not in bundles]
    if unknown:
        raise BundleError(f"unknown bundle '{unknown[0]}'; the manifest has {', '.join(bundles)}.")
    if dest.is_symlink() or dest.is_junction():
        raise BundleError(f"{dest} is a link; refusing to write through it.")
    dest.mkdir(parents=True, exist_ok=True)
    for name in chosen:
        fetch_bundle(name, bundles[name], dest, download)
        print(f"{name}: placed in {dest}")


def main(argv: list[str] | None = None, download: Downloader = gdown_download) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    packer = commands.add_parser("pack", help="zip data/ and record checksums")
    packer.add_argument("--out", type=Path, required=True, help="where the zip is written")
    fetcher = commands.add_parser("fetch", help="download bundles from Drive into data/")
    fetcher.add_argument("--bundle", default="core", help="core, industreal or all")
    args = parser.parse_args(argv)
    try:
        if args.command == "pack":
            manifest = pack(DATA_DIR, args.out)
            core = manifest["bundles"][CORE]
            print(f"{core['name']}: {core['files']} files, {core['bytes']} bytes, {core['sha256']}")
        else:
            fetch([args.bundle], DATA_DIR, download)
    except BundleError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
