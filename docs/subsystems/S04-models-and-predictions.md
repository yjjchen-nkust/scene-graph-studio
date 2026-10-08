# S4 Models and predictions

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/infer/` | Model registry, RelTR CPU runner, provenance and reconstruction |
| `system/backend/scripts/reconstruct_predictions.py` | Regenerates the reconstructed prediction tier |
| `system/backend/requirements-infer.txt` | Live-inference extras kept apart from the base install |
| `system/backend/tests/test_reconstruct.py` | Tests of the reconstructed predictions |
| `system/backend/tests/test_registry.py` | Tests of the model registry |
| `system/backend/tests/test_reltr.py` | Tests of the RelTR runner |
| `data/predictions/` | Recorded predictions by provenance tier (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §2, VERIFICATION §3, VERIFICATION §13.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-05, D-06, D-07.

**Specs and plans:** `2026-09-15-03-models-and-vlm.md`.

| Deviation | Effect | Role |
|---|---|---|
| D37 | `/api/health` advertised a model this machine cannot run | primary |
| D41 | RelTR carries no licence, so the live path cannot contain it | primary |
| D42 | the spike failed twice, and Task 4's "target recall profile" had to go | primary |
| D44 | `/api/health` started reading thirty files, and NFR-8 caught it | primary |
| D78 | the licence guard fired on a virtual environment | primary |
| D80 | every Python step now names its interpreter: the `py12` environment | secondary |
| D82 | the GPU was there the whole time; the interpreter had the CPU wheel | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

DRAFT
