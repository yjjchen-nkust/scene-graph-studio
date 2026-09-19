from __future__ import annotations

import base64
from typing import Any

from fastapi import APIRouter, Query

from app.datasets.licences import gates_for
from app.datasets.loader import (
    DATASETS,
    MEDIA_TYPES,
    distribution_mode,
    image_file,
    images_present,
    load_slice,
)
from app.errors import ApiError

router = APIRouter()

NAMES: dict[str, tuple[str, str]] = {
    "vrd": ("Visual Relationship Detection", "視覺關係偵測資料集"),
    "vg150-sgb": (
        "Visual Genome 150 (Xu split, SGB redistribution)",
        "Visual Genome 150（Xu 分割）",
    ),
    "psg": ("Panoptic Scene Graph", "全景場景圖資料集"),
    "indoorvg": ("IndoorVG", "室內場景 VG 子集"),
    "haystack": ("Haystack", "Haystack 評測集"),
    "mini-isg": ("mini-ISG (this project's teaching set)", "mini-ISG（本專案自建教學集）"),
    "placeholder": ("Synthetic placeholder frames", "合成佔位影像"),
}


def _counts(ds: str) -> tuple[int, int, int, bool]:
    graphs = load_slice(ds)
    objects = {o.names[0] for g in graphs for o in g.objects}
    predicates = {r.predicate for g in graphs for r in g.relationships}
    masks = any(o.mask for g in graphs for o in g.objects)
    return len(graphs), len(objects), len(predicates), masks


@router.get("/datasets")
def list_datasets() -> dict[str, Any]:
    rows = []
    for ds in DATASETS:
        n_images, n_objects, n_predicates, has_masks = _counts(ds)
        gates = gates_for(ds)
        en, zh = NAMES[ds]
        rows.append({
            "id": ds,
            "name_en": en,
            "name_zh": zh,
            "image_count": n_images,
            "object_class_count": n_objects,
            "predicate_class_count": n_predicates,
            "has_masks": has_masks,
            "licence": gates.licence,
            "licence_url": gates.statement_url,
            "licence_commit_cleared": gates.annotations_commit,
            "licence_bundle_cleared": gates.bundle_distribute,
            "images_present": images_present(ds),
            "distribution": distribution_mode(ds),
            "notes_en": "" if n_images else "No slice has been cut for this dataset yet.",
            "notes_zh": "" if n_images else "尚未由此資料集切出教學切片。",
        })
    return {"datasets": rows}


@router.get("/datasets/{ds}/images")
def list_slice_images(ds: str) -> dict[str, Any]:
    """The frames in a slice, in the order the annotations are committed in.

    A standalone lab route has to choose a frame before it can ask for one, and nothing else in
    the API says which frames exist. The alternatives were an id guessed from a naming
    convention and a copy of every slice manifest bundled into the frontend; both put a second
    statement of what was cut somewhere the cutter does not maintain. Deviation D60.

    `present` is per frame rather than per dataset because a partially unpacked bundle is the
    case the lab has to survive, and a dataset-level flag would tell it the wrong thing about
    exactly the frame it is about to request.
    """
    if ds not in DATASETS:
        raise ApiError("not_found", 404, {"dataset": ds})
    graphs = load_slice(ds)
    return {
        "dataset": ds,
        "image_count": len(graphs),
        "images": [
            {
                "image_id": g.image_id,
                "width": g.width,
                "height": g.height,
                "object_count": len(g.objects),
                "relationship_count": len(g.relationships),
                "present": image_file(ds, g.image_id) is not None,
            }
            for g in graphs
        ],
    }


@router.get("/datasets/{ds}/images/{image_id}")
def get_image_graph(ds: str, image_id: str, include_image: bool = Query(False)) -> dict[str, Any]:
    if ds not in DATASETS:
        raise ApiError("not_found", 404, {"dataset": ds})
    graph = next((g for g in load_slice(ds) if g.image_id == image_id), None)
    if graph is None:
        raise ApiError("not_found", 404, {"dataset": ds, "image_id": image_id})
    body = graph.model_dump()
    if include_image:
        path = image_file(ds, image_id)
        if path is None:
            raise ApiError("slice_images_missing", 422, {
                "dataset": ds,
                "image_id": image_id,
                "action_en": (
                    "Unpack the slice bundle into data/slices/, then run "
                    "`python backend/scripts/verify_bundle.py`."
                ),
                "action_zh": (
                    "請將課程發放的 slice bundle 解壓縮至 data/slices/，"
                    "再執行 verify_bundle.py。"
                ),
            })
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        media = MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")
        body["image_data_url"] = f"data:{media};base64,{encoded}"
    return body
