"""D-V, IndVisSGG recorded: the recorder's wrapper and its per-frame pipeline, over a fake provider.

No model is called here and `anthropic` is never imported. What is tested is that the recorder makes
the paper's five calls in the paper's order, files each under the key the player will ask for, and
that a frame recorded this way replays.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.vlm import transcript
from app.vlm.provider import VLMProvider, exchange_key
from app.vlm.transcript import TranscriptPlayer
from scripts import record_demo_indvissgg as rec

FRAME = "m0-demo-088"
COMPLETION = "<hand, holding, beam>\nANALYSIS_EN\nkept\nANALYSIS_ZH\n保留"


class FakeProvider:
    name = "fake"

    def __init__(self) -> None:
        self.calls = 0

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        self.calls += 1
        return COMPLETION


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
        assert ex["completion"] == COMPLETION
        assert ex["key"] == exchange_key(
            prompt=ex["prompt"], image_ref=ex["image_ref"], context=ex["context"]
        )


def test_a_sixth_call_for_one_frame_is_refused() -> None:
    provider = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, provider)
    with pytest.raises(RuntimeError):
        provider.complete(prompt="again", image_ref=FRAME, context={})


def test_a_recorded_frame_replays_through_the_transcript_player(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import json

    first = rec.RecordingProvider(FakeProvider())
    rec.record_frame(FRAME, first)
    blob = {"$schema_version": 1, "provenance": rec.PROVENANCE, "exchanges": first.exchanges}
    (tmp_path / "m0-demo.json").write_text(json.dumps(blob, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(transcript, "ROOT", tmp_path)
    transcript.reload()
    try:
        replay = rec.RecordingProvider(TranscriptPlayer())
        rec.record_frame(FRAME, replay)
    finally:
        monkeypatch.undo()
        transcript.reload()
    assert [ex["completion"] for ex in replay.exchanges] == [COMPLETION] * 5
    assert [ex["key"] for ex in replay.exchanges] == [ex["key"] for ex in first.exchanges]


def test_the_recorder_will_not_overwrite_a_transcript(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "m0-demo.json"
    target.write_text("existing", encoding="utf-8")
    monkeypatch.setattr(rec, "TRANSCRIPT", target)
    assert rec.main([]) != 0
    assert target.read_text(encoding="utf-8") == "existing"
