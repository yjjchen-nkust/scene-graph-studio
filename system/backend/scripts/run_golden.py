"""Emit the Python engine's output for every golden case, as JSON on stdout.

Consumed by tools/parity.mjs, which runs the TypeScript engine over the same cases and diffs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.eval.engine import EvalRequest, evaluate  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402

cases = json.loads((DATA_DIR / "golden" / "vectors.json").read_text(encoding="utf-8"))["cases"]
out = {}
for case in cases:
    body = evaluate(
        EvalRequest.model_validate({"gt": case["gt"], "pred": case["pred"], **case["params"]})
    )
    out[case["id"]] = {
        "metrics": {f"{m['metric']}@{m['k']}": m["value"] for m in body["metrics"]},
        "verdicts": [[v["pred_index"], v["verdict"], v["gt_index"]] for v in body["verdicts"]],
        "warnings": sorted(w["code"] for w in body["warnings"]),
        "matched_count": body["matched_count"],
        "gt_count": body["gt_count"],
        "pred_count_considered": body["pred_count_considered"],
    }
print(json.dumps(out, sort_keys=True))
