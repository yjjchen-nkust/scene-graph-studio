"""Pack the cut slice images into the one zip the class receives.

Students never download Visual Genome, PSG or VRD (decision D-08). They receive this file out
of band -- LMS, shared drive, USB -- unzip it into data/slices/, and run verify_bundle.py.

A dataset enters the bundle only if data/LICENCES.md clears its bundle_distribute gate.
Downloading a corpus for one own use and distributing images to a class are different acts,
and only the second needs clearing.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.licences import gates_for  # noqa: E402
from app.datasets.loader import DATASETS  # noqa: E402
from app.settings import DATA_DIR, ROOT  # noqa: E402


def main() -> None:
    cleared: list[str] = []
    skipped: list[str] = []
    for ds in DATASETS:
        if not (DATA_DIR / "slices" / ds / "annotations.json").is_file():
            continue
        (cleared if gates_for(ds).bundle_distribute else skipped).append(ds)

    for ds in skipped:
        print(
            f"skipping {ds}: data/LICENCES.md does not clear bundle_distribute. Establish "
            f"whether the licence permits distributing individual images to enrolled students, "
            f"fill the row, and set the cell to YES. UNCLEAR counts as NO."
        )
    if not cleared:
        raise SystemExit("no dataset is cleared for distribution; nothing to bundle")

    stamp = dt.date.today().isoformat()
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    target = dist / f"scene-graph-studio-slices-{stamp}.zip"

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for ds in cleared:
            base = DATA_DIR / "slices" / ds
            for path in sorted((base / "images").glob("*")):
                z.write(path, f"{ds}/images/{path.name}")
            z.write(base / "MANIFEST.json", f"{ds}/MANIFEST.json")
        z.write(DATA_DIR / "LICENCES.md", "LICENCES.md")

    data = target.read_bytes()
    print(f"bundled {', '.join(cleared)} -> {target}")
    print(f"  size   {len(data) / 1_048_576:.1f} MiB")
    print(f"  sha256 {hashlib.sha256(data).hexdigest()}")
    print("  Quote both when distributing, so a student can check what they received.")


if __name__ == "__main__":
    main()
