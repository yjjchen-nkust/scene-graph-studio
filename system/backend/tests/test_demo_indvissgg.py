"""D-V, IndVisSGG recorded: the recorder's wrapper and its per-frame pipeline, over a fake provider.

No model is called here and `anthropic` is never imported. What is tested is that the recorder makes
the paper's five calls in the paper's order, files each under the key the player will ask for, and
that a frame recorded this way replays.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.schema import SceneGraph
from app.vlm import indvissgg, prompts, transcript
from app.vlm import openai_compat as oc
from app.vlm.provider import ProviderUnavailable, VLMProvider, exchange_key
from app.vlm.transcript import TranscriptPlayer
from scripts import record_demo_indvissgg as rec

FRAME = "m0-demo-088"


def completion_n(n: int) -> str:
    """The n-th call's text: its own triplets and its own analyses, so wiring errors show."""
    return (
        f"<hand, holding, part{n}>\n<part{n}, on, bench{n}>\n"
        f"ANALYSIS_EN\nreview {n}\nANALYSIS_ZH\n分析{n}"
    )


class FakeProvider:
    name = "fake"

    def __init__(self) -> None:
        self.calls = 0

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        self.calls += 1
        return completion_n(self.calls)


class StampingFake(FakeProvider):
    name = "openai-compat"
    model = "stamping-vlm"

    def served_root(self) -> str | None:
        return "Qwen/Qwen3.8-27B"


def test_the_provenance_names_the_served_weights_and_the_settings() -> None:
    block = rec.provenance_for(StampingFake())
    assert block["recorded"] is True
    assert block["model"] == "stamping-vlm"
    assert block["generated_at"]
    for note in (block["note_en"], block["note_zh"]):
        for text in ("Qwen/Qwen3.8-27B", "vLLM", "pro6000", "thinking", "top_p", "top_k",
                     "presence_penalty", "max_tokens"):
            assert text in note
        for value in (oc.TEMPERATURE, oc.TOP_P, oc.TOP_K, oc.PRESENCE_PENALTY, oc.MAX_TOKENS):
            assert str(value) in note
    assert "seed is derived from each exchange's key" in block["note_en"]
    assert "one seeded sample" in block["note_en"]
    assert "seed 由各筆 exchange 之 key 推得" in block["note_zh"]
    assert "獨立" in block["note_zh"]


def test_the_provenance_names_the_server_the_calls_went_to() -> None:
    # D114 was recorded on pro6000 and its note said so; D124 is recorded on the A6000, and a
    # note naming the wrong machine would misplace every completion in the file.
    block = rec.provenance_for(StampingFake(), server="A6000")
    assert "A6000" in block["note_en"] and "A6000" in block["note_zh"]
    assert "pro6000" not in block["note_en"] and "pro6000" not in block["note_zh"]


def test_the_demo_names_each_hand_and_no_bare_hand() -> None:
    # D124: COCO's `person` and O_ISG's `hand` both leave the two hands one class; the demo asks
    # for the worker's left and right hand, and nothing else in O_ISG changes.
    assert prompts.O_DEMO[:2] == ("left hand", "right hand")
    assert "hand" not in prompts.O_DEMO
    assert prompts.O_DEMO[2:] == tuple(o for o in prompts.O_ISG if o != "hand")


def test_the_demo_examples_stay_inside_the_demo_vocabulary() -> None:
    kinds = [ex["kind"] for ex in prompts.EXAMPLES_DEMO]
    assert kinds == ["positive", "negative"]
    for ex in prompts.EXAMPLES_DEMO:
        subject, predicate, obj = ex["triplet"]
        assert subject in prompts.O_DEMO and obj in prompts.O_DEMO
        # The negative example is the out-of-vocabulary predicate, as in EXAMPLES_ISG.
        assert (predicate in prompts.P_ISG) == (ex["kind"] == "positive")


