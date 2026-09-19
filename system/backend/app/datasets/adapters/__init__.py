"""Corpus adapters: the only dataset-specific code in the project.

Each adapter exposes exactly one function::

    def read(root: Path) -> Iterator[SceneGraph]

`root` is the dataset's directory under `SGS_CORPUS_ROOT`, laid out as the source publishes it.
Everything downstream of an adapter sees `SceneGraph` and nothing else, which is why the rest of
the codebase carries no knowledge of HDF5 index arrays, COCO panoptic JSON, or VRD's predicate
tables.

**Two of the five adapters are still unwritten.** `vg150-sgb` and `indoorvg` landed on
2026-09-16, once their corpora were on disk -- both COCO-format parquet, so one reader serves
both; `psg` followed on the same day, against its own format. `vrd` and `haystack` are still
absent for the reason below, and both are gate-shut anyway.

Decision D-08 has the author
downloading the corpora by hand; the adapters are written against what is actually on disk, not
against a remembered layout. Writing them now would mean guessing at field names and index
conventions that cannot be run against anything, and a guess that typechecks is worse than an
absence -- it would look finished. `LAYOUTS` below records the expected shape so the work has a
starting point, and `read_dataset` fails with that expectation named rather than with an
AttributeError.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Protocol

from app.schema import SceneGraph


class Adapter(Protocol):
    def read(self, root: Path) -> Iterator[SceneGraph]: ...


def image_bytes(dataset: str, root: Path, image_id: str) -> bytes | None:
    """The JPEG for one image, when the corpus does not publish images as loose files.

    VG150 and IndoorVG embed the image in the parquet row, so there is no `root/images/` for
    `cut_slice.py` to copy from. An adapter may expose `image_bytes` to serve them; one that
    does not simply has no bytes to offer here, and the caller falls back to the filesystem.
    See DEVIATIONS.md D7.
    """
    adapter = _REGISTRY.get(dataset)
    getter = getattr(adapter, "image_bytes", None)
    if getter is None:
        return None
    return getter(root, image_id)


# Corrected 2026-09-16 against corpora actually on disk. The first three entries were
# written from memory and two of them were wrong, which is the failure the docstring above
# predicted. What maelic publishes for VG150 and IndoorVG is COCO-format parquet with the
# image bytes embedded in the row -- no separate images/ directory, and no HDF5 at all.
# That also means a split is self-contained: the val shard alone carries enough images to
# cut a slice, so there is no reason to pull the full 14 GB.
LAYOUTS: dict[str, str] = {
    "vg150-sgb": "annotations/*.parquet + categories.json (COCO format, images embedded)",
    "psg": "psg.json + coco/val2017/ + coco/panoptic_val2017/ (masks in the panoptic PNG)",
    "vrd": "annotations_train.json, annotations_test.json, sg_dataset/",
    "indoorvg": "annotations/*.parquet + categories.json (COCO format, images embedded)",
    "haystack": "the Haystack release, as published, negatives included",
    "mini-isg": "frames/ plus this project's own annotations",
}

# The parquet row schema, read off the file rather than assumed:
#   image      struct<bytes: binary, path: string>
#   image_id   int64
#   width      int64
#   height     int64
#   file_name  string
#   objects    list<struct<area, bbox: list<double>, category_id, id>>
#   relations  list<struct<id, object_id, predicate_id, subject_id>>
# categories.json carries the id -> name maps the adapter needs for both.

_REGISTRY: dict[str, Adapter] = {}


def register(dataset: str, adapter: Adapter) -> None:
    _REGISTRY[dataset] = adapter


def read_dataset(dataset: str, root: Path) -> Iterator[SceneGraph]:
    adapter = _REGISTRY.get(dataset)
    if adapter is None:
        expected = LAYOUTS.get(dataset, "an unknown layout")
        raise SystemExit(
            f"no adapter for {dataset!r}.\n"
            f"  Expected corpus layout under {root}: {expected}\n"
            f"  Write system/backend/app/datasets/adapters/"
            f"{dataset.replace('-', '_')}.py exposing\n"
            f"  `read(root: Path) -> Iterator[SceneGraph]`, register it here, and write its test\n"
            f"  against the files actually on disk. See DEVIATIONS.md D6."
        )
    return adapter.read(root)


def _register_builtins() -> None:
    """Wire up the adapters that exist.

    Imported here rather than at module top so that a missing optional dependency disables one
    adapter instead of breaking every import of this package.
    """
    try:
        from app.datasets.adapters import indoorvg, psg, vg150_sgb
    except ImportError as exc:  # pragma: no cover - only when pyarrow is absent
        import warnings

        warnings.warn(f"COCO-parquet adapters unavailable: {exc}", stacklevel=2)
        return
    register(vg150_sgb.DATASET, vg150_sgb)  # type: ignore[arg-type]
    register(indoorvg.DATASET, indoorvg)  # type: ignore[arg-type]
    register(psg.DATASET, psg)  # type: ignore[arg-type]


_register_builtins()
