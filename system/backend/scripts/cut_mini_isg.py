"""Cut the mini-ISG frames from IndustReal.

Reads `data/_raw/industreal/all_rgb_videos.zip` and writes `data/slices/mini-isg/images/` plus
`data/slices/mini-isg/MANIFEST.json`.

**The licence gate comes first.** `data/mini-isg/LICENCE.md` is the finding and this script is its
consequence: IndustReal is Apache-2.0 and the licence reaches the frames, verified on the 4TU data
record rather than only on the code repository. MECCANO states no licence anywhere, so nothing is
cut from it and the manifest records why in a way that survives someone finding this file alone.

Deterministic: same archive, same selection, same timestamps, same frames. A reader can rerun it
and compare hashes rather than take the manifest's word for what is in the images.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.settings import DATA_DIR  # noqa: E402

ARCHIVE = DATA_DIR / "_raw" / "industreal" / "all_rgb_videos.zip"
IMAGES = DATA_DIR / "slices" / "mini-isg" / "images"
MANIFEST = DATA_DIR / "slices" / "mini-isg" / "MANIFEST.json"

SOURCE = "IndustReal (4TU.ResearchData, doi:10.4121/b008dd74-020d-4ea4-a8ba-7bb60769d224)"
LICENCE = "Apache-2.0; the 4TU data record states it for the data, not only the code"

#: Two frames per video, at fractions of its duration. Away from the ends, where an egocentric
#: recording is usually a hand reaching for the camera or a bench nobody is working at yet.
FRACTIONS = (0.35, 0.65)


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def grab(video: Path, seconds: float, out: Path) -> None:
    """One frame, re-encoded to JPEG at quality 3. `-ss` before `-i` seeks without decoding."""
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{seconds:.3f}", "-i", str(video),
         "-frames:v", "1", "-q:v", "3", str(out)],
        check=True,
    )


def select(names: list[str], wanted: int) -> list[str]:
    """A spread across participants and both task types, chosen without randomness.

    The archive is one flat directory of `<participant>_<assy|main>_<n>_<m>.mp4`. Sorting and
    striding takes a different participant each time rather than the first N, which would be four
    videos of the same person.
    """
    ordered = sorted(names)
    if wanted >= len(ordered):
        return ordered
    step = len(ordered) / wanted
    return [ordered[int(i * step)] for i in range(wanted)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames", type=int, default=40)
    args = parser.parse_args()

    if not ARCHIVE.is_file():
        raise SystemExit(f"{ARCHIVE} is not here. Download it first; see data/mini-isg/LICENCE.md.")

    videos_needed = max(1, args.frames // len(FRACTIONS))
    IMAGES.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)

    manifest: list[dict[str, object]] = []
    index = 0

    with zipfile.ZipFile(ARCHIVE) as archive:
        chosen = select([n for n in archive.namelist() if n.endswith(".mp4")], videos_needed)
        with tempfile.TemporaryDirectory() as tmp:
            for name in chosen:
                # One video on disk at a time: the archive is 5 GB and mp4 needs to seek.
                local = Path(tmp) / Path(name).name
                local.write_bytes(archive.read(name))
                duration = ffprobe_duration(local)
                for fraction in FRACTIONS:
                    if index >= args.frames:
                        break
                    index += 1
                    image_id = f"isg-{index:03d}"
                    out = IMAGES / f"{image_id}.jpg"
                    at = duration * fraction
                    grab(local, at, out)
                    raw = out.read_bytes()
                    import PIL.Image  # noqa: PLC0415 - only needed for the dimensions

                    with PIL.Image.open(out) as im:
                        width, height = im.size
                    manifest.append({
                        "image_id": image_id,
                        "file": f"images/{image_id}.jpg",
                        "sha256": hashlib.sha256(raw).hexdigest(),
                        "bytes": len(raw),
                        "width": width,
                        "height": height,
                        "source": SOURCE,
                        "source_video": Path(name).name,
                        "source_timestamp_seconds": round(at, 3),
                        "licence": LICENCE,
                        "distribution": "bundle",
                    })
                local.unlink()

    MANIFEST.write_text(
        json.dumps(
            {
                "dataset": "mini-isg",
                # Both gates are YES *because* every frame here is IndustReal. MECCANO states no
                # licence (data/mini-isg/LICENCE.md), so nothing is cut from it; adding one frame
                # from it would close this gate again.
                "distribution": "bundle",
                "sources_cut": ["IndustReal"],
                "sources_excluded": {
                    "MECCANO": "no licence statement on the repository or the project page; "
                               "UNCLEAR is treated as NO under decision D-18",
                },
                "frames_per_video": len(FRACTIONS),
                "fractions": list(FRACTIONS),
                "images": manifest,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(manifest)} frames from {len(chosen)} videos -> {IMAGES}")


if __name__ == "__main__":
    main()
