"""D-V, IndVisSGG recorded: the recorder's wrapper and its per-frame pipeline, over a fake provider.

No model is called here and `anthropic` is never imported. What is tested is that the recorder makes
the paper's five calls in the paper's order, files each under the key the player will ask for, and
that a frame recorded this way replays.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.schema import SceneGraph
from app.vlm import indvissgg, transcript
from app.vlm.provider import VLMProvider, exchange_key
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
    blob = {"$schema_version": 1, "provenance": rec.PROVENANCE, "exchanges": first.exchanges}
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
