"""Emit the remaining modules of plan 02 Task 8.

The frontmatter is written once and shared byte for byte between the two locales, so the pair
cannot drift in step ids, symbols, claims or formulas -- which is the drift the content lint
exists to catch, and which hand-copying a 60-line header invites.

The LaTeX comes from `tools/kp_latex.mjs` output, delimiters swapped and nothing else changed.

**This script does not reproduce its output.** It has no driver: the content it would
need was authored interactively and lives only in the committed artefact. Running it writes
nothing, `npm run ci` does not invoke it, and the committed file is the source of truth.
Keep it as a record of how the rows were shaped, or delete it; do not trust it to rebuild
anything.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "system" / "frontend" / "src" / "content"


def harvested(kp: str) -> tuple[list[str], list[str]]:
    """The display blocks for one knowledge point, already in `$$` delimiters."""
    script = (
        "import { mathOf, derivOf } from './tools/kp_latex.mjs';"
        f"console.log(JSON.stringify({{ m: mathOf('{kp}'), d: derivOf('{kp}') }}));"
    )
    out = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT / "system",
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout
    blob = json.loads(out)
    def fmt(blocks: list[str]) -> list[str]:
        return [f"$$\n{b}\n$$" for b in blocks]

    return fmt(blob["m"]), fmt(blob["d"])


def math_step(kp: str, intuition: str, implications: str) -> str:
    """One math step: intuition written fresh, the rest harvested verbatim."""
    math, deriv = harvested(kp)
    formal = "\n\n".join(math)
    worked = deriv[0] if deriv else formal
    tail = deriv[1] if len(deriv) > 1 else ""
    parts = [
        "<Intuition>\n\n" + intuition.strip() + "\n\n</Intuition>",
        "<Formal>\n\n" + formal + "\n\n</Formal>",
        "<Worked>\n\n" + worked + "\n\n</Worked>",
        "<Implications>\n\n"
        + (tail + "\n\n" if tail else "")
        + implications.strip()
        + "\n\n</Implications>",
    ]
    return "\n\n".join(parts)


def yaml_str(value: str) -> str:
    r"""A double-quoted YAML scalar.

    Raw, because this docstring is about `\o` and therefore contains it, and Python reads an
    unrecognised escape in a plain string literal the same way YAML does: as a warning today and
    an error in a later version. The paragraph below explained the trap while demonstrating it.

    The backslash doubling is not decoration. `remark-mdx-frontmatter` parses the block with a
    real YAML parser, and in a double-quoted scalar `\o` is an invalid escape sequence, so
    `sym: "\omega_p"` written with one backslash fails the build. Every symbol in this corpus is
    LaTeX, so every one of them is affected.
    """
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def frontmatter(spec: dict) -> str:
    lines = ["---", f"id: {spec['id']}", f"order: {spec['order']}"]
    lines.append(f"title_en: {yaml_str(spec['title_en'])}")
    lines.append(f"title_zh: {yaml_str(spec['title_zh'])}")
    lines.append(f"anchor_labs: [{', '.join(spec['labs'])}]")
    lines.append(f"knowledge_points: [{', '.join(spec['points'])}]")
    if spec.get("symbols"):
        lines.append("symbols:")
        for sym, en, zh in spec["symbols"]:
            lines.append(f"  - sym: {yaml_str(sym)}")
            lines.append(f"    gloss_en: {yaml_str(en)}")
            lines.append(f"    gloss_zh: {yaml_str(zh)}")
    else:
        lines.append("symbols: []")
    if spec.get("claims"):
        lines.append("claims:")
        for c in spec["claims"]:
            lines.append(f"  - id: {c['id']}")
            lines.append(f"    text_en: {yaml_str(c['text_en'])}")
            lines.append(f"    text_zh: {yaml_str(c['text_zh'])}")
            lines.append(f"    source: {c['source']}")
            lines.append(f"    source_table: {yaml_str(c['source_table'])}")
            lines.append(f"    constraint: {c['constraint']}")
            lines.append(f"    protocol: {c['protocol']}")
            lines.append(f"    verified: {'true' if c['verified'] else 'false'}")
    else:
        lines.append("claims: []")
    lines.append("steps:")
    for step in spec["steps"]:
        budget = f", seconds_budget: {step['budget']}" if step.get("budget") else ""
        lab = f", lab: {step['lab']}" if step.get("lab") else ""
        lines.append(f"  - {{ id: {step['id']}, kind: {step['kind']}{lab}{budget} }}")
    lines.append("---")
    return "\n".join(lines) + "\n"


IMPORT = "import { Formal, Implications, Intuition, Worked } from './math/Parts';"


def emit(spec: dict) -> None:
    head = frontmatter(spec)
    needs_import = any(s["kind"] == "math" for s in spec["steps"])
    # Specs key their prose "en" / "zh"; the files are named by locale.
    for locale, key in (("en", "en"), ("zh-TW", "zh")):
        chunks = [head, ""]
        if needs_import:
            chunks += [IMPORT, ""]
        for step in spec["steps"]:
            if step["kind"] == "math":
                body = math_step(
                    step["kp"], step[f"intuition_{key}"], step[f"implications_{key}"]
                )
            else:
                body = step[key]
            chunks.append(f'<Step id="{step["id"]}">')
            chunks.append("")
            chunks.append(body.strip())
            chunks.append("")
            chunks.append("</Step>")
            chunks.append("")
        (OUT / f"{spec['id']}.{locale}.mdx").write_text("\n".join(chunks), encoding="utf-8")
    print(f"{spec['id']}: {len(spec['steps'])} steps, {len(spec['points'])} points")
