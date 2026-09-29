"""Where the frame a VLM call is asked about lives on disk.

The live provider has to send the image itself. An `image_ref` is an id, not a path, so this
module is the one place that turns it into a file.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.settings import DATA_DIR

FRAME_DIRS: tuple[Path, ...] = (
    DATA_DIR / "slices" / "mini-isg" / "images",
    DATA_DIR / "demos" / "m0" / "frames",
)


_ID = re.compile(r"[A-Za-z0-9_-]+")


def frame_path(image_ref: str) -> Path | None:
    """The first `<dir>/<image_ref>.jpg` that exists, or None.

    `image_ref` arrives from an API request body, so it is untrusted: only `[A-Za-z0-9_-]+` is
    looked up, and a candidate that resolves outside its directory is skipped.
    """
    if _ID.fullmatch(image_ref) is None:
        return None
    for directory in FRAME_DIRS:
        candidate = directory / f"{image_ref}.jpg"
        if candidate.is_file() and candidate.resolve().is_relative_to(directory.resolve()):
            return candidate
    return None
