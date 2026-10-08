# S13 Demos

## 1. Purpose and boundary

S13 is M0's two demonstrations on one IndustReal clip: D-T, the traditional detect, enumerate and classify pipeline in four parts, and D-V, IndVisSGG's three steps in five, each recorded once by a backend script and replayed in the lecture from `data/demos/m0/`. It owns the `demo` step's components and tables, the scripts that cut the clip and record and derive the two artefacts, and their tests. It is not the VLM pipeline and providers D-V is recorded through (S5), not the playgrounds whose control kit and photograph overlay it reuses (S12), and it computes no metric, which is a lab's business (S11).

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

**Provides:**

- `Demo` (`system/frontend/src/demos/Demo.tsx`), which S6's `system/frontend/src/content/registry.tsx` passes to every module body through the MDX `components` prop.
- `DEMO_MOUNTS`, `DEMO_PARTS` and `DEMO_ARTEFACTS` (`system/frontend/src/demos/mounts.tsx`), which S6's `system/tools/content_lint.mjs` reads as text; S6's `system/frontend/src/content/test/registry.test.tsx` imports `system/frontend/src/demos/data.ts` and `logic.ts` to hold M0's prose to the recordings.
- `data/demos/m0/`: S5's `system/backend/app/vlm/indvissgg.py` reads its `MANIFEST.json` and `system/backend/app/vlm/frames.py` its `frames/`, and S4's `system/backend/tests/test_registry.py` audits the provenance of its `traditional/` graphs.

**Consumes:**

- S12 (`system/frontend/src/demos/DT/Part1.tsx` imports `PhotoMarks` and `MARK_PREDICTED`; the parts and the two containers import `Readout` and `Choice`, `Demo.tsx` `PartContext` and `DemoFrame.tsx` `DensityContext` from `system/frontend/src/playgrounds/controls.tsx`; `DV/IndVisSGG.tsx` imports `snap` from `system/frontend/src/playgrounds/logic.ts`).
- S11 (`DT/Traditional.tsx` and `DV/IndVisSGG.tsx` import `useLabParams` from `system/frontend/src/labs/useLabParams.ts`).
- S10 (the components import `useLocale` from `system/frontend/src/i18n/useLocale.ts`).
- S1 (`system/frontend/src/demos/data.ts` imports the type `BBox` from `sgg-metrics`).
- S5 (`record_demo_indvissgg.py` and `build_demo_m0.py` import `app.vlm` and `app.vlm.prompts`; the recorder also `app.vlm.openai_compat` and `app.vlm.provider`).
- S3 (`record_demo_traditional.py`, `build_demo_m0.py` and `test_demo_m0.py` import `load_slice` from `app.datasets.loader`).
- S2 (the four scripts import `DATA_DIR` and `require_data_dir` from `app.settings`, and `record_demo_traditional.py` and two of the tests import `SceneGraph` from `app.schema`).
- S15 (`data.ts` imports the clip, the manifest, the frames and the two derived files from `data/demos/m0/` through the `data/` link, whose CI copy is `fixtures/data`).

## 4. Current rules

