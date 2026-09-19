"""The reconstructed tier of D-07: predictions built to exhibit a behaviour, labelled as such.

**Nothing here is a model's output, and nothing here reproduces a published number.** Plan 03
Task 4 describes this as taking "a target recall profile"; targeting a published figure would
invite the reading that the file reproduces it, which on a six-image placeholder slice it cannot.
What a profile states is narrower and checkable: whether this style of model emits several
predictions at one ordered pair, and roughly how much of the ground truth it recovers. The labs
need one duplicating style and one non-duplicating style to have anything to show; that is the
whole requirement.

Deterministic under a fixed seed, so a reader can regenerate the files and see exactly what was
constructed. `test_the_committed_files_match_what_the_script_regenerates` holds them to it.
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import UTC, datetime
from typing import Any

from app.schema import SceneGraph
from app.settings import DATA_DIR

#: Bumped only with a note in PROVENANCE.md, because every committed file changes with it.
SEED = 20260918

NOTE = (
    "Reconstructed to exhibit the {behaviour} reported for {family} models. This is NOT {model} "
    "output; no checkpoint was run and no published figure is reproduced. Regenerate with "
    "`python backend/scripts/reconstruct_predictions.py`."
)

PROFILES: dict[str, dict[str, Any]] = {
    # A one-stage or panoptic model emits duplicate instances freely, which is what the ECCV 2024
    # mask-pairing correction penalises. `duplicates` is how many extra predictions it puts on an
    # already-predicted pair.
    "psgformer": {
        "family": "one-stage panoptic",
        "behaviour": "duplicate-instance behaviour of the ECCV 2024 mask-pairing correction",
        "recall": 0.7,
        "duplicates": 2,
        "spurious": 2,
    },
    "egtr": {
        "family": "one-stage",
        "behaviour": "duplicate-instance behaviour of the ECCV 2024 mask-pairing correction",
        "recall": 0.8,
        "duplicates": 1,
        "spurious": 1,
    },
    # A two-stage model emits one prediction per instance pair, so the correction leaves it alone.
    "motifs": {
        "family": "two-stage",
        "behaviour": "one-prediction-per-pair behaviour",
        "recall": 0.6,
        "duplicates": 0,
        "spurious": 2,
    },
    "vctree": {
        "family": "two-stage",
        "behaviour": "one-prediction-per-pair behaviour",
        "recall": 0.7,
        "duplicates": 0,
        "spurious": 1,
    },
    "reltr": {
        "family": "one-stage",
        "behaviour": "one-prediction-per-pair behaviour",
        "recall": 0.65,
        "duplicates": 0,
        "spurious": 2,
    },
}

#: Predicates a reconstruction may invent. Drawn from the slice's own vocabulary at run time when
#: there is one; this is the fallback for a graph too small to supply alternatives.
FALLBACK_PREDICATES = ("on", "near", "under", "holding", "above", "behind")


def reconstruct(gt: SceneGraph, *, model: str, profile: dict[str, Any], seed: int) -> SceneGraph:
    """One prediction graph over the objects of `gt`, exhibiting `profile`'s behaviour."""
    rng = random.Random(f"{seed}:{model}:{gt.image_id}")
    truth = [(r.subject_id, r.predicate, r.object_id) for r in gt.relationships]
    vocabulary = sorted({r.predicate for r in gt.relationships} | set(FALLBACK_PREDICATES))
    ids = [o.object_id for o in gt.objects]

    keep = max(1, round(len(truth) * float(profile["recall"]))) if truth else 0
    recovered = rng.sample(truth, keep) if truth else []

    emitted: list[tuple[int, str, int]] = list(recovered)

    # Duplicates sit on a pair that is already predicted, with a different predicate. That is the
    # shape the correction is about: several predictions competing for one ordered pair.
    for _ in range(int(profile["duplicates"])):
        if not emitted:
            break
        subject, predicate, obj = rng.choice(list(emitted))
        alternatives = [p for p in vocabulary if p != predicate]
        if alternatives:
            emitted.append((subject, rng.choice(alternatives), obj))

    # Spurious predictions on pairs the ground truth says nothing about.
    for _ in range(int(profile["spurious"])):
        if len(ids) < 2:
            break
        subject, obj = rng.sample(ids, 2)
        candidate = (subject, rng.choice(vocabulary), obj)
        if candidate not in truth:
            emitted.append(candidate)

    # Scores descend in emission order, so the recovered triplets rank above the invented ones and
    # `@K` behaves the way a trained model's would. Quantised, so the file is stable to read.
    step = 0.9 / max(1, len(emitted))
    relationships = [
        {
            "relationship_id": i + 1,
            "subject_id": subject,
            "object_id": obj,
            "predicate": predicate,
            "score": round(0.95 - i * step, 4),
        }
        for i, (subject, predicate, obj) in enumerate(emitted)
    ]

    return SceneGraph.model_validate({
        "image_id": gt.image_id,
        "dataset": gt.dataset,
        "width": gt.width,
        "height": gt.height,
        "objects": [o.model_dump() for o in gt.objects],
        "relationships": relationships,
        "provenance": {
            "kind": "model",
            "fidelity": "reconstructed",
            "model": model,
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "note": NOTE.format(model=model, family=profile["family"],
                                behaviour=profile["behaviour"]),
        },
    })


def write_all(dataset: str = "placeholder", seed: int = SEED) -> int:
    """Regenerate the whole reconstructed tier for one slice. Returns the file count."""
    annotations = DATA_DIR / "slices" / dataset / "annotations.json"
    graphs = json.loads(annotations.read_text(encoding="utf-8"))["graphs"]
    written = 0
    for model, profile in PROFILES.items():
        folder = DATA_DIR / "predictions" / dataset / model
        folder.mkdir(parents=True, exist_ok=True)
        for raw in graphs:
            gt = SceneGraph.model_validate(raw)
            graph = reconstruct(gt, model=model, profile=profile, seed=seed)
            (folder / f"{gt.image_id}.json").write_text(
                json.dumps(graph.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            written += 1
    return written


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default="placeholder")
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    print(f"{write_all(args.dataset, args.seed)} files written for {args.dataset}")
