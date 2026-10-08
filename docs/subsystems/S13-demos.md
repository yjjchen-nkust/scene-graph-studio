# S13 Demos

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/demos/` | The D-T and D-V demo components, frame, logic and mounts |
| `system/backend/scripts/cut_demo_m0.py` | Cuts the M0 clip and ten frames from IndustReal |
| `system/backend/scripts/build_demo_m0.py` | Derives the two files the demos read |
| `system/backend/scripts/record_demo_indvissgg.py` | Records D-V over the ten frames |
| `system/backend/scripts/record_demo_traditional.py` | Records D-T over the ten frames |
| `system/backend/tests/test_demo_indvissgg.py` | Tests of the D-V recording |
| `system/backend/tests/test_demo_m0.py` | Tests of the M0 demo files |
| `system/backend/tests/test_demo_traditional.py` | Tests of the D-T recording |
| `data/demos/m0/` | Clip, frames and derived demo files (NAS) |

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

**Binding decisions:** none.

**Specs and plans:** `2026-09-29-m0-demos-design.md`, `2026-09-29-m0-demos.md`.

| Deviation | Effect | Role |
|---|---|---|
| D112 | the live VLM provider sent no frame | secondary |
| D113 | the demonstrations' graphs carry `dataset: "mini-isg"`, and no `DatasetId` of their own | primary |
| D114 | D-V is recorded on the author's own server, through an OpenAI-compatible provider | secondary |
| D115 | The expert prompt carries the criteria and asks for labelled analyses; D-V is recorded again | secondary |
| D116 | the demos draw lists, numbers and one expert at a time | primary |
| D117 | M0's lab and checkpoint moved to s16 and s17, and what the demos' steps leave unrecorded | primary |
| D124 | D-V names each hand, and is recorded again on the A6000 | primary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

DRAFT
