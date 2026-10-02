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
| `gv-012` | E13's one-stage failure: `multi_mpo` admits three predictions at one ordered pair of masks |
| `gv-013` | The scene of `gv-012` under `single_mpo`, which keeps one, so the correction's direction is pinned |
| `gv-014` | The graph constraint keyed on the ordered object pair: two hands on one assembly are two pairs (D99) |
| `gv-015` | Duplicate masks under `single_mpo` and `graph`: pairing runs before the constraint and caps first |
| `gv-016` | The scene of `gv-015` under `multi_mpo`; a constraint keyed on class pairs kept one of the two |
| `gv-017` | `semi`'s cap per ordered object pair, which neither a cap per class pair nor `graph` reproduces |
| `gv-018` | SGCls: a wrong label is `spurious`, never `localization`, and SGCls raises `gt_boxes_not_pairs` too |
| `gv-019` | Masks in one graph only: boxes are compared, and `masks_ignored` is the reader's only sign of it |
| `gv-020` | Unscored predictions: ranked after the scored, in input order, and never a tie |
| `gv-021` | An empty training split read as none: `zR` null, not `R`, and `zero_shot_unavailable` raised |

Tolerance is `1e-9` absolute. `zR` is `null` wherever a case declares no training split.

Every case lists the complete set of warnings the engine must raise, derived in its `why` from
the six conditions in `engine.py`, and both harnesses compare that set exactly: a warning
missing and a warning extra fail alike (D103). That holds only for a warning some case raises,
so some case raises each of the six and some case runs each of the three protocols;
`test_some_case_raises_every_warning` and `test_some_case_runs_every_protocol` in
`test_golden.py` require both (D104). gv-020 holds the tie rule on predictions without a score,
and gv-021 the empty training split, which counts as none supplied: SRS §4.3's definition, read
literally, gives zR = R there, and the author ruled for null on 2026-09-28 (D105).