1. A `demo` is a step kind beside `playground`: `kind: demo` with `demo: 'DT' | 'DV'`, `part: n` and a `seconds_budget`, and one `<Demo id="…" part="n"/>` in its body, supplied through the MDX `components` prop, so no module imports it. [contracts §2.4] [`2026-09-29-m0-demos-design.md`] [`system/frontend/src/demos/Demo.tsx`]
2. `mounts.tsx` holds three tables, `DEMO_MOUNTS`, `DEMO_PARTS = { DT: 4, DV: 5 }` and `DEMO_ARTEFACTS`, which name `demos/m0/traditional.json` and `demos/m0/indvissgg.json`. The content lint reads them as text, one entry to a line, and `Demo.test.tsx` holds them to that form. [contracts §2.4] [`CLAUDE.md`] [`system/frontend/src/demos/mounts.tsx`] [`system/frontend/src/demos/test/Demo.test.tsx`]
3. A demo replays recorded artefacts and computes only counts, set memberships and set differences over them, never a metric: no R@K, no mR@K and no comparison with mini-ISG's reference annotations, and nothing in `system/frontend/src/demos/` imports a value from `sgg-metrics`. [contracts §2.4] [`2026-09-29-m0-demos-design.md`] [VERIFICATION §31]
4. A `<Demo>` whose id is not registered, or whose part is absent, not an integer or outside 1 to `DEMO_PARTS[id]`, names itself on the slide rather than rendering nothing or rounding to a part that exists. [`system/frontend/src/demos/Demo.tsx`] [`system/frontend/src/demos/test/Demo.test.tsx`]
5. The demos import the clip, its manifest, the ten frames and the two derived files from `data/demos/m0/` at build time, so they replay with no backend, no network and no model running. [`2026-09-29-m0-demos-design.md`] [VERIFICATION §31] [`system/frontend/src/demos/data.ts`]
6. The clip is IndustReal's `01_assy_0_1.mp4` from 88.0 to 106.0 s, H.264 at 1280×720 and 10 fps with no audio, within a 5,000,000-byte budget, and its ten frames are `m0-demo-088` to `m0-demo-106`, 2.0 s apart, with keyframes at 90, 96 and 102 s. `cut_demo_m0.py` refuses to run until `data/LICENCES.md` carries a `demos-m0` row. [`2026-09-29-m0-demos-design.md`] [VERIFICATION §31] [`system/backend/scripts/cut_demo_m0.py`]
7. D-T detects with torchvision's Faster R-CNN R50-FPN on COCO weights at a score threshold of 0.5, enumerates every ordered pair, and gives each pair the predicate most frequent for its class pair over the vg150-sgb slice's 80 frames and 892 rows, or `on` when the pair is unseen or a class unmapped. Its ten graphs are `measured`, model id `fasterrcnn-r50fpn-coco+freq-vg150sgb`, and `torch` and `torchvision` are imported only inside functions, never at module level. [`2026-09-29-m0-demos-design.md`] [VERIFICATION §31] [`system/backend/scripts/record_demo_traditional.py`]
8. On the recording all 224 relations take the fallback `on`, and the demo states it as the prior's coverage limit; D-T part 3 therefore shows the two predicate histograms and the counts of each fallback cause, not a list of each pair's predicate. [VERIFICATION §31] [D116]
9. D-V makes IndVisSGG's five calls a frame, step 1, three experts and step 3, 50 in all, through the application's own provider, and drafts under `O_DEMO`, `P_ISG` and `EXAMPLES_DEMO`, which name each hand; D-T's comparison column keeps `O_ISG`. [VERIFICATION §31] [D124] [`system/backend/scripts/record_demo_indvissgg.py`]
10. The recording replayed was made on 2026-10-02 on the A6000, `Qwen/Qwen3.8-27B-FP8` under vLLM 0.21.0, with D114's sampling settings, a seed per exchange key and thinking off; the files it replaced are kept at `data/vlm/transcripts-pre-D124/m0-demo.json` and `data/demos/m0/pre-D124/indvissgg.json`. [D124] [VERIFICATION §34]
11. D-V's replayed graphs are `reconstructed`, and its provenance line says recorded and replayed, never measured; D-T's says measured. [VERIFICATION §31] [`system/frontend/src/demos/DV/IndVisSGG.tsx`] [`system/frontend/src/demos/DT/Traditional.tsx`]
12. Every graph a demo records carries `dataset: "mini-isg"` and no `DatasetId` of its own, although its frames are not among the slice's; `image_id` and the demos' manifest say which frames they are. [D113]
13. `build_demo_m0.py` derives `traditional.json` and `indvissgg.json` from the recordings, deterministically, calls no model, and with `--check` names a file that differs; pytest rebuilds both and compares them with the files on disk. [`2026-09-29-m0-demos-design.md`] [VERIFICATION §31] [`system/backend/scripts/build_demo_m0.py`] [`system/backend/tests/test_demo_m0.py`]
14. The demos draw lists, numbers and one expert at a time where the design names graphs, labels and all three experts: D-V part 4 lists the summary as text, since `SceneGraphView`'s canvas sets labels below the 18 px floor, which no DOM sweep can measure, and D-V part 3 shows one expert, chosen by `DV.expert`. [D116]
15. Figure 6's marks are one definition, `marks.ts`, used by D-T part 4 and D-V parts 3 and 5: an added triplet on a solid `blue-700` rule, a removed one on a dotted `slate-700` rule, a kept one on none, the rule running unbroken under the descenders. [D116] [VERIFICATION §31] [`system/frontend/src/demos/marks.ts`]
16. D-T part 1 numbers each box with an HTML badge `#n` set above its box and names every number in a legend; a badge whose box's top lies within one badge height of the photograph's top sits in a band directly above the photograph, an exception to D100's rule that a badge lies on the photograph. [D116] [VERIFICATION §31]
17. D-V part 1's whole prompt and part 3's analysis each scroll within a box of their own, so the part stays inside the panel. [D116] [D124]
18. The knobs are `DT.frame`, `DV.frame` and `DV.expert`, in the URL; a frame id not among the ten reads as `m0-demo-090`, and `DV.expert` is snapped onto 1 to N. The stepper carries the query between two parts of one demo and nowhere else. [contracts §2.4] [`2026-09-29-m0-demos.md`] [`system/frontend/src/demos/DV/IndVisSGG.tsx`]
19. `ClipPlayer` is a native `<video>`, muted, inline, `preload="metadata"`, never autoplayed, with one button for each of the ten frames, a keyframe's differing by its border's shape. The lecture shell yields Space to a focused clip and tick and keeps the arrows. A tick on the last frame seeks 1 ms below the clip's end, and Chromium still sets `ended`, so Play restarts the clip; `END_MARGIN_SECONDS` in `system/frontend/src/demos/data.ts` is the one constant to change. [D117] [VERIFICATION §31] [`system/frontend/src/demos/ClipPlayer.tsx`]
20. `DemoFrame` is always dense and never clipped, and carries a provenance line naming the model, the date and how the artefact was obtained. [`system/frontend/src/demos/DemoFrame.tsx`] [`system/frontend/src/demos/test/DemoFrame.test.tsx`]
21. M0's nine demo steps are s7 to s15, D-T's four then D-V's five, between the playgrounds and the L1 lab at s16, with the checkpoint at s17; their budgets are 60, 60, 60 and 90 s, and 60, 60, 120, 60 and 120 s. [D117] [`2026-09-29-m0-demos-design.md`]
22. A demo step's prose and presenter notes are written from the recorded artefacts after recording, and a test in `system/frontend/src/content/test/registry.test.tsx` holds M0's demonstration prose to the recordings. [`2026-09-29-m0-demos-design.md`] [D124]
23. The content lint holds a `demo` step to five rules. (1) The step names a registered demo, a key of `DEMO_MOUNTS` or `DEMO_PARTS`, and an integer part. (2) Its body carries exactly one `<Demo>`, whose id and part equal the step's; every `<Demo>` in a module's body answers to a declared step; and no tag is mounted twice in a module. Tags are read in any spelling MDX compiles, with MDX comments removed. (3) A demo's parts are 1 to N on consecutive steps of one module, in order, where N is its entry in `DEMO_PARTS`, and a demo with no entry is refused. (4) The artefact `DEMO_ARTEFACTS` names lies under `data/demos/`, a backslash read as a separator, exists, is JSON, and carries a provenance object. (5) The step declares a positive `seconds_budget`. [contracts §2.4] [D118] [D122] [`system/tools/content_lint.mjs`]
24. The comparison of the two locales, shared with the playgrounds, also requires both locales to carry the same demo and part at each step. [`system/tools/content_lint.mjs`]
25. Disabling each demo rule of `system/tools/content_lint.mjs` alone fails a named test of `system/tools/test/content_lint.test.mjs`, measured as 11 mutants of 11 against its 67 tests. Rule 1's two clauses, a registered demo and an integer part, each fail `refuses a demo step that names no demo, or no part`. Rule 2's three clauses fail, in turn, `refuses a demo step whose body carries no matching <Demo>`, `refuses a <Demo> whose part is not a literal` and `does not count a <Demo> inside an MDX comment`; `refuses a <Demo> no step declares` and `counts a <Demo> spelt in another order as the tag it is`; and `refuses a <Demo> mounted more than once in one module` and the same spelling test. Rule 3's consecutive parts fail `refuses demo parts apart, out of order, or fewer than DEMO_PARTS gives` and `refuses the parts of one demo spread over two modules`, and its missing `DEMO_PARTS` entry the first of these. Rule 4 fails `refuses a demo whose artefact is missing or carries no provenance` and `refuses a demo whose artefact lies outside data/demos/`; rule 5 fails `refuses a demo step with no seconds_budget`; and the locale comparison, with its demo kind or its demo term removed, fails `refuses a demo that differs between the two locales`. The earlier records state what was watched failing before: the five rules each in the M0 demos' mutation table, against a suite of 55 tests; the backslash case of rule 4 before D118's fix; the repeated `<Demo>` with its rule disabled (D120); and each behaviour D122 added to the reading of tags, removed in turn. [`system/tools/test/content_lint.test.mjs`] [VERIFICATION §31] [VERIFICATION §36] [D118] [D120] [D122]

