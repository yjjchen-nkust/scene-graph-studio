"""A provider for any server that speaks the OpenAI chat-completions protocol (vLLM here).

Opt-in, like `ClaudeProvider`, and standard library only: no `openai` package and no key. The
address and the model id come from the environment, so nothing about a machine is committed.
"""

from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from typing import Any

from app.vlm.claude import ModelRefused
from app.vlm.frames import frame_path
from app.vlm.provider import ProviderUnavailable, exchange_key

BASE_URL_ENV = "SGS_VLM_BASE_URL"
MODEL_ENV = "SGS_VLM_MODEL"
MAX_TOKENS = 2048
TIMEOUT_SECONDS = 300
# Qwen3's published non-thinking settings. Greedy decoding (temperature 0) degenerated on the
# first recorded call: one triplet repeated until the token limit (D114). The seed is not a
# constant: each call derives its own from its exchange key (`seed_for`), so calls whose prompts
# differ only in the expert index are independent samples, and any call can be reproduced.
TEMPERATURE = 0.7
TOP_P = 0.8
TOP_K = 20
PRESENCE_PENALTY = 1.5
ERROR_BODY_CHARS = 500

_THINK_END = "</think>"


def seed_for(*, prompt: str, image_ref: str | None, context: dict[str, Any]) -> int:
    """The sampling seed of one call: the first 8 hex digits of its exchange key.

    Deterministic, so a recorded call can be reproduced from the transcript alone, and distinct for
    distinct prompts, so the three experts (prompts that differ only in "expert N of N") are not
    forced onto the same random stream.
    """
    return int(exchange_key(prompt=prompt, image_ref=image_ref, context=context)[:8], 16)


class OpenAICompatibleProvider:
    name = "openai-compat"

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        base_url = base_url or os.environ.get(BASE_URL_ENV)
        model = model or os.environ.get(MODEL_ENV)
        if not base_url:
            raise ProviderUnavailable(
                f"{BASE_URL_ENV} is not set. The provider needs the server's address, "
                f"for example http://host:8001/v1."
            )
        if not model:
            raise ProviderUnavailable(f"{MODEL_ENV} is not set. The provider needs a model id.")
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _open(self, request: urllib.request.Request) -> dict[str, Any]:
        url = request.full_url
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            try:
                detail = error.read().decode("utf-8", errors="replace")[:ERROR_BODY_CHARS]
            except Exception:  # noqa: BLE001 - the body is only a courtesy to the reader
                detail = ""
            raise ProviderUnavailable(
                f"{url} answered status {error.code}" + (f": {detail}" if detail else "")
            ) from error
        except urllib.error.URLError as error:
            raise ProviderUnavailable(f"{url} is unreachable: {error.reason}") from error
        except OSError as error:  # includes TimeoutError and socket errors during the read
            raise ProviderUnavailable(
                f"{url} failed while reading the answer: {error!r}"
            ) from error
        except ValueError as error:  # includes json.JSONDecodeError and bad UTF-8
            raise ProviderUnavailable(
                f"{url} returned a body that is not JSON: {error}"
            ) from error

    def served_root(self) -> str | None:
        """The weights behind `.model`, as the server reports them, or None if it lists none."""
        url = f"{self.base_url}/models"
        listing = self._open(urllib.request.Request(url))
        try:
            for entry in listing["data"]:
                if entry["id"] == self.model:
                    return entry.get("root")
        except (KeyError, TypeError, AttributeError) as error:
            raise ProviderUnavailable(
                f"{url} returned a model list of an unexpected shape"
            ) from error
        return None

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        content: list[dict[str, Any]] = []
        if image_ref is not None:
            path = frame_path(image_ref)
            if path is None:
                raise ProviderUnavailable(
                    f"no frame found for image {image_ref!r}. A call without the frame would "
                    f"describe an image the model did not see, so none is made."
                )
            data = base64.standard_b64encode(path.read_bytes()).decode("ascii")
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{data}"}}
            )
        content.append({"type": "text", "text": prompt})

        body = {
            "model": self.model,
            "max_tokens": MAX_TOKENS,
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "top_k": TOP_K,
            "presence_penalty": PRESENCE_PENALTY,
            "seed": seed_for(prompt=prompt, image_ref=image_ref, context=context),
            "chat_template_kwargs": {"enable_thinking": False},
            "messages": [{"role": "user", "content": content}],
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        url = request.full_url
        reply = self._open(request)
        try:
            choice = reply["choices"][0]
            message = choice["message"]
            text = message["content"] or ""
            refusal = message.get("refusal")
            finish = choice.get("finish_reason")
        except (KeyError, IndexError, TypeError, AttributeError) as error:
            raise ProviderUnavailable(
                f"{url} returned an answer without choices, message or content"
            ) from error
        if refusal:
            raise ModelRefused(f"{self.model} refused the request: {refusal}")
        if finish == "length":
            raise ProviderUnavailable(
                f"{self.model} stopped at finish_reason 'length'; a truncated answer is never "
                f"recorded"
            )
        _, marker, after = text.partition(_THINK_END)
        text = (after if marker else text).strip()
        if not text:
            raise ProviderUnavailable(f"{self.model} returned an empty answer")
        return text
