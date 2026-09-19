from __future__ import annotations

import importlib.util
from functools import lru_cache
from typing import Any

from fastapi import APIRouter

from app.infer import registry
from app.settings import DATA_DIR, VERSION

router = APIRouter()

DATASETS = ["vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg", "placeholder"]


@lru_cache(maxsize=1)
def _torch_state() -> tuple[bool, str | None, bool]:
    """Probe torch without importing it. Importing costs seconds and defeats NFR-8."""
    if importlib.util.find_spec("torch") is None:
        return False, None, False
    import torch  # noqa: PLC0415 - deliberately lazy

    return True, torch.__version__, bool(torch.cuda.is_available())


@router.get("/health")
def health() -> dict[str, Any]:
    present_torch, version, cuda = _torch_state()
    images = {ds: DATA_DIR / "slices" / ds / "images" for ds in DATASETS}
    present = {ds: p.is_dir() and any(p.iterdir()) for ds, p in images.items()}
    return {
        "status": "ok",
        "version": VERSION,
        "torch_present": present_torch,
        "torch_version": version,
        "cuda_available": cuda,
        "device": "cuda" if cuda else "cpu",
        # The registry owns this question. Answering it here as well is how /api/health came
        # to advertise a model with no weights on the machine. D37.
        "live_models": registry.live_model_ids(),
        "vlm_provider": "transcript",
        "slices_present": present,
    }
