"""Rebuild the authored Figure 2 step-2 prompts under the criteria, and rekey them.

D115. The expert prompt gained the criteria blocks and the ANALYSIS_EN / ANALYSIS_ZH labels, so the
eight hand-authored step-2 exchanges (five in `fig2-pipeline.json`, three in
`fig2-corrections.json`) are keyed on a prompt nobody sends any more. For each exchange whose
prompt starts `TRIPLE-CHECKING` this recovers the draft and the expert index from the old
prompt, rebuilds the prompt with `step2_prompt(draft, expert, *criteria_for(image_ref))`, and
recomputes `key`. Completions, cases, provenance and every other exchange are left as they are.

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
from app.vlm.indvissgg import criteria_for, parse_triplets  # noqa: E402
from app.vlm.prompts import step2_prompt  # noqa: E402
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
        payload["exchanges"] = [rekeyed(e) for e in payload["exchanges"]]
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
