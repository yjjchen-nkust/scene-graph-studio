# S1 Evaluation engine

## 1. Purpose and boundary

S1 scores a predicted scene graph against a ground-truth one: the match relation, ranking, mask pairing, the three constraint modes, R@K, mR@K, ngR@K and zR@K, the per-triplet verdicts and the six warnings. It exists twice, in Python, which is authoritative, and in TypeScript for the browser, and the golden vectors hold the two equal. It is not the HTTP route that serves it (S2), it does not apply a protocol to a prediction, which the labs do before calling it, and it is not the teaching function `evaluate()` in the knowledge map's `pg.js`.

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

**Provides:**

- `evaluate(EvalRequest)` in `system/backend/app/eval/engine.py`, whose request and response are contracts §1.5. S2 serves it as `POST /api/eval` (`system/backend/app/api/eval.py` imports `app.eval.engine`).
- The `sgg-metrics` package (`system/packages/sgg-metrics/src/index.ts`): `evaluate`, its parts (`boxIou`, `decode`, `maskIou`, `classify`, `toTriplets`, `rank`, `applyConstraint`, `applyPairing`, `assign` and the recall functions) and the wire types. Imported by S7 (`frontend/src/pages/boards.ts`, `papers.ts`), S9 (`frontend/src/graph/`, `frontend/src/components/`), S10 (`frontend/src/assess/`, `frontend/src/export/`), S11 (the labs), and by S12 and S13 for types only in production code.
- `encode_counts` and `decode_counts` in `system/backend/app/eval/rle.py`, imported by S2 (`app/schema.py` validates a mask's runs with `decode_counts`) and S3 (the PSG adapter encodes masks with `encode_counts`).

**Consumes:**

- S2 (every non-empty module of `app/eval/` but `metrics.py` imports `app.schema`; `run_golden.py` and `build_golden.py` import `DATA_DIR` from `app.settings`, and `build_golden.py` also `require_data_dir`).
- S14 (`system/tools/parity.mjs` imports `pythonPath` from `system/tools/py.mjs`).
- S15 (`parity.mjs`, `test_golden.py` and `engine.test.ts` read `data/golden/vectors.json` through the `data/` link, whose CI copy is `fixtures/data/golden/vectors.json`).

## 4. Current rules

1. The engine is implemented twice: in Python under `system/backend/app/eval/`, which is authoritative, and in TypeScript in `system/packages/sgg-metrics/`, for feedback in the browser. The two must agree on every golden vector, and continuous integration fails if they disagree. [SRS §4] [SRS §7] [design §4.3]
2. The authority for every definition is arXiv 2404.09616 and `Scene-Graph-Benchmark.pytorch/METRICS.md`. The function `evaluate()` in `pg.js` is excluded and is never consulted. [SRS §4] [D-14]
3. Each concept has a Python module and a TypeScript module of the same name, so that a reviewer can place them side by side: `iou`, `rle`, `match`, `constraint`, `pairing` and `metrics`, with `engine.py` answering to `index.ts`. [`2026-09-15-01-skeleton-and-eval-engine.md`] [`system/backend/app/eval/`] [`system/packages/sgg-metrics/src/`]
4. The Python engine uses no numpy, scipy or pycocotools, and the TypeScript package declares no dependencies. [D-11] [`2026-09-15-01-skeleton-and-eval-engine.md`] [`system/packages/sgg-metrics/package.json`]
5. COCO RLE decoding and mask IoU are implemented in-house in both languages from the format specification, and `pycocotools` is not a dependency. [D-12]
6. A predicted triplet matches a ground-truth triplet if and only if the subject classes, the object classes and the predicates agree, and the subject IoU and the object IoU are each at least the threshold. The threshold is the request's `iou_thresh`, 0.5 by default, exposed as a labelled parameter. [SRS §4.1] [contracts §1.5]
7. Mask IoU replaces box IoU only when both graphs carry masks. When one graph carries masks and the other does not, boxes are used and the response carries `masks_ignored`; `gv-019-masks-in-one-graph-only` pins it. [SRS §4.1] [D103] [D104]
8. Assignment is greedy and one-to-one over the score-ranked predictions in the top K, and each ground-truth triplet is credited at most once. [SRS §4.2] [design §4.3]
9. Among the unused ground-truth triplets that satisfy all five conjuncts, the lowest ground-truth index wins. A prediction whose three classes agree with some ground truth but whose boxes fail is `localization` and consumes nothing; one whose classes agree with none is `spurious`. Ground truth that nothing matched is appended as `missed`, with `pred_index` -1. [SRS §4.2] [contracts §1.5] [`system/backend/app/eval/match.py`]
10. Because `localization` requires all three classes to agree, a wrong label under SGCls makes a prediction `spurious`, never `localization`; `gv-018-sgcls-label-error` pins it. [D104]
11. Predictions are ranked by score descending, ties broken by `relationship_id` ascending. A prediction without a score ranks after every scored one, in input order, and takes part in no tie; `gv-020-unscored-predictions-do-not-tie` pins it. [contracts §1.5] [D104] [D105]
12. The TypeScript ranking compares scores rather than subtracting them, so two infinite scores break their tie on `relationship_id`, as Python's tuple key does. [D120]
13. Mask pairing is applied after ranking and before the constraint, so the survivor at each mask pair is the highest-scoring prediction and both the constrained and the unconstrained pool inherit the cap. [`system/backend/app/eval/engine.py`] [`system/packages/sgg-metrics/src/index.ts`]
14. `single_mpo` admits one prediction per ordered pair of mask instances, keyed on `(subject_mask.counts, object_mask.counts)` and not on the class names; `multi_mpo` admits every prediction; a prediction lacking either mask passes untouched. [D36] [SRS §4.6] [`system/backend/app/eval/pairing.py`]
15. The graph constraint keeps one predicate per ordered object pair, `(subject_id, object_id)`, as Tang's evaluator keeps one per pair of predicted object indices. `Triplet` carries `subject_id` and `object_id` in both engines, so two objects with the same class names, two hands on one assembly for instance, are two pairs. [D99] [SRS §4.5] [`2026-09-27-graph-constraint-key-design.md`]
16. Golden vector `gv-014-graph-constraint-per-object-pair` pins that key: two hands on one assembly, one predicate each, give R = 1.0 under the graph constraint where the class-pair key gave 0.5, and with both engines put back on the class-pair key it fails in both. [D99] [VERIFICATION §23]
17. `semi` keeps at most `semi_constraint_max_per_pair` predicates per ordered object pair, 2 by default. It is not the Semi Constraint STTran proposed for Action Genome, which the application does not implement. `gv-017-semi-constraint-per-object-pair` pins the cap: R@20 = 3/4 = 0.75, where a cap of 2 per class pair would give 0.5. [D99] [D100] [SRS §4.5] [contracts §1.5] [VERIFICATION §24]
18. Keyed on object pairs, the graph constraint caps what `single_mpo` caps only while no two predicted objects share a mask. `gv-015` (`single_mpo`, R 0.5) and `gv-016` (`multi_mpo`, R 1.0) pin the case where they do. [D99] [VERIFICATION §23]
19. `none` keeps every prediction, and ngR@K is computed on the unconstrained pool whatever `constraint` the request names. [SRS §4.3] [D36] [`system/backend/app/eval/engine.py`]
20. R@K is the matched ground truth over all ground truth in the top K. mR@K averages R@K per predicate class, unweighted, over the classes present in the ground truth. zR@K restricts the ground truth to the triplets absent from the training split. K is drawn from {20, 50, 100}, and the request defaults to all three. [SRS §4.3] [contracts §1.5]
21. A metric with nothing to measure is null, never 0: R, mR and ngR are null on an empty ground truth, and zR is null when no ground-truth triplet is absent from the split. [contracts §1.0] [`system/backend/app/eval/metrics.py`]
22. A training split that is omitted or supplied as `[]` is no split: every zR value is null and `zero_shot_unavailable` is raised. This is the author's ruling, and `gv-021-empty-training-split` pins it. [D105] [SRS §4.3] [contracts §1.5] [VERIFICATION §28]
23. Neither engine branches on `protocol`. It is copied onto every `MetricValue` and decides only the `gt_boxes_not_pairs` warning; a lab applies the protocol to the prediction before calling the engine (`system/frontend/src/labs/L2/protocol.ts`). [D27] [`system/backend/app/eval/engine.py`]
24. The engine raises six warnings, each on one condition: `gt_boxes_not_pairs` under PredCls or SGCls; `empty_ground_truth` and `empty_prediction` when a side has no relationship; `ties_broken_by_index` when two non-null scores are equal; `masks_ignored` when one graph carries masks and the other does not; and `zero_shot_unavailable` when no training split, or an empty one, is supplied. Both engines raise them on the same conditions. [D103] [D104] [contracts §1.5]
25. `gt_boxes_not_pairs` is emitted on every `predcls` and `sgcls` response without exception. [contracts §1.5] [SRS §4.4]
26. Every metric on the wire is a `MetricValue` tagged with `metric`, `k`, `protocol`, `constraint`, `source`, `verified` and `fidelity`. The engine writes `source: 'engine'`, `verified: true` and `fidelity: 'measured'` on every value, which is true of the comparison and says nothing of its inputs. [contracts §1.0] [D122]
27. `matched_count` and the verdicts, with their `rank` and `entered_top_k`, come from the assignment at the largest K requested; `pred_count_considered` counts the constrained pool before the top-K cut. [D122] [contracts §1.5]
28. Identical input yields identical output, the tie-break order included, and the response echoes the request in `params_echo`. [SRS §7] [contracts §1.5]
29. `EvalRequest` refuses a K outside {20, 50, 100}, an empty K, an `iou_thresh` outside 0 to 1, and, when both graphs carry masks, masks of more than one size; each is a validation failure, 422 `schema_invalid`. [D120] [contracts §1.1] [`system/backend/app/eval/engine.py`]
30. A graph that repeats an `object_id` is refused by both engines, because the constraint key is the id pair: Python in the schema, whose one validator reports a repeated id and a dangling reference together, and TypeScript in `toTriplets`, which throws. [D100] [D102]
31. The RLE decoder clips each run to the mask before using it. `decode` writes exactly H × W pixels, and `mask_iou` sweeps the two masks' foreground intervals, so its cost follows the runs and not the pixels. [D122] [`system/backend/app/eval/rle.py`]
32. The TypeScript RLE accumulates run lengths with arithmetic rather than 32-bit bit operations and agrees with Python for every value below 2⁵³. The one difference left lies below the schema: counts that end inside a group raise in Python and read the missing group as zero in TypeScript, and the schema refuses such counts before either engine sees them. [D122] [`system/packages/sgg-metrics/src/rle.ts`]
33. The golden vectors are one file, `data/golden/vectors.json`, at schema version 1, which both engines load from disk and neither embeds. [D-16]
34. Every expected value in a vector is computed by hand from the definitions before the engine runs, `hand_checked` records that, and the case's `why` writes out the arithmetic. Engine output is never pasted into an expectation. [D-16] [`system/backend/scripts/build_golden.py`]
35. `build_golden.py` builds every vector, and re-running it reproduces the committed `vectors.json` byte for byte. [D99] [D104]
36. There are 21 vectors, `gv-001` to `gv-021`. [D105] [VERIFICATION §28]
37. Floats are compared with an absolute tolerance of 1e-9, and a null expectation requires null. [D-16] [`system/backend/tests/test_golden.py`]
38. Every case lists its warnings and derives them in a "Warnings:" sentence of its `why`. Both harnesses compare the listed warnings with the engine's as a sorted list, so a missing and an extra warning fail alike, for any warning some case raises. [D103] [D104]
39. Some case raises every warning and some case runs every protocol, and pytest fails when either stops holding (`test_some_case_raises_every_warning`, `test_some_case_runs_every_protocol`). [D104]
40. `parity.mjs` imports the compiled engine from `packages/sgg-metrics/dist/` under `system/`, which `npm run build:metrics` produces and git does not track, not the `.ts` source. [D2]
41. `parity.mjs` runs the Python side through `run_golden.py` on the project's interpreter and compares, for every vector, each metric within 1e-9, requiring a number wherever Python gives a number, the verdicts, the sorted warnings, `matched_count`, `gt_count` and `pred_count_considered`. [D120] [`system/tools/parity.mjs`]
42. Parity compares the two engines with each other, not with the hand-computed expectations, so a defect common to both passes it; the expectations are held by `test_golden.py` and `engine.test.ts`. [D102] [VERIFICATION §25]
43. No ordering of recall between protocols is forced. Both engines assert a counterexample: ground truths (man#1, on, table#2) and (man#1, near, table#2) give R@50 0.5 under the graph constraint on the given boxes, and 1.0 with two box pairs of the prediction's own, each at IoU 9,604 / 10,396 = 0.924. [D99] [D100]
44. `gv-006-iou-exactly-at-threshold` is built by containment, a 10×20 box holding a 10×10 one for an IoU of exactly 0.5, because two 10×10 boxes offset by 10/3 give `0.4999999999999999`. [D4]

## 5. Verification

**Records:** VERIFICATION §1, VERIFICATION §2, VERIFICATION §3, VERIFICATION §5, VERIFICATION §23, VERIFICATION §24, VERIFICATION §25, VERIFICATION §26, VERIFICATION §27, VERIFICATION §28, VERIFICATION §32.

**`npm run ci` steps:** 2 pytest, the seven test files of §2; 3 metrics build, which compiles `dist` for parity; 4 vitest, the `metrics` project (`system/packages/sgg-metrics/test/engine.test.ts`, `pairing.test.ts`, `rle.test.ts`, `types.test.ts`); 5 ruff, over `backend` and `tools`; 6 parity, `system/tools/parity.mjs` over every golden vector; 8 content, whose first block requires the file's schema version 1 and, of each vector, a unique id, `hand_checked: true`, a `why` of at least 40 characters, and `gt`, `pred`, `params` and `expect` (`system/tools/content_lint.mjs`).

**Outside `ci`:** none of `test:e2e`, `check:offline`, `check:perf` and `check:pins` is specific to S1.

**What the records measure.** §1 checks `gv-004-all-tied-scores` by hand against the definitions. §2 and §3 run the committed reconstructed predictions on the `placeholder` slice through `/api/eval`, a sanity check and not a reproduction of a published figure. §5 runs L6's forensics in both pairing modes. §23 to §28 are the runs of D99 to D105, with their mutation tables. §32 is the run of D122.

## 6. Traps

- The graph constraint keys on the ordered object pair, not the class pair, so two hands on one assembly are two pairs, and `semi` is a cap per object pair, not the Semi Constraint STTran proposed for Action Genome, which the course states and the engine does not compute. [D99] [`CLAUDE.md`]
- `pg.js evaluate()` is a teaching toy over fifteen hard-coded rows and must never be promoted to the evaluation engine. [D-14] [`CLAUDE.md`]

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

1. D-11 states that `system/backend/app/eval/` imports nothing outside the Python standard library. `engine.py` imports `pydantic` for `EvalRequest` and `MetricValue`, and every non-empty module but `metrics.py` imports `app.schema`, whose models are pydantic; plan 01's own `engine.py` imported `pydantic`, and no record reconciles the two. [D-11] [`2026-09-15-01-skeleton-and-eval-engine.md`] [`system/backend/app/eval/engine.py`]
2. D-12 places the TypeScript decoder at `frontend/packages/sgg-metrics/src/rle.ts`, under `system/`; the file is `system/packages/sgg-metrics/src/rle.ts`. [D-12] [`system/packages/sgg-metrics/src/rle.ts`]
3. Contracts §1.5 marks `semi_constraint_max_per_pair` as required when `constraint` is `semi` and gives it a default of 2. Both engines default it to 2 and require it under no mode. [contracts §1.5] [`system/backend/app/eval/engine.py`] [`system/packages/sgg-metrics/src/index.ts`]
4. The pytest harness finds a verdict row by its first matching `pred_index`, so a `-1` row matches any missed one and an extra row is never refused. D104's reviewer set it aside, and it is left. [D104]
5. Neither harness compares a verdict's IoUs, so `gv-019`'s IoU of 2/3 is held by no test; accepted as it stands. [D104]
6. `parity.mjs` and `engine.test.ts` would pass over zero cases; only pytest's two coverage tests fail on zero cases. Set aside, and left so. [D104]
7. The TypeScript `toTriplets` does not check dangling references. Left so. [D102] [D104]
