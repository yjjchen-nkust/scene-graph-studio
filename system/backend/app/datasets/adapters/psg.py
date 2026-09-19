"""PSG — Panoptic Scene Graph, as OpenPSG publishes it.

The only Tier-1 dataset with masks, which is what makes L6 Protocol Forensics possible: scoring
identical predictions under `single_mpo` and `multi_mpo` needs segments, not boxes.

Layout under `SGS_CORPUS_ROOT/psg/`:

    psg.json
    coco/val2017/<id>.jpg                 the photographs (not redistributable)
    coco/panoptic_val2017/<id>.png        one PNG per image, segment id per pixel

Three conventions, each read off the real file on 2026-09-16 rather than remembered, and each
pinned by a test because getting any of them wrong produces output that looks right:

  1. **`bbox_mode: 0` is Detectron2 `BoxMode.XYXY_ABS`.** The four numbers are two corners, not
     an origin and a size. Reading them as width and height yields boxes that are plausible and
     wrong, and nothing downstream would notice.
  2. **`relations` are positional.** `[0, 6, 3]` means `annotations[0] -> annotations[6]` under
     `predicate_classes[3]`. They are not object ids, and they are not segment ids.
  3. **`category_id` indexes `thing_classes + stuff_classes` concatenated**, 0..132. There is no
     separate stuff numbering to subtract.

The panoptic PNG encodes each pixel's segment id as `R + G*256 + B*65536`. A mask is recovered by
selecting the pixels carrying a given `segments_info[i].id`, then RLE-encoding them column-major
per COCO. The encoder is ours (D-12), so no pycocotools.

**A record whose photograph is not on disk is dropped, and counted.** `psg.json` covers 48,749
images drawn from both COCO train2017 (46,563) and val2017 (2,186), published as two separate
downloads of which the val half is 0.8 GB and the train half 18 GB. Whichever the author has
taken, the corpus on disk is a subset of what the annotations describe, and a scene whose
photograph is absent is not one the studio can display. Yielding it anyway would let
`cut_slice.py` write a slice whose annotations name images it cannot supply — a slice that
passes every schema check and teaches nothing, which is the failure D17 exists to prevent.

Masks, by contrast, stay best-effort: an image whose panoptic PNG is absent still reads, without
them. That is the difference between a scene missing its measurements and a scene missing itself,
and it is why `mask` is optional on `SGObject` while the photograph is not optional here.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from app.datasets.adapters._repairs import Repairs
from app.eval.rle import encode_counts
from app.schema import BBox, Provenance, RLEMask, SceneGraph, SGObject, SGRelationship

DATASET = "psg"

last_repairs = Repairs()


@lru_cache(maxsize=4)
def _blob(root: Path) -> dict:
    path = root / "psg.json"
    if not path.is_file():
        raise SystemExit(
            f"no psg.json at {path}\n"
            f"  OpenPSG publishes it through an interactive link; it cannot be fetched by a\n"
            f"  script. Download psg.json (not psg_val_test.json, whose test annotations are\n"
            f"  wiped) and place it there."
        )
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=4)
def _image_paths(root: Path) -> dict[str, str]:
    """image_id -> the photograph's path relative to `root/coco`.

    Built once. `image_bytes` is called per chosen image while a slice is cut, and a linear scan
    of 48,749 records per call would make that quadratic.
    """
    return {str(r["image_id"]): str(r.get("file_name", "")) for r in _blob(root)["data"]}


def _segment_masks(png: Path, height: int, width: int) -> dict[int, RLEMask]:
    """One RLE mask per segment id present in the panoptic PNG, column-major per COCO.

    Panoptic segments are mutually exclusive: every pixel carries exactly one id. That is what
    lets a single pass serve every segment at once. The pixels are walked once in COCO's
    column-major order, each maximal run of one id is recorded as an interval, and the
    alternating zero/one counts are assembled per segment from its own intervals. Testing every
    pixel against every segment instead costs segments x pixels, which on a 640x480 image
    carrying nine segments is 2.8 million comparisons rather than 307 thousand.
    """
    from PIL import Image

    with Image.open(png) as img:
        rgb = img.convert("RGB")
        if rgb.size != (width, height):
            # The annotation and the PNG disagree about the image. Trust neither.
            return {}
        raw = rgb.tobytes()  # row-major RGB triples

    total = width * height
    stride = width * 3
    intervals: dict[int, list[tuple[int, int]]] = {}
    previous = -1  # not a segment id, so the first pixel always opens an interval
    start = 0
    index = 0
    for x in range(width):
        offset = x * 3
        for _ in range(height):
            sid = raw[offset] + raw[offset + 1] * 256 + raw[offset + 2] * 65536
            if sid != previous:
                if previous > 0:  # id 0 is unlabelled, and no mask is wanted for it
                    intervals.setdefault(previous, []).append((start, index))
                previous = sid
                start = index
            index += 1
            offset += stride
    if previous > 0:
        intervals.setdefault(previous, []).append((start, total))

    masks: dict[int, RLEMask] = {}
    for sid, spans in intervals.items():
        runs: list[int] = []
        at = 0  # COCO RLE always starts with a run of zeros, possibly empty
        for lo, hi in spans:
            runs.append(lo - at)
            runs.append(hi - lo)
            at = hi
        if at < total:
            runs.append(total - at)
        masks[sid] = RLEMask(counts=encode_counts(runs), size=(height, width))
    return masks


def read(root: Path) -> Iterator[SceneGraph]:
    global last_repairs
    repairs = Repairs()
    last_repairs = repairs

    blob = _blob(root)
    names = list(blob["thing_classes"]) + list(blob["stuff_classes"])
    predicates = list(blob["predicate_classes"])

    for record in blob["data"]:
        photograph = root / "coco" / str(record.get("file_name", ""))
        if not photograph.is_file():
            repairs.rows_dropped += 1
            repairs.note("photograph not on disk")
            continue
        repairs.rows += 1

        height, width = int(record["height"]), int(record["width"])
        png = root / "coco" / str(record.get("pan_seg_file_name", ""))
        masks = _segment_masks(png, height, width) if png.is_file() else {}

        segments = record.get("segments_info") or []
        annotations = record.get("annotations") or []

        # Positional: index i in annotations pairs with index i in segments_info.
        objects: list[SGObject] = []
        index_to_id: dict[int, int] = {}
        for i, ann in enumerate(annotations):
            box = ann.get("bbox") or []
            if len(box) != 4:
                repairs.objects_dropped += 1
                repairs.note("bbox is not four numbers")
                continue
            x1, y1, x2, y2 = (float(v) for v in box)
            w, h = x2 - x1, y2 - y1
            if w <= 0 or h <= 0:
                # BBox requires both > 0; a zero-area segment is not a measurement
                repairs.objects_dropped += 1
                repairs.note("zero-area bbox")
                continue
            cid = int(ann["category_id"])
            if cid >= len(names):
                repairs.objects_dropped += 1
                repairs.note("category_id past the class list")
                continue
            segment = segments[i] if i < len(segments) else {}
            sid = int(segment.get("id", i + 1))
            objects.append(
                SGObject(
                    object_id=sid,
                    names=[names[cid]],
                    bbox=BBox(x=x1, y=y1, w=w, h=h),
                    mask=masks.get(sid),
                )
            )
            index_to_id[i] = sid

        relationships: list[SGRelationship] = []
        for n, triple in enumerate(record.get("relations") or []):
            if len(triple) != 3:
                repairs.relations_dropped += 1
                repairs.note("relation is not a triple")
                continue
            s_idx, o_idx, p_idx = (int(v) for v in triple)
            # An index past the end, or naming an object dropped above, cannot be represented.
            if s_idx not in index_to_id or o_idx not in index_to_id:
                repairs.relations_dropped += 1
                repairs.note("relation names a missing object")
                continue
            if not 0 <= p_idx < len(predicates):
                repairs.relations_dropped += 1
                repairs.note("predicate index past the predicate list")
                continue
            relationships.append(
                SGRelationship(
                    relationship_id=n + 1,
                    subject_id=index_to_id[s_idx],
                    object_id=index_to_id[o_idx],
                    predicate=predicates[p_idx],
                    score=None,
                )
            )

        yield SceneGraph(
            image_id=str(record["image_id"]),
            dataset=DATASET,  # type: ignore[arg-type]
            width=width,
            height=height,
            objects=objects,
            relationships=relationships,
            provenance=Provenance(kind="ground_truth", fidelity="measured"),
        )


def image_bytes(root: Path, image_id: str) -> bytes | None:
    """PSG's images are COCO photographs on disk, so this is a straight read."""
    name = _image_paths(root).get(str(image_id))
    if not name:
        return None
    path = root / "coco" / name
    return path.read_bytes() if path.is_file() else None
