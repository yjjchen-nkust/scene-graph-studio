# S2 API and schema

## 1. Purpose and boundary

S2 is the backend's HTTP surface and its data model: the FastAPI application, the route modules under `/api`, the canonical `SceneGraph` models with their validation, the one error shape every refusal takes, and the settings that place the data directory. It turns each request into a call on the subsystem that owns the answer and returns that answer in the shape contracts §1 fixes. It computes no metric (S1), reads no corpus (S3), runs no model (S4) and drafts no graph (S5).

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

**Provides:**

- The HTTP API of contracts §1: `GET /api/health` (§1.2), `GET /api/datasets` (§1.3), `GET /api/datasets/{ds}/images` (§1.4), `GET /api/datasets/{ds}/images/{image_id}` (§1.4a), `POST /api/eval` (§1.5), `GET /api/models` (§1.6), `POST /api/infer/{model}` (§1.7), `GET /api/predictions/{ds}/{model}/{image_id}` (§1.8) and `POST /api/vlm/indvissgg` (§1.9). The frontend reaches it through `system/frontend/src/labs/api.ts` (S11) and the health query of `system/frontend/src/pages/Status.tsx` (S10).
- `app.schema` (`SceneGraph`, `SGObject`, `SGRelationship`, `BBox`, `RLEMask`, `Provenance`, `DatasetId`, `Protocol`, `Constraint`, `MaskPairing`, `Strict`) and `app.settings` (`DATA_DIR`, `CORPUS_ROOT`, `ROOT`, `require_data_dir`), imported throughout S1, S3, S4, S5 and S13's backend scripts.

**Consumes:**

