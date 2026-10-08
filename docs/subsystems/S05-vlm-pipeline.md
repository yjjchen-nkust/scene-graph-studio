# S5 VLM pipeline

## 1. Purpose and boundary

DRAFT

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

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §31, VERIFICATION §34.

DRAFT

## 6. Traps

DRAFT

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

DRAFT
