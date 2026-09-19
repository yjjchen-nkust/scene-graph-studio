from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from app.schema import SceneGraph
from app.settings import DATA_DIR

DATASETS = ("vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg", "placeholder")

SELECTION_RULE = (
    "at least 4 objects; at least 3 relationships; at least one relationship whose predicate "
    "is outside the slice's ten most frequent"
)


def slice_dir(ds: str):
    return DATA_DIR / "slices" / ds


def images_present(ds: str) -> bool:
    d = slice_dir(ds) / "images"
    return d.is_dir() and any(d.iterdir())


@cache
def load_slice(ds: str) -> tuple[SceneGraph, ...]:
    path = slice_dir(ds) / "annotations.json"
    if not path.is_file():
        return ()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(SceneGraph.model_validate(g) for g in raw["graphs"])


def top_predicates(graphs: list[SceneGraph], n: int = 10) -> set[str]:
    counts: dict[str, int] = {}
    for g in graphs:
        for r in g.relationships:
            counts[r.predicate] = counts.get(r.predicate, 0) + 1
    return {p for p, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]}


def selection_ok(g: SceneGraph, head: set[str] | None = None, n: int = 10) -> bool:
    """D-10's selection rule. Asserted by a test, not merely documented.

    The tail condition -- one relationship outside the slice's `n` most frequent predicates --
    needs a slice with more than `n` predicates in it. mini-ISG's whole dictionary is seven
    words, so no frame drawn from it can have an eighth-most-frequent predicate, and applying
    the condition anyway rejected all forty frames for having a small vocabulary rather than for
    being badly chosen. Where there is no tail, the condition is vacuous and is not applied.
    """
    if len(g.objects) < 4 or len(g.relationships) < 3:
        return False
    graphs = list(load_slice(g.dataset))
    if head is None:
        head = top_predicates(graphs, n)
    vocabulary = {r.predicate for x in graphs for r in x.relationships}
    if len(vocabulary) <= n:
        return True
    return any(r.predicate not in head for r in g.relationships)


def distribution_mode(ds: str) -> str:
    """How students obtain this slice's images: 'bundle', 'fetch', or 'none' if not cut yet.

    A licence fact recorded at cut time (data/LICENCES.md), not a runtime preference.
    """
    path = slice_dir(ds) / "MANIFEST.json"
    if not path.is_file():
        return "none"
    return json.loads(path.read_text(encoding="utf-8")).get("distribution", "fetch")


# The extension is a property of the source, not of the project: cut_slice.py copies the bytes the
# corpus published, and every corpus so far publishes JPEG. Only the synthetic placeholder slice is
# PNG, which is the whole reason a hard-coded ".png" survived so long -- it was the one slice the
# tests had.
MEDIA_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def image_file(ds: str, image_id: str) -> Path | None:
    """The image file for one slice image, or None if it is not unpacked.

    MANIFEST.json is authoritative: it records the file each annotation was cut against, together
    with the sha256 the bundle verifier checks. Guessing an extension instead is how a real slice
    came to be unreachable through the API while every test stayed green.
    """
    manifest = slice_dir(ds) / "MANIFEST.json"
    if manifest.is_file():
        blob = json.loads(manifest.read_text(encoding="utf-8"))
        for row in blob.get("images", []):
            if str(row.get("image_id")) == str(image_id):
                path = slice_dir(ds) / str(row["file"])
                return path if path.is_file() else None
    # No manifest: a hand-assembled slice. Accept the extensions the project can serve.
    for suffix in MEDIA_TYPES:
        path = slice_dir(ds) / "images" / f"{image_id}{suffix}"
        if path.is_file():
            return path
    return None
