from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.eval.engine import EvalRequest, evaluate

router = APIRouter()


@router.post("/eval")
def post_eval(req: EvalRequest) -> dict[str, Any]:
    return evaluate(req)
