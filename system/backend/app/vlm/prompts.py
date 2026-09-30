"""The prompts the three IndVisSGG steps issue, and the three corrections the paper names.

Plan 03 puts the prompt builders in Task 7 and the recorded transcripts in Task 6, which cannot
both be true: the transcript player keys on a hash of the prompt, so a transcript recorded before
the prompt exists is keyed on nothing, and one recorded against a draft prompt goes unreachable
the moment the wording is edited. The builders therefore live here, ahead of both, and Task 7's
pipeline calls the same functions the transcripts were keyed with. DEVIATIONS D38.

Wording follows SRS §6 and sections 3.1-3.3 of the anchor paper. The three canned cases are the
paper's own, from its Figure 2 walkthrough:

    the output of GPT-4V from step 1 may contain redundant entities like "wrench", which is not
    shown in V_t1. Additionally, nodes such as "terminals", "beam", and "panel" may be missing
    among the O, which influences triplet extraction in these frames. Lastly, although the
    predicate "taping" predicted in V_t3 similarly represents human actions as "knocking on" ...

    -- Wang et al. 2025, §3.2
"""

from __future__ import annotations

from typing import Any

Triplet = tuple[str, str, str]

#: The object set O of the Figure 2 walkthrough.
O_DEFAULT: tuple[str, ...] = (
    "worker", "wrench", "terminals", "beam", "panel", "screwdriver", "tape", "workbench",
)
#: The predicate set P. `taping` is deliberately absent: it is what TEC exists to rule out.
P_DEFAULT: tuple[str, ...] = ("holding", "knocking on", "on", "near", "installing", "above")


# ── the mini-ISG bench ────────────────────────────────────────────────────────────────────────
#
# `O_DEFAULT` and `P_DEFAULT` above are the paper's Figure 2 vocabulary, written for a wiring
# workcell. The forty frames this project cut are a STEMFIE construction-toy assembly bench:
# two hands, plastic beams and braces, pins, nuts, washers, wheels and a printed instruction
# sheet on a white table. There is no robot arm, no conveyor and no terminal block in any of
# them, so asking for `terminals` or `panel` would put a redundant entity in the criteria rather
# than leave step 2 to catch one -- the failure the paper names in §3.2, manufactured on purpose.

#: The object set O for the mini-ISG frames. Named for what is in them, checked against them.
O_ISG: tuple[str, ...] = (
    "hand", "beam", "brace", "block", "wheel", "axle", "pin", "nut", "washer",
    "assembly", "instruction sheet", "workbench",
)

#: The predicate set P for the mini-ISG frames.
#:
#: `tightening` and `screwing` are deliberately absent, as `taping` is from `P_DEFAULT`. Turning
#: a nut invites both words, and a triplet carrying either scores zero however well it describes
#: the frame, because an out-of-vocabulary predicate is counted twice: once as a miss on the
#: relation that was there, once as a false positive on the relation that was not (knowledge
#: point L10). `assembling` is the legal term the annotator substitutes.
P_ISG: tuple[str, ...] = (
    "holding", "assembling", "attached to", "inserted into", "on", "near", "reaching for",
)

#: The examples-with-analysis block E for the mini-ISG frames. One positive, one negative, as
#: §3.1 describes, and the negative is the out-of-vocabulary case the frames actually invite.
EXAMPLES_ISG: list[dict[str, Any]] = [
    {
        "kind": "positive",
        "triplet": ["hand", "assembling", "assembly"],
        "analysis": "The hand is working on the partly built model; `assembling` is in P.",
    },
    {
        "kind": "negative",
        "triplet": ["hand", "tightening", "nut"],
        "analysis": "`tightening` is not in P, so this triplet cannot be scored at all.",
    },
]


def _bullets(items: tuple[str, ...] | list[str]) -> str:
    return "\n".join(f"- {x}" for x in items)


def _triplets(items: list[Triplet]) -> str:
    return "\n".join(f"<{s}, {p}, {o}>" for s, p, o in items)


def step1_prompt(
    O: tuple[str, ...] | list[str] = O_DEFAULT,
    P: tuple[str, ...] | list[str] = P_DEFAULT,
    E: list[dict[str, Any]] | None = None,
    *,
    ablate: frozenset[str] = frozenset(),
) -> str:
    """`out^s1_t = VLM(V_t, O, P, E, Prompt)`, or `VLM(V_t, Prompt)` with everything ablated.

    Ablation removes a block rather than telling the model to ignore it. Table 3 is a factorial
    over which blocks were supplied, so a prompt that mentions O in order to withhold it is not
    the row the paper measured.
    """
    parts = [
        "INFORMATION",
        "You are given one video frame from an industrial workcell.",
        "Extract every relation you can see as <subject, predicate, object> triplets.",
        *_criteria_parts(O, P, E, ablate),
        "", "OUTPUT", "One triplet per line, in <subject, predicate, object> form.",
    ]
    return "\n".join(parts)


