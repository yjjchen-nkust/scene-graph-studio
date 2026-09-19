"""The opt-in live provider. Selected only by explicit request, never as a fallback.

D-17. The paper used GPT-4V and Gemini-Pro-Vision; both are superseded and neither is reproducible
at the version tested, so a live run here is a different experiment from the paper's and the lab
has to say so. Nothing in this module runs unless a student asks for it and supplies a key.
"""

from __future__ import annotations

import importlib.util
import os
from typing import Any

from app.vlm.provider import ProviderUnavailable

ENV_KEY = "ANTHROPIC_API_KEY"
MODEL = "claude-sonnet-5"


class ClaudeProvider:
    name = "claude"

    def __init__(self) -> None:
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

        client = Anthropic(api_key=os.environ[ENV_KEY])
        message = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(block.text for block in message.content if block.type == "text")
