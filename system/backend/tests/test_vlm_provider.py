"""The VLM provider protocol, and the offline transcript player that is its default.

L5 must work with no API key and no network (SRS §6), so the default provider replays recorded
exchanges. Two things make that honest rather than a stub: a miss is an error that names the key
and how to record it, never an empty string; and a transcript says whether it was recorded from a
live model or authored from the paper, because a hand-written exchange presented as a model's
output is the same defect as a hand-written benchmark figure.
"""

from __future__ import annotations

import json

import pytest

from app.settings import DATA_DIR
from app.vlm import prompts
from app.vlm.provider import (
    ProviderUnavailable,
    TranscriptMiss,
    exchange_key,
    get_provider,
)

TRANSCRIPTS = DATA_DIR / "vlm" / "transcripts"


def files() -> list:
    return sorted(TRANSCRIPTS.glob("*.json"))


# ── provider selection ────────────────────────────────────────────────────────────────────────


def test_transcript_player_is_the_default():
    assert get_provider(None).name == "transcript"


def test_transcript_player_needs_no_network_and_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = get_provider(None).complete(
        prompt=prompts.step2_prompt(prompts.CANNED["hallucinated_wrench"]["draft"], expert=1),
        image_ref="isg-fig2-t1",
        context={},
    )
    assert out


def test_an_unrecorded_prompt_raises_a_stated_error_not_a_silent_empty():
    with pytest.raises(TranscriptMiss) as e:
        get_provider(None).complete(prompt="nothing recorded", image_ref="p1", context={})
    message = str(e.value).lower()
    assert "record" in message
    assert exchange_key(prompt="nothing recorded", image_ref="p1", context={}) in str(e.value)


def test_claude_provider_without_a_key_is_never_selected_silently(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ProviderUnavailable) as e:
        get_provider("claude")
    # The reason, not just the refusal. Without this the test passes on any machine where the
    # `anthropic` package is absent, whatever the key check does -- which is how it behaved when
    # the key check was deleted on purpose and nothing went red.
    assert "ANTHROPIC_API_KEY" in str(e.value)


def test_an_unknown_provider_is_an_error_and_not_a_quiet_fallback(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ProviderUnavailable):
        get_provider("gpt-4v")


# ── the transcripts themselves ────────────────────────────────────────────────────────────────


def test_there_are_transcripts_to_check():
    assert files(), "the transcript corpus is empty; the tests below would prove nothing"


def test_no_transcript_contains_anything_resembling_a_key():
    # Not paranoia: a recorded exchange is exactly the artefact that carries a header by accident.
    for path in files():
        text = path.read_text(encoding="utf-8")
        assert "sk-" not in text, path.name
        assert "ANTHROPIC_API_KEY" not in text, path.name
        assert "Bearer " not in text, path.name


def test_every_transcript_says_whether_a_model_produced_it():
    """The D-07 rule, applied to text instead of to graphs. An exchange authored from the paper
    is a legitimate teaching artefact and an illegitimate claim about a model."""
    for path in files():
        blob = json.loads(path.read_text(encoding="utf-8"))
        p = blob["provenance"]
        assert isinstance(p["recorded"], bool), path.name
        if p["recorded"]:
            assert p["model"], path.name
            assert p["generated_at"], path.name
        else:
            assert p["source"], path.name
            assert p["note_en"] and p["note_zh"], path.name


def test_every_exchange_key_matches_the_exchange_it_labels():
    """A key computed by hand, or left behind after a prompt was edited, silently becomes a
    miss at run time and a transcript nobody can reach."""
    for path in files():
        blob = json.loads(path.read_text(encoding="utf-8"))
        for ex in blob["exchanges"]:
            want = exchange_key(
                prompt=ex["prompt"], image_ref=ex["image_ref"], context=ex["context"]
            )
            assert ex["key"] == want, f"{path.name}: {ex['key']} should be {want}"


def test_the_three_corrections_the_paper_names_are_all_playable():
    """SRS §6: deleting a hallucinated `wrench`; recovering missing `terminals`, `beam` and
    `panel`; rewriting an imprecise `taping` to the criteria-legal `knocking on`."""
    player = get_provider(None)
    for case in ("hallucinated_wrench", "missing_nodes", "imprecise_taping"):
        canned = prompts.CANNED[case]
        out = player.complete(
            prompt=prompts.step2_prompt(canned["draft"], expert=1),
            image_ref=canned["image_ref"],
            context={},
        )
        assert canned["expect_in_completion"] in out, case


def test_a_transcript_completion_is_never_empty():
    for path in files():
        for ex in json.loads(path.read_text(encoding="utf-8"))["exchanges"]:
            assert ex["completion"].strip(), f"{path.name}: {ex['key']}"


def test_the_key_ignores_context_ordering_but_not_context_content():
    a = exchange_key(prompt="p", image_ref="i", context={"x": 1, "y": 2})
    b = exchange_key(prompt="p", image_ref="i", context={"y": 2, "x": 1})
    c = exchange_key(prompt="p", image_ref="i", context={"x": 1, "y": 3})
    assert a == b
    assert a != c
