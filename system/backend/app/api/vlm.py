"""Contracts §1.9 — `POST /api/vlm/indvissgg`.

A miss in the transcript corpus and a missing API key both come back as 503 `vlm_unavailable`
with the reason intact. Neither is answered with an empty graph: a student would read an empty
revision as the model having found no fault, which is the opposite of what happened.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import Field

from app.errors import ApiError
from app.schema import DatasetId, Strict
from app.vlm import indvissgg
from app.vlm.provider import ProviderUnavailable, TranscriptMiss

router = APIRouter()


class Example(Strict):
    kind: Literal["positive", "negative"]
    triplet: tuple[str, str, str]
    analysis: str


class IndVisSGGRequest(Strict):
    image_data_url: str | None = None
    #: Checked here, before any call: the graph's own schema refused an unknown dataset only once
    #: every step had run, as a 500 after the paid calls (D120).
    dataset: DatasetId = "mini-isg"
    image_id: str = "isg-fig2-t1"
    O: list[str] = Field(default_factory=list)
    P: list[str] = Field(default_factory=list)
    E: list[Example] = Field(default_factory=list)
    #: 1, 2, 3 or 5 — the four counts Table 4 measures. Any other value would put a student's run
    #: beside a published row that does not exist.
    n_experts: Literal[1, 2, 3, 5] = 3
    steps: list[Literal[1, 2, 3]] = Field(default_factory=lambda: [1, 2, 3])
    ablate: list[Literal["O", "P", "E"]] = Field(default_factory=list)
    provider: Literal["transcript", "claude"] = "transcript"


@router.post("/vlm/indvissgg")
def indvissgg_run(req: IndVisSGGRequest) -> dict[str, Any]:
    if req.image_data_url is not None:
        # Nothing here sends an uploaded image to a model or keys a transcript on one, so the run
        # would answer for `image_id`'s frame: a graph of a picture the student did not send.
        raise ApiError("bad_request", 400, {
            "expected": "dataset and image_id; an uploaded image is not supported by this endpoint",
        })
    # An omitted list is the frame's default criteria; an empty one is an ablation (D39). `or None`
    # read both as the default.
    given = req.model_fields_set
    try:
        return indvissgg.run(
            image_ref=req.image_id,
            dataset=req.dataset,
            O=req.O if "O" in given else None,
            P=req.P if "P" in given else None,
            E=[e.model_dump() for e in req.E] if "E" in given else None,
            n_experts=req.n_experts,
            steps=list(req.steps),
            ablate=list(req.ablate),
            provider=req.provider,
        )
    except TranscriptMiss as exc:
        raise ApiError("vlm_unavailable", 503, {"provider": req.provider,
                                                "reason": str(exc)}) from exc
    except ProviderUnavailable as exc:
        raise ApiError("vlm_unavailable", 503, {"provider": req.provider,
                                                "reason": str(exc)}) from exc
