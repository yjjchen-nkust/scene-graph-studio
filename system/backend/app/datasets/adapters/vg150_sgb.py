"""VG150, as maelic publishes it: COCO-format parquet, images embedded.

The split is `vg150-sgb` and never bare `vg150` (D-09): several releases answer to the short
name, and this is the corrected release of Neau et al.'s SGG-Benchmark,
`maelic/VG150-coco-format`. 150 object categories, 50 predicates.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from app.datasets.adapters.coco_parquet import image_bytes as _image_bytes
from app.datasets.adapters.coco_parquet import read_coco_parquet
from app.schema import SceneGraph

DATASET = "vg150-sgb"


def read(root: Path) -> Iterator[SceneGraph]:
    return read_coco_parquet(root, DATASET)


def image_bytes(root: Path, image_id: str) -> bytes | None:
    return _image_bytes(root, image_id)
