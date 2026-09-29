"""Cut a teaching slice from a corpus the author downloaded themselves.

No script in this repository downloads a dataset (decision D-08). This one reads what is
already under SGS_CORPUS_ROOT, converts it through the dataset adapter, applies D-10 selection
rule, samples deterministically, and writes:

  data/slices/<ds>/annotations.json   on the NAS with the rest of data/; git carries none (D109)
  data/slices/<ds>/MANIFEST.json      likewise
  data/slices/<ds>/images/            likewise; handed to students via bundle_slices.py

It refuses to write anything for a dataset whose annotations_commit gate is not cleared.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.adapters import LAYOUTS, image_bytes, read_dataset  # noqa: E402
from app.datasets.licences import gates_for, require_annotations_commit  # noqa: E402
from app.datasets.loader import selection_ok, top_predicates  # noqa: E402
from app.settings import CORPUS_ROOT, DATA_DIR  # noqa: E402

DEFAULT_N = {"vg150-sgb": 80, "psg": 50, "vrd": 40, "indoorvg": 20, "haystack": 10}


def main() -> None:
    ap = argparse.ArgumentParser(description="Cut a teaching slice from a local corpus.")
    ap.add_argument("--dataset", required=True, choices=sorted(LAYOUTS))
    ap.add_argument("--n", type=int, default=None)
    ap.add_argument("--seed", type=int, default=20260915)
    args = ap.parse_args()

    ds = args.dataset
    n = args.n if args.n is not None else DEFAULT_N.get(ds, 20)

    require_annotations_commit(ds)

    root = CORPUS_ROOT / ds
    if not root.is_dir():
        raise SystemExit(
            f"corpus not found: {root}\n"
            f"  Expected layout: {LAYOUTS[ds]}\n"
            f"  Download it yourself, then point SGS_CORPUS_ROOT at the parent directory\n"
            f"  (it currently resolves to {CORPUS_ROOT}). A missing corpus is a normal state:\n"
            f"  every lab runs on the placeholder slice until one is cut."
        )

    graphs = list(read_dataset(ds, root))
    head = top_predicates(graphs)
    eligible = [g for g in graphs if selection_ok(g, head)]
    if len(eligible) < n:
        raise SystemExit(
            f"only {len(eligible)} of {len(graphs)} images satisfy the selection rule; "
            f"asked for {n}"
        )

    rng = random.Random(args.seed)
    chosen = sorted(rng.sample(eligible, n), key=lambda g: g.image_id)

    out = DATA_DIR / "slices" / ds
    (out / "images").mkdir(parents=True, exist_ok=True)

    manifest = []
    for g in chosen:
        # Two shapes of corpus: images as loose files, or embedded in the annotation rows.
        # Ask the adapter first; fall back to the filesystem for corpora published as files.
        src = root / "images" / f"{g.image_id}.jpg"
        dst = out / "images" / f"{g.image_id}.jpg"
        data = image_bytes(ds, root, g.image_id)
        if data is None and src.is_file():
            shutil.copy2(src, dst)
            data = dst.read_bytes()
        elif data is not None:
            dst.write_bytes(data)
        if data is not None:
            manifest.append(
                {
                    "image_id": g.image_id,
                    "url": getattr(g, "source_url", None),
                    "file": f"images/{g.image_id}.jpg",
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "bytes": len(data),
                    "width": g.width,
                    "height": g.height,
                    "source_dataset": ds,
                }
            )

    (out / "annotations.json").write_text(
        json.dumps({"dataset": ds, "graphs": [g.model_dump() for g in chosen]}, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )
    # Which of the two distribution paths this dataset takes is a licence fact, not a
    # preference, so it is recorded in the manifest rather than re-derived by each reader.
    distribution = "bundle" if gates_for(ds).bundle_distribute else "fetch"
    (out / "MANIFEST.json").write_text(
        json.dumps(
            {"dataset": ds, "seed": args.seed, "distribution": distribution, "images": manifest},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
        newline="",
    )
    if not manifest:
        raise SystemExit(
            f"cut {len(chosen)} graphs from {ds} but wrote no images.\n"
            f"  Neither {root / 'images'} nor the adapter yielded any bytes. A slice with\n"
            f"  annotations and no images would pass every schema check and teach nothing."
        )
    print(
        f"cut {len(chosen)} images from {ds} (seed {args.seed}) into {out}"
        f"  [{len(manifest)} image files written]"
    )


if __name__ == "__main__":
    main()
