"""Rebuild the authored Figure 2 step-2 prompts under the criteria, and rekey them.

D115. The expert prompt gained the criteria blocks and the ANALYSIS_EN / ANALYSIS_ZH labels, so the
eight hand-authored step-2 exchanges (five in `fig2-pipeline.json`, three in
`fig2-corrections.json`) are keyed on a prompt nobody sends any more. For each exchange whose
prompt starts `TRIPLE-CHECKING` this recovers the draft and the expert index from the old
prompt, rebuilds the prompt with `step2_prompt(draft, expert, *criteria_for(image_ref))`, and
recomputes `key`. Completions, cases, provenance and every other exchange are left as they are.

It also rebuilds each authored step-3 exchange (prompt starting `SUMMARIZATION`, case `step3-nN`)
from the same file's step-2 completions for that frame: the revisions of experts 1 to N are read
through `revision_text` (a triplet an analysis quotes is not a row of the revision) and the
analyses through `parse_analysis`. The stored prompt must equal the old build (whole-completion
parse) or the new one, or the script stops: it never guesses which experts a summary saw.

`--check` writes nothing and exits 1 when a rewrite would change anything. `m0-demo.json` is a
recording and is refused: its prompts are what the recorder sent, not something to rebuild.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.settings import DATA_DIR  # noqa: E402
from app.vlm.indvissgg import (  # noqa: E402
    criteria_for,
    parse_analysis,
    parse_triplets,
    revision_text,
)
from app.vlm.prompts import step2_prompt, step3_prompt  # noqa: E402
from app.vlm.provider import exchange_key  # noqa: E402

TRANSCRIPTS = DATA_DIR / "vlm" / "transcripts"
AUTHORED = ("fig2-pipeline.json", "fig2-corrections.json")
REFUSED = "m0-demo.json"

HEADING_RE = re.compile(r"\ATRIPLE-CHECKING -- expert (\d+) of N\n")
DRAFT_RE = re.compile(r"\nDRAFT\n(.*?)\n\nOUTPUT\n", re.S)


def rekeyed(exchange: dict[str, Any]) -> dict[str, Any]:
    """The exchange with its prompt rebuilt and its key recomputed; others come back unchanged."""
    old = exchange["prompt"]
    heading = HEADING_RE.match(old)
    if heading is None:
        return exchange
    block = DRAFT_RE.search(old)
    if block is None:
        raise ValueError(f"{exchange['case']}: a step-2 prompt with no DRAFT block")
    draft = parse_triplets(block.group(1))
    prompt = step2_prompt(draft, int(heading.group(1)), *criteria_for(exchange["image_ref"]))
    key = exchange_key(prompt=prompt, image_ref=exchange["image_ref"], context=exchange["context"])
    return {**exchange, "prompt": prompt, "key": key}


STEP3_CASE_RE = re.compile(r"\Astep3-n(\d+)\Z")


def _step3(exchange: dict[str, Any], step2: list[dict[str, Any]]) -> dict[str, Any]:
    """The step-3 exchange rebuilt from the step-2 exchanges (already rekeyed) of its frame."""
    case = STEP3_CASE_RE.match(exchange["case"])
    if case is None:
        raise ValueError(f"{exchange['case']}: a step-3 case that names no expert count")
    n = int(case.group(1))
    experts = sorted(
        (e for e in step2 if e["image_ref"] == exchange["image_ref"]),
        key=lambda e: int(HEADING_RE.match(e["prompt"]).group(1)),  # type: ignore[union-attr]
    )[:n]
    if len(experts) != n or [
        int(HEADING_RE.match(e["prompt"]).group(1)) for e in experts  # type: ignore[union-attr]
    ] != list(range(1, n + 1)):
        raise ValueError(f"{exchange['case']}: cannot tie it to experts 1 to {n}")
    analyses = [parse_analysis(e["completion"])[0] for e in experts]
    old = step3_prompt([parse_triplets(e["completion"]) for e in experts], analyses)
    new = step3_prompt(
        [parse_triplets(revision_text(e["completion"])) for e in experts], analyses
    )
    if exchange["prompt"] not in (old, new):
        raise ValueError(f"{exchange['case']}: the stored prompt matches neither build")
    key = exchange_key(prompt=new, image_ref=exchange["image_ref"], context=exchange["context"])
    return {**exchange, "prompt": new, "key": key}


def render(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="exit 1 if a rewrite would change")
    parser.add_argument("files", nargs="*", type=Path, help="default: the two authored files")
    args = parser.parse_args(argv)

    paths = args.files or [TRANSCRIPTS / name for name in AUTHORED]
    if any(p.name == REFUSED for p in paths):
        print(f"{REFUSED} is a recording and is not rekeyed", file=sys.stderr)
        return 2

    changed = False
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        step2 = [rekeyed(e) for e in payload["exchanges"]]
        step2_only = [e for e in step2 if HEADING_RE.match(e["prompt"])]
        payload["exchanges"] = [
            _step3(e, step2_only) if e["prompt"].startswith("SUMMARIZATION") else e for e in step2
        ]
        before = json.loads(path.read_text(encoding="utf-8"))["exchanges"]
        for old, new in zip(before, payload["exchanges"], strict=True):
            if old["key"] != new["key"]:
                print(f"{path.name}  {new['case']}  {old['key']} -> {new['key']}")
        text = render(payload)
        if path.read_bytes().decode("utf-8") != text:
            changed = True
            if not args.check:
                path.write_text(text, encoding="utf-8", newline="")
    if args.check and changed:
        print("a rewrite would change a file", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
