"""Generate the placeholder slice: six synthetic frames plus their ground-truth graphs.

This is the one slice whose IMAGES this repository makes, because they are this project's own
generated output and NFR-1 depends on every lab being demonstrable with no corpora under
SGS_CORPUS_ROOT and no slice bundle unpacked. Every other slice holds annotations and a manifest
only (decision D-08). None of it is committed since D109: data/ comes from the NAS.

Each frame satisfies D-10's selection rule: at least 4 objects, at least 3 relationships, and at
least one relationship whose predicate falls outside the slice's ten most frequent. The last
condition is what keeps mR@K non-degenerate on a slice this small -- without it every predicate
is a head predicate, per-class recall has nothing to average over, and plan 04's verification
item 4 cannot fire.

Deterministic: same input, same bytes. Re-running is a no-op.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.licences import require_annotations_commit  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402

W, H = 640, 480
GROUND = (244, 244, 246)

PALETTE: dict[str, tuple[int, int, int]] = {
    "person": (70, 90, 160),
    "table": (150, 120, 80),
    "box": (200, 160, 70),
    "conveyor": (90, 120, 110),
    "robot arm": (130, 80, 130),
    "panel": (80, 140, 150),
    "glove": (190, 110, 110),
    "wrench": (110, 110, 120),
    "terminal": (100, 150, 90),
    "beam": (140, 140, 150),
}

# Ten head predicates and six tail predicates, one tail per frame. Head counts are all >= 2 and
# tail counts are exactly 1, so the slice's ten most frequent are exactly the head set.
Frame = tuple[str, list[tuple[str, tuple[int, int, int, int]]], list[tuple[int, str, int]]]

FRAMES: list[Frame] = [
    (
        "ph-001",
        [("table", (60, 300, 420, 110)), ("person", (140, 80, 110, 235)),
         ("box", (250, 240, 90, 70)), ("glove", (190, 205, 45, 40)),
         ("wrench", (100, 268, 70, 24)), ("panel", (500, 150, 110, 140))],
        [(2, "on", 0), (1, "near", 0), (1, "wearing", 3), (1, "holding", 4),
         (5, "above", 0), (4, "resting against", 0)],
    ),
    (
        "ph-002",
        [("conveyor", (60, 320, 500, 90)), ("box", (150, 248, 90, 70)),
         ("robot arm", (330, 70, 130, 240)), ("panel", (420, 240, 120, 76)),
         ("terminal", (470, 170, 60, 60)), ("beam", (60, 28, 520, 32))],
        [(1, "on", 0), (3, "near", 0), (1, "under", 5), (2, "next to", 3),
         (2, "attached to", 5), (1, "feeding into", 3)],
    ),
    (
        "ph-003",
        [("table", (50, 305, 400, 105)), ("panel", (110, 175, 175, 125)),
         ("person", (330, 100, 110, 225)), ("terminal", (140, 195, 55, 55)),
         ("wrench", (250, 272, 80, 26)), ("beam", (60, 30, 520, 32))],
        [(1, "on", 0), (1, "behind", 4), (2, "in front of", 1),
         (5, "attached to", 0), (5, "above", 0), (3, "clamped to", 1)],
    ),
    (
        "ph-004",
        [("robot arm", (90, 60, 130, 250)), ("conveyor", (60, 330, 480, 80)),
         ("box", (280, 252, 90, 70)), ("beam", (60, 28, 520, 32)),
         ("glove", (400, 268, 48, 42)), ("person", (480, 120, 105, 205))],
        [(2, "near", 1), (0, "attached to", 3), (0, "under", 3),
         (5, "next to", 1), (5, "holding", 4), (4, "suspended from", 3)],
    ),
    (
        "ph-005",
        [("table", (70, 300, 430, 110)), ("box", (110, 228, 100, 70)),
         ("terminal", (275, 238, 70, 60)), ("person", (395, 95, 110, 215)),
         ("panel", (430, 228, 110, 72)), ("glove", (360, 240, 44, 38))],
        [(1, "behind", 2), (3, "in front of", 0), (3, "wearing", 5),
         (3, "holding", 4), (1, "above", 0), (3, "knocking on", 2)],
    ),
    (
        "ph-006",
        [("conveyor", (60, 310, 500, 100)), ("beam", (60, 36, 520, 32)),
         ("robot arm", (200, 90, 130, 215)), ("box", (370, 238, 95, 70)),
         ("panel", (80, 215, 90, 85)), ("person", (480, 110, 105, 195))],
        [(2, "behind", 4), (5, "in front of", 0), (5, "wearing", 3),
         (2, "under", 1), (3, "next to", 0), (2, "aligned with", 4)],
    ),
]


def draw(frame: Frame) -> Image.Image:
    _, objects, _ = frame
    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)
    for name, (x, y, w, h) in objects:
        colour = PALETTE[name]
        d.rectangle([x, y, x + w, y + h], fill=colour, outline=(30, 30, 40), width=2)
        d.text((x + 6, y + 6), name, fill=(255, 255, 255))
    return img


def build() -> None:
    require_annotations_commit("placeholder")
    out = DATA_DIR / "slices" / "placeholder"
    (out / "images").mkdir(parents=True, exist_ok=True)

    graphs: list[dict[str, Any]] = []
    manifest: list[dict[str, Any]] = []
    rel_id = 1

    for frame in FRAMES:
        image_id, objects, rels = frame
        path = out / "images" / f"{image_id}.png"
        draw(frame).save(path, format="PNG", optimize=True)

        graphs.append({
            "image_id": image_id,
            "dataset": "placeholder",
            "width": W,
            "height": H,
            "objects": [
                {
                    "object_id": i + 1,
                    "names": [name],
                    "bbox": {"x": float(x), "y": float(y), "w": float(w), "h": float(h)},
                }
                for i, (name, (x, y, w, h)) in enumerate(objects)
            ],
            "relationships": [
                {
                    "relationship_id": rel_id + j,
                    "subject_id": s + 1,
                    "object_id": o + 1,
                    "predicate": p,
                }
                for j, (s, p, o) in enumerate(rels)
            ],
            "provenance": {
                "kind": "ground_truth",
                "fidelity": "measured",
                "note": None,
            },
        })
        rel_id += len(rels)

        data = path.read_bytes()
        manifest.append({
            "image_id": image_id,
            "file": f"images/{image_id}.png",
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "width": W,
            "height": H,
            "source": "generated by backend/scripts/make_placeholders.py",
            "licence": "this project's own generated output",
        })

    (out / "annotations.json").write_text(
        json.dumps({"dataset": "placeholder", "graphs": graphs}, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )
    (out / "MANIFEST.json").write_text(
        json.dumps(
            {"dataset": "placeholder", "distribution": "bundle", "images": manifest},
            indent=2,
        ) + "\n",
        encoding="utf-8",
        newline="",
    )
    print(f"wrote {len(graphs)} placeholder frames to {out}")


if __name__ == "__main__":
    build()
