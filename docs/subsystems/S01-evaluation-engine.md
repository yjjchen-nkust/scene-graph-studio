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

DRAFT

## 6. Traps

DRAFT

## 7. History

DRAFT

## 8. Open items

DRAFT
