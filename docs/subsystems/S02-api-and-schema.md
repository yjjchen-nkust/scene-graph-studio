# S2 API and schema

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/__init__.py` | Package marker of the backend application |
| `system/backend/app/main.py` | FastAPI application, router and CORS wiring |
| `system/backend/app/api/` | Route modules: datasets, eval, health, models, vlm |
| `system/backend/app/schema.py` | Pydantic models of the scene graph and the API |
| `system/backend/app/errors.py` | Exception handlers and the error response shape |
| `system/backend/app/settings.py` | Roots, version and data directory settings |
| `system/backend/tests/test_eval_api.py` | Tests of the evaluation endpoint |
| `system/backend/tests/test_health.py` | Tests of the health endpoint |
| `system/backend/tests/test_schema.py` | Tests of the schema models |
| `system/backend/tests/test_cors.py` | Tests of the CORS configuration |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §6, VERIFICATION §25.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-07.

**Specs and plans:** `2026-09-15-01-skeleton-and-eval-engine.md`, `2026-09-15-scene-graph-studio-SRS.md`, `2026-09-15-scene-graph-studio-contracts.md`.

| Deviation | Effect | Role |
|---|---|---|
| D1 | `test_health_does_not_import_torch` replaced | primary |
| D5 | the validation error handler needed sanitizing, and a dedicated dangling code | primary |
| D13 | the licence check ran, and PSG cannot be bundled | secondary |
| D25 | the image endpoint served the one slice that was synthetic | secondary |
| D37 | `/api/health` advertised a model this machine cannot run | secondary |
| D44 | `/api/health` started reading thirty files, and NFR-8 caught it | secondary |
| D60 | `/lab/:labId`, and the endpoint a standalone lab needed | secondary |
| D72 | `/api/content/*` is normative, absent, and should stay absent | primary |
| D84 | the suite was red in the configuration where the adapters are actually tested | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D102 | the five minors D100's review deferred, settled | secondary |
| D113 | the demonstrations' graphs carry `dataset: "mini-isg"`, and no `DatasetId` of their own | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |
| D127 | the frontend on GitHub Pages and the backend on Render | secondary |

## 8. Open items

DRAFT
