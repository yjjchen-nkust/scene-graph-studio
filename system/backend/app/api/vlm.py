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
from app.schema import Strict
from app.vlm import indvissgg
from app.vlm.provider import ProviderUnavailable, TranscriptMiss

router = APIRouter()


class Example(Strict):
    kind: Literal["positive", "negative"]
    triplet: tuple[str, str, str]
    analysis: str


class IndVisSGGRequest(Strict):
    image_data_url: str | None = None
    dataset: str = "mini-isg"
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
    try:
        return indvissgg.run(
            image_ref=req.image_id,
            dataset=req.dataset,
            O=req.O or None,
            P=req.P or None,
            E=[e.model_dump() for e in req.E] or None,
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
