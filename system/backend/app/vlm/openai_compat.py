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
from app.vlm.provider import ProviderUnavailable

BASE_URL_ENV = "SGS_VLM_BASE_URL"
MODEL_ENV = "SGS_VLM_MODEL"
MAX_TOKENS = 8192
TIMEOUT_SECONDS = 300

_THINK_END = "</think>"


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
            raise ProviderUnavailable(f"{url} answered status {error.code}") from error
        except urllib.error.URLError as error:
            raise ProviderUnavailable(f"{url} is unreachable: {error.reason}") from error

    def served_root(self) -> str | None:
        """The weights behind `.model`, as the server reports them, or None if it lists none."""
        listing = self._open(urllib.request.Request(f"{self.base_url}/models"))
        for entry in listing.get("data", []):
            if entry.get("id") == self.model:
                return entry.get("root")
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
            "temperature": 0,
            "chat_template_kwargs": {"enable_thinking": False},
            "messages": [{"role": "user", "content": content}],
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        choice = self._open(request)["choices"][0]
        message = choice["message"]
        if message.get("refusal"):
            raise ModelRefused(f"{self.model} refused the request: {message['refusal']}")
        if choice.get("finish_reason") == "length":
            raise ProviderUnavailable(
                f"{self.model} stopped at finish_reason 'length'; a truncated answer is never "
                f"recorded"
            )
        text = message.get("content") or ""
        _, marker, after = text.partition(_THINK_END)
        text = (after if marker else text).strip()
        if not text:
            raise ProviderUnavailable(f"{self.model} returned an empty answer")
        return text