def _criteria_parts(
    O: tuple[str, ...] | list[str],
    P: tuple[str, ...] | list[str],
    E: list[dict[str, Any]] | None,
    ablate: frozenset[str] = frozenset(),
) -> list[str]:
    """The three `TRIPLETS EXTRACTION CRITERIA` blocks, each led by a blank line.

    Steps 1 and 2 both call this, so the criteria the experts check against are the text the
    draft was made under and the two cannot drift. Eq. (3) gives step 2 the same O, P and E.
    """
    # An empty list is an ablation, not an empty header: supplying a criteria block with no
    # entries in it is supplying no criteria, and emitting the heading anyway would make two
    # spellings of the same experiment that hash to different transcripts.
    parts: list[str] = []
    if "O" not in ablate and O:
        parts += ["", "TRIPLETS EXTRACTION CRITERIA -- object categories", _bullets(O)]
    if "P" not in ablate and P:
        parts += ["", "TRIPLETS EXTRACTION CRITERIA -- predicate dictionary", _bullets(P)]
    if "E" not in ablate and E:
        parts += ["", "TRIPLETS EXTRACTION CRITERIA -- examples"]
        for ex in E:
            s, p, o = ex["triplet"]
            parts.append(f"[{ex['kind']}] <{s}, {p}, {o}> -- {ex['analysis']}")
    return parts


def step2_prompt(
    draft: list[Triplet],
    expert: int,
    O: tuple[str, ...] | list[str] = O_DEFAULT,
    P: tuple[str, ...] | list[str] = P_DEFAULT,
    E: list[dict[str, Any]] | None = None,
) -> str:
    """`(out^s2_t, a_i) = VLM(V_t, O, P, E, Prompt, out^s1_t)` for expert i.

    The expert index is part of the prompt because N experts run in parallel over the same draft
    and Table 4 measures what varying N does. Experts that received identical prompts would be one
    expert sampled N times, which is a different experiment.

    The criteria are in the prompt because Eq. (3) has them as inputs and the instruction to
    replace a predicate "not in the dictionary" is empty without the dictionary. The output section
    names the `ANALYSIS_EN` and `ANALYSIS_ZH` labels that `indvissgg.parse_analysis` reads;
    without them every analysis parsed empty and the summariser received none (D115).
    """
    return "\n".join([
        f"TRIPLE-CHECKING -- expert {expert} of N",
        "Review the draft triplets below against the frame and the criteria.",
        "Delete any entity that is not visible. Recover any entity that is visible and missing.",
        "Replace any predicate that is not in the dictionary with the nearest one that is.",
        *_criteria_parts(O, P, E),
        "",
        "DRAFT",
        _triplets(draft),
        "",
        "OUTPUT",
        "The revised triplet set, one per line, in <subject, predicate, object> form.",
        "Then a line reading ANALYSIS_EN, followed by one paragraph in English explaining every "
        "change.",
        "Then a line reading ANALYSIS_ZH, followed by the same paragraph in Traditional Chinese.",
    ])


def step3_prompt(revisions: list[list[Triplet]], analyses: list[str]) -> str:
    """`out^s3_t = VLM(out^s2_t, alpha, Prompt)` over `{out^s2_t, a_i : i in 1..N}`."""
    blocks = []
    for i, (rev, analysis) in enumerate(zip(revisions, analyses, strict=True), start=1):
        blocks += [f"EXPERT {i} REVISION", _triplets(rev), f"EXPERT {i} ANALYSIS", analysis, ""]
    return "\n".join([
        "SUMMARIZATION",
        "Reconcile the expert revisions below into one triplet set for this frame.",
        "",
        *blocks,
        "OUTPUT",
        "The final triplet set, one per line.",
    ])


#: The three corrections SRS §6 requires to ship as canned cases, each keyed to a Figure 2 frame.
CANNED: dict[str, dict[str, Any]] = {
    "hallucinated_wrench": {
        "image_ref": "isg-fig2-t1",
        "draft": [("worker", "holding", "wrench"), ("worker", "near", "workbench")],
        "expect_in_completion": "wrench",
        "why_en": "`wrench` is not shown in the frame, so the triplet asserting it is deleted.",
    },
    "missing_nodes": {
        "image_ref": "isg-fig2-t2",
        "draft": [("worker", "near", "workbench")],
        "expect_in_completion": "terminals",
        "why_en": "`terminals`, `beam` and `panel` are visible and were absent from the draft.",
    },
    "imprecise_taping": {
        "image_ref": "isg-fig2-t3",
        "draft": [("worker", "taping", "panel")],
        "expect_in_completion": "knocking on",
        "why_en": "`taping` is not in the predicate dictionary; the nearest legal term is used.",
    },
}
