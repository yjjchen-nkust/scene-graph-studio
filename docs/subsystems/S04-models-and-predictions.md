# S4 Models and predictions

## 1. Purpose and boundary

S4 answers which scene-graph models can run on this machine and why the others cannot, holds the one live inference path, RelTR on the CPU, and produces and audits the committed prediction files the labs compare. Every committed prediction states how it was obtained, `measured` or `reconstructed`, and nothing reconstructed is presented as a model's output. S4 does not score predictions (S1), serve them over HTTP (S2), or run a vision-language model (S5).

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

**Provides:**

- `app.infer.registry` (`MODELS`, `BY_ID`, `liveness`, `live_model_ids`, `describe_all`, `torch_present`, `checkpoint_present`, `NOT_WIRED_EN`, `NOT_WIRED_ZH`), imported by S2's `system/backend/app/api/health.py` and `system/backend/app/api/models.py` for `GET /api/health`, `GET /api/models` and `POST /api/infer/{model}` (contracts §1.2, §1.6, §1.7).
- The prediction files under `data/predictions/<ds>/<model>/`, which S2 serves as `GET /api/predictions/{ds}/{model}/{image_id}` (contracts §1.8) to the labs.
- `app.infer.provenance.audit`, which `test_registry.py` also runs over S13's demonstration predictions.

**Consumes:**

- S2 (`registry.py`, `reltr_cpu.py`, `reconstruct.py` and `provenance.py` import `app.settings` or `app.schema`; `reconstruct_predictions.py` imports `require_data_dir`).
- S3 (`reconstruct.write_all` reads `data/slices/<ds>/annotations.json`, the slice it reconstructs over).

## 4. Current rules

1. Model comparisons run on committed predictions. Live inference is an opt-in path, for RelTR alone, behind a measured latency estimate. [D-05] [D-06]
2. A prediction's `provenance.fidelity` is `measured`, produced by running the model on this image; `reconstructed`, built to reproduce a model's documented behaviour on this slice, which is not that model's output and carries a note saying what it reproduces; or `published`, a number quoted from a paper. [D-07]
3. The registry lists five models: `reltr` (one-stage, TPAMI 2023), `egtr` (one-stage, CVPR 2024), `motifs` (two-stage, CVPR 2018), `vctree` (two-stage, CVPR 2019) and `psgformer` (panoptic, ECCV 2022). [contracts §1.6] [`system/backend/app/infer/registry.py`]
4. The registry is the one answer to what can run here. `/api/health` and `/api/models` both read it, and `test_health_and_models_do_not_disagree_about_what_is_live` fails if they part. Nothing in the registry imports `torch`. [D37] [`system/backend/app/infer/registry.py`]
5. RelTR is live only when four gates are open, checked in this order: `torch` is importable, probed and not imported; a weights file sits under `data/checkpoints/reltr/`; `SGS_RELTR_PATH` names a directory, the operator's own clone; and `reltr` is in `registry.WIRED`. The first gate that is shut gives the reason, in both languages. D41 and D120 added the third and fourth gates to the two D-06 names. [D-06] [D37] [D41] [D120]
6. `registry.WIRED` is empty, because `reltr_cpu._decode` is deliberately unimplemented. No model is live on any machine, and `POST /api/infer/{model}` answers 503 `inference_unavailable` for every model the registry knows. [D120] [D41]
7. EGTR is blocked as not wired up, Motifs and VCTree as needing the unmaintained `maskrcnn-benchmark`, and PSGFormer as needing `detectron2`, which does not build here. A blocked reason says only why the live path is shut, and a test refuses one that claims committed predictions while none are on disk. [D37] [D42] [`system/backend/app/infer/registry.py`]
8. RelTR declares no licence, so none of its source is vendored: the operator clones it and points `SGS_RELTR_PATH` at the clone. `test_no_reltr_source_is_vendored_into_this_repository` scans every `.py` under `system/` for a definition line only a copy of RelTR would carry, skipping `node_modules`, `__pycache__` and `site-packages`, and `test_the_licence_guard_can_actually_fail` runs the same rule over a file that violates it. [D41] [D78]
9. `reltr_cpu` imports `torch` inside `infer` and never at module scope, and loads the checkpoint with `weights_only=True`, which a test requires of every `torch.load` in the module. [D41] [`system/backend/app/infer/reltr_cpu.py`]
10. `to_scene_graph` is a pure function over already-decoded output, tested against synthetic detections without weights. [D41]
11. The latency estimate is a measured value read from `data/predictions/.latency.json`, or null; no constant stands in for it, and a recorded latency must be positive. [SRS §7] [`system/backend/app/infer/reltr_cpu.py`] [`system/backend/app/infer/registry.py`]
12. `predictions_available` is read off the files under `data/predictions/` rather than declared, and cached for the life of the process; `registry.reload()` drops the cache. `/api/health` never calls it. [D37] [D44]
13. `data/predictions/` holds 30 reconstructed files, five models over the six frames of `placeholder`, deterministic under seed 20260918, and no measured file; `test_the_committed_files_match_what_the_script_regenerates` fails if the files and the script drift. [D42] [`data/predictions/PROVENANCE.md`]
14. A reconstruction profile states whether its style of model emits several predictions at one ordered pair and roughly how much of the ground truth it recovers. It targets no published number, and every graph's note says whose output it is not. [D42] [`system/backend/app/infer/reconstruct.py`]
15. `provenance.audit` requires a `measured` prediction to name a model that `data/predictions/PROVENANCE.md` accounts for, and any other prediction to carry a note. It reads provenance before validating the graph, it runs over the tree on every CI pass, and it runs over the demonstration predictions as well. [D-07] [D37] [`system/backend/tests/test_registry.py`]
16. The `detectron2` spike failed twice inside its four-hour box and nothing was carried into the repository, so Motifs and PSGFormer stay reconstructed. [D-06] [D42]
17. `requirements-infer.txt` keeps the live extras apart from `requirements.txt`, which lists no `torch`, and nothing installs it in setup, CI or `start.ps1`. It pins `torch==2.10.0+cu128` and `torchvision==0.25.0+cu128` with the cu128 index line, because PyPI serves the CPU wheel on Windows. [D82] [VERIFICATION §13] [`system/backend/requirements-infer.txt`]
18. On the hosted backend, Render installs `system/backend/requirements.txt`, which does not list `torch`, and holds no checkpoint, so live inference reports unavailable; L4 says so on the hosted site. [D-24] [D127]
19. `reconstruct_predictions.py` calls `require_data_dir()` before it writes. [D125] [`system/backend/scripts/reconstruct_predictions.py`]

