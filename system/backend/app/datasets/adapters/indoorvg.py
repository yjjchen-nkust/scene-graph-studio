"""IndoorVG, as maelic publishes it: COCO-format parquet, images embedded.

A curated indoor split of Visual Genome (Neau et al., 2024), reformatted to COCO parquet.
84 object categories, 37 predicates.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from app.datasets.adapters.coco_parquet import image_bytes as _image_bytes
from app.datasets.adapters.coco_parquet import read_coco_parquet
from app.schema import SceneGraph

DATASET = "indoorvg"


def read(root: Path) -> Iterator[SceneGraph]:
    return read_coco_parquet(root, DATASET)


def image_bytes(root: Path, image_id: str) -> bytes | None:
    return _image_bytes(root, image_id)
