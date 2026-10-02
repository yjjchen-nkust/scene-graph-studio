from __future__ import annotations

import os
from pathlib import Path

VERSION = "0.1.0"
# Two roots, deliberately distinct. ROOT is the code root (system/), which is what
# package.json, the backend and the tools sit in and what other modules join against.
# data/ stayed at the track root in the 2026-09-16 reorganisation, because it is
# content rather than machinery -- so DATA_DIR climbs one level out of system/.
ROOT = Path(__file__).resolve().parents[2]
TRACK_ROOT = ROOT.parent
# `SGS_DATA_DIR` redirects the whole application at another data directory. Every module reads
# DATA_DIR from here, so one variable moves all of them.
#
# It exists for check 6 of docs/VERIFICATION.md, the offline run, which has to be performed with
# no slices fetched. Without it that check could only be run on a machine that had never fetched
# anything, which is a machine nobody has twice -- and the alternative, moving the author's
# corpora out of the way, is a destructive operation in the service of a test.
DATA_DIR = Path(os.environ.get("SGS_DATA_DIR", TRACK_ROOT / "data"))
CORPUS_ROOT = Path(os.environ.get("SGS_CORPUS_ROOT", DATA_DIR / "_raw"))


def require_data_dir() -> Path:
    """`DATA_DIR`, for a script about to write under it, or a stop that names the remedy.

    data/ is the link to the NAS that `devdata pull` makes (D110, D125). A writer that ran without
    it would create a real directory in its place, which devdata reports as `occupied`, and what
    it wrote would reach no NAS and no other checkout: rule 10.4 of the devdata spec. Read at call
    time, so a test that moves `DATA_DIR` moves the check with it.
    """
    if not DATA_DIR.is_dir():
        raise SystemExit(
            f"{DATA_DIR} is absent. data/ is the link to the NAS that `devdata pull` makes; run "
            f"`devdata pull` at the track root (or set SGS_DATA_DIR). Nothing was written."
        )
    return DATA_DIR
