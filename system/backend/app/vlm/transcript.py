"""The offline default: replay a recorded or authored exchange, or say precisely what is missing.

Every file under `data/vlm/transcripts/` carries a `provenance` block saying whether a model
produced the text. That is the D-07 rule applied to prose: an exchange written from the paper is a
legitimate teaching artefact and an illegitimate claim about a model, and only the block
distinguishes them.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from app.settings import DATA_DIR
from app.vlm.provider import TranscriptMiss, exchange_key

ROOT = DATA_DIR / "vlm" / "transcripts"


@lru_cache(maxsize=1)
def _corpus() -> dict[str, dict[str, Any]]:
    """Every exchange, by key, with the provenance of the file it came from attached."""
    out: dict[str, dict[str, Any]] = {}
    if not ROOT.is_dir():
        return out
    for path in sorted(ROOT.glob("*.json")):
        blob = json.loads(path.read_text(encoding="utf-8"))
        for exchange in blob["exchanges"]:
            out[exchange["key"]] = {**exchange, "provenance": blob["provenance"],
                                    "file": path.name}
    return out


def reload() -> None:
    """Drop the cache. Used after recording a new exchange in the same process."""
    _corpus.cache_clear()


class TranscriptPlayer:
    name = "transcript"

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        key = exchange_key(prompt=prompt, image_ref=image_ref, context=context)
        hit = _corpus().get(key)
        if hit is None:
            raise TranscriptMiss(
                f"no recorded exchange for key {key}. To record it, run this call against a live "
                f"provider and append the prompt, image_ref, context, key and completion to a "
                f"file under data/vlm/transcripts/, with a provenance block naming the model and "
                f"the date. image_ref={image_ref!r}, prompt starts {prompt[:60]!r}"
            )
        return hit["completion"]

    def provenance_of(self, *, prompt: str, image_ref: str | None,
                      context: dict[str, Any]) -> dict[str, Any] | None:
        """Where the replayed text came from, for the lab to render beside it."""
        hit = _corpus().get(exchange_key(prompt=prompt, image_ref=image_ref, context=context))
        return None if hit is None else hit["provenance"]
