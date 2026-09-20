"""Build backend/tests/fixtures/coco_parquet/, the adapter's CI fixture.

The corpora themselves cannot be committed. `data/LICENCES.md` clears VG150 and IndoorVG for
*annotations* and shuts the gate on *images*, and a test fixture carved out of a real shard
would be exactly the redistribution that gate forbids. So the fixture is synthetic: flat-colour
JPEGs generated here, with objects and relations invented to exercise the branches that matter.

What it must reproduce faithfully is the *shape*, read off a real shard rather than assumed:

    image      struct<bytes: binary, path: string>
    image_id   int64
    width      int64
    height     int64
    file_name  string
    objects    list<struct<area, bbox: list<double>, category_id, id>>
    relations  list<struct<id, object_id, predicate_id, subject_id>>

Rows are chosen to cover what the adapter has to survive, not to look realistic:
  - a row that satisfies the D-10 selection rule (>= 4 objects, >= 3 relations)
  - a row too small to be selected, so the cutter's filter has something to reject
  - a relation naming an object id that is absent, which must be dropped rather than
    crash the SceneGraph no-dangling-reference validator
  - an object whose bbox has zero width, which BBox rejects with gt=0
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "coco_parquet"

CATEGORIES = [
    {"id": 1, "name": "table", "supercategory": "none"},
    {"id": 2, "name": "box", "supercategory": "none"},
    {"id": 3, "name": "lamp", "supercategory": "none"},
    {"id": 4, "name": "chair", "supercategory": "none"},
    {"id": 5, "name": "window", "supercategory": "none"},
]
# More than ten, deliberately. The D-10 selection rule wants a relation whose predicate sits
# outside the corpus's ten most frequent, so a fixture with ten or fewer predicates can never
# satisfy it and would make the rule untestable here.
REL_CATEGORIES = [
    {"id": i, "name": n, "supercategory": "none"}
    for i, n in enumerate(
        [
            "on", "near", "above", "behind", "under", "in", "beside", "against",
            "in front of", "attached to",          # the head: ids 1-10
            "wedged under", "draped over", "propped against", "balanced on",  # the tail: 11-14
        ],
        start=1,
    )
]


def jpeg(width: int, height: int, colour: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def obj(oid: int, cat: int, x: float, y: float, w: float, h: float) -> dict:
    return {"id": oid, "category_id": cat, "bbox": [x, y, w, h], "area": w * h}


def rel(rid: int, sid: int, oid: int, pid: int) -> dict:
    return {"id": rid, "subject_id": sid, "object_id": oid, "predicate_id": pid}


def rows() -> list[dict]:
    return [
        {  # selectable: 5 objects, 4 relations, one of them outside any plausible head
            "image": {"bytes": jpeg(64, 48, (120, 140, 130)), "path": "1.jpg"},
            "image_id": 1,
            "width": 64,
            "height": 48,
            "file_name": "1.jpg",
            "objects": [
                obj(10, 1, 4, 4, 30, 20),
                obj(11, 2, 8, 8, 10, 10),
                obj(12, 3, 40, 4, 12, 12),
                obj(13, 4, 20, 30, 14, 14),
                obj(14, 5, 50, 30, 10, 10),
            ],
            # every predicate here is in the tail, which is what makes the row selectable
            "relations": [
                rel(100, 11, 10, 11),
                rel(101, 12, 10, 12),
                rel(102, 13, 10, 13),
                rel(103, 14, 10, 14),
            ],
        },
        {  # too small to be selected: 2 objects, 1 relation
            "image": {"bytes": jpeg(32, 32, (200, 90, 90)), "path": "2.jpg"},
            "image_id": 2,
            "width": 32,
            "height": 32,
            "file_name": "2.jpg",
            "objects": [obj(20, 1, 1, 1, 8, 8), obj(21, 2, 12, 12, 8, 8)],
            "relations": [rel(200, 21, 20, 1)],
        },
        {  # filler: gives predicates 1-10 enough weight to be the head
            "image": {"bytes": jpeg(40, 40, (160, 160, 90)), "path": "4.jpg"},
            "image_id": 4,
            "width": 40,
            "height": 40,
            "file_name": "4.jpg",
            "objects": [obj(40 + i, (i % 5) + 1, 1 + i, 1 + i, 6, 6) for i in range(11)],
            "relations": [rel(400 + i, 41 + i, 40, i + 1) for i in range(10)],
        },
        {  # a dangling relation and a degenerate bbox, both of which must be dropped
            "image": {"bytes": jpeg(48, 48, (90, 110, 200)), "path": "3.jpg"},
            "image_id": 3,
            "width": 48,
            "height": 48,
            "file_name": "3.jpg",
            "objects": [
                obj(30, 1, 2, 2, 20, 20),
                obj(31, 2, 10, 10, 6, 6),
                obj(32, 3, 30, 2, 8, 8),
                obj(33, 4, 30, 30, 8, 8),
                obj(34, 5, 5, 30, 0, 9),          # zero width -> dropped by BBox(gt=0)
            ],
            "relations": [
                rel(300, 31, 30, 1),
                rel(301, 32, 30, 2),
                rel(302, 33, 30, 3),
                rel(303, 31, 999, 1),             # object 999 does not exist -> dropped
                rel(304, 34, 30, 1),              # subject was dropped -> dropped
            ],
        },
    ]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "categories.json").write_text(
        json.dumps({"categories": CATEGORIES, "rel_categories": REL_CATEGORIES}, indent=2) + "\n",
        encoding="utf-8",
        newline="",
    )
    ann = OUT / "annotations"
    ann.mkdir(exist_ok=True)

    schema = pa.schema(
        [
            ("image", pa.struct([("bytes", pa.binary()), ("path", pa.string())])),
            ("image_id", pa.int64()),
            ("width", pa.int64()),
            ("height", pa.int64()),
            ("file_name", pa.string()),
            (
                "objects",
                pa.list_(
                    pa.struct(
                        [
                            ("area", pa.float64()),
                            ("bbox", pa.list_(pa.float64())),
                            ("category_id", pa.int64()),
                            ("id", pa.int64()),
                        ]
                    )
                ),
            ),
            (
                "relations",
                pa.list_(
                    pa.struct(
                        [
                            ("id", pa.int64()),
                            ("object_id", pa.int64()),
                            ("predicate_id", pa.int64()),
                            ("subject_id", pa.int64()),
                        ]
                    )
                ),
            ),
        ]
    )
    pq.write_table(pa.Table.from_pylist(rows(), schema=schema), ann / "val-00000-of-00001.parquet")
    print(f"wrote {len(rows())} fixture rows to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