## 5. Verification

**Records:** VERIFICATION §31, VERIFICATION §34, VERIFICATION §36.

**`npm run ci` steps:** 2 pytest (`system/backend/tests/test_demo_m0.py`, `test_demo_traditional.py`, `test_demo_indvissgg.py`); 4 vitest, the `frontend` project (`system/frontend/src/demos/test/`: `Demo.test.tsx`, `DemoFrame.test.tsx`, `data.test.ts`, `logic.test.ts`, `ClipPlayer.test.tsx`, `DT.test.tsx`, `DV.test.tsx`) and the `tools` project (`system/tools/test/content_lint.test.mjs`, its `content_lint demo rules` block); 5 ruff, over the scripts and the tests; 7 i18n, over the `demo` keys; 8 content, the five demo rules over M0's nine demo steps; 11 frontend build, which bundles the clip and the frames.

**Outside `ci`:** `npm run test:e2e` requires that a demo computes with `/api/` refused, that Space on the clip or a tick does not advance the deck while ArrowRight does, and that the stepper carries `DT.frame` across D-T's parts and not into D-V (`system/e2e/lecture.spec.ts`); its projector suite holds every demo part to 1024×768 in 繁體中文 in its longest state, with no word clipped out of reach, D-T part 1's frame whole and its marks and badges on it, the clip whole, and Figure 6's rules unbroken (`system/e2e/projector.spec.ts`). `npm run check:offline` opens the nine demo parts with nothing fetched from outside the origin (`system/e2e/offline.spec.ts`). `npm run check:perf` times a D-T tick and a D-V expert against NFR-8's 100 ms (`system/e2e/perf.spec.ts`).

