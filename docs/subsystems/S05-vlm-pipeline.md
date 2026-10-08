# S5 VLM pipeline

## 1. Purpose and boundary

S5 is the replica of IndVisSGG's three steps, extraction under the Triplets Extraction Criteria, N experts auditing the draft, and a summary, together with the providers that answer each call: the offline transcript player by default, and two opt-in live providers. It builds the prompts, keys every exchange, parses the completions into graphs and returns the authors' published tables beside the run, never merged with it. It does not score a graph (S1), serve the endpoint (S2) or draw the M0 demonstration (S13), and no graph it produces carries a measured box.

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/vlm/` | VLM providers, prompts, frames, transcripts and the IndVisSGG pipeline |
| `system/backend/scripts/rekey_step2_transcripts.py` | Rekeys the authored step-2 exchanges under the criteria prompt |
| `system/backend/tests/test_indvissgg.py` | Tests of the IndVisSGG pipeline |
| `system/backend/tests/test_openai_compat.py` | Tests of the OpenAI-compatible provider |
| `system/backend/tests/test_vlm_provider.py` | Tests of the provider interface |
| `data/vlm/transcripts/` | Recorded VLM transcripts (NAS) |

## 3. Interfaces

**Provides:**

- `app.vlm.indvissgg` (`run`, `step1`, `step2`, `step3`, `criteria_for`, `parse_triplets`, `revision_text`, `parse_analysis`, `to_graph`, `published_reference`), `app.vlm.prompts` (the step builders and `O_DEFAULT`, `O_ISG`, `O_DEMO`, `P_ISG`, `EXAMPLES_ISG`, `EXAMPLES_DEMO`) and `app.vlm.provider` (`get_provider`, `exchange_key`, `ProviderUnavailable`, `TranscriptMiss`). Imported by S2 (`system/backend/app/api/vlm.py`, which serves `POST /api/vlm/indvissgg`, contracts §1.9), S3 (`build_mini_isg.py`) and S13 (`build_demo_m0.py`, `record_demo_indvissgg.py`).

**Consumes:**

- S2 (`indvissgg.py`, `transcript.py` and `frames.py` import `app.schema` or `app.settings`).
- S3 (`criteria_for` imports `slice_dir` from `app.datasets.loader` and reads the mini-ISG slice's `MANIFEST.json`; `frames.py` reads `data/slices/mini-isg/images`).
- S13 (`criteria_for` reads `data/demos/m0/MANIFEST.json`; `frames.py` reads `data/demos/m0/frames`).

## 4. Current rules

1. The VLM is configured, not hard-coded: everything above `app/vlm/provider.py` talks to the `VLMProvider` protocol, whose default implementation is the offline transcript player, so L5 works with no key and no network. [SRS §6] [D-17]
2. `get_provider` returns the transcript player for no name or `transcript`, `ClaudeProvider` for `claude` and `OpenAICompatibleProvider` for `openai-compat`, and raises `ProviderUnavailable` for any other name. No provider falls back to another. [D114] [`system/backend/app/vlm/provider.py`]
3. The live providers are opt-in, and the transcript player is the only provider a P0 feature may require. [D-17]
4. An exchange is keyed on the first 16 hex digits of a SHA-256 over the canonical JSON of its prompt, `image_ref` and context, with the keys sorted. A replay that finds no exchange raises `TranscriptMiss` naming the key, never an empty completion. [D38] [`system/backend/app/vlm/provider.py`] [`system/backend/app/vlm/transcript.py`]
5. The step builders live in `app/vlm/prompts.py`, and the pipeline calls the same functions the transcripts were keyed with; a test recomputes every key from the exchange it labels, so a prompt edit fails CI rather than emptying the corpus. [D38]
6. Every transcript file carries a provenance block saying whether a model produced the text, and one that claims `recorded: true` must name a model and a date. The three Figure 2 corrections and the fourteen pipeline exchanges are authored from the paper's §3.1 to §3.3 and Figure 2, with `recorded: false`. [D38] [D39]
7. A graph built from a replay is `reconstructed`, with `provenance.vlm` `"transcript"`. A graph a live provider produced is `measured`, with `provenance.vlm` the model id: the Claude provider's `model`, `claude-sonnet-5` by default, or the served name on the OpenAI-compatible provider. [D39] [D122] [`system/backend/app/vlm/indvissgg.py`]
8. The method emits triplets and no geometry, so every graph carries one-pixel placeholder boxes and a note saying so in both languages, in one string, whether the graph is live or replayed. [D39] [D120] [D122]
9. An empty criteria list is an ablation: `O=[]` and `ablate=["O"]` build the same prompt, and no empty `TRIPLETS EXTRACTION CRITERIA` heading is emitted. [D39]
10. Each of the N experts receives its own prompt, carrying its index, the draft, and the O, P and E that step 1 was given before any ablation, and is asked for the revised triplets one per line, then `ANALYSIS_EN` and `ANALYSIS_ZH`. Under a step-1 ablation the experts still receive the full criteria, so a Table 3 row run through steps 2 and 3 no longer withholds the ablated block from the final graph. [D115]
11. `revision_text` ends an expert's revision at the first analysis label, so a triplet quoted in an analysis is not a revision row. A label is `ANALYSIS_EN` or `ANALYSIS_ZH` at the start of a line with up to four non-word characters around it, and its paragraph may follow on the same line. [D115] [D118]
12. Step 3 receives each expert's revision and its English analysis. [D115] [`system/backend/app/vlm/indvissgg.py`]
13. `n_experts` is 1, 2, 3 or 5, the four counts Table 4 measures. [D39] [contracts §1.9]
14. The authors' Tables 3 and 4 come back in `published_reference`, a field of their own labelled as not this run, read from `data/content/indvissgg_tables.json`. Table 3 is the five-row factorial over O, P and E with analysis, its omitted row P alone at 2.079; Table 4 carries every cutoff, because N = 5 is not better than N = 3 at every one (25.480 against 24.383 on mR at k = 50, 30.142 against 30.020 on R at k = 100, for N = 3). [D16] [SRS §6] [`system/backend/app/vlm/indvissgg.py`]
15. `criteria_for(image_ref)` gives a frame listed in `data/demos/m0/MANIFEST.json` `O_DEMO`, `P_ISG` and `EXAMPLES_DEMO`; a frame listed in the mini-ISG slice's manifest `O_ISG`, `P_ISG` and `EXAMPLES_ISG`; and any other frame the Figure 2 vocabulary, `O_DEFAULT`, `P_DEFAULT` and the module's two examples. The manifests decide, not a prefix rule. [D51] [D124] [`system/backend/app/vlm/indvissgg.py`]
16. `O_DEMO` is `O_ISG` with `hand` replaced by `left hand` and `right hand`, 13 classes, and `EXAMPLES_DEMO`'s positive example states how to tell the hands apart. [D124]
17. A live provider sends the frame as a base64 JPEG block before the prompt. `frame_path` looks up only an id matching `[A-Za-z0-9_-]+`, first among the mini-ISG slice's images and then in `data/demos/m0/frames`, and skips a candidate that resolves outside its directory; a frame found in neither raises `ProviderUnavailable`, and no request is made. [D112] [`system/backend/app/vlm/frames.py`]
18. Because no frame exists for `isg-fig2-t1`, `isg-fig2-t2` or `isg-fig2-t3`, a live run on the Figure 2 ids, the endpoint's default, answers 503 `vlm_unavailable` by intent; their replay reads no frame and is unaffected. [D112]
19. `ClaudeProvider` needs `ANTHROPIC_API_KEY` and the `anthropic` package, which `requirements.txt` deliberately omits. It requests `max_tokens=16000` and `output_config={"effort": "high"}` and sets neither fallbacks nor thinking. A refusal raises `ModelRefused`; a truncation, an answer without text, an HTTP status error and an unreachable API raise `ProviderUnavailable`, which the endpoint answers as 503 `vlm_unavailable`. [D112] [D120] [`system/backend/app/vlm/claude.py`]
20. `OpenAICompatibleProvider` uses the standard library alone and reads its address and model id from `SGS_VLM_BASE_URL` and `SGS_VLM_MODEL`. It samples with temperature 0.7, top_p 0.8, top_k 20, presence_penalty 1.5 and max_tokens 2048, thinking disabled, and a seed taken from the first 8 hex digits of each exchange's key; it removes any text up to a first `</think>`, and each failure it meets raises `ProviderUnavailable` naming the URL. [D114] [`system/backend/app/vlm/openai_compat.py`]
21. The mini-ISG step-1 drafts in `data/vlm/transcripts/mini-isg-step1.json` were written by a model given each frame and the exact step-1 prompt outside the application's provider path, so a graph replayed from them is `reconstructed` and `provider_used` reads `transcript`. [D49]
22. `rekey_step2_transcripts.py` rebuilds the authored step-2 exchanges of Figure 2, five in `fig2-pipeline.json` and three in `fig2-corrections.json`, and the four step-3 exchanges, under the current prompt builders and recomputes their keys, leaving every completion as it was. It has `--check`, refuses `m0-demo.json`, and rebuilds from the current prompt only, so reverting the prompt needs the old `step2_prompt` restored before it runs. [D115]
23. On the hosted backend, `render.yaml` installs `system/backend/requirements.txt`, which lists neither `torch` nor `anthropic`, and sets no `ANTHROPIC_API_KEY`. The transcript player there replays the four transcript files that `fixtures/data/vlm/transcripts/` holds, and a request for `claude` answers 503 `vlm_unavailable`. [D-24] [D127] [`render.yaml`] [`system/backend/app/vlm/claude.py`]

## 5. Verification

**Records:** VERIFICATION §31, VERIFICATION §34.

**`npm run ci` steps:** 2 pytest, `system/backend/tests/test_indvissgg.py`, `test_vlm_provider.py` and `test_openai_compat.py`, with `test_mini_isg.py` requiring every mini-ISG draft to be reachable through the pipeline; 5 ruff.

**Outside `ci`:** `npm run check:offline` (check 6) requires `POST /api/vlm/indvissgg` with `provider: claude` to answer 503 `vlm_unavailable` (VERIFICATION §6).

**What the records measure.** §31 records the attempt and the three recordings of D-V through the OpenAI-compatible provider, and the rekey of the authored Figure 2 exchanges. §34 records D-V's recording on the A6000 under `O_DEMO`.

## 6. Traps

- D-V drafts under `O_DEMO`, which is `O_ISG` with `hand` split into `left hand` and `right hand`, and `EXAMPLES_DEMO`; D-T's comparison keeps `O_ISG`. [D124] [`CLAUDE.md`]
- D-V was recorded through `app/vlm/openai_compat.py` and not on the Anthropic API, on the author's pro6000 (`Qwen/Qwen3.8-27B`) until D124 and on the A6000 (`Qwen/Qwen3.8-27B-FP8`, vLLM 0.21.0) since; its graphs are `reconstructed`, and no label says "measured" of a replay. [D114] [D124] [`CLAUDE.md`]

## 7. History

**Binding decisions:** D-07, D-17.

**Specs and plans:** `2026-09-15-03-models-and-vlm.md`, `2026-09-16-indvissgg-reading.md`, `2026-09-29-m0-demos-design.md`, `2026-09-29-m0-demos.md`.

| Deviation | Effect | Role |
|---|---|---|
| D16 | two content errors about the anchor paper's ablations | secondary |
| D38 | the transcripts cannot be recorded before the prompts exist, and were not recorded at all | primary |
| D39 | the replica's tests were written after the module, and validated by mutation instead | primary |
| D49 | one model drafted the mini-ISG set and the same model corrected it | secondary |
| D51 | what the review of D46–D50 found | secondary |
| D112 | the live VLM provider sent no frame | primary |
| D114 | D-V is recorded on the author's own server, through an OpenAI-compatible provider | primary |
| D115 | The expert prompt carries the criteria and asks for labelled analyses; D-V is recorded again | primary |
| D118 | two minors the M0 demos' final review left open | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D124 | D-V names each hand, and is recorded again on the A6000 | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

1. `ClaudeProvider`'s request shape is exercised only against a fake `anthropic` module; no live call has been made through it. [D112] [D120]
2. `IndVisSGGRequest.provider` admits `transcript` and `claude` only, so `openai-compat` cannot be chosen through the endpoint. Left open by D122. [D122] [`system/backend/app/api/vlm.py`]
3. D-17 places the live provider in `app/vlm/providers/`; it is `system/backend/app/vlm/claude.py`, and no such directory exists. [D-17] [`system/backend/app/vlm/claude.py`]
4. D-17 states that `/api/health` reports whether a live provider is configured, and contracts §1.2 types `vlm_provider` as `transcript` or `claude`; `health.py` always answers `"transcript"`. [D-17] [contracts §1.2] [`system/backend/app/api/health.py`]
5. The M0 demos design, `2026-09-29-m0-demos-design.md` §3.3, still has D-V recorded under `O_ISG`, `P_ISG` and `EXAMPLES_ISG`, and carries no annotation for D124, which replaced `O_ISG` and `EXAMPLES_ISG` with `O_DEMO` and `EXAMPLES_DEMO`. D124, the later record, holds. [D124] [`2026-09-29-m0-demos-design.md`]
6. Contracts §1.9 types `published_reference.table3` as `{components, r_at_20}` and `table4` as `{n_experts, r_at_20, mr_at_20}`, the @20 columns only. `published_reference()` returns every cutoff, R and mR at 20, 50 and 100, as D16 requires, and the contract was never amended. [contracts §1.9] [D16] [`system/backend/app/vlm/indvissgg.py`]