## 5. Verification

**Records:** VERIFICATION §2, VERIFICATION §3, VERIFICATION §13.

**`npm run ci` steps:** 2 pytest, `system/backend/tests/test_registry.py`, `test_reltr.py` and `test_reconstruct.py`; 5 ruff.

**Outside `ci`:** `npm run check:pins` compares `requirements-infer.txt`'s optional pins with the interpreter, 5 of 5 agreeing in VERIFICATION §13. `npm run check:offline` (check 6) requires `/api/health` to report no `torch` and no live model, and `POST /api/infer/motifs` to answer 503 `inference_unavailable` (VERIFICATION §6).

**What the records measure.** §2 runs the reconstructed `reltr` and `motifs` files on `placeholder` through `/api/eval` at SGDet, graph constraint, K = 50, a sanity check and not a reproduction of any published figure. §3 runs them again under `none`. §13 is the CUDA build of `torch` on the author's machine.

## 6. Traps

None. No trap in `CLAUDE.md`, and no row of the trap table that `docs/INDEX.md` §6 held until 2026-10-08, has S4 as its subject.

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

1. The live path stays unreachable until `_decode` is written, and D41 forbids writing it from RelTR's code into this repository; L4's handling of a live 503 and a live graph is therefore held by stubbed tests only. [D41] [D120] [D122]
2. Plan 03 lists `app/infer/cached.py`, under `system/backend/`, for the committed prediction lookup. No such module exists; the lookup is `prediction()` in `system/backend/app/api/models.py`, and no record states the change. [`2026-09-15-03-models-and-vlm.md`] [`system/backend/app/api/models.py`]
3. VERIFICATION §3 explains Motifs' rise under `none` (0.6111 to 0.6667) by a two-stage model emitting several predictions per pair, and RelTR's stillness by a one-stage model emitting one. Both sets are reconstructed, and `reconstruct.py` gives `motifs` and `reltr` the same behaviour, "one-prediction-per-pair", with `duplicates: 0`; no record says what in the construction separates them. [VERIFICATION §3] [`system/backend/app/infer/reconstruct.py`]
4. `test_no_reltr_source_is_vendored_into_this_repository` scans `DATA_DIR.parent / "system"`. With `SGS_DATA_DIR` set to a directory outside the track root, that path need not exist, and `rglob` over a missing directory yields nothing, so the guard would pass over no file. No record states it. [`system/backend/tests/test_reltr.py`]
