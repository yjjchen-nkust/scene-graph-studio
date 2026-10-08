# S1 Evaluation engine

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/eval/` | Python reference engine: IoU, RLE, matching, pairing, constraints, metrics |
| `system/packages/sgg-metrics/` | TypeScript engine package that mirrors the Python engine |
| `system/backend/scripts/build_golden.py` | Builds the golden vectors with hand-computed expectations |
| `system/backend/scripts/run_golden.py` | Emits the Python engine output for every golden case |
| `system/tools/parity.mjs` | Diffs the TypeScript engine against the Python engine on the golden vectors |
| `system/backend/tests/test_constraint.py` | Tests of the constraint modes |
| `system/backend/tests/test_golden.py` | Tests of the golden vectors |
| `system/backend/tests/test_iou.py` | Tests of IoU |
| `system/backend/tests/test_match.py` | Tests of the match relation |
| `system/backend/tests/test_metrics.py` | Tests of the recall metrics |
| `system/backend/tests/test_pairing.py` | Tests of mask pairing |
| `system/backend/tests/test_rle.py` | Tests of the RLE decoder |
| `data/golden/vectors.json` | The golden vectors read by both engines (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §1, VERIFICATION §2, VERIFICATION §3, VERIFICATION §5, VERIFICATION §23, VERIFICATION §24, VERIFICATION §25, VERIFICATION §26, VERIFICATION §27, VERIFICATION §28, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-11, D-12, D-14, D-16.

**Specs and plans:** `2026-09-15-01-skeleton-and-eval-engine.md`, `2026-09-15-scene-graph-studio-SRS.md`, `2026-09-15-scene-graph-studio-design.md`, `2026-09-27-graph-constraint-key-design.md`, `2026-09-27-graph-constraint-key.md`.

| Deviation | Effect | Role |
|---|---|---|
| D2 | `system/tools/parity.mjs` reads compiled output, not `.ts` | primary |
| D4 | the IoU-at-threshold fixture had to be reconstructed | primary |
| D27 | the engine does not read `protocol`, so the ordering invariant was untestable | secondary |
| D36 | the pairing key is the mask pair, not the mask pair plus the class names | primary |
| D51 | what the review of D46–D50 found | secondary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | primary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D102 | the five minors D100's review deferred, settled | secondary |
| D103 | the checks D102 left open: every golden vector's warnings, and the locales' placeholders | secondary |
| D104 | the review of the open checks: two warnings no vector raised, and five minors | secondary |
| D105 | an empty training split is no split: the author's ruling, pinned | primary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

DRAFT
