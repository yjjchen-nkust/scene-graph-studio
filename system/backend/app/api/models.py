"""Contracts §1.6, §1.7 and §1.8.

Inference is the only endpoint group in this application that is allowed to be unavailable, and
it says so precisely: which model, why, whether `torch` is here and whether a checkpoint is. A
503 with a reason a student can act on is the whole point of the degradation path.
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter
from pydantic import Field

from app.errors import ApiError
from app.infer import registry
from app.schema import Strict
from app.settings import DATA_DIR

router = APIRouter()

#: A dataset, model or image id: a name, never a path. Dots are allowed inside one, not `..` alone.
SEGMENT = re.compile(r"(?!\.\.?$)[A-Za-z0-9_.-]+")


class InferRequest(Strict):
    image_data_url: str | None = None
    dataset: str | None = None
    image_id: str | None = None
    max_triplets: int = Field(default=100, ge=1, le=1000)


@router.get("/models")
def list_models() -> dict[str, Any]:
    return {"models": registry.describe_all()}


@router.post("/infer/{model}")
def infer(model: str, req: InferRequest) -> dict[str, Any]:
    entry = registry.BY_ID.get(model)
    if entry is None:
        raise ApiError("not_found", 404, {"model": model, "known": sorted(registry.BY_ID)})

    if req.image_data_url is None and not (req.dataset and req.image_id):
        raise ApiError(
            "bad_request", 400,
            {"expected": "either image_data_url, or both dataset and image_id"},
        )

    live, blocked = registry.liveness(entry)
    if not live:
        reason_en, reason_zh = blocked or ("", "")
        raise ApiError(
            "inference_unavailable", 503,
            {
                "model": model,
                "reason_en": reason_en,
                "reason_zh": reason_zh,
                "torch_present": registry.torch_present(),
                "checkpoint_present": registry.checkpoint_present(model),
            },
        )

    # Task 5 wires the one live path. Until then the registry can only ever report it unavailable,
    # so reaching this line means the registry and the implementation have drifted apart.
    raise ApiError(
        "inference_unavailable", 503,
        {
            "model": model,
            "reason_en": registry.NOT_WIRED_EN,
            "reason_zh": registry.NOT_WIRED_ZH,
            "torch_present": registry.torch_present(),
            "checkpoint_present": registry.checkpoint_present(model),
        },
    )


PREDICTIONS = DATA_DIR / "predictions"


@router.get("/predictions/{ds}/{model}/{image_id}")
def prediction(ds: str, model: str, image_id: str) -> dict[str, Any]:
    # The three segments are joined into a path, so `..` (or `..\` on Windows, which the router's
    # `[^/]+` admits) would read any `.json` the server can reach. A segment that is not a plain
    # name, or a path that resolves outside the predictions tree, is a prediction that is not here.
    path = (PREDICTIONS / ds / model / f"{image_id}.json").resolve()
    plain = all(SEGMENT.fullmatch(s) for s in (ds, model, image_id))
    if not plain or not path.is_relative_to(PREDICTIONS.resolve()) or not path.is_file():
        raise ApiError("not_found", 404, {"dataset": ds, "model": model, "image_id": image_id})
    return json.loads(path.read_text(encoding="utf-8"))
