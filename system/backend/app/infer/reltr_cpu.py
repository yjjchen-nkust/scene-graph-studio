"""The one live inference path, and the three things that have to be true before it runs.

**Nothing from RelTR is vendored here, and nothing may be.** The GitHub API reports
`license: null` for `yrcong/RelTR` and the repository carries no LICENSE file, so the default
applies and no right to copy, modify or redistribute has been granted. The operator points
`SGS_RELTR_PATH` at their own clone; this module imports from it and never contains it.
`test_no_reltr_source_is_vendored_into_this_repository` fails the moment that stops being true.
DEVIATIONS D41.

`torch` is imported inside `infer`, never at module scope. NFR-1 makes the live path the only
degradable thing in the system, and a module-scope import would take the API down with it on a
machine that has no torch.

`to_scene_graph` is a pure function over the model's decoded output, so the part most likely to be
wrong is the part that can be tested without a GPU, a checkpoint or a licence.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.infer import registry
from app.schema import SceneGraph
from app.settings import DATA_DIR

MODEL = "reltr"
LATENCY = DATA_DIR / "predictions" / ".latency.json"
ENV_PATH = "SGS_RELTR_PATH"

NO_TORCH = "`torch` is not installed, so the live path cannot run."
NO_CHECKPOINT = (
    "No checkpoint on this machine. Download RelTR's own `checkpoint0149.pth` and put it in "
    "`data/checkpoints/reltr/`; it is not redistributed with this project."
)
NO_PACKAGE = registry.NO_PACKAGE_EN.format(env=ENV_PATH)


class InferenceUnavailable(RuntimeError):
    """The live path cannot run here, with the reason stated. Never a silent empty graph."""


# ── the latency estimate NFR-8 asks for ───────────────────────────────────────────────────────


def estimated_seconds_per_image() -> float | None:
    """A measured estimate, or None. A plausible constant would be believed, so there isn't one."""
    try:
        return json.loads(LATENCY.read_text(encoding="utf-8")).get(MODEL)
    except (OSError, ValueError):
        return None


def record_latency(seconds: float) -> None:
    """Store a measurement. Refuses anything that cannot have come from a run."""
    if not seconds > 0:
        raise ValueError(f"a measured latency is positive; got {seconds!r}")
    try:
        blob = json.loads(LATENCY.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        blob = {}
    blob[MODEL] = seconds
    LATENCY.parent.mkdir(parents=True, exist_ok=True)
    LATENCY.write_text(json.dumps(blob, indent=2) + "\n", encoding="utf-8")


# ── the three gates ───────────────────────────────────────────────────────────────────────────


def package_root() -> Path | None:
    """The operator's clone, or None. The *question* is answered in the registry, which is the
    single source of truth for what can run here; this returns the path once the answer is yes."""
    if not registry.package_present(MODEL):
        return None
    return Path(os.environ[ENV_PATH])


def checkpoint_file() -> Path | None:
    folder = registry.CHECKPOINTS / MODEL
    if not folder.is_dir():
        return None
    weights = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix in (".pth", ".pt"))
    return weights[0] if weights else None


def available() -> tuple[bool, str]:
    """Whether the live path can run, and if not, which of the three things is missing."""
    if not registry.torch_present():
        return False, NO_TORCH
    if not registry.checkpoint_present(MODEL):
        return False, NO_CHECKPOINT
    if package_root() is None:
        return False, NO_PACKAGE
    return True, ""


# ── the conversion, which needs neither weights nor torch ─────────────────────────────────────


