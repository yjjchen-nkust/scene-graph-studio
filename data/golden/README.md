# Golden vectors

`vectors.json` is the single fixture artefact. Both engines load it from disk; neither embeds a
copy. `tools/parity.mjs` drives both over these cases and fails CI on any disagreement.

## The rule

**Compute on paper, then write the file. Never paste engine output into an expectation.**

An expectation produced by running the engine proves only that the engine agrees with itself.
Every `expect` block here was derived from the definitions in SRS §4 before the engine was run
against it, and each case's `why` field writes the arithmetic out so a reader can check it.
`hand_checked: true` records that this was done; `test_every_case_is_hand_checked` fails if a
case is added without it.

## Regenerating

`python backend/scripts/build_golden.py` rebuilds the file. The script constructs the *graphs*;
the expectations are literals inside it. Re-running must be a no-op unless a case was
deliberately changed.

## What each case pins

| Case | The thing that would otherwise go wrong |
|---|---|
| `gv-001` | Nothing subtle. The simplest thing that can be right. |
| `gv-002` | Empty GT returning `0.0` instead of `null` — "scored nothing" versus "does not apply" |
| `gv-003` | Empty predictions, and the three `missed` verdicts the grey-dashed edges need |
| `gv-004` | The tie-break. Verdicts are pinned, not only metrics, because reversing the order swaps them |
| `gv-005` | A duplicate prediction being credited twice |
| `gv-006` | The inclusive `IoU ≥ τ` boundary, on a construction that is exact in binary |
| `gv-007` | The mean-Recall denominator: one instance weighs as much as nine |
| `gv-008` | Greedy assignment is an assumption, not a theorem. This discharges it |
| `gv-009` | Masks being silently ignored — the boxes are identical, so a box-only build scores 1.0 |
| `gv-010` | The constraint gap: `R = 0`, `ngR = 1` on identical predictions |
| `gv-011` | `zR` with a non-null value. An always-null metric is not a tested metric |

Tolerance is `1e-9` absolute. `zR` is `null` wherever a case declares no training split.
