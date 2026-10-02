"""Record D-T, the traditional scene-graph pipeline, over the ten M0 demonstration frames.

Three stages, each a plain function so that each can be shown and tested on its own:

1. detect: torchvision's Faster R-CNN (ResNet-50 FPN, COCO_V1 weights), scores >= THRESHOLD.
2. enumerate: every ordered pair (i, j), i != j, of the detections.
3. classify: for each pair, the predicate most frequent for that pair of classes over the
   vg150-sgb slice (FREQ in form), or `on` when the pair was never seen.

Reads `data/demos/m0/MANIFEST.json` and the frames; writes one SceneGraph per frame under
`data/demos/m0/traditional/` and the detection scores to `data/demos/m0/detections.json`. The
scores live in their own file because the schema forbids a score on an object, and the provenance
audit reads every `*.json` under the graphs' directory as a SceneGraph.

`torch` and `torchvision` are imported inside `detect` only (NFR-1).
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Literal, TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.loader import load_slice  # noqa: E402
from app.schema import SceneGraph  # noqa: E402
from app.settings import DATA_DIR, require_data_dir  # noqa: E402

MODEL = "fasterrcnn-r50fpn-coco+freq-vg150sgb"
THRESHOLD = 0.5
VG150_PREDICATES = 50
OUT = DATA_DIR / "demos" / "m0" / "traditional"
SCORES = DATA_DIR / "demos" / "m0" / "detections.json"
MANIFEST = DATA_DIR / "demos" / "m0" / "MANIFEST.json"

#: COCO label to slice class, where the names differ. A label equal to a slice class maps to itself.
CLASS_SYNONYMS: dict[str, str] = {
    "dining table": "table",
    "cell phone": "phone",
}

#: Each `O_ISG` class to the COCO category naming the same kind of thing, or None. `hand` is None
#: because COCO's `person` is the whole body, not a hand.
O_ISG_COCO: dict[str, str | None] = {
    "hand": None,
    "beam": None,
    "brace": None,
    "block": None,
    "wheel": None,
    "axle": None,
    "pin": None,
    "nut": None,
    "washer": None,
    "assembly": None,
    "instruction sheet": None,
    "workbench": "dining table",
}

class Detection(TypedDict):
    label: str
    score: float
    box: tuple[float, float, float, float]  # x, y, w, h in pixels



FrequencyTable = dict[tuple[str, str], Counter[str]]


def slice_classes(graphs) -> set[str]:
    return {o.names[0] for g in graphs for o in g.objects}


def map_class(label: str, classes: set[str]) -> str | None:
    if label in classes:
        return label
    target = CLASS_SYNONYMS.get(label)
    return target if target in classes else None


def frequency_table(graphs) -> FrequencyTable:
    table: FrequencyTable = {}
    for g in graphs:
        names = {o.object_id: o.names[0] for o in g.objects}
        for r in g.relationships:
            key = (names[r.subject_id], names[r.object_id])
            table.setdefault(key, Counter())[r.predicate] += 1
    return table


def most_frequent(graphs) -> str:
    counts = Counter(r.predicate for g in graphs for r in g.relationships)
    return min(counts, key=lambda p: (-counts[p], p))


def classify(
    subject: str | None, obj: str | None, table: FrequencyTable, fallback: str
) -> tuple[str, Literal["prior", "fallback"]]:
    counts = table.get((subject, obj)) if subject is not None and obj is not None else None
    if not counts:
        return fallback, "fallback"
    return min(counts, key=lambda p: (-counts[p], p)), "prior"


def to_scene_graph(
    image_id: str,
    width: int,
    height: int,
    detections: list[Detection],
    table: FrequencyTable,
    classes: set[str],
    fallback: str,
    generated_at: str,
) -> SceneGraph:
    objects = [
        {
            "object_id": i,
            "names": [d["label"]],
            "bbox": {"x": d["box"][0], "y": d["box"][1], "w": d["box"][2], "h": d["box"][3]},
        }
        for i, d in enumerate(detections)
    ]
    mapped = [map_class(d["label"], classes) for d in detections]
    relationships = []
    for i in range(len(detections)):
        for j in range(len(detections)):
            if i == j:
                continue
            predicate, _ = classify(mapped[i], mapped[j], table, fallback)
            relationships.append({
                "relationship_id": len(relationships), "subject_id": i, "object_id": j,
                "predicate": predicate, "score": None,
            })
    note = (
        f"Faster R-CNN ResNet-50 FPN, COCO_V1 weights, detections with score >= {THRESHOLD}; "
        f"every ordered pair takes the predicate most frequent for its class pair over the "
        f"vg150-sgb slice's 80 frames (FREQ in form), or `{fallback}` when the pair is unseen "
        f"or a class is not a slice class."
    )
    return SceneGraph.model_validate({
        "image_id": image_id, "dataset": "mini-isg", "width": width, "height": height,
        "objects": objects, "relationships": relationships,
        "provenance": {
            "kind": "model", "fidelity": "measured", "model": MODEL,
            "generated_at": generated_at, "note": note,
        },
    })


@lru_cache(maxsize=1)
def _detector():
    import torch
    from torchvision.models.detection import (
        FasterRCNN_ResNet50_FPN_Weights,
        fasterrcnn_resnet50_fpn,
    )

    weights = FasterRCNN_ResNet50_FPN_Weights.COCO_V1
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = fasterrcnn_resnet50_fpn(weights=weights).eval().to(device)
    return model, weights.meta["categories"], device


def detect(path: Path) -> list[Detection]:
    import torch
    from PIL import Image
    from torchvision.transforms.functional import to_tensor

    model, categories, device = _detector()
    image = to_tensor(Image.open(path).convert("RGB")).to(device)
    with torch.no_grad():
        out = model([image])[0]
    found: list[Detection] = []
    for box, label, score in zip(out["boxes"].tolist(), out["labels"].tolist(),
                                 out["scores"].tolist(), strict=True):
        if score < THRESHOLD:
            continue
        x1, y1, x2, y2 = box
        found.append({"label": categories[label], "score": score,
                      "box": (x1, y1, x2 - x1, y2 - y1)})
    return found


def _write(path: Path, payload: object) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8", newline="")


def main() -> None:
    require_data_dir()
    import torch
    import torchvision

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    graphs = load_slice("vg150-sgb")
    table, classes, fallback = frequency_table(graphs), slice_classes(graphs), most_frequent(graphs)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    OUT.mkdir(parents=True, exist_ok=True)

    _, _, device = _detector()
    print(f"torch {torch.__version__}, torchvision {torchvision.__version__}, device {device}")
    if device == "cuda":
        print(f"gpu {torch.cuda.get_device_name(0)}")
    scores: dict[str, list[float]] = {}
    labels: Counter[str] = Counter()
    for frame in manifest["frames"]:
        image_id = frame["image_id"]
        detections = detect(MANIFEST.parent / frame["file"])
        sg = to_scene_graph(image_id, frame["width"], frame["height"], detections, table,
                            classes, fallback, generated_at)
        _write(OUT / f"{image_id}.json", sg.model_dump(mode="json"))
        scores[image_id] = [d["score"] for d in detections]
        labels.update(d["label"] for d in detections)
        print(f"{image_id}: {len(detections)} detections, "
              f"{len(sg.relationships)} ordered pairs")
    _write(SCORES, scores)
    for label, n in sorted(labels.items()):
        print(f"label {label!r} x{n} -> {map_class(label, classes)!r}")


if __name__ == "__main__":
    main()
