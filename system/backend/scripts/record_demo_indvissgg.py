"""Record D-V, the paper's five-call IndVisSGG pipeline, over the ten M0 demonstration frames.

Per frame: step 1 (the draft), three experts over that draft, step 3 (the summary), in the order and
with the inputs of `app.vlm.indvissgg.run`. The calls go through the application's own
provider (`--provider`: the OpenAI-compatible one by default, or `ClaudeProvider`), so the frame
is attached and the recording is what the application would have sent. A refusal or a truncation
raises and stops the run; it is never recorded and never retried.

`anthropic` is imported by `ClaudeProvider` only when a call is made, and `main` builds the provider
only after it has decided to record, so importing this module needs nothing beyond the backend.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.settings import DATA_DIR, require_data_dir  # noqa: E402
from app.vlm import indvissgg  # noqa: E402
from app.vlm.openai_compat import (  # noqa: E402
    MAX_TOKENS,
    PRESENCE_PENALTY,
    TEMPERATURE,
    TOP_K,
    TOP_P,
)
from app.vlm.prompts import EXAMPLES_DEMO, O_DEMO, P_ISG  # noqa: E402
from app.vlm.provider import VLMProvider, exchange_key  # noqa: E402

MODEL = "claude-opus-5-5"  # the `claude` provider's model; `openai-compat` names its own
N_EXPERTS = 3
TRANSCRIPT = DATA_DIR / "vlm" / "transcripts" / "m0-demo.json"
MANIFEST = DATA_DIR / "demos" / "m0" / "MANIFEST.json"

#: The five calls of one frame, in the order the pipeline makes them.
CASES = ("step1", "expert1", "expert2", "expert3", "step3")

SOURCE = (
    "the ten frames of 01_assy_0_1.mp4 at 88 to 106 s, drafted under O_DEMO, P_ISG and "
    "EXAMPLES_DEMO, five calls per frame (step 1, three experts, step 3)"
)

_CLAUDE_NOTES = {
    "note_en": (
        "Claude Opus 5.5 was shown each frame with the prompt recorded beside it, and its "
        "completion is recorded here verbatim. The calls were made by the application's own "
        "provider, `app/vlm/claude.py`, with the frame attached. A graph replayed from this file "
        "is nevertheless `reconstructed`, because the replay is not the call: the application "
        "did not ask a model anything when it read this file."
    ),
    "note_zh": (
        "本檔各筆 completion 係將各影格連同其旁所錄之提示送入 Claude Opus 5.5 後之輸出，逐字"
        "記錄。呼叫由本應用程式自身之 provider（`app/vlm/claude.py`）發出，並附上該影格。然而"
        "由本檔重播所得之圖仍屬 `reconstructed`，因重播並非呼叫：讀取本檔時，應用程式並未向"
        "任何模型提問。"
    ),
}


def _compat_notes(model: str, root: str | None, server: str) -> dict[str, str]:
    weights = root or "weights not reported by the server"
    return {
        "note_en": (
            f"The model `{model}`, the weights {weights} served by vLLM on the author's {server} "
            f"server and reached over Tailscale, was shown each frame with the prompt recorded "
            f"beside it, and its completion is recorded here verbatim, apart from the `</think>` "
            f"strip and surrounding whitespace. The calls were made by the application's own "
            f"provider, `app/vlm/openai_compat.py`, with the frame attached, thinking disabled, "
            f"temperature {TEMPERATURE}, top_p {TOP_P}, top_k {TOP_K}, presence_penalty "
            f"{PRESENCE_PENALTY} and max_tokens {MAX_TOKENS}. Greedy decoding degenerated on the "
            f"first call (one triplet repeated until 8192 tokens, 287 s), and these are the model "
            f"family's published non-thinking settings. The seed is derived from each exchange's "
            f"key (the first 8 hex digits, read as an integer), so a call can be reproduced from "
            f"this file, and the three experts, whose prompts differ only in the expert index, "
            f"sample independently instead of sharing one random stream. Each completion is one "
            f"seeded sample, not the model's only answer. A graph replayed from this file is "
            f"nevertheless `reconstructed`, because the replay is not the call: the application "
            f"did not ask a model anything when it read this file."
        ),
        "note_zh": (
            f"本檔各筆 completion 係將各影格連同其旁所錄之提示送入模型 `{model}`（權重 {weights}，"
            f"由作者之 {server} 伺服器以 vLLM 提供，經 Tailscale 連線）後之輸出，除去 `</think>` "
            f"及其前文與首尾空白外，逐字記錄。呼叫由本應用程式自身之 provider"
            f"（`app/vlm/openai_compat.py`）發出，並附上該影格，關閉 thinking，"
            f"temperature 為 {TEMPERATURE}，top_p 為 {TOP_P}，top_k 為 {TOP_K}，"
            f"presence_penalty 為 {PRESENCE_PENALTY}，max_tokens 為 {MAX_TOKENS}。"
            f"貪婪解碼（temperature 0）於首次呼叫即退化（單一三元組重複至 8192 個 token，歷時 287 "
            f"秒），故改用該模型系列所公布之非思考模式設定。seed 由各筆 exchange 之 key 推得"
            f"（取前 8 位十六進位數，轉為整數），使任一呼叫可由本檔重現，且三位專家之提示僅專家序號"
            f"不同，取樣互相獨立，不共用同一隨機序列。各筆 completion 僅為一次以該 seed 取得之"
            f"取樣，並非該模型之唯一答案。然而由本檔重播所得之圖"
            f"仍屬 `reconstructed`，因重播並非呼叫：讀取本檔時，應用程式並未向任何模型提問。"
        ),
    }


def provenance_for(provider: Any, server: str = "pro6000") -> dict[str, Any]:
    """The transcript's provenance block for the provider that made the calls, on `server`."""
    if provider.name == "openai-compat":
        notes = _compat_notes(provider.model, provider.served_root(), server)
    else:
        notes = _CLAUDE_NOTES
    return {
        "recorded": True,
        "model": provider.model,
        "generated_at": datetime.now(UTC).date().isoformat(),
        "source": SOURCE,
        **notes,
    }


