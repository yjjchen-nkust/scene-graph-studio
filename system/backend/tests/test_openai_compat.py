"""The OpenAI-compatible provider: request shape, answer cleaning, and every stated refusal.

`urllib.request.urlopen` is replaced, so no server is contacted.
"""

from __future__ import annotations

import base64
import io
import json
import urllib.error
import urllib.request
from typing import Any

import pytest

from app.vlm import frames
from app.vlm.claude import ModelRefused
from app.vlm.openai_compat import (
    BASE_URL_ENV,
    MODEL_ENV,
    OpenAICompatibleProvider,
    seed_for,
)
from app.vlm.provider import ProviderUnavailable, exchange_key, get_provider

BASE = "http://host:8001/v1"


class StubResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def __enter__(self) -> StubResponse:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def answer(content: str | None, *, finish: str = "stop", refusal: str | None = None) -> dict:
    return {"choices": [{
        "finish_reason": finish,
        "message": {"role": "assistant", "content": content, "refusal": refusal},
    }]}


@pytest.fixture
def frame_dir(tmp_path, monkeypatch: pytest.MonkeyPatch):
    (tmp_path / "x.jpg").write_bytes(b"\xff\xd8jpeg-bytes")
    monkeypatch.setattr(frames, "FRAME_DIRS", (tmp_path,))
    monkeypatch.setenv(BASE_URL_ENV, BASE + "/")
    monkeypatch.setenv(MODEL_ENV, "stamping-vlm")
    return tmp_path


@pytest.fixture
def server(monkeypatch: pytest.MonkeyPatch):
    """Captures each Request; the reply is `server.reply` (a dict) or an exception to raise."""

    class Server:
        requests: list[urllib.request.Request]
        reply: Any

        def __init__(self) -> None:
            self.requests = []
            self.reply = answer("ok")

    state = Server()

    def fake_urlopen(request: urllib.request.Request, timeout: float | None = None):
        state.requests.append(request)
        if isinstance(state.reply, Exception):
            raise state.reply
        if isinstance(state.reply, StubResponse):
            return state.reply
        return StubResponse(state.reply)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    return state


def test_the_compatible_provider_sends_the_frame_before_the_prompt(frame_dir, server):
    server.reply = answer("<a, on, b>")
    provider = OpenAICompatibleProvider()
    assert provider.base_url == BASE
    assert provider.complete(prompt="P", image_ref="x", context={}) == "<a, on, b>"
    request = server.requests[0]
    assert request.full_url == f"{BASE}/chat/completions"
    body = json.loads(request.data)
    assert body["model"] == "stamping-vlm"
    assert body["max_tokens"] == 2048
    assert body["temperature"] == 0.7
    assert body["top_p"] == 0.8
    assert body["top_k"] == 20
    assert body["presence_penalty"] == 1.5
    assert body["seed"] == int(exchange_key(prompt="P", image_ref="x", context={})[:8], 16)
    assert body["chat_template_kwargs"] == {"enable_thinking": False}
    content = body["messages"][0]["content"]
    data = base64.standard_b64encode((frame_dir / "x.jpg").read_bytes()).decode("ascii")
    assert content[0] == {
        "type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{data}"},
    }
    assert content[1] == {"type": "text", "text": "P"}


def test_reasoning_before_think_is_removed(frame_dir, server):
    server.reply = answer("why <a, b, c>\n</think>\n<hand, holding, beam>\n")
    provider = OpenAICompatibleProvider()
    assert provider.complete(prompt="P", image_ref="x", context={}) == "<hand, holding, beam>"


def test_a_truncated_answer_is_raised(frame_dir, server):
    server.reply = answer("partial", finish="length")
    with pytest.raises(ProviderUnavailable, match="length"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_content_that_is_not_a_string_is_raised_with_the_url(frame_dir, server):
    server.reply = answer([{"type": "text", "text": "<hand, holding, beam>"}])
    with pytest.raises(
        ProviderUnavailable, match=r"/chat/completions returned message content of type list"
    ):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_a_refusal_is_raised(frame_dir, server):
    server.reply = answer("text", refusal="no")
    with pytest.raises(ModelRefused):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_an_empty_answer_is_raised(frame_dir, server):
    for content in ("", None, "  \n", "reasoning only\n</think>\n  "):
        server.reply = answer(content)
        with pytest.raises(ProviderUnavailable):
            OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_an_unreachable_server_is_raised(frame_dir, server):
    server.reply = urllib.error.URLError("refused")
    with pytest.raises(ProviderUnavailable, match=f"{BASE}/chat/completions"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})
    server.reply = urllib.error.HTTPError(f"{BASE}/chat/completions", 500, "boom", None, None)
    with pytest.raises(ProviderUnavailable, match="500"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_a_missing_frame_makes_no_request(frame_dir, server):
    with pytest.raises(ProviderUnavailable):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="absent", context={})
    assert server.requests == []