- S1 (`app/api/eval.py` imports `app.eval.engine`; `app/schema.py` imports `decode_counts` from `app.eval.rle` to validate a mask's runs).
- S3 (`app/api/datasets.py` imports `app.datasets.licences` and `app.datasets.loader`).
- S4 (`app/api/health.py` and `app/api/models.py` import `app.infer.registry`).
- S5 (`app/api/vlm.py` imports `app.vlm.indvissgg` and `app.vlm.provider`).

## 4. Current rules

1. Where a plan and the contracts disagree, the contracts govern; field names, types and enum spellings in them are exact. [`2026-09-15-scene-graph-studio-contracts.md`]
2. `create_app()` in `system/backend/app/main.py` mounts five routers under `/api`, `health`, `eval`, `datasets`, `models` and `vlm`, and nothing else. [D72] [`system/backend/app/main.py`]
3. `/api/content/*` of contracts §1.10 is superseded and is not to be built: the frontend imports `data/content/*.json` at build time, which keeps the corpus readable with the backend stopped. [D72] [contracts §1.10]
4. JSON on the wire is `snake_case` in both directions, and enum spellings are lowercase. [contracts §1.0]
5. Every non-2xx response has one shape, `{error: {code, message_en, message_zh, detail?}}`, with a fixed message in both languages for each code and never a stack trace; an unhandled exception becomes 500 `internal_error`. [contracts §1.1] [`system/backend/app/errors.py`]
6. A Pydantic validation failure is 422 `schema_invalid`, with Pydantic's error list in `detail` and every value that is not a JSON primitive stringified, so that the response can be encoded. A relationship that names an absent object is 422 `dangling_reference` instead. [contracts §1.1] [D5]
7. One graph validator reports a repeated `object_id` and a dangling reference in one message, so a graph carrying both answers `dangling_reference`, and its detail names the relationship and the repeated id. [D102] [VERIFICATION §25]
8. A router 404 answers `not_found`, and any other HTTP exception the router raises answers `bad_request`. [`system/backend/app/errors.py`]
9. The models of `app/schema.py` are strict and frozen: an unknown field is refused. A box has positive width and height. [SRS §3] [`system/backend/app/schema.py`]
10. `provenance.fidelity` is required, with the values `measured`, `reconstructed` and `published`, and `provenance.note` is required whenever the fidelity is not `measured`. [D-07] [`system/backend/app/schema.py`]
11. `DatasetId` is `vrd`, `vg150-sgb`, `psg`, `indoorvg`, `haystack`, `mini-isg` or `placeholder`, and a bare `vg150` is refused (`test_bare_vg150_is_not_a_dataset`). The literal is declared twice, in `app/schema.py` and in the TypeScript engine's types. [D-09] [D93] [D113] [`system/backend/app/schema.py`]
12. A mask's `counts` must be compressed RLE, characters `0` to `o`, whose last group closes its run. Its `size` must have both sides at least 1 and an area of at most 4096 × 4096 = 16,777,216 pixels (`MASK_PIXELS_MAX`). Its decoded runs must be non-negative and sum to exactly H × W. A violation is 422 `schema_invalid`. [D120] [D122]
13. A mask's size is not tied to its graph's `width` and `height`, because the golden vectors hold 4×4 masks on 200×200 graphs. [D120]
14. The mask rules admit every mask under `data/golden`, `data/slices` and `data/predictions`, which `test_every_mask_on_the_nas_is_admitted` holds; on the NAS that is 648 of 648. [VERIFICATION §32] [D122]
15. `GET /api/health` reports `status`, `version`, `torch_present`, `torch_version`, `cuda_available`, `device`, `live_models`, `vlm_provider` and `slices_present`. It probes `torch` with `importlib.util.find_spec` and imports it at most once per process, and importing the application never imports `torch`. [contracts §1.2] [D1]
16. `live_models` is `registry.live_model_ids()`, the registry's one answer to what can run here, and health does not walk the prediction tree. It must answer within 50 ms once warm. [D37] [D44] [D1] [contracts §1.2]
17. `GET /api/datasets` gives each dataset's counts, both licence gates, `images_present` and `distribution` (`bundle`, `fetch` or `none`). [contracts §1.3] [D13] [`system/backend/app/api/datasets.py`]
18. `GET /api/datasets/{ds}/images` lists a slice's frames in the order of its annotations, with `present` per frame; a slice never cut answers 200 with an empty list, and an unknown dataset 404 `not_found`. [contracts §1.4] [D60]
19. `GET /api/datasets/{ds}/images/{image_id}` returns the frame's ground-truth `SceneGraph`. With `include_image=true` it adds `image_data_url`, read from the file the slice's manifest names and typed by that file's extension; when the annotation exists and the file does not, it answers 422 `slice_images_missing`, naming the action to take. [contracts §1.4a] [D25]
20. `POST /api/eval` validates the body as S1's `EvalRequest` and returns `evaluate`'s response unchanged. [contracts §1.5] [`system/backend/app/api/eval.py`]
21. `POST /api/infer/{model}` answers 404 for an unknown model and 400 `bad_request` without either `image_data_url` or both `dataset` and `image_id`. A model that is not live answers 503 `inference_unavailable` with `{model, reason_en, reason_zh, torch_present, checkpoint_present}`. [contracts §1.1] [contracts §1.7] [D122] [`system/backend/app/api/models.py`]
22. `GET /api/predictions/{ds}/{model}/{image_id}` reads a file only when each segment is a plain name and the path resolves inside `data/predictions/`; anything else, and a missing file, is 404 `not_found`. [D120] [contracts §1.8]
23. `POST /api/vlm/indvissgg` types `dataset` as `DatasetId`, so an unknown dataset is a 422 before any provider call. An `image_data_url` answers 400 `bad_request`. An omitted `O`, `P` or `E` means the frame's default criteria, and an empty one is an ablation. A transcript miss and a failed or refused provider call both answer 503 `vlm_unavailable` with `{provider, reason}`. [D120] [contracts §1.1] [contracts §1.9] [`system/backend/app/api/vlm.py`]
24. `n_experts` is 1, 2, 3 or 5, and `provider` is `transcript` or `claude`. [contracts §1.9] [`system/backend/app/api/vlm.py`]
25. CORS is added only when `SGS_CORS_ORIGINS`, a comma-separated list, names an origin; it then allows `GET` and `POST` and the `content-type` header. Locally the variable is unset and Vite proxies `/api`. This replaces contracts §1.0's statement that there is no CORS configuration because every deployment is localhost: D-24, the later binding record, brings deployment into scope. [D127] [D-24] [contracts §1.0]
26. `DATA_DIR` is `SGS_DATA_DIR`, or the track root's `data/` when unset; `CORPUS_ROOT` is `SGS_CORPUS_ROOT`, or `DATA_DIR/_raw` when unset, so an explicit corpus root is not moved by the data directory. [D84] [`system/backend/app/settings.py`]
27. `require_data_dir()` stops with a message naming `devdata pull` and creates nothing when `DATA_DIR` is absent, and every backend script that writes under `DATA_DIR` calls it first. [D125] [`system/backend/app/settings.py`]
28. The graphs of the M0 demonstrations carry `dataset: "mini-isg"` and no `DatasetId` of their own, because the datasets API serves only the slices under `data/slices/`. [D113]

## 5. Verification

**Records:** VERIFICATION §6, VERIFICATION §25, VERIFICATION §32.

**`npm run ci` steps:** 2 pytest, the four test files of §2, with the routes also exercised by `system/backend/tests/test_slices.py` (datasets), `test_registry.py` (models, infer, predictions), `test_indvissgg.py` and `test_mini_isg.py` (vlm and eval); 5 ruff.

**Outside `ci`:** `npm run check:offline` (check 6) runs the backend on an interpreter without `torch` and requires `/api/health` to report no `torch` and no live model, `POST /api/infer/motifs` to answer 503 `inference_unavailable`, and `POST /api/vlm/indvissgg` with `provider: claude` to answer 503 `vlm_unavailable` (VERIFICATION §6).

**What the records measure.** §6 is the offline run. §25 includes the `dangling_reference` answer beside a repeated id. §32 includes the mask rule's admission of every mask on the NAS.

## 6. Traps

- A demonstration's graph is filed under `mini-isg` with no `DatasetId` of its own, though its frames are not the slice's, so a reader that joins on `dataset == "mini-isg"` and looks the frame up in the slice's manifest finds no row. [D113]

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

1. Contracts §1.11 specifies `GET /images/{ds}/{image_id}`, served by FastAPI `StaticFiles` outside `/api`. `create_app()` mounts no static route, and the labs obtain a photograph through `include_image=true` (`system/frontend/src/labs/api.ts`). No record states the departure. [contracts §1.11] [`system/backend/app/main.py`]
2. Contracts §1.0 still reads that there is no CORS configuration because every deployment is localhost; it carries no annotation pointing to D127 or D-24. [contracts §1.0] [D127] [D-24]
3. Contracts §1.3 does not list the `distribution` field that `GET /api/datasets` returns since D13. [contracts §1.3] [D13]
4. `IndVisSGGRequest.provider` admits `transcript` and `claude` only, so `openai-compat` cannot be chosen through the endpoint. Left open by D122. [D122] [`system/backend/app/api/vlm.py`]
5. D-09's `dataset` union and the `id` union of contracts §1.3 have six members and no `placeholder`; `DatasetId` in `app/schema.py` has `placeholder` as its seventh. No record adds it to either. [D-09] [contracts §1.3] [`system/backend/app/schema.py`]
