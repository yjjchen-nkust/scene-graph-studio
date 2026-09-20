"""Build backend/tests/fixtures/psg/, the PSG adapter's CI fixture.

Synthetic for the same reason as the COCO-parquet fixture: `data/LICENCES.md` clears PSG for
annotations and shuts the gate on images, and PSG's images are COCO photographs that OpenPSG's
MIT licence does not reach. A fixture carved out of the real corpus would be the redistribution
that gate forbids.

What it reproduces is the shape, read off the real `psg.json` on 2026-09-16:

    data[]                 file_name, pan_seg_file_name, height, width, image_id, coco_image_id
      segments_info[]      id, category_id, iscrowd, isthing, area
      annotations[]        bbox (XYXY -- bbox_mode 0), bbox_mode, category_id
      relations[]          [subject_index, object_index, predicate_index]
    thing_classes[]        80
    stuff_classes[]        53      category_id indexes thing+stuff concatenated, 0..132
    predicate_classes[]    56
    test_image_ids[]       the 2,186 val images

Three properties this fixture exists to pin, each of which a remembered convention gets wrong:

  - **bbox is XYXY, not XYWH.** `bbox_mode: 0` is Detectron2's `BoxMode.XYXY_ABS`. Reading it as
    width and height produces boxes that are plausible, wrong, and silently wrong.
  - **relations are positional.** `[0, 6, 3]` means annotations[0] -> annotations[6] with
    predicate_classes[3]; they are not object ids.
  - **the panoptic PNG encodes a segment id per pixel** as R + G*256 + B*65536, which is how a
    mask is recovered for each entry in segments_info.

A fourth property the fixture pins is the one that is a property of the *corpus* rather than the
file: psg.json describes 48,749 images split across COCO train2017 and val2017, which are
separate downloads, so a record's photograph may simply not be present. One fixture record has
no JPEG for exactly that reason and must be dropped rather than yielded.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "psg"

THING = ["person", "bench", "car"]
STUFF = ["tree-merged", "sky-other-merged"]
PREDICATES = ["over", "in front of", "beside", "on", "sitting on"]

# Two segments, laid out so their masks are trivially checkable by hand.
SEGMENTS = [
    {"id": 1, "category_id": 0, "box": (1, 1, 5, 7), "isthing": 1},   # person, thing
    {"id": 2, "category_id": 1, "box": (6, 4, 11, 9), "isthing": 1},  # bench, thing
    {"id": 3, "category_id": 3, "box": (0, 0, 12, 3), "isthing": 0},  # tree, stuff
]
W, H = 12, 10


def panoptic_png(path: Path) -> None:
    """One PNG where each pixel carries its segment id as R + G*256 + B*65536."""
    img = Image.new("RGB", (W, H), (0, 0, 0))
    px = img.load()
    # Panoptic segments are mutually exclusive: every pixel belongs to exactly one. Stuff is
    # painted first and things over it, which is the layering the real annotations have and the
    # reason a thing's mask is never clipped by the sky behind it.
    for seg in sorted(SEGMENTS, key=lambda s: s["isthing"]):
        x1, y1, x2, y2 = seg["box"]
        sid = seg["id"]
        rgb = (sid & 255, (sid >> 8) & 255, (sid >> 16) & 255)
        for y in range(y1, y2):
            for x in range(x1, x2):
                px[x, y] = rgb
    img.save(path)


def main() -> int:
    (OUT / "coco" / "panoptic_val2017").mkdir(parents=True, exist_ok=True)
    (OUT / "coco" / "val2017").mkdir(parents=True, exist_ok=True)

    panoptic_png(OUT / "coco" / "panoptic_val2017" / "000000000001.png")
    Image.new("RGB", (W, H), (40, 80, 120)).save(OUT / "coco" / "val2017" / "000000000001.jpg")
    # a second image with no panoptic PNG, so the adapter's mask-absent path is exercised
    Image.new("RGB", (W, H), (120, 80, 40)).save(OUT / "coco" / "val2017" / "000000000002.jpg")
    Image.new("RGB", (W, H), (80, 120, 40)).save(OUT / "coco" / "val2017" / "000000000003.jpg")
    # ...and deliberately no JPEG for 000000000004, whose record must be dropped

    record = {
        "file_name": "val2017/000000000001.jpg",
        "pan_seg_file_name": "panoptic_val2017/000000000001.png",
        "height": H,
        "width": W,
        "image_id": "000000000001",
        "coco_image_id": 1,
        "segments_info": [
            {
                "id": s["id"],
                "category_id": s["category_id"],
                "iscrowd": 0,
                "isthing": s["isthing"],
                "attribute_ids": [],
                "area": (s["box"][2] - s["box"][0]) * (s["box"][3] - s["box"][1]),
            }
            for s in SEGMENTS
        ],
        "annotations": [
            {"bbox": [float(v) for v in s["box"]], "bbox_mode": 0, "category_id": s["category_id"]}
            for s in SEGMENTS
        ],
        # positional: annotations[0] over annotations[2]; [1] sitting on [2]; [0] beside [1]
        "relations": [[0, 2, 0], [1, 2, 4], [0, 1, 2]],
    }

    no_masks = {
        **record,
        "file_name": "val2017/000000000002.jpg",
        "pan_seg_file_name": "panoptic_val2017/does-not-exist.png",
        "image_id": "000000000002",
        "coco_image_id": 2,
        # one relation points past the end of annotations and must be dropped
        "relations": [[0, 1, 3], [0, 99, 1]],
    }

    degenerate = {
        **record,
        "file_name": "val2017/000000000003.jpg",
        "image_id": "000000000003",
        "coco_image_id": 3,
        # a zero-area box: x1 == x2. BBox requires w > 0, so this object goes, and with it
        # every relation naming it.
        "annotations": [
            {"bbox": [2.0, 2.0, 2.0, 8.0], "bbox_mode": 0, "category_id": 0},
            {"bbox": [3.0, 3.0, 9.0, 9.0], "bbox_mode": 0, "category_id": 1},
        ],
        "segments_info": [
            {"id": 1, "category_id": 0, "iscrowd": 0, "isthing": 1, "attribute_ids": [], "area": 0},
            {
                "id": 2, "category_id": 1, "iscrowd": 0,
                "isthing": 1, "attribute_ids": [], "area": 36,
            },
        ],
        "relations": [[0, 1, 0]],
    }

    # A record from the half of the corpus the author did not download: annotations present,
    # photograph absent. The adapter must drop it, because a slice cut from it would name an
    # image that cannot be supplied.
    no_photograph = {
        **record,
        "file_name": "train2017/000000000004.jpg",
        "pan_seg_file_name": "panoptic_train2017/000000000004.png",
        "image_id": "000000000004",
        "coco_image_id": 4,
    }

    blob = {
        "data": [record, no_masks, degenerate, no_photograph],
        "thing_classes": THING,
        "stuff_classes": STUFF,
        "predicate_classes": PREDICATES,
        "test_image_ids": ["000000000001", "000000000002", "000000000003"],
    }
    (OUT / "psg.json").write_text(json.dumps(blob, indent=2) + "\n", encoding="utf-8", newline="")
    print(f"wrote {len(blob['data'])} PSG fixture records to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