def test_a_demo_frame_is_drafted_and_replayed_under_the_demo_criteria() -> None:
    provider = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, provider)
    expected = prompts.step1_prompt(prompts.O_DEMO, prompts.P_ISG, prompts.EXAMPLES_DEMO)
    assert provider.exchanges[0]["prompt"] == expected
    # The endpoint replays a demo frame under the criteria it was recorded with, or it asks for
    # a key no transcript holds.
    assert indvissgg.criteria_for(FRAME) == (prompts.O_DEMO, prompts.P_ISG, prompts.EXAMPLES_DEMO)
    # The mini-ISG bench keeps its own.
    assert indvissgg.criteria_for("isg-001") == (prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG)


def test_a_server_failure_stops_the_run_before_the_first_call(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    class Failing:
        name = "openai-compat"
        model = "stamping-vlm"
        base_url = "http://host/v1"

        def served_root(self) -> str | None:
            if calls == ["listed"]:
                raise ProviderUnavailable("the model list is gone")
            calls.append("listed")
            return "Qwen/Qwen3.8-27B"

        def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
            calls.append("complete")
            return "<a, on, b>"

    monkeypatch.setattr(oc, "OpenAICompatibleProvider", Failing)
    monkeypatch.setattr(rec, "TRANSCRIPT", tmp_path / "m0-demo.json")
    with pytest.raises(ProviderUnavailable):
        rec.main([])
    assert "complete" not in calls
    assert not (tmp_path / "m0-demo.json").exists()


def test_a_frame_is_five_exchanges_in_the_paper_s_order() -> None:
    provider = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, provider)
    assert [ex["case"] for ex in provider.exchanges] == [
        f"{FRAME}/step1", f"{FRAME}/expert1", f"{FRAME}/expert2", f"{FRAME}/expert3",
        f"{FRAME}/step3",
    ]
    assert isinstance(provider, VLMProvider)
    assert provider.name == "recording"


def test_every_recorded_key_is_the_key_the_player_will_ask_for() -> None:
    provider = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, provider)
    for ex in provider.exchanges:
        assert ex["image_ref"] == FRAME
        assert ex["key"] == exchange_key(
            prompt=ex["prompt"], image_ref=ex["image_ref"], context=ex["context"]
        )


def test_a_sixth_call_for_one_frame_is_refused() -> None:
    provider = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, provider)
    with pytest.raises(RuntimeError):
        provider.complete(prompt="again", image_ref=FRAME, context={})


def test_a_recorded_frame_replays_through_the_application_s_own_run(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import json

    first = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, first)
    assert [ex["completion"] for ex in first.exchanges] == [completion_n(n) for n in range(1, 6)]
    blob = {
        "$schema_version": 1, "provenance": rec.provenance_for(StampingFake()),
        "exchanges": first.exchanges,
    }
    (tmp_path / "m0-demo.json").write_text(json.dumps(blob, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(transcript, "ROOT", tmp_path)
    transcript.reload()
    try:
        # Default O, P and E: what the endpoint and lab L5 send for a demo frame.
        body = indvissgg.run(image_ref=FRAME, provider="transcript")
        replay = rec.RecordingProvider(TranscriptPlayer())
        rec.record_frame(FRAME, replay)
    finally:
        monkeypatch.undo()
        transcript.reload()
    assert [ex["completion"] for ex in replay.exchanges] == [completion_n(n) for n in range(1, 6)]
    final = SceneGraph.model_validate(body["step3"]["graph"])
    recorded = indvissgg.parse_triplets(first.exchanges[4]["completion"])
    assert indvissgg.triplets_of(final) == recorded


def test_the_recorder_will_not_overwrite_a_transcript(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "m0-demo.json"
    target.write_text("existing", encoding="utf-8")
    monkeypatch.setattr(rec, "TRANSCRIPT", target)
    assert rec.main([]) != 0
    assert target.read_text(encoding="utf-8") == "existing"
