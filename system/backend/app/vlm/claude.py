"""The opt-in live provider. Selected only by explicit request, never as a fallback.

D-17. The paper used GPT-4V and Gemini-Pro-Vision; both are superseded and neither is reproducible
at the version tested, so a live run here is a different experiment from the paper's and the lab
has to say so. Nothing in this module runs unless a student asks for it and supplies a key.
"""

from __future__ import annotations

import base64
import importlib.util
import os
from typing import Any

from app.vlm.frames import frame_path
from app.vlm.provider import ProviderUnavailable

ENV_KEY = "ANTHROPIC_API_KEY"
MODEL = "claude-sonnet-5"


class ModelRefused(ProviderUnavailable):
    """The model declined. Raised, never recorded as an answer."""


class ClaudeProvider:
    name = "claude"

    def __init__(self, model: str = MODEL) -> None:
        self.model = model
        if not os.environ.get(ENV_KEY):
            raise ProviderUnavailable(
                f"{ENV_KEY} is not set. The live provider is opt-in: put the key in an untracked "
                f".env, or leave it unset and use the offline transcript player."
            )
        if importlib.util.find_spec("anthropic") is None:
            raise ProviderUnavailable(
                "the `anthropic` package is not installed. It is deliberately absent from "
                "requirements.txt so that the base install stays offline; "
                "`pip install anthropic` to enable the live path."
            )

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        from anthropic import Anthropic  # noqa: PLC0415 - optional dependency, checked above

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
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/jpeg", "data": data},
                }
            )
        content.append({"type": "text", "text": prompt})

        client = Anthropic(api_key=os.environ[ENV_KEY])
        message = client.messages.create(
            model=self.model,
            max_tokens=16000,
            output_config={"effort": "high"},
            messages=[{"role": "user", "content": content}],
        )
        if message.stop_reason == "refusal":
            category = getattr(getattr(message, "stop_details", None), "category", None)
            raise ModelRefused(
                f"{self.model} refused the request"
                + (f" (category: {category})" if category else "")
            )
        if message.stop_reason == "max_tokens":
            raise ProviderUnavailable(
                f"{self.model} stopped at max_tokens; a truncated answer is never recorded"
            )
        return "".join(block.text for block in message.content if block.type == "text")
