"""The audit rule behind D-07: a committed prediction says how it was obtained, or it is a defect.

Written as a function rather than as assertions inside a test so that it can be exercised against
files that violate it. A rule that has only ever been run over a clean tree -- or, as here, over an
empty one -- has not been shown to work. D19, D22, D24.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.schema import SceneGraph


def audit(root: Path, *, recorded: str) -> list[str]:
    """Every problem with the prediction files under `root`, given the text of PROVENANCE.md.

    Two rules, both from D-07:

      * a `measured` prediction names a model that PROVENANCE.md accounts for, because "this is
        what the model produced" is a claim about a run that happened on a machine on a date;
      * anything that is not `measured` carries a note. The schema enforces this too; the audit
        repeats it so that a prediction file which never passes through `SceneGraph` is still
        caught.
    """
    problems: list[str] = []
    for path in sorted(root.rglob("*.json")):
        if path.name.startswith("."):
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            problems.append(f"{path.name}: not readable as JSON ({type(exc).__name__})")
            continue

        # Provenance is read off the raw object before the graph is validated. `Provenance`
        # already refuses a non-measured fidelity with no note, so validating first would report
        # every such file as merely malformed and bury the one sentence that says what to fix.
        p = raw.get("provenance") if isinstance(raw, dict) else None
        if not isinstance(p, dict):
            problems.append(f"{path.name}: no provenance block")
            continue
        fidelity, model, note = p.get("fidelity"), p.get("model"), p.get("note")
        if fidelity == "measured":
            if not model:
                problems.append(f"{path.name}: claims 'measured' and names no model")
            elif model not in recorded:
                problems.append(
                    f"{path.name}: claims 'measured' for model '{model}', which PROVENANCE.md "
                    f"does not account for"
                )
        elif not note:
            problems.append(f"{path.name}: fidelity '{fidelity}' with no note")

        try:
            SceneGraph.model_validate(raw)
        except ValueError as exc:
            problems.append(f"{path.name}: not a valid SceneGraph ({type(exc).__name__})")
    return problems
