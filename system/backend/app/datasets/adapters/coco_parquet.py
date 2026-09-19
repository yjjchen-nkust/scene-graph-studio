"""COCO-format parquet, the shape maelic publishes VG150 and IndoorVG in.

One reader serves both datasets because the format is identical; only the category maps and the
dataset id differ. Read off a real shard on 2026-09-16 rather than assumed:

    image      struct<bytes: binary, path: string>   the JPEG itself, inline
    image_id   int64
    width      int64
    height     int64
    file_name  string
    objects    list<struct<area, bbox: list<double>, category_id, id>>
    relations  list<struct<id, object_id, predicate_id, subject_id>>

`categories.json` alongside carries `categories` and `rel_categories`, each a list of
`{id, name, supercategory}`.

**Images are embedded in the row, not on disk.** That is why `image_bytes` exists: `cut_slice.py`
copies from `root/images/<id>.jpg` for a corpus published as loose files, and asks the adapter
when there is no such directory. See DEVIATIONS.md D7.

Two kinds of row are repaired rather than trusted, because `SceneGraph` would reject them and a
corpus of ~100k rows will contain a few of each:

  - a bbox with zero width or height. `BBox` requires both > 0. Such an object is dropped, not
    clamped: widening it to one pixel would invent a measurement the source did not make.
  - a relation naming an object id absent from the row, including one dropped just above.
    `SceneGraph` forbids dangling references, so these go too.

Both are counted and reported by `read_coco_parquet` through `last_repairs`, so a corpus that is
mostly broken cannot look like a corpus that is merely small.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

import pyarrow.parquet as pq

from app.datasets.adapters._repairs import Repairs
from app.schema import BBox, Provenance, SceneGraph, SGObject, SGRelationship

last_repairs = Repairs()


def _shards(root: Path) -> list[Path]:
    ann = root / "annotations"
    if not ann.is_dir():
        return []
    # val first: it is the smallest complete split, and a slice needs a few hundred rows at most
    return sorted(ann.glob("*.parquet"), key=lambda p: (not p.name.startswith("val"), p.name))


@lru_cache(maxsize=8)
def _categories(root: Path) -> tuple[dict[int, str], dict[int, str]]:
    path = root / "categories.json"
    if not path.is_file():
        raise SystemExit(
            f"no categories.json in {root}\n"
            f"  The parquet carries category ids; the names live in categories.json beside it.\n"
            f"  Download it from the same dataset repository."
        )
    blob = json.loads(path.read_text(encoding="utf-8"))
    objs = {int(c["id"]): str(c["name"]) for c in blob["categories"]}
    rels = {int(c["id"]): str(c["name"]) for c in blob["rel_categories"]}
    return objs, rels


def _row_to_graph(row: dict, dataset: str, obj_names: dict[int, str], rel_names: dict[int, str],
                  repairs: Repairs) -> SceneGraph | None:
    objects: list[SGObject] = []
    for o in row.get("objects") or []:
        bbox = o.get("bbox") or []
        if len(bbox) != 4:
            repairs.objects_dropped += 1
            repairs.note("bbox not four numbers")
            continue
        x, y, w, h = (float(v) for v in bbox)
        if w <= 0 or h <= 0:
            repairs.objects_dropped += 1
            repairs.note("bbox with zero width or height")
            continue
        name = obj_names.get(int(o["category_id"]))
        if name is None:
            repairs.objects_dropped += 1
            repairs.note("category id absent from categories.json")
            continue
        objects.append(
            SGObject(object_id=int(o["id"]), names=[name], bbox=BBox(x=x, y=y, w=w, h=h))
        )

    known = {o.object_id for o in objects}
    relationships: list[SGRelationship] = []
    for r in row.get("relations") or []:
        sid, oid = int(r["subject_id"]), int(r["object_id"])
        if sid not in known or oid not in known:
            repairs.relations_dropped += 1
            repairs.note("relation naming an object not in the row")
            continue
        predicate = rel_names.get(int(r["predicate_id"]))
        if predicate is None:
            repairs.relations_dropped += 1
            repairs.note("predicate id absent from categories.json")
            continue
        relationships.append(
            SGRelationship(
                relationship_id=int(r["id"]),
                subject_id=sid,
                object_id=oid,
                predicate=predicate,
                # Ground truth carries no score. A score would make it rankable, which it is not.
                score=None,
            )
        )

    width, height = int(row["width"]), int(row["height"])
    if width <= 0 or height <= 0:
        repairs.note("image with no dimensions")
        return None

    return SceneGraph(
        image_id=str(row["image_id"]),
        dataset=dataset,  # type: ignore[arg-type]
        width=width,
        height=height,
        objects=objects,
        relationships=relationships,
        provenance=Provenance(kind="ground_truth", fidelity="measured"),
    )


def read_coco_parquet(root: Path, dataset: str) -> Iterator[SceneGraph]:
    """Yield every row of every shard under `root/annotations/` as a `SceneGraph`."""
    global last_repairs
    repairs = Repairs()
    last_repairs = repairs

    shards = _shards(root)
    if not shards:
        raise SystemExit(
            f"no parquet shards under {root / 'annotations'}\n"
            f"  Expected COCO-format parquet as published on Hugging Face, plus categories.json.\n"
            f"  A single val shard is enough to cut a slice."
        )
    obj_names, rel_names = _categories(root)

    for shard in shards:
        table = pq.read_table(shard, columns=[c for c in pq.ParquetFile(shard).schema_arrow.names
                                              if c != "image"])
        for row in table.to_pylist():
            repairs.rows += 1
            graph = _row_to_graph(row, dataset, obj_names, rel_names, repairs)
            if graph is not None:
                yield graph


def image_bytes(root: Path, image_id: str) -> bytes | None:
    """The JPEG for one image, pulled out of the shard that holds it.

    Linear in the number of rows, which is fine: it runs once per image of a cut slice, tens of
    times, never in a request path.
    """
    for shard in _shards(root):
        table = pq.read_table(shard, columns=["image_id", "image"])
        ids = table.column("image_id").to_pylist()
        try:
            i = ids.index(int(image_id))
        except (ValueError, TypeError):
            continue
        cell = table.column("image").to_pylist()[i]
        if cell and cell.get("bytes"):
            return bytes(cell["bytes"])
    return None
