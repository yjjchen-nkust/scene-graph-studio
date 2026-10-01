"""What can actually run on this machine, and why the rest cannot.

The registry is the single source of truth for that question. `/api/health` used to answer it
separately, reporting `live_models: ["reltr"]` whenever `import torch` would succeed -- on a
machine with no weights anywhere. Two answers to one question is one answer too many, and the one
that was wrong was the cheerful one. DEVIATIONS D37.

Nothing here imports `torch`. NFR-1 makes the live path the only degradable thing in the system,
and a registry that imported the dependency it reports on would take the whole API down with it.
"""

from __future__ import annotations

import importlib.util
import json
import os
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any, Literal

from app.settings import DATA_DIR

Family = Literal["two_stage", "one_stage", "panoptic", "vlm"]

CHECKPOINTS = DATA_DIR / "checkpoints"
LATENCY = DATA_DIR / "predictions" / ".latency.json"

MASKRCNN_EN = (
    "This model needs `maskrcnn-benchmark`, which is unmaintained and pinned to a PyTorch and "
    "CUDA generation this project does not install."
)
MASKRCNN_ZH = (
    "本模型需要 `maskrcnn-benchmark`，該套件已停止維護，且綁定本專案並未安裝的 PyTorch 與 "
    "CUDA 世代。"
)
DETECTRON2_EN = "This model needs `detectron2`, which does not build in this environment."
DETECTRON2_ZH = "本模型需要 `detectron2`，該套件無法於本環境建置。"
# Plan 03 phrases this as "Predictions are committed; live inference is not wired up." The
# first half is a claim about the repository that was false when it was written and will be
# false again whenever a set is removed. Whether a prediction set exists is what
# `predictions_available` is for; a blocked reason says only why the live path is shut.
NOT_WIRED_EN = "Live inference is not wired up for this model."
NOT_WIRED_ZH = "本模型的即時推論尚未接通。"
NO_TORCH_EN = "`torch` is not installed, so the live path cannot run."
NO_TORCH_ZH = "未安裝 `torch`，因此無法執行即時推論。"
NO_CHECKPOINT_EN = (
    "`torch` is present but no checkpoint is on this machine. Put the weights under "
    "`data/checkpoints/{model}/`."
)
NO_CHECKPOINT_ZH = "`torch` 已安裝，但本機未放置權重檔。請將權重置於 `data/checkpoints/{model}/`。"
NO_PACKAGE_EN = (
    "{env} is not set. RelTR declares no licence -- the GitHub API reports `license: null` "
    "for yrcong/RelTR -- so its source is not vendored here. Clone it yourself and point "
    "{env} at the clone."
)
NO_PACKAGE_ZH = (
    "尚未設定 {env}。RelTR 未載明任何授權條款（GitHub API 就 yrcong/RelTR 回報 `license: null`），"
    "故本專案並未內含其原始碼。請自行 clone 該專案，並將 {env} 指向該目錄。"
)

#: Models whose source this project may not carry, and the variable that points at a clone.
EXTERNAL_PACKAGE: dict[str, str] = {"reltr": "SGS_RELTR_PATH"}


@dataclass(frozen=True)
class Model:
    id: str
    name: str
    family: Family
    year: int
    venue: str
    paper_key: str
    #: None when the model can never run here; otherwise the reason is decided per machine.
    blocked: tuple[str, str] | None


MODELS: tuple[Model, ...] = (
    Model("reltr", "RelTR", "one_stage", 2023, "TPAMI", "reltr-2023", None),
    Model("egtr", "EGTR", "one_stage", 2024, "CVPR", "egtr-2024", (NOT_WIRED_EN, NOT_WIRED_ZH)),
    Model("motifs", "Neural Motifs", "two_stage", 2018, "CVPR", "neural-motifs-2018",
          (MASKRCNN_EN, MASKRCNN_ZH)),
    Model("vctree", "VCTree", "two_stage", 2019, "CVPR", "vctree-2019",
          (MASKRCNN_EN, MASKRCNN_ZH)),
    Model("psgformer", "PSGFormer", "panoptic", 2022, "ECCV", "psgformer-2022",
          (DETECTRON2_EN, DETECTRON2_ZH)),
)

BY_ID = {m.id: m for m in MODELS}

#: The one model whose liveness is a property of the machine rather than of the project.
LIVE_CAPABLE = frozenset({"reltr"})

