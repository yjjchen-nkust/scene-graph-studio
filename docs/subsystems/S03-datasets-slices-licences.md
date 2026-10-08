# S3 Datasets, slices and licences

## 1. Purpose and boundary

S3 turns the corpora the author downloads into the small teaching slices the labs read, and holds the licence findings that decide what may be committed and what may reach a class. It owns the corpus adapters, the cutter, the bundle and its verifier, the synthetic placeholder slice, the mini-ISG build and the two licence gates of `data/LICENCES.md`. It downloads no corpus, serves nothing over HTTP (S2 does), and does not place or synchronise `data/` itself, which is S15's.

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/datasets/` | Dataset adapters, licence gates and the slice loader |
| `system/backend/scripts/cut_slice.py` | Cuts a teaching slice from a corpus the author downloaded |
| `system/backend/scripts/bundle_slices.py` | Packs slice images into the class bundle |
| `system/backend/scripts/verify_bundle.py` | Checks an unpacked bundle against the manifests |
| `system/backend/scripts/make_placeholders.py` | Generates the synthetic placeholder slice |
| `system/backend/scripts/cut_mini_isg.py` | Cuts the mini-ISG frames from IndustReal |
| `system/backend/scripts/build_mini_isg.py` | Builds the mini-ISG artefacts from one authored file |
| `system/backend/scripts/fetch_images.py` | Fetches images by identifier for datasets that may not be redistributed |
| `system/backend/scripts/make_adapter_fixture.py` | Builds the synthetic COCO-parquet adapter fixture |
| `system/backend/scripts/make_psg_fixture.py` | Builds the synthetic PSG adapter fixture |
| `system/backend/tests/fixtures/` | Synthetic adapter fixtures |
| `system/backend/tests/test_adapters.py` | Tests of the COCO-parquet adapters |
| `system/backend/tests/test_psg_adapter.py` | Tests of the PSG adapter |
| `system/backend/tests/test_slices.py` | Tests of the slices |
| `system/backend/tests/test_mini_isg.py` | Tests of the mini-ISG artefacts |
| `data/slices/` | Slice annotations, manifests and images (NAS) |
| `data/LICENCES.md` | The licence gates per dataset (NAS) |

## 3. Interfaces

**Provides:**

- `app.datasets.loader` (`DATASETS`, `load_slice`, `image_file`, `images_present`, `distribution_mode`, `selection_ok`, `MEDIA_TYPES`) and `app.datasets.licences` (`gates_for` and the two `require_*` guards), imported by S2 (`system/backend/app/api/datasets.py`), S5 (`system/backend/app/vlm/indvissgg.py`), S13 (`build_demo_m0.py`, `record_demo_traditional.py`) and S15 (`data_bundles.py`).
- The slices under `data/slices/`, read through S2's datasets routes by the labs, and the placeholder slice's annotations and images and `vg150-sgb`'s annotations, which S12 imports at build time (`system/frontend/src/playgrounds/slice.ts`, `images.ts`).
- `data/LICENCES.md`, whose gate block S6's `system/tools/content_lint.mjs` reads.

**Consumes:**

- S2 (`loader.py`, `licences.py`, the adapters and every script import `app.schema` or `app.settings`).
- S1 (the PSG adapter imports `encode_counts` from `app.eval.rle`).
- S5 (`build_mini_isg.py` imports `app.vlm.prompts` and `exchange_key` from `app.vlm.provider`).

## 4. Current rules

1. No script downloads a corpus. The author downloads each corpus under `SGS_CORPUS_ROOT`, by default `data/_raw`, and `cut_slice.py` cuts a slice from it. [D-08] [`system/backend/scripts/cut_slice.py`]
2. The adapter is the only dataset-specific code: it exposes `read(root) -> Iterator[SceneGraph]`, and everything downstream sees `SceneGraph` and nothing else. [D-08] [D6]
3. Adapters exist for `vg150-sgb` and `indoorvg`, which share one COCO-format parquet reader, and for `psg`. `vrd` and `haystack` have none, and `read_dataset` fails for them naming the expected layout from `LAYOUTS` and the file to write. [D6] [D21] [`system/backend/app/datasets/adapters/__init__.py`]
4. `pyarrow==23.0.1` is a backend dependency for the parquet adapters alone; the evaluation engine imports nothing new. The adapters are imported lazily, inside one `try`, so that a missing `pyarrow` disables adapters rather than every import of the package. [D18] [`system/backend/app/datasets/adapters/__init__.py`]
5. An adapter may expose `image_bytes(root, image_id)`. `cut_slice.py` asks the adapter first and falls back to `root/images/<id>.jpg`, and it refuses to finish when it wrote no image. [D17]
6. The PSG adapter reads `bbox_mode: 0` as two corners (XYXY), `relations` as positions in the record's annotations, and `category_id` over the thing and stuff classes concatenated. It drops a record whose photograph is absent and counts it in `last_repairs`; a record whose panoptic PNG is absent still yields its scene, without masks. [D21] [`system/backend/app/datasets/adapters/psg.py`]
7. `data/LICENCES.md` carries two findings per dataset, `annotations_commit` and `bundle_distribute`, each read from the source's own statement. Anything but `YES` is closed: `UNCLEAR` and a blank count as `NO`. [D-08] [`system/backend/app/datasets/licences.py`]
8. `cut_slice.py` and `make_placeholders.py` refuse to write annotations for a dataset whose `annotations_commit` is not `YES`, and the content lint refuses a slice whose `annotations.json` exists without that gate cleared. [D-08] [`system/tools/content_lint.mjs`]
9. The gates now read: `annotations_commit` `YES` for `placeholder`, `psg`, `vg150-sgb`, `indoorvg`, `mini-isg` and `demos-m0`, `NO` for `vrd` and `haystack`; `bundle_distribute` `YES` for `placeholder`, `mini-isg` and `demos-m0` and `NO` for the other five. [`data/LICENCES.md`] [D48] [D-24]
10. PSG's annotations are MIT, and its images are COCO photographs that MIT does not reach. A dataset whose images may not be bundled reaches a student through `fetch_images.py`, which downloads each image by identifier from the source and checks it against the manifest's SHA-256. [D13] [D-08]
11. The manifest records `distribution`, `bundle` or `fetch`, at cut time, from the `bundle_distribute` gate; `distribution_mode` reads it, and answers `none` for a slice with no manifest. [D13] [D19] [`system/backend/app/datasets/loader.py`]
12. A slice is `annotations.json`, `MANIFEST.json` and `images/` under `data/slices/<ds>/`. The manifest records the seed, the distribution and, per image, the file, its SHA-256, its size in bytes, its width and height. [D-08] [`system/backend/scripts/cut_slice.py`]
13. Every slice keeps its manifest in its slice directory, where the loader looks. `data/mini-isg/` holds nothing the application reads: its README and licence finding are for a reader, and `authoring.json` is the input of `build_mini_isg.py`. [D46] [`system/backend/scripts/build_mini_isg.py`]
14. `image_file` takes the file the manifest names, and falls back to `.jpg`, `.jpeg` and `.png` only when there is no manifest. [D25] [`system/backend/app/datasets/loader.py`]
15. D-10's selection rule admits a frame with at least four objects, at least three relationships, and at least one relationship whose predicate is outside the slice's ten most frequent. The third clause applies only where the slice has more than ten predicates, so mini-ISG, whose dictionary has seven, is exempt from it; a test requires a frame of head predicates alone to be rejected where there is a tail. [D-10] [D47]
16. D-10 allocates 200 frames with seed 20260915: `vg150-sgb` 80, `psg` 50, `vrd` 40, `indoorvg` 20 and `haystack` 10. The slices cut are `placeholder` 6, `vg150-sgb` 80, `indoorvg` 20, `mini-isg` 40 and `psg` 50. [D-10] [D99]
17. `vg150-sgb` is the project's one VG150 split, and the bare `vg150` names no dataset. The corpus behind it is the COCO-format parquet release `maelic/VG150-coco-format` of SGG-Benchmark, in its corrected version, and not `VG-SGG.h5`; its manifest carries per-image hashes, the seed and the distribution, and no source-file hash. [D-09] [D93]
18. `bundle_slices.py` walks `DATASETS` and includes each dataset that has annotations and whose `bundle_distribute` is `YES`, with no list of its own. It writes `dist/scene-graph-studio-slices-<date>.zip` under `system/`, with each slice's images and manifest and `LICENCES.md`, and prints the size and SHA-256 to quote. [D48] [D-08] [`system/backend/scripts/bundle_slices.py`]
19. `verify_bundle.py` reports missing, extra and hash-mismatched files separately. [D-08] [`system/backend/scripts/verify_bundle.py`]
20. The placeholder slice is six synthetic frames that `make_placeholders.py` generates deterministically; it is the one slice whose images this repository makes, and every lab is demonstrable on it alone. [D-08] [`system/backend/scripts/make_placeholders.py`]
21. Mini-ISG frames come from IndustReal alone, whose Apache-2.0 licence was verified on the 4TU data record and not only on the code repository. MECCANO states no licence, and nothing is cut from it; one frame from it would close both gates again. [D45] [D-18] [`data/LICENCES.md`]
22. `data/mini-isg/README.md` states, in both languages, that the set is not the authors' ISG, that it is built with the paper's method and not its data, and that `ISG-Bench` is a name collision. [D45] [D-18]
23. `build_mini_isg.py` builds the drafts, `data/vlm/transcripts/mini-isg-step1.json`, and the reference set, `data/slices/mini-isg/annotations.json`, from one authored file, `data/mini-isg/authoring.json`, keying each draft on the hash of the prompt `prompts.py` builds; `test_mini_isg.py` reruns it and requires byte-identical output. [`system/backend/scripts/build_mini_isg.py`] [`system/backend/tests/test_mini_isg.py`]
24. One model drafted the mini-ISG set and the same model corrected it, so the correction count is a lower bound on the work, not a measurement of what a human finds; the boxes were placed by eye to roughly 3% of the frame width. [D49]
25. Every annotated mini-ISG object takes part in a relationship, and the README's predicate table is parsed from both language copies and compared with the data. [D51]
26. Scored against itself at K = 100, the mini-ISG reference set gives 1.0 on all forty frames under `none` and below 1.0 on four under the graph constraint, isg-011, isg-013, isg-025 and isg-035, each with one hand both holding and assembling one object. A test pins the four in both directions. [D51] [D99] [VERIFICATION §23]
27. The adapter fixtures are synthetic, built by `make_adapter_fixture.py` and `make_psg_fixture.py`, because the gates forbid carving them out of real shards; the three JPEGs under `system/backend/tests/fixtures/psg/` are drawn with `Image.new`. [D-24] [`system/backend/scripts/make_psg_fixture.py`]
28. The four adapter tests against the real corpora run only when `SGS_CORPUS_ROOT` names them and skip otherwise, and an explicit `SGS_CORPUS_ROOT` is not moved by `SGS_DATA_DIR`. [D84] [VERIFICATION §14]
29. In the CI fixture, `vg150-sgb` contributes annotations only, while `placeholder` and `mini-isg` carry their images. [D125] [D-24]

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §14.

**`npm run ci` steps:** 2 pytest, `system/backend/tests/test_adapters.py`, `test_psg_adapter.py`, `test_slices.py` and `test_mini_isg.py`, the adapter tests against real corpora skipping unless `SGS_CORPUS_ROOT` is set; 5 ruff; 8 content, whose licence block parses `data/LICENCES.md` and requires the `annotations_commit` gate of every slice with an `annotations.json`.

**Outside `ci`:** `npm run check:offline` (check 6) runs with a scratch `SGS_DATA_DIR` holding no slice images and a freshly generated `placeholder` slice, and requires all eight labs to render on it (VERIFICATION §6).

**What the records measure.** §9 is the source audit: the content lint over seven licence rows, and `data/mini-isg/LICENCE.md`. §14 includes the run with `SGS_CORPUS_ROOT` set, the configuration in which the adapter tests run.

## 6. Traps

- "Read the source's own statement" means every place the source publishes: IndoorVG states no licence on GitHub and CC BY 4.0 on Hugging Face. [`data/LICENCES.md`] [`docs/INDEX.md`]
- A corpus layout recorded from memory was wrong in two of three fields; `LAYOUTS` now records what was read off the files. [D17] [`system/backend/app/datasets/adapters/__init__.py`]
- A cutter that copies images from a directory writes a silent empty slice when the corpus embeds the images instead. [D17]
- A test that asserts "nothing cut yet" goes stale the moment something is cut. [D19]
- A binding decision can describe an artefact the project never obtained, and nothing compares the two: D-09 named `VG-SGG.h5`, which the project never had. [D93]
- The configuration that unskips the tests worth running, `SGS_CORPUS_ROOT` set, is the configuration nobody ran the suite in. [D84]

## 7. History

**Binding decisions:** D-08, D-09, D-10, D-18.

**Specs and plans:** `2026-09-15-01-skeleton-and-eval-engine.md`, `2026-09-15-04-labs-shells-hardening.md`.

| Deviation | Effect | Role |
|---|---|---|
| D6 | the five corpus adapters are deliberately not written | primary |
| D13 | the licence check ran, and PSG cannot be bundled | primary |
| D17 | `cut_slice.py` gets images from the adapter, not only from disk | primary |
| D18 | `pyarrow` enters the backend, outside the evaluation engine | primary (rule): the adapters are its only consumer and import it lazily; the file it changed, `system/backend/requirements.txt`, is S14's |
| D19 | two slice tests encoded a state rather than a rule | primary |
| D21 | PSG annotations describe a corpus larger than the one on disk | primary |
| D25 | the image endpoint served the one slice that was synthetic | primary |
| D45 | the mini-ISG gate: one source cleared, one shut | primary |
| D46 | the manifest was written where the application does not look | primary |
| D47 | D-10's tail condition cannot be met by a seven-word dictionary | primary |
| D48 | `bundle_slices.py` has no cleared set to add mini-ISG to | primary |
| D49 | one model drafted the mini-ISG set and the same model corrected it | primary |
| D51 | what the review of D46–D50 found | primary |
| D84 | the suite was red in the configuration where the adapters are actually tested | primary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D109 | all of `data/` on the NAS, and none of it in git | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

1. **F5's unresolved question.** `bundle_distribute` is defined as distribution "to enrolled students for classroom use". A public repository and a public Render service reach a wider audience than that definition states. Whether the named licences (Apache-2.0, CC BY 4.0, MIT) cover it is the author's finding to record. [D-24] [`2026-10-08-subsystem-index-design.md`]
2. D18 states that a machine without `pyarrow` loses "those two datasets". `_register_builtins` imports `indoorvg`, `psg` and `vg150_sgb` in one statement inside one `try`, so the `ImportError` leaves `psg`, which does not read parquet, unregistered as well. [D18] [`system/backend/app/datasets/adapters/__init__.py`]
3. D-08a's table and D13 record `vg150-sgb` with `bundle_distribute` `YES`. D19 ("`vg150-sgb` fetches"), D48 and D108 record it as `NO`, and so does `data/LICENCES.md`, whose row explains that the licence's scope over the images is unclear. No record states when or why the cell changed. [D-08] [D13] [D48] [D108] [`data/LICENCES.md`]
4. `image_bytes`'s docstring cites "DEVIATIONS.md D7"; D7 is the CommonJS scoping of `system/tools/`, and the record of `image_bytes` is D17, renumbered from D7. [D17] [`system/backend/app/datasets/adapters/__init__.py`]
5. D49 states that the annotations' provenance note says, in both languages, that one model drafted and corrected the set, and plan 04 Task 4 asks for a note naming the drafting model. The note in `data/slices/mini-isg/annotations.json` is in English only, calls the annotations hand-corrected, names no model, and refers to the transcript for who drafted them; its `kind` is `user`, which `test_the_annotations_say_a_person_made_them` requires. [D49] [`2026-09-15-04-labs-shells-hardening.md`] [`data/slices/mini-isg/annotations.json`]
6. D-09's source-file hash is not implemented: D93 annotated D-09 and did not re-cut `vg150-sgb` or add a hash to its manifest. [D-09] [D93]
7. Left for the author by D125: once a second machine passes with `devdata pull` alone, the corpora under `data/_raw` and the author's `SGS_CORPUS_ROOT` would become dataset entries of their own. [D125]
