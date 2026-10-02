"""Cut the M0 demonstrations' clip and ten frames from IndustReal.

Reads `data/_raw/industreal/all_rgb_videos.zip` and writes `data/demos/m0/clip.mp4`,
`data/demos/m0/frames/m0-demo-088.jpg` to `m0-demo-106.jpg` and `data/demos/m0/MANIFEST.json`.

**The licence gate comes first.** The frames are IndustReal frames under the finding recorded in
`data/mini-isg/LICENCE.md`: Apache-2.0, verified on the 4TU data record for the data and not only
the code. This script refuses to run until `data/LICENCES.md` carries a `demos-m0` row (D-18), so a
cut without its licence entry cannot happen by accident.

Deterministic: same archive, same times, same encoder settings. A reader can rerun it and compare
hashes rather than take the manifest's word for what is in the files.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.settings import DATA_DIR, require_data_dir  # noqa: E402

ARCHIVE = DATA_DIR / "_raw" / "industreal" / "all_rgb_videos.zip"
LICENCES = DATA_DIR / "LICENCES.md"
DEMO_DIR = DATA_DIR / "demos" / "m0"
FRAMES_DIR = DEMO_DIR / "frames"
MANIFEST = DEMO_DIR / "MANIFEST.json"

SOURCE = "IndustReal (4TU.ResearchData, doi:10.4121/b008dd74-020d-4ea4-a8ba-7bb60769d224)"
LICENCE = "Apache-2.0; the 4TU data record states it for the data, not only the code"

SOURCE_VIDEO = "01_assy_0_1.mp4"
SEGMENT = (88.0, 106.0)
TIMES = tuple(88.0 + 2.0 * i for i in range(10))
KEYFRAMES = (90.0, 96.0, 102.0)
CLIP_BUDGET = 5_000_000
CRF_START, CRF_LAST, CRF_STEP = 28, 34, 2
LICENCE_ROW = "| demos-m0 |"


def frame_id(t: float) -> str:
    return f"m0-demo-{int(t):03d}"


def licence_row_present() -> bool:
    if not LICENCES.is_file():
        return False
    lines = LICENCES.read_text(encoding="utf-8").splitlines()
    return any(line.startswith(LICENCE_ROW) for line in lines)


def grab(video: Path, seconds: float, out: Path) -> None:
    """One frame as JPEG at quality 2. `-ss` after `-i` is output seeking: frame-accurate."""
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-ss", f"{seconds:.3f}",
         "-frames:v", "1", "-q:v", "2", str(out)],
        check=True,
    )


def encode(video: Path, out: Path, crf: int) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{SEGMENT[0]:g}", "-to", f"{SEGMENT[1]:g}",
         "-i", str(video), "-an", "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)],
        check=True,
    )


def probe(path: Path) -> dict[str, object]:
    raw = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    info = json.loads(raw)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    return {
        "codec": video["codec_name"],
        "width": int(video["width"]),
        "height": int(video["height"]),
        "audio": any(s["codec_type"] == "audio" for s in info["streams"]),
        "seconds": round(float(info["format"]["duration"]), 1),
    }


def digest(path: Path) -> tuple[str, int]:
    raw = path.read_bytes()
    return hashlib.sha256(raw).hexdigest(), len(raw)


def main() -> None:
    require_data_dir()
    if not licence_row_present():
        raise SystemExit(
            f"{LICENCES} has no `demos-m0` row. Write it first (D-18); "
            "see data/mini-isg/LICENCE.md."
        )
    if not ARCHIVE.is_file():
        raise SystemExit(f"{ARCHIVE} is not here. Download it first; see data/mini-isg/LICENCE.md.")

    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    clip_path = DEMO_DIR / "clip.mp4"

    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / SOURCE_VIDEO
        with zipfile.ZipFile(ARCHIVE) as archive:
            member = next(n for n in archive.namelist() if Path(n).name == SOURCE_VIDEO)
            with archive.open(member) as src, local.open("wb") as dst:
                while chunk := src.read(1 << 20):
                    dst.write(chunk)

        frames: list[dict[str, object]] = []
        for t in TIMES:
            image_id = frame_id(t)
            out = FRAMES_DIR / f"{image_id}.jpg"
            grab(local, t, out)
            sha, size = digest(out)
            probed = probe(out)
            frames.append({
                "image_id": image_id,
                "file": f"frames/{image_id}.jpg",
                "timestamp_seconds": t,
                "keyframe": t in KEYFRAMES,
                "sha256": sha,
                "bytes": size,
                "width": probed["width"],
                "height": probed["height"],
            })

        crf = CRF_START
        while True:
            encode(local, clip_path, crf)
            sha, size = digest(clip_path)
            if size <= CLIP_BUDGET:
                break
            if crf + CRF_STEP > CRF_LAST:
                raise SystemExit(
                    f"the clip is {size} bytes at CRF {crf}, over the {CLIP_BUDGET}-byte budget"
                )
            crf += CRF_STEP

    probed = probe(clip_path)
    manifest = {
        "$schema_version": 1,
        "source": SOURCE,
        "source_video": SOURCE_VIDEO,
        "segment_seconds": list(SEGMENT),
        "licence": LICENCE,
        "distribution": "bundle",
        "clip": {
            "file": "clip.mp4",
            "sha256": sha,
            "bytes": size,
            "width": probed["width"],
            "height": probed["height"],
            "codec": probed["codec"],
            "audio": probed["audio"],
            "seconds": probed["seconds"],
        },
        "frames": frames,
    }
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline=""
    )
    print(f"clip {size} bytes at CRF {crf}; {len(frames)} frames -> {DEMO_DIR}")


if __name__ == "__main__":
    main()