def to_scene_graph(
    *,
    detections: list[dict[str, Any]],
    relations: list[dict[str, Any]],
    image_id: str,
    dataset: str,
    width: int,
    height: int,
    checkpoint: str,
    max_triplets: int,
) -> SceneGraph:
    """Decoded RelTR output as a `SceneGraph`, ranked and truncated.

    Truncation happens after ranking, so `max_triplets` drops the least confident rather than
    whatever came out of the decoder last. Objects are kept whole: a detection is part of the
    frame's content whether or not a surviving relation happens to reference it, and dropping
    them would make the object count depend on `max_triplets`.
    """
    objects = [
        {
            "object_id": i + 1,
            "names": [d["label"]],
            "bbox": {
                "x": float(d["bbox"][0]),
                "y": float(d["bbox"][1]),
                # A degenerate box would fail validation on a student's screen rather than here.
                "w": max(1e-6, float(d["bbox"][2]) - float(d["bbox"][0])),
                "h": max(1e-6, float(d["bbox"][3]) - float(d["bbox"][1])),
            },
        }
        for i, d in enumerate(detections)
    ]
    known = {o["object_id"] for o in objects}

    ranked = sorted(relations, key=lambda r: -float(r["score"]))
    relationships = []
    for r in ranked:
        subject_id, object_id = int(r["subject"]) + 1, int(r["object"]) + 1
        # SRS §3's invariant, enforced where the model output is read rather than where a
        # student would meet the ValidationError.
        if subject_id not in known or object_id not in known:
            continue
        relationships.append({
            "relationship_id": len(relationships) + 1,
            "subject_id": subject_id,
            "object_id": object_id,
            "predicate": r["predicate"],
            "score": float(r["score"]),
        })
        if len(relationships) >= max_triplets:
            break

    return SceneGraph.model_validate({
        "image_id": image_id,
        "dataset": dataset,
        "width": width,
        "height": height,
        "objects": objects,
        "relationships": relationships,
        "provenance": {
            "kind": "model",
            "fidelity": "measured",
            "model": MODEL,
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "note": f"RelTR, checkpoint {checkpoint}, run on this machine.",
        },
    })


# ── the live path ─────────────────────────────────────────────────────────────────────────────


def infer(
    image_bytes: bytes,
    *,
    image_id: str,
    dataset: str,
    max_triplets: int = 100,
) -> SceneGraph:
    """Run RelTR over one image on the CPU.

    Unverified end to end: this project holds no RelTR checkpoint and may not vendor the package,
    so the body below has never been executed against real weights. It is written to fail loudly
    rather than plausibly, and `PROVENANCE.md` records that no measured prediction exists yet.
    """
    ok, reason = available()
    if not ok:
        raise InferenceUnavailable(reason)

    root = package_root()
    assert root is not None  # `available` checked it
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    import time  # noqa: PLC0415 - local to the measured path

    import torch  # noqa: PLC0415 - NFR-1: lazy, never at module scope
    from models import build_model  # type: ignore[import-not-found]  # noqa: PLC0415

    checkpoint = checkpoint_file()
    if checkpoint is None:
        raise InferenceUnavailable(NO_CHECKPOINT)

    started = time.perf_counter()
    model, _, postprocessors = build_model(_args())
    # `weights_only=True`, always. The checkpoint is a .pth a human downloaded from a Google
    # Drive link; the default unpickles arbitrary objects, so loading it unguarded is remote
    # code execution wearing a file extension. A checkpoint that will not load this way is
    # one to inspect, not one to trust.
    state = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model.load_state_dict(state["model"])
    model.eval()

    decoded = _decode(model, postprocessors, image_bytes)
    record_latency(time.perf_counter() - started)

    return to_scene_graph(
        detections=decoded["detections"],
        relations=decoded["relations"],
        image_id=image_id,
        dataset=dataset,
        width=decoded["width"],
        height=decoded["height"],
        checkpoint=checkpoint.name,
        max_triplets=max_triplets,
    )


def _args() -> Any:
    """RelTR's `build_model` takes its argparse namespace. Supplied by the operator's clone,
    because the defaults belong to that code and not to this project."""
    from main import get_args_parser  # type: ignore[import-not-found]  # noqa: PLC0415

    return get_args_parser().parse_args([])


def _decode(model: Any, postprocessors: Any, image_bytes: bytes) -> dict[str, Any]:
    """Left to the operator's clone, which owns the transform and the class lists.

    Raising here rather than guessing is deliberate: RelTR's label vocabulary and box convention
    live in code this project is not licensed to copy, and a decoder written from memory would
    produce a graph that looks right and names the wrong classes.
    """
    raise InferenceUnavailable(
        "The decode step is not implemented. It needs RelTR's own transform, class list and "
        "postprocessor, which live in code this project may not vendor. Implement it against "
        f"your clone at {ENV_PATH} once a checkpoint is in place."
    )
