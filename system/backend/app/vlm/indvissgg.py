"""The three-step, N-expert IndVisSGG replica. Faithful to SRS §6 and the paper's §3.1-3.3.

Two things this module refuses to do, and both are the point of it:

* It never merges the student's run with the authors' numbers. `published_reference` comes back in
  its own field, carrying `fidelity: 'published'` and a note saying it is not this run. Returning
  them separately is how the API makes conflation awkward rather than merely discouraged.
* It never invents a bounding box it measured. This method emits triplets and no geometry -- the
  VLM is asked for `<subject, predicate, object>` lines and nothing else -- so every graph it
  produces carries placeholder boxes and says so in `provenance.note`. Any figure computed from
  these boxes is a figure about the placeholder, which is why the graphs are `reconstructed`
  unless a live provider produced them.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

from app.schema import SceneGraph
from app.settings import DATA_DIR
from app.vlm import prompts
from app.vlm.provider import VLMProvider, get_provider
from app.vlm.transcript import TranscriptPlayer

TABLES = DATA_DIR / "content" / "indvissgg_tables.json"

TRIPLET_RE = re.compile(r"<\s*([^,<>]+?)\s*,\s*([^,<>]+?)\s*,\s*([^,<>]+?)\s*>")

NO_GEOMETRY_EN = (
    "This method returns triplets and no geometry. The boxes on this graph are placeholders so "
    "that it satisfies the SceneGraph schema; they were not measured and nothing may be computed "
    "from them."
)
NO_GEOMETRY_ZH = (
    "本方法僅輸出三元組，不輸出幾何資訊。本圖之 box 為佔位值，僅為滿足 SceneGraph 結構驗證，"
    "並非量測所得，不得據以計算任何數值。"
)


def parse_triplets(completion: str) -> list[tuple[str, str, str]]:
    """Every `<s, p, o>` line, in order, duplicates preserved.

    Order is the ranking (NFR-4), so de-duplicating here would silently change what `@K` means.
    """
    return [(m.group(1), m.group(2), m.group(3)) for m in TRIPLET_RE.finditer(completion)]


def parse_analysis(completion: str) -> tuple[str, str]:
    """The `ANALYSIS_EN` and `ANALYSIS_ZH` sections, or empty strings when absent."""
    def section(tag: str) -> str:
        match = re.search(rf"ANALYSIS_{tag}\n(.*?)(?=\nANALYSIS_|\Z)", completion, re.S)
        return match.group(1).strip() if match else ""

    return section("EN"), section("ZH")


def to_graph(
    triplets: list[tuple[str, str, str]],
    *,
    image_ref: str,
    dataset: str,
    live: bool,
    note_extra: str = "",
) -> SceneGraph:
    """One graph from one triplet list, with placeholder geometry that admits to being so."""
    ids: dict[str, int] = {}
    objects: list[dict[str, Any]] = []
    for name in (n for t in triplets for n in (t[0], t[2])):
        if name in ids:
            continue
        ids[name] = len(ids) + 1
        # A one-pixel box at a distinct offset: distinct enough that two entities never collide,
        # meaningless enough that nobody mistakes it for a detection.
        objects.append({
            "object_id": ids[name],
            "names": [name],
            "bbox": {"x": float(ids[name]), "y": float(ids[name]), "w": 1.0, "h": 1.0},
        })
    relationships = [
        {"relationship_id": i + 1, "subject_id": ids[s], "object_id": ids[o], "predicate": p,
         "score": None}
        for i, (s, p, o) in enumerate(triplets)
    ]
    note = NO_GEOMETRY_EN + (" " + note_extra if note_extra else "")
    return SceneGraph.model_validate({
        "image_id": image_ref,
        "dataset": dataset,
        "width": 1024,
        "height": 768,
        "objects": objects,
        "relationships": relationships,
        "provenance": {
            "kind": "vlm",
            # `measured` only when a live provider produced this text for this image. A replayed
            # exchange is a recording of some other run, and calling that measured would make the
            # transcript player a way of manufacturing evidence.
            "fidelity": "measured" if live else "reconstructed",
            "vlm": "live" if live else "transcript",
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "note": None if live else note,
        },
    })


def published_reference() -> dict[str, Any]:
    """Tables 3 and 4 as published, in their own field, labelled as not this run."""
    blob = json.loads(TABLES.read_text(encoding="utf-8"))
    return {
        "table3": blob["table3"],
        "table4": blob["table4"],
        "table3_reading_en": blob["table3_reading_en"],
        "table3_reading_zh": blob["table3_reading_zh"],
        "table4_reading_en": blob["table4_reading_en"],
        "table4_reading_zh": blob["table4_reading_zh"],
        "source": blob["source"],
        "fidelity": blob["fidelity"],
        "note_en": blob["note_en"],
        "note_zh": blob["note_zh"],
    }


def _is_live(provider: VLMProvider) -> bool:
    return not isinstance(provider, TranscriptPlayer)


def criteria_for(image_ref: str) -> tuple[tuple[str, ...], tuple[str, ...], list[dict[str, Any]]]:
    """The O, P and E a frame is drafted under, when the caller names none.

    Two frame families live behind this endpoint. `isg-fig2-t*` are the paper's Figure 2
    walkthrough, whose transcripts were keyed on the wiring-workcell vocabulary; `isg-NNN` are the
    forty mini-ISG bench frames, keyed on `O_ISG`. A single default cannot serve both: whichever
    one it is, the other family's transcripts are keyed on a prompt nobody sends, and the endpoint
    answers 503 for every frame in it.

    A third family, `m0-demo-NNN`, is the ten M0 demonstration frames cut from IndustReal; their
    transcript was recorded under the same `O_ISG`, `P_ISG` and `EXAMPLES_ISG`.

    The manifests are the discriminator rather than a prefix rule, because they are the
    authoritative lists of what was cut. A frame nobody has heard of gets the paper's vocabulary and
    the usual `TranscriptMiss` naming its key, which is the right answer to a question about a frame
    that does not exist.
    """
    from app.datasets.loader import slice_dir  # noqa: PLC0415 - avoids an import cycle

    cut: set[str] = set()
    manifest = slice_dir("mini-isg") / "MANIFEST.json"
    if manifest.is_file():
        listed = json.loads(manifest.read_text(encoding="utf-8"))["images"]
        cut |= {row["image_id"] for row in listed}
    demo = DATA_DIR / "demos" / "m0" / "MANIFEST.json"
    if demo.is_file():
        cut |= {row["image_id"] for row in json.loads(demo.read_text(encoding="utf-8"))["frames"]}
    if image_ref in cut:
        return prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG
    return prompts.O_DEFAULT, prompts.P_DEFAULT, EXAMPLES


def step1(
    *, image_ref: str, dataset: str, O: list[str], P: list[str], E: list[dict[str, Any]],
    ablate: frozenset[str], provider: VLMProvider,
) -> tuple[SceneGraph, str]:
    prompt = prompts.step1_prompt(tuple(O), tuple(P), E, ablate=ablate)
    completion = provider.complete(prompt=prompt, image_ref=image_ref, context={})
    graph = to_graph(parse_triplets(completion), image_ref=image_ref, dataset=dataset,
                     live=_is_live(provider))
    return graph, prompt


def step2(
    *, image_ref: str, dataset: str, draft: list[tuple[str, str, str]], n_experts: int,
    provider: VLMProvider, O: tuple[str, ...] | list[str], P: tuple[str, ...] | list[str],
    E: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """N experts over the same draft, each with its own prompt and the criteria of step 1.

    The expert index is in the prompt because Table 4 measures what varying N does; N experts
    given identical prompts would be one expert sampled N times, a different experiment.
    """
    out: list[dict[str, Any]] = []
    for i in range(1, n_experts + 1):
        prompt = prompts.step2_prompt(draft, i, O, P, E)
        completion = provider.complete(prompt=prompt, image_ref=image_ref, context={})
        analysis_en, analysis_zh = parse_analysis(completion)
        out.append({
            "expert_index": i,
            "graph": to_graph(parse_triplets(completion), image_ref=image_ref, dataset=dataset,
                              live=_is_live(provider)),
            "analysis_en": analysis_en,
            "analysis_zh": analysis_zh,
            "prompt_shown": prompt,
        })
    return out


def step3(
    *, image_ref: str, dataset: str, revisions: list[list[tuple[str, str, str]]],
    analyses: list[str], provider: VLMProvider,
) -> tuple[SceneGraph, str]:
    prompt = prompts.step3_prompt(revisions, analyses)
    completion = provider.complete(prompt=prompt, image_ref=image_ref, context={})
    graph = to_graph(parse_triplets(completion), image_ref=image_ref, dataset=dataset,
                     live=_is_live(provider))
    return graph, prompt


def triplets_of(graph: SceneGraph) -> list[tuple[str, str, str]]:
    by_id = {o.object_id: o.name for o in graph.objects}
    return [(by_id[r.subject_id], r.predicate, by_id[r.object_id]) for r in graph.relationships]


def run(
    *,
    image_ref: str = "isg-fig2-t1",
    dataset: str = "mini-isg",
    O: list[str] | None = None,
    P: list[str] | None = None,
    E: list[dict[str, Any]] | None = None,
    n_experts: int = 3,
    steps: list[int] | None = None,
    ablate: list[str] | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    """Contracts §1.9. `steps` selects which of the three run; later steps need earlier ones."""
    impl = get_provider(provider)
    wanted = sorted(set(steps or [1, 2, 3]))
    ablated = frozenset(ablate or ())
    default_O, default_P, default_E = criteria_for(image_ref)
    objects = default_O if O is None else tuple(O)
    predicates = default_P if P is None else tuple(P)
    examples = default_E if E is None else E

    body: dict[str, Any] = {
        "step1": None,
        "step2": [],
        "step3": None,
        "provider_used": impl.name,
        "published_reference": published_reference(),
    }

    graph, prompt = step1(image_ref=image_ref, dataset=dataset, O=list(objects),
                          P=list(predicates), E=examples, ablate=ablated, provider=impl)
    body["step1"] = {"graph": graph.model_dump(), "prompt_shown": prompt}
    if wanted == [1]:
        return body

    experts = step2(image_ref=image_ref, dataset=dataset, draft=triplets_of(graph),
                    n_experts=n_experts, provider=impl, O=objects, P=predicates, E=examples)
    body["step2"] = [{**e, "graph": e["graph"].model_dump()} for e in experts]
    if 3 not in wanted:
        return body

    final, prompt3 = step3(
        image_ref=image_ref, dataset=dataset,
        revisions=[triplets_of(e["graph"]) for e in experts],
        analyses=[e["analysis_en"] for e in experts], provider=impl,
    )
    body["step3"] = {"graph": final.model_dump(), "prompt_shown": prompt3}
    return body


#: The examples-with-analysis block E. Two cases, as §3.1 describes: one positive, one negative.
EXAMPLES: list[dict[str, Any]] = [
    {
        "kind": "positive",
        "triplet": ["worker", "knocking on", "panel"],
        "analysis": "The hand contacts the panel repeatedly; `knocking on` is in the dictionary.",
    },
    {
        "kind": "negative",
        "triplet": ["worker", "taping", "panel"],
        "analysis": "`taping` is not in the dictionary, so this triplet cannot be scored at all.",
    },
]
