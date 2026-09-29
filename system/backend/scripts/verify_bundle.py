"""Check an unpacked slice bundle against the slices' manifests.

A student whose lab will not load runs this first. Missing, extra and hash-mismatched files are
reported separately, because the three have different causes: an interrupted unzip, a stale
bundle, and a corrupted download.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.loader import DATASETS  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402


def main() -> int:
    problems = 0
    checked = 0
    for ds in DATASETS:
        manifest_path = DATA_DIR / "slices" / ds / "MANIFEST.json"
        if not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        base = DATA_DIR / "slices" / ds
        expected = {row["file"] for row in manifest["images"]}

        for row in manifest["images"]:
            path = base / row["file"]
            if not path.is_file():
                print(f"MISSING   {ds}/{row['file']}")
                problems += 1
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != row["sha256"]:
                print(f"MISMATCH  {ds}/{row['file']}")
                print(f"            expected {row['sha256']}")
                print(f"            found    {digest}")
                problems += 1
            else:
                checked += 1

        images_dir = base / "images"
        if images_dir.is_dir():
            for path in sorted(images_dir.glob("*")):
                rel = f"images/{path.name}"
                if rel not in expected:
                    print(f"EXTRA     {ds}/{rel}  (not in MANIFEST.json)")
                    problems += 1

    if problems:
        print(
            f"\n{problems} problem(s). Re-unzip the bundle you were given; if a file still "
            f"mismatches, ask for it to be re-issued and quote the bundle sha256."
        )
        return 1
    print(f"bundle verified: {checked} file(s) match their manifest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