class RecordingProvider:
    """Wraps a provider and keeps every exchange, filed under the key the player will ask for."""

    name = "recording"

    def __init__(self, inner: VLMProvider) -> None:
        self.inner = inner
        self.exchanges: list[dict[str, Any]] = []
        self._calls = 0

    def start(self, image_ref: str) -> None:
        """A new frame: the call counter returns to zero. The frame itself is named per call."""
        self._calls = 0

    def complete(self, *, prompt: str, image_ref: str | None, context: dict[str, Any]) -> str:
        if self._calls >= len(CASES):
            raise RuntimeError(
                f"a sixth call for {image_ref!r}: the paper's pipeline makes {len(CASES)}"
            )
        case = f"{image_ref}/{CASES[self._calls]}"
        completion = self.inner.complete(prompt=prompt, image_ref=image_ref, context=context)
        self._calls += 1
        self.exchanges.append({
            "case": case,
            "key": exchange_key(prompt=prompt, image_ref=image_ref, context=context),
            "prompt": prompt,
            "image_ref": image_ref,
            "context": context,
            "completion": completion,
        })
        return completion


def record_frame(image_ref: str, provider: RecordingProvider) -> None:
    """The same order and inputs as `indvissgg.run`, with the demo criteria and no ablation."""
    provider.start(image_ref)
    graph, _ = indvissgg.step1(
        image_ref=image_ref, dataset="mini-isg", O=list(O_DEMO), P=list(P_ISG),
        E=EXAMPLES_DEMO, ablate=frozenset(), provider=provider,
    )
    experts = indvissgg.step2(
        image_ref=image_ref, dataset="mini-isg", draft=indvissgg.triplets_of(graph),
        n_experts=N_EXPERTS, provider=provider, O=O_DEMO, P=P_ISG, E=EXAMPLES_DEMO,
    )
    indvissgg.step3(
        image_ref=image_ref, dataset="mini-isg",
        revisions=[indvissgg.triplets_of(e["graph"]) for e in experts],
        analyses=[e["analysis_en"] for e in experts], provider=provider,
    )


def main(argv: list[str] | None = None) -> int:
    require_data_dir()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="overwrite an existing transcript")
    parser.add_argument(
        "--provider", choices=("claude", "openai-compat"), default="openai-compat",
        help="claude needs ANTHROPIC_API_KEY; openai-compat needs SGS_VLM_BASE_URL, SGS_VLM_MODEL",
    )
    parser.add_argument(
        "--server", default="pro6000",
        help="the machine serving openai-compat, named in the provenance note "
        "(D114: pro6000; D124: A6000)",
    )
    args = parser.parse_args(argv)

    if TRANSCRIPT.exists() and not args.force:
        print(f"{TRANSCRIPT} exists; pass --force to overwrite it", file=sys.stderr)
        return 1

    inner: Any
    if args.provider == "claude":
        from app.vlm.claude import ClaudeProvider  # noqa: PLC0415 - imports `anthropic` on a call

        inner = ClaudeProvider(model=MODEL)
    else:
        from app.vlm.openai_compat import OpenAICompatibleProvider  # noqa: PLC0415

        inner = OpenAICompatibleProvider()
        print(f"server {inner.base_url}, model {inner.model}, served root {inner.served_root()}")

    # Built before the first call: a server failure here must not come after fifty calls.
    provenance = provenance_for(inner, args.server)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    provider = RecordingProvider(inner)
    started = time.monotonic()
    for frame in manifest["frames"]:
        record_frame(frame["image_id"], provider)
        print(f"{frame['image_id']}: {len(provider.exchanges)} exchanges so far")
    print(f"wall time {time.monotonic() - started:.1f} s")

    payload = {"$schema_version": 1, "provenance": provenance, "exchanges": provider.exchanges}
    TRANSCRIPT.parent.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline=""
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
