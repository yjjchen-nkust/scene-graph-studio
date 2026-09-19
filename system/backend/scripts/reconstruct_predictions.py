"""Regenerate the reconstructed prediction tier. See app/infer/reconstruct.py for the rules."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.infer.reconstruct import SEED, write_all  # noqa: E402

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default="placeholder")
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    print(f"{write_all(args.dataset, args.seed)} files written for {args.dataset}")
