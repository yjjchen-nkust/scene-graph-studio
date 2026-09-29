"""Derive the two files the M0 demonstrations' frontend reads.

`traditional.json` (D-T) and `indvissgg.json` (D-V) are pure functions of what was recorded: the
ten SceneGraph files under `data/demos/m0/traditional/`, `detections.json`, the vg150-sgb slice,
and the transcript `data/vlm/transcripts/m0-demo.json`. Nothing is measured or called here. The
shapes are the frontend's contract; the frontend mirrors them in TypeScript.

    node tools/py.mjs backend/scripts/build_demo_m0.py           # write both files
    node tools/py.mjs backend/scripts/build_demo_m0.py --check   # exit 1 naming a file that differs

Neither `torch` nor `anthropic` is imported (NFR-1).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets.loader import load_slice  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402
from app.vlm import indvissgg  # noqa: E402
from app.vlm.prompts import EXAMPLES_ISG, O_ISG, P_ISG, step1_prompt  # noqa: E402
from scripts.record_demo_traditional import (  # noqa: E402
    MODEL,
    O_ISG_COCO,
    THRESHOLD,
    VG150_PREDICATES,
    classify,
    frequency_table,
    map_class,
    most_frequent,
    slice_classes,
)

DEMO_DIR = DATA_DIR / "demos" / "m0"
MANIFEST = DEMO_DIR / "MANIFEST.json"
GRAPHS = DEMO_DIR / "traditional"
SCORES = DEMO_DIR / "detections.json"
TRANSCRIPT = DATA_DIR / "vlm" / "transcripts" / "m0-demo.json"
TRADITIONAL = DEMO_DIR / "traditional.json"
INDVISSGG = DEMO_DIR / "indvissgg.json"

SLICE = "vg150-sgb"
WEIGHTS = "fasterrcnn_resnet50_fpn_coco-258fb6c6.pth"
CALLS_PER_FRAME = 5
N_EXPERTS = 3


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _text(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def build_traditional() -> dict[str, Any]:
    manifest = _read(MANIFEST)
    scores = _read(SCORES)
    graphs = load_slice(SLICE)
    table, classes, fallback = frequency_table(graphs), slice_classes(graphs), most_frequent(graphs)

    frames: list[dict[str, Any]] = []
    class_map: dict[str, str | None] = {}
    provenance: dict[str, Any] | None = None
    for entry in manifest["frames"]:
        image_id = entry["image_id"]
        graph = _read(GRAPHS / f"{image_id}.json")
        provenance = provenance or graph["provenance"]
        objects = graph["objects"]
        if len(scores[image_id]) != len(objects):
            raise ValueError(f"{image_id}: {len(scores[image_id])} scores, {len(objects)} objects")
        label = {o["object_id"]: o["names"][0] for o in objects}
        for name in label.values():
            class_map[name] = map_class(name, classes)
        detections = [
            {
                "object_id": o["object_id"],
                "label": o["names"][0],
                "score": score,
                "bbox": {k: o["bbox"][k] for k in ("x", "y", "w", "h")},
            }
            for o, score in zip(objects, scores[image_id], strict=True)
        ]
        relations = []
        for r in graph["relationships"]:
            predicate, source = classify(
                map_class(label[r["subject_id"]], classes),
                map_class(label[r["object_id"]], classes),
                table,
                fallback,
            )
            if predicate != r["predicate"]:
                raise ValueError(f"{image_id}: relation {r['relationship_id']} differs on re-run")
            relations.append({
                "subject_id": r["subject_id"], "object_id": r["object_id"],
                "predicate": r["predicate"], "from": source,
            })
        frames.append({
            "image_id": image_id,
            "t": entry["timestamp_seconds"],
            "keyframe": entry["keyframe"],
            "width": entry["width"],
            "height": entry["height"],
            "detections": detections,
            "relations": relations,
        })
    assert provenance is not None
    predicates = sorted({r.predicate for g in graphs for r in g.relationships})
    return {
        "$schema_version": 1,
        "provenance": {
            "model": MODEL,
            "fidelity": "measured",
            "generated_at": provenance["generated_at"],
            "note_en": provenance["note"],
            "note_zh": (
                f"本檔之偵測由 Faster R-CNN ResNet-50 FPN（COCO_V1 權重）取得，僅保留分數不低於 "
                f"{THRESHOLD} 之偵測；每一有序物件對之謂詞取該類別對於 vg150-sgb 切片 "
                f"{len(graphs)} 個影格中最常見者（FREQ 形式），該類別對未曾出現或任一類別非切片"
                f"類別時，取 `{fallback}`。"
            ),
        },
        "detector": {"weights": WEIGHTS, "threshold": THRESHOLD},
        "prior": {
            "dataset": SLICE,
            "frames": len(graphs),
            "rows": sum(len(g.relationships) for g in graphs),
            "fallback": fallback,
            "predicates": predicates,
        },
        "class_map": dict(sorted(class_map.items())),
        "o_isg_coco": {name: O_ISG_COCO[name] for name in O_ISG},
        "vg150_predicate_count": VG150_PREDICATES,
        "frames": frames,
    }


def build_indvissgg() -> dict[str, Any]:
    manifest = _read(MANIFEST)
    transcript = _read(TRANSCRIPT)
    completion = {e["case"]: e["completion"] for e in transcript["exchanges"]}

    def rows(text: str) -> list[list[str]]:
        return [list(t) for t in indvissgg.parse_triplets(text)]

    frames = []
    for entry in manifest["frames"]:
        image_id = entry["image_id"]
        experts = []
        for index in range(1, N_EXPERTS + 1):
            text = completion[f"{image_id}/expert{index}"]
            analysis_en, analysis_zh = indvissgg.parse_analysis(text)
            experts.append({
                "index": index,
                "revision": rows(indvissgg.revision_text(text)),
                "analysis_en": analysis_en,
                "analysis_zh": analysis_zh,
            })
        frames.append({
            "image_id": image_id,
            "t": entry["timestamp_seconds"],
            "keyframe": entry["keyframe"],
            "draft": rows(completion[f"{image_id}/step1"]),
            "experts": experts,
            "summary": rows(completion[f"{image_id}/step3"]),
        })
    return {
        "$schema_version": 1,
        "provenance": transcript["provenance"],
        "O": list(O_ISG),
        "P": list(P_ISG),
        "E": EXAMPLES_ISG,
        "prompt_step1": step1_prompt(list(O_ISG), list(P_ISG), EXAMPLES_ISG),
        "calls_per_frame": CALLS_PER_FRAME,
        "frames": frames,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="compare, write nothing")
    args = parser.parse_args(argv)
    built = {TRADITIONAL: _text(build_traditional()), INDVISSGG: _text(build_indvissgg())}
    if args.check:
        for path, text in built.items():
            current = path.read_text(encoding="utf-8") if path.exists() else None
            if current != text:
                print(f"differs: {path}", file=sys.stderr)
                return 1
        return 0
    for path, text in built.items():
        path.write_text(text, encoding="utf-8", newline="")
        print(f"wrote {path} ({len(text.encode('utf-8'))} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
