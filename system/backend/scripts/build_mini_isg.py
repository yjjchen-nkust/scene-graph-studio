"""Build the two mini-ISG artefacts from the one authored file.

    data/mini-isg/authoring.json      the source: per frame, the objects with boxes, the step-1
                                      draft, and the corrected triplet set
      -> data/vlm/transcripts/mini-isg-step1.json   the drafts, keyed on the real step-1 prompt
      -> data/slices/mini-isg/annotations.json      the corrected reference set

Two outputs from one source rather than three hand-maintained files: a draft and an annotation
that drifted apart would make the lab's correction count a comparison of two unrelated things.
`test_mini_isg.py` reruns this and asserts the outputs on disk are byte-identical, so the source
cannot silently stop being the source.

**The key is computed here, never written by hand.** It is a hash of the prompt `prompts.py`
builds today, so editing the wording of `step1_prompt` makes every transcript unreachable and the
test that checks keys says so at once. That is the intended behaviour: a transcript keyed to a
prompt nobody sends is a recording of a different experiment.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.settings import DATA_DIR, require_data_dir  # noqa: E402
from app.vlm import prompts  # noqa: E402
from app.vlm.provider import exchange_key  # noqa: E402

AUTHORING = DATA_DIR / "mini-isg" / "authoring.json"
TRANSCRIPT = DATA_DIR / "vlm" / "transcripts" / "mini-isg-step1.json"
ANNOTATIONS = DATA_DIR / "slices" / "mini-isg" / "annotations.json"

WIDTH, HEIGHT = 1280, 720

DRAFT_NOTE_EN = (
    "Claude Opus 5 was shown the frame and the step-1 prompt below, and its triplet lines are "
    "recorded here verbatim. The call was made from the Claude Code session that built this set "
    "and not through `app/vlm/claude.py`, so a graph replayed from it is `reconstructed`: the "
    "application did not call a model. The same model then produced the corrected reference "
    "annotations in data/slices/mini-isg/annotations.json, so the difference between a draft "
    "here and the reference there is not an independent measurement of what a human annotator "
    "finds that a model misses. It is what one model found on a second, slower look."
)
DRAFT_NOTE_ZH = (
    "本檔各筆 completion 係將影格與下列 step-1 提示詞交付 Claude Opus 5 後，逐字記錄其輸出之"
    "三元組。該次呼叫由建置本資料集之 Claude Code 工作階段發出，並未經由 `app/vlm/claude.py`，"
    "故據以重播所建之場景圖一律標記為 reconstructed：應用程式本身並未呼叫模型。"
    "data/slices/mini-isg/annotations.json 之修正後標註亦由同一模型產生，故此處草稿與該處參考"
    "標註之差異，並非人工標註者較模型多發現若干關係之獨立量測，而係同一模型二次審視之結果。"
)

ANNOTATION_NOTE_EN = (
    "Hand-corrected reference annotations for the mini-ISG teaching set, 2026-09-18. The "
    "triplets were written by looking at each frame; the boxes were placed by eye to roughly 3% "
    "of the frame width, which is adequate for teaching how IoU behaves and is not adequate for "
    "reporting a detection figure. The draft each frame was corrected from is in "
    "data/vlm/transcripts/mini-isg-step1.json, and that file states who drafted it and why the "
    "correction count here is a lower bound rather than a measurement."
)


def _triplet_lines(triplets: list[list[str]]) -> str:
    return "\n".join(f"<{s}, {p}, {o}>" for s, p, o in triplets)


def _step1_prompt() -> str:
    return prompts.step1_prompt(prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG)


def build_transcript(authoring: dict[str, Any]) -> dict[str, Any]:
    prompt = _step1_prompt()
    exchanges = []
    for image_id in sorted(authoring):
        exchanges.append({
            "case": f"mini-isg-step1-{image_id}",
            "key": exchange_key(prompt=prompt, image_ref=image_id, context={}),
            "prompt": prompt,
            "image_ref": image_id,
            "context": {},
            # Only the triplet lines. The prompt asks for "one triplet per line" and nothing
            # else, so appending a teaching analysis would put this project's prose inside a
            # field that is presented as the model's output.
            "completion": _triplet_lines(authoring[image_id]["draft"]),
        })
    return {
        "$schema_version": 1,
        "provenance": {
            "recorded": True,
            "model": "claude-opus-5",
            "generated_at": "2026-09-18",
            "source": "the forty mini-ISG frames, drafted under prompts.step1_prompt(O_ISG, P_ISG)",
            "note_en": DRAFT_NOTE_EN,
            "note_zh": DRAFT_NOTE_ZH,
        },
        "exchanges": exchanges,
    }


def build_annotations(authoring: dict[str, Any]) -> dict[str, Any]:
    graphs = []
    for image_id in sorted(authoring):
        frame = authoring[image_id]
        ids = {name: i + 1 for i, name in enumerate(frame["objects"])}
        objects = [
            {
                "object_id": ids[name],
                # `hand#1` and `hand#2` are two instances of one class. The suffix exists only
                # so the authored triplets can say which hand; it never reaches the annotation.
                "names": [name.split("#")[0]],
                "bbox": {"x": float(x), "y": float(y), "w": float(w), "h": float(h)},
            }
            for name, (x, y, w, h) in frame["objects"].items()
        ]
        relationships = [
            {"relationship_id": i + 1, "subject_id": ids[s], "object_id": ids[o],
             "predicate": p, "score": None}
            for i, (s, p, o) in enumerate(frame["final"])
        ]
        graphs.append({
            "image_id": image_id,
            "dataset": "mini-isg",
            "width": WIDTH,
            "height": HEIGHT,
            "objects": objects,
            "relationships": relationships,
            "provenance": {
                "kind": "user",
                "fidelity": "measured",
                "note": ANNOTATION_NOTE_EN,
            },
        })
    return {"dataset": "mini-isg", "graphs": graphs}


def dumps(blob: dict[str, Any]) -> str:
    return json.dumps(blob, ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    require_data_dir()
    authoring = json.loads(AUTHORING.read_text(encoding="utf-8"))
    TRANSCRIPT.parent.mkdir(parents=True, exist_ok=True)
    ANNOTATIONS.parent.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT.write_text(dumps(build_transcript(authoring)), encoding="utf-8", newline="")
    ANNOTATIONS.write_text(dumps(build_annotations(authoring)), encoding="utf-8", newline="")
    drafted = sum(len(f["draft"]) for f in authoring.values())
    final = sum(len(f["final"]) for f in authoring.values())
    print(f"{len(authoring)} frames: {drafted} drafted triplets, {final} after correction")
    print(f"  -> {TRANSCRIPT}")
    print(f"  -> {ANNOTATIONS}")


if __name__ == "__main__":
    main()
