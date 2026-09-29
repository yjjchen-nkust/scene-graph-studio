"""Fetch slice images by identifier, for datasets that may not be redistributed.

The second of the two distribution paths (see data/LICENCES.md). `bundle_slices.py` handles
datasets whose licence permits handing images to a class; this handles the rest, by downloading
each image from the source onto the machine of the person who will look at it. That is not
redistribution -- the source publishes the file, and nothing passes through a third party.

PSG is the case that forces this to exist: OpenPSG is MIT, but it annotates COCO images, and
COCO does not relicense the Flickr photographs it indexes. An MIT licence on an annotation set
does not reach through to photographs its authors never owned.

Every download is checked against the SHA-256 in the slice's MANIFEST.json, so a truncated or
substituted file fails loudly rather than teaching from the wrong pixels.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.loader import DATASETS  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402

TIMEOUT = 30
USER_AGENT = "scene-graph-studio/0.1 (teaching material; one image per manifest entry)"


def fetch_one(url: str, dest: Path, expected_sha256: str) -> tuple[bool, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            data = response.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        return False, f"download failed: {exc}"

    digest = hashlib.sha256(data).hexdigest()
    if digest != expected_sha256:
        return False, f"sha256 mismatch: expected {expected_sha256}, got {digest}"

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return True, "ok"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch slice images by identifier.")
    ap.add_argument("--dataset", required=True, choices=sorted(DATASETS))
    ap.add_argument(
        "--force",
        action="store_true",
        help="re-download images that are already present and already match their hash",
    )
    args = ap.parse_args()

    base = DATA_DIR / "slices" / args.dataset
    manifest_path = base / "MANIFEST.json"
    if not manifest_path.is_file():
        raise SystemExit(
            f"no manifest at {manifest_path}\n"
            f"  Nothing has been cut for {args.dataset!r} yet. Every lab runs on the\n"
            f"  placeholder slice until a slice exists."
        )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest["images"]
    missing_url = [r for r in rows if not r.get("url")]
    if missing_url:
        raise SystemExit(
            f"{len(missing_url)} of {len(rows)} manifest entries carry no 'url'.\n"
            f"  This dataset was cut for bundling, not for fetching. Either distribute the\n"
            f"  bundle, or re-cut with source URLs recorded in the manifest."
        )

    ok = skipped = failed = 0
    for row in rows:
        dest = base / row["file"]
        if dest.is_file() and not args.force:
            if hashlib.sha256(dest.read_bytes()).hexdigest() == row["sha256"]:
                skipped += 1
                continue
        good, message = fetch_one(row["url"], dest, row["sha256"])
        if good:
            ok += 1
        else:
            failed += 1
            print(f"FAILED  {row['image_id']}: {message}")

    print(f"{args.dataset}: {ok} fetched, {skipped} already present, {failed} failed")
    if failed:
        print(
            "  A failure here is usually a dead source URL rather than a local problem.\n"
            "  Report it: the manifest is shared, so the same URL fails for everyone."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
