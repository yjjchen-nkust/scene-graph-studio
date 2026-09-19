"""The provider seam, and the key every transcript is filed under.

SRS §6: the VLM is configured, not hard-coded, and the default works with no API key and no
network. Everything above this module talks to `VLMProvider` and never to a vendor.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Protocol, runtime_checkable


class ProviderUnavailable(RuntimeError):
    """Asked for a provider this machine cannot supply. Never answered with a substitute."""


class TranscriptMiss(LookupError):
    """No recorded exchange for this key.

    Raised rather than returning an empty completion, because L5 would then appear to work while
    teaching nothing: a student would read a blank revision as the model having found no fault.
    """


@runtime_checkable
class VLMProvider(Protocol):
    name: str

    def complete(
        self, *, prompt: str, image_ref: str | None, context: dict[str, Any]
    ) -> str: ...


def exchange_key(*, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
    """A stable identity for one exchange: sha256 over canonical JSON, first 16 hex digits.

    `sort_keys` makes the key independent of how the caller happened to order the context, and
    dependent on what is in it. Both halves matter: without sorting, an equivalent call misses;
    without the content, two different ablations would share a transcript.
    """
    blob = json.dumps(
        {"prompt": prompt, "image_ref": image_ref, "context": context},
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def get_provider(name: str | None) -> VLMProvider:
    """`None` selects the offline default. Anything else must be asked for explicitly.

    There is no fallback. A `claude` request that quietly became a transcript replay would put
    recorded text on screen under a live model's name, which is the one thing the provenance
    rules in this project exist to prevent.
    """
    from app.vlm.transcript import TranscriptPlayer  # noqa: PLC0415 - avoids an import cycle

    if name in (None, "transcript"):
        return TranscriptPlayer()
    if name == "claude":
        from app.vlm.claude import ClaudeProvider  # noqa: PLC0415 - optional dependency

        return ClaudeProvider()
    raise ProviderUnavailable(
        f"unknown VLM provider {name!r}; this build offers 'transcript' and 'claude'"
    )