#: The models whose `/api/infer` path runs. Empty while `reltr_cpu._decode` raises (D41): with all
#: three gates open, liveness said yes and the endpoint answered 503, which is D37 again (D120).
WIRED: frozenset[str] = frozenset()


def torch_present() -> bool:
    """True when `torch` could be imported. Probed, never imported: NFR-8's cold start."""
    return importlib.util.find_spec("torch") is not None


def checkpoint_present(model: str) -> bool:
    """True when any weights file sits under `data/checkpoints/<model>/`.

    Deliberately not a filename. Task 5 pins the exact release RelTR's loader expects; until it
    does, asserting a name here would be a guess reported as a capability.
    """
    folder = CHECKPOINTS / model
    return folder.is_dir() and any(p.is_file() for p in folder.iterdir())


def package_present(model: str) -> bool:
    """True when the operator has pointed this model's env var at a real directory.

    The third gate, and the one that is about licensing rather than hardware: a model whose code
    this project may not carry can only run against a clone somebody else made. D41.
    """
    env = EXTERNAL_PACKAGE.get(model)
    if env is None:
        return True
    raw = os.environ.get(env)
    return bool(raw) and Path(raw).is_dir()


def estimated_seconds_per_image(model: str) -> float | None:
    """A measured estimate, or None. NFR-8 asks for a measurement and a guess would be believed."""
    try:
        return json.loads(LATENCY.read_text(encoding="utf-8")).get(model)
    except (OSError, ValueError):
        return None


def liveness(model: Model) -> tuple[bool, tuple[str, str] | None]:
    if model.blocked is not None:
        return False, model.blocked
    if model.id not in LIVE_CAPABLE:
        return False, (NOT_WIRED_EN, NOT_WIRED_ZH)
    if not torch_present():
        return False, (NO_TORCH_EN, NO_TORCH_ZH)
    if not checkpoint_present(model.id):
        return False, (NO_CHECKPOINT_EN, NO_CHECKPOINT_ZH)
    if not package_present(model.id):
        env = EXTERNAL_PACKAGE[model.id]
        return False, (NO_PACKAGE_EN.format(env=env), NO_PACKAGE_ZH.format(env=env))
    # Last, so that the three gates above still name what this machine lacks.
    if model.id not in WIRED:
        return False, (NOT_WIRED_EN, NOT_WIRED_ZH)
    return True, None


@cache
def predictions_available(model: str) -> list[dict[str, str]]:
    """Which datasets hold a committed prediction set for this model, and at what fidelity.

    Read off the files rather than declared, so a set that is deleted stops being advertised.

    Cached: the prediction tree does not change while the server runs, and `/api/models` would
    otherwise re-read every file on every request. `reload()` drops it for a process that has just
    written new predictions.
    """
    root = DATA_DIR / "predictions"
    if not root.is_dir():
        return []
    out: list[dict[str, str]] = []
    for folder in sorted(root.iterdir()):
        target = folder / model
        if not target.is_dir():
            continue
        fidelities = set()
        for path in sorted(target.glob("*.json")):
            try:
                fidelities.add(json.loads(path.read_text(encoding="utf-8"))
                               ["provenance"]["fidelity"])
            except (OSError, ValueError, KeyError):
                continue
        for fidelity in sorted(fidelities):
            out.append({"dataset": folder.name, "fidelity": fidelity})
    return out


def describe(model: Model) -> dict[str, Any]:
    live, blocked = liveness(model)
    return {
        "id": model.id,
        "name": model.name,
        "family": model.family,
        "year": model.year,
        "venue": model.venue,
        "paper_key": model.paper_key,
        "live": live,
        "live_blocked_reason_en": None if blocked is None else blocked[0],
        "live_blocked_reason_zh": None if blocked is None else blocked[1],
        "estimated_seconds_per_image": estimated_seconds_per_image(model.id),
        "predictions_available": predictions_available(model.id),
    }


def describe_all() -> list[dict[str, Any]]:
    return [describe(m) for m in MODELS]


def live_model_ids() -> list[str]:
    """What can run here. Deliberately not `describe_all()`.

    Liveness is three cheap checks; `predictions_available` walks the prediction tree. Answering
    the first question by computing the second put thirty file reads inside NFR-8's 50 ms health
    budget, and `test_health_answers_quickly_once_warm` caught it. D44.
    """
    return [m.id for m in MODELS if liveness(m)[0]]


def reload() -> None:
    """Drop the prediction-tree cache. For a process that has just written new predictions."""
    predictions_available.cache_clear()
