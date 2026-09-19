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