@pytest.mark.parametrize("unset", [BASE_URL_ENV, MODEL_ENV])
def test_the_provider_needs_both_settings(frame_dir, monkeypatch, unset):
    monkeypatch.delenv(unset)
    with pytest.raises(ProviderUnavailable, match=unset):
        OpenAICompatibleProvider()


def test_served_root_reads_the_model_list(frame_dir, server):
    server.reply = {"data": [
        {"id": "other", "root": "elsewhere"},
        {"id": "stamping-vlm", "root": "Qwen/Qwen3.8-27B"},
    ]}
    provider = OpenAICompatibleProvider()
    assert provider.served_root() == "Qwen/Qwen3.8-27B"
    assert server.requests[0].full_url == f"{BASE}/models"
    server.reply = {"data": [{"id": "other", "root": "elsewhere"}]}
    assert provider.served_root() is None


def test_get_provider_offers_the_compatible_provider_and_nothing_silently(
    frame_dir, monkeypatch
):
    assert isinstance(get_provider("openai-compat"), OpenAICompatibleProvider)
    monkeypatch.delenv(BASE_URL_ENV)
    with pytest.raises(ProviderUnavailable):
        get_provider("openai-compat")


def test_the_seed_is_per_call_and_deterministic():
    one = "You are expert 1 of 3. Revise the draft."
    two = "You are expert 2 of 3. Revise the draft."
    assert seed_for(prompt=one, image_ref="x", context={}) == seed_for(
        prompt=one, image_ref="x", context={}
    )
    assert seed_for(prompt=one, image_ref="x", context={}) != seed_for(
        prompt=two, image_ref="x", context={}
    )
    assert 0 <= seed_for(prompt=one, image_ref="x", context={}) < 2**32


def test_each_request_carries_the_seed_of_its_own_prompt(frame_dir, server):
    provider = OpenAICompatibleProvider()
    provider.complete(prompt="expert 1 of 3", image_ref="x", context={})
    provider.complete(prompt="expert 2 of 3", image_ref="x", context={})
    seeds = [json.loads(r.data)["seed"] for r in server.requests]
    assert seeds[0] != seeds[1]


def test_a_body_that_is_not_json_is_raised(frame_dir, server):
    class Bad(StubResponse):
        def read(self) -> bytes:
            return b"<html>gateway</html>"

    server.reply = Bad({})
    with pytest.raises(ProviderUnavailable, match=f"{BASE}/chat/completions"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


@pytest.mark.parametrize(
    "payload",
    [{}, {"choices": []}, {"choices": [{}]}, {"choices": [{"message": {}}]}, {"choices": None}],
)
def test_an_answer_of_the_wrong_shape_is_raised(frame_dir, server, payload):
    server.reply = payload
    with pytest.raises(ProviderUnavailable, match=f"{BASE}/chat/completions"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


@pytest.mark.parametrize("error", [TimeoutError("read timed out"), ConnectionResetError("reset")])
def test_a_timeout_or_socket_error_during_the_read_is_raised(frame_dir, server, error):
    class Slow(StubResponse):
        def read(self) -> bytes:
            raise error

    server.reply = Slow({})
    with pytest.raises(ProviderUnavailable, match=f"{BASE}/chat/completions"):
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})


def test_an_http_error_carries_at_most_500_characters_of_the_body(frame_dir, server):
    url = f"{BASE}/chat/completions"
    body = io.BytesIO(b"reason: " + b"x" * 2000)
    server.reply = urllib.error.HTTPError(url, 400, "bad", None, body)
    with pytest.raises(ProviderUnavailable) as caught:
        OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={})
    message = str(caught.value)
    assert "400" in message and "reason: " in message
    assert message.count("x") == 500 - len("reason: ")


def test_text_after_the_answer_passes_through_untouched(frame_dir, server):
    server.reply = answer("why\n</think>\n<a, on, b>\n\nNote: kept.\n")
    assert OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={}) == (
        "<a, on, b>\n\nNote: kept."
    )


def test_only_the_first_think_marker_is_removed(frame_dir, server):
    server.reply = answer("r1</think>A\n</think>\nB")
    assert OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={}) == (
        "A\n</think>\nB"
    )


def test_a_fenced_answer_keeps_its_fence(frame_dir, server):
    server.reply = answer("```\n<a, on, b>\n```")
    assert OpenAICompatibleProvider().complete(prompt="P", image_ref="x", context={}) == (
        "```\n<a, on, b>\n```"
    )