**What the records measure.** §31 is the clip and its frames with their hashes, D-T's recording, D-V's greedy attempt and three recordings, the two derived files, the fit of every part at three sizes in both locales, the badges, contrast, keys, NFR-8 and NFR-1, and the gate on 2026-09-30. §34 is D-V recorded again on the A6000 under `O_DEMO` on 2026-10-02, with its transcript's and derived file's hashes. §36 is the demo rules of the content lint disabled one at a time on 2026-10-08, 11 mutants of 11 caught.

## 6. Traps

- A demo is a step kind that replays a recording and computes counts, set memberships and set differences over it, never a metric, and the content lint reads the three tables of `system/frontend/src/demos/mounts.tsx` as text, one entry to a line, so the tables keep that form. [contracts §2.4] [VERIFICATION §31] [`system/frontend/src/demos/test/Demo.test.tsx`] [`CLAUDE.md`]
- The recordings live in the one shared `data/`, so a branch that records again breaks `main`'s gate until it merges; the map states the rule, and D124 names the files a revert copies back. [D124] [`docs/subsystems/README.md`]
- A live provider that accepted `image_ref` and never read it produced answers about an image the model never saw, each reading as a description of it. [D112]
- One fixed seed made the three experts of a frame correlated, two of them identical on `m0-demo-088`; greedy decoding repeated one triplet to the token limit; and with thinking on, the reasoning arrived inside the answer. [D114]
- A prompt that asked for an unlabelled analysis left every recorded analysis empty, and a triplet quoted inside an analysis became a revision row. [D115]
- A canvas draws its labels where no DOM sweep can measure them, and `SceneGraphView` scaled them to about 8 to 15 px at 1024×768. [D116]
- Chromium sets `ended` for any seek at or after the clip's last frame, 17.9 s, so a seek to the last tick leaves the clip ended. [D117]
- A reader that joins on `dataset == "mini-isg"` and looks the `image_id` up in the slice's manifest finds no row for a demo frame. [D113]

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
| D118 | two minors the M0 demos' final review left open | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D124 | D-V names each hand, and is recorded again on the A6000 | primary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

1. D-T's tick took 71.1 and 72.8 ms in two runs against about 33 ms for every other case, and 32.9 ms in the run that closed the branch, all inside the 100 ms budget; the cost is the new photograph's first decode, and since `PhotoMarks` is shared with F3, E1 and E10, `decoding="async"` or a preload is left undecided. [D117] [VERIFICATION §31]
2. D117 records that the lecture test that no backend is needed does not block `/api`. `a demo computes with no backend running` in `system/e2e/lecture.spec.ts` now refuses every request to `/api/` and asserts that none was made, and no record states the change. The badge and marks tests still wait for visibility, not for `img.decode()`. [D117] [`system/e2e/lecture.spec.ts`] [`system/e2e/projector.spec.ts`]
3. `DEMO_LONGEST` in the projector suite chooses its states by rules over the recordings, each checked against a full sweep; a new recording needs that check again. [D117]
4. In English, three demo parts ran past 1024×768 on 2026-09-30, D-T part 4 and D-V parts 4 and 5, by 25, 37 and 43 px; the suite holds 繁體中文 only, so no assertion fails. [D117] [VERIFICATION §31]
5. No test reads the demos' sources for a value import from `sgg-metrics`; rule 3 of §4 holds in the code as it stands. [contracts §2.4] [`system/frontend/src/demos/logic.ts`]
