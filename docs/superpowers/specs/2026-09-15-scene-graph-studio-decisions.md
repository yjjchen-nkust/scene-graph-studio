# Decisions Register — Scene Graph Studio

**Status:** resolved 2026-09-15
**Companions:** `2026-09-15-scene-graph-studio-PRD.md`, `2026-09-15-scene-graph-studio-SRS.md`, `2026-09-15-scene-graph-studio-design.md`, `2026-09-15-scene-graph-studio-contracts.md`

This document closes every open item and every blocking gap identified in the 2026-09-15 plan review. It is the authority where it contradicts the design document; the design document's §7 open items are now answered here and are marked closed in place.

Each decision carries the evidence it rests on. Where a decision rests on a command that was actually run, the command and its output are quoted. Where it rests on a judgement, the alternatives and the reason for rejection are stated.

---

## Index

| ID | Decision | Closes |
|---|---|---|
| D-01 | Repository location is `AI-LLM/scene-graph-studio/` | Design §7 item 1 |
| D-02 | Two machines exist; the ship target is the weaker one | Design §1 environment table |
| D-03 | Node 22 LTS is a hard prerequisite, installed before Phase 1 | New blocker found at re-probe |
| D-04 | Dependency versions are pinned at the values measured 2026-09-15 | Stale version table |
| D-05 | The cache-first rule stands; its stated rationale is corrected | Design §1 design consequence |
| D-06 | Live inference tier list, and the timeboxed detectron2 spike | B2, design §7 item 3 |
| D-07 | Prediction provenance has three tiers, carried in the data model | B2 |
| D-08 | Corpora are downloaded by the author; the class receives a cut slice bundle | B1 |
| D-09 | `vg150-sgb` is the one VG150 split this project ships | B1, SRS §10 hazard 1 |
| D-10 | Slice composition: 200 images, allocated per dataset | B1 |
| D-11 | The evaluation engine is pure-Python stdlib; no numpy, no pycocotools | New |
| D-12 | COCO RLE decode is implemented in-house in both languages | New |
| D-13 | `system/web/knowledge-map` is harvested for content and then frozen | B3 |
| D-14 | `pg.js evaluate()` is a teaching toy and must never become the engine | B3 |
| D-15 | CI is one local command, mirrored by a path-filtered GitHub workflow | B4 |
| D-16 | Golden vectors are one JSON file read by both engines | B4 |
| D-17 | The live VLM provider is Claude, opt-in through `.env` | Design §7 item 2 |
| D-18 | Mini-ISG licence gate precedes any frame commit | Licence hole |
| D-19 | Effort estimates and the cut order | No estimates |
| D-20 | The track is documented in the repository `CLAUDE.md` | Undocumented track |
| D-21 | The paper corpus is two tiers; only scored methods carry numbers | D-19 scope cut |

---

## D-01 Repository location

**Decision.** The project lives at `AI-LLM/scene-graph-studio/` inside the `course-lab` repository. It is not a separate repository and does not get its own `git init`.

Design §4.1 pins the root at `C:\Dropbox_teach\Class\38.大語言模型技術與應用\2026\paper\scene-graph-studio\` and §7 item 1 asks whether it should sit beside `paper\`. Both are obsolete: the material was committed to `course-lab` at `5341aee` on 2026-09-15. Design §5 Phase 0 lists `git init` as a deliverable; that step is struck.

**Consequence.** The `data/` tree specified in SRS §2 must respect this repository's conventions. Large binary corpora are not committed to `course-lab`; see D-08 for how slice images are handled instead.

---

## D-02 Two machines, and which one the software targets

**Decision.** Two distinct machines are in play. All specifications target the weaker (TEACH). DEV is used only to *produce* committed artefacts.

| | DEV (measured 2026-09-15) | TEACH (design §1, recorded 2026-09-15, not re-probed) |
|---|---|---|
| CPU | 12th Gen Intel Core i7-12700H, AMD64, 14 torch threads | Snapdragon X, Windows ARM64 |
| GPU | NVIDIA GeForce RTX 3070 Ti Laptop + Intel Iris Xe | Qualcomm Adreno X1-45 |
| Python | 3.12.10, native AMD64 | 3.12.10, x64 build under emulation |
| torch | 2.11.0**+cpu** — `torch.cuda.is_available() → False`, `torch.version.cuda → None` | 2.11.0 |
| Node | v20.16.0, npm 10.8.1 | v24.15.0, npm 11.12.1 |

Evidence, run on DEV:

```
python -c "import platform;print(platform.machine(), platform.processor())"
→ AMD64 Intel64 Family 6 Model 154 Stepping 3, GenuineIntel

python -c "import torch;print(torch.__version__, torch.cuda.is_available(), torch.version.cuda)"
→ 2.11.0+cpu False None

Get-CimInstance Win32_VideoController
→ NVIDIA GeForce RTX 3070 Ti Laptop GPU / Intel(R) Iris(R) Xe Graphics
```

**The finding that matters.** DEV carries an Ampere-class CUDA device. The installed torch is a CPU-only wheel, so CUDA is unavailable *by installation*, not by hardware. A CUDA wheel would enable GPU inference on DEV. This does not change what the software may assume, because students run on their own machines and the professor teaches from TEACH; it changes only what is feasible when producing committed prediction files. See D-06.

**Consequence.** Every requirement in SRS §7 that says "works with `torch` absent" is unchanged and remains the ship gate. No feature may require CUDA at run time.

---

## D-03 Node 22 LTS is a hard prerequisite

**Decision.** Node ≥ 22.12 LTS must be installed before Phase 1 begins. This is Task 1 of plan 01 and blocks everything downstream of it.

Evidence:

```
node --version      → v20.16.0
npm view vite version engines
  → version = '8.3.0'
  → engines = { node: '^20.19.0 || >=22.12.0' }
```

Node 20.16.0 satisfies neither branch of the range. `npm create vite` will refuse. This was not visible in the design document because its recorded Node version (v24.15.0) belongs to TEACH.

**Rejected alternative.** Pinning Vite 6, which accepts Node 18+. Rejected because it also forces older Rollup and Vitest majors, and the SRS names React 19 and Tailwind v4, both of which are exercised hardest by the current Vite line. Upgrading Node is free and removes the constraint permanently.

**Verification.** `node --version` prints `v22.12.0` or higher, and `npm --version` prints `10.9` or higher, before Task 2 starts.

---

## D-04 Pinned dependency versions

**Decision.** The versions below are pinned at the values measured or published on 2026-09-15. The design document's version table was measured on TEACH and does not match DEV; it is superseded here.

**Python, already installed on DEV.** `fastapi 0.136.1`, `uvicorn 0.46.0`, `torch 2.11.0+cpu`, `numpy 1.26.4`, `pydantic 2.13.3`, `scipy 1.17.1`, `pillow 12.2.0`, `pytest 9.0.3`, `httpx 0.28.1`.

**Python, to install.** `pytest-cov`, `ruff`, `python-multipart` (FastAPI file upload), and — only when the Phase 5 live path is attempted — `transformers`, `huggingface_hub`, `timm`. `opencv-contrib-python` is **not** required; Pillow covers every image operation this project performs.

**Node, published versions confirmed 2026-09-15 via `npm view`.** `vite 8.3.0`, `react 19.3.0`, `tailwindcss 4.3.3`, `cytoscape 3.34.3`, `cytoscape-dagre 4.0.1`, `d3 7.9.0`, `katex 0.18.7`, `ts-fsrs 5.4.2`.

SRS §2.1 names `cytoscape 3.34.2`; the published version is 3.34.3. The patch bump is adopted.

**Rule.** `pydantic` stays on v2. `numpy` is pinned `>=1.26,<3` but is used only in the inference and image paths — never in the evaluation engine, per D-11.

---

## D-05 The cache-first rule stands; the rationale is corrected

**Decision.** Every model comparison ships as committed precomputed predictions. Live inference is an opt-in path, RelTR only, behind a measured latency estimate. The application is fully functional with the network down and `torch` uninstalled.

This is unchanged from design §1. Its *stated reason* — "Windows ARM64, no CUDA device, so `detectron2` and `maskrcnn-benchmark` will not build" — is only true of TEACH. On DEV the architecture is AMD64 and a CUDA device is present. The rule survives on three reasons that hold on both machines:

1. **The teaching machine is TEACH.** The professor lectures from it, and it cannot run these models.
2. **Students run localhost on unknown hardware.** PRD §8 requires every P0 lab to run with `torch` uninstalled. A lab that needs live inference fails that gate regardless of the author's hardware.
3. **`maskrcnn-benchmark` is unmaintained** and pinned to a PyTorch and CUDA generation that torch 2.11 does not provide. Neural Motifs and VCTree inherit that constraint on any machine.

**Consequence.** No plan task may make a P0 feature depend on inference.

---

## D-06 Live inference tiers, and the detectron2 spike

**Decision.** Three tiers, fixed:

| Tier | Models | How they ship |
|---|---|---|
| **Live-capable** | RelTR | Opt-in CPU inference plus committed predictions. `/api/models` reports `live: true` only when `torch` imports and the checkpoint is present. |
| **Producible on DEV** | RelTR, EGTR | Committed predictions, produced by running the model. Provenance `measured`. |
| **Not producible here** | Neural Motifs, VCTree, PSGFormer, and the one-stage/two-stage pair L6 needs | Committed predictions, provenance `reconstructed`. See D-07. |

**The spike.** Phase 5 opens with a **four-hour timeboxed attempt** to build `detectron2` on DEV against torch 2.11 CPU, because DEV is AMD64 and the design's ARM64 objection does not apply to it. The spike is bounded and its outcome is recorded in `data/predictions/PROVENANCE.md` either way:

- **If it succeeds**, produce genuine Motifs and PSGFormer predictions on the slice, commit them with provenance `measured`, and the reconstructed files are never created.
- **If it fails or the timebox expires**, stop immediately and ship the reconstructed files. Do not extend the timebox.

This honours the chosen answer to B2 while not discarding a capability that was discovered after the question was framed. It is a spike, not a dependency: no task downstream of Phase 5 may assume it succeeded.

**Design §7 item 3 is closed by this decision.**

---

## D-07 Prediction provenance has three tiers, carried in the data model

**Decision.** SRS §3's `provenance` object gains one required field. The `kind` union is unchanged; a sibling `fidelity` field records how the numbers were obtained.

```typescript
provenance: {
  kind: 'ground_truth' | 'model' | 'vlm' | 'user';
  fidelity: 'measured' | 'reconstructed' | 'published';
  model?: string;
  vlm?: string;
  generated_at?: string;   // ISO 8601
  note?: string;           // required when fidelity !== 'measured'
}
```

- **`measured`** — produced by running the model on this image. The only tier that may be described as a model's output without qualification.
- **`reconstructed`** — a prediction file constructed by hand or by script to reproduce a published model's documented behaviour on this slice. It is not that model's output. `note` states what it reproduces and from which published table.
- **`published`** — a number quoted from a paper, carried on leaderboard and ablation records rather than per-image graphs.

**Interface obligation.** Anything whose `fidelity` is not `measured` renders with the distinct unverified style NFR-2 already requires, and its `note` is reachable without a click-through. The four-colour diff renders identically in all three tiers; only the provenance chrome differs.

**Precedent.** `system/web/knowledge-map` already labels its playground data synthetic in `README.md`. This decision generalises that practice and makes it machine-checkable by the content lint.

---

## D-08 Corpora are downloaded by the author; the class receives a cut bundle

**Revised 2026-09-15**, after the author confirmed they will download the source corpora
themselves. The earlier version of this decision specified a `fetch_slices.py` that pulled images
by URL with hash verification. That machinery is struck: it solved a problem that no longer
exists, and a script whose only user has already done the work by hand is a liability.

**The shape, in three moves.**

1. **The author downloads the full corpora** to a local root of their choosing — `data/_raw/` by
   default, overridable with the `SGS_CORPUS_ROOT` environment variable. The root is git-ignored
   and is never referenced by a committed path.
2. **`cut_slice.py` reads that root and cuts the slice** — 200 images under the D-10 allocation and
   selection rule — writing `annotations.json` and `MANIFEST.json` into `data/slices/<ds>/`
   (committed) and the selected image files into `data/slices/<ds>/images/` (git-ignored).
3. **`bundle_slices.py` packs the cut images** into one `scene-graph-studio-slices-<date>.zip` of a
   few dozen megabytes, which the author distributes to the class out of band — the LMS, a shared
   drive, a USB stick. Students unzip it into `data/slices/` and never touch Visual Genome, PSG or
   VRD. `verify_bundle.py` checks every unpacked file against the committed `MANIFEST.json`.

**Why a bundle rather than each student downloading.** Visual Genome alone is tens of gigabytes for
a slice that needs eighty images, and a class of thirty downloading it is thirty chances for a dead
link, a rate limit or a half-finished extract to break a lab session. One bundle prepared once is
distribution the author controls and can test. It also narrows the licence question from an
open-ended redistribution to a single, identifiable act — see the gate below.

**What is committed and what is not.**

| Artefact | Committed | Why |
|---|---|---|
| `data/slices/<ds>/annotations.json` | **Yes** | Small, derived, and the part the labs evaluate |
| `data/slices/<ds>/MANIFEST.json` | **Yes** | Per image: identifier, source dataset, SHA-256, width, height, licence identifier. It is what `verify_bundle.py` checks and what makes a slice reproducible from the corpora |
| `data/slices/<ds>/images/` | **No** — git-ignored | Distributed in the bundle instead |
| `data/slices/placeholder/` including its images | **Yes** | Six synthetic frames generated by `make_placeholders.py`. This project's own output, and NFR-1 depends on every lab being demonstrable on a machine that has neither the corpora nor the bundle |
| `data/_raw/` | **No** — git-ignored | The author's downloads |

**The licence gate, narrowed but not removed.** Downloading for one's own use and redistributing to
a class are different acts, and only the second needs clearing. `data/LICENCES.md` therefore carries
two findings per dataset:

| Column | Question it answers |
|---|---|
| `annotations_commit` | May derived annotations be committed to this repository? |
| `bundle_distribute` | May the image files be distributed to enrolled students for classroom use? |

Both start `UNVERIFIED`. `cut_slice.py` refuses to write `annotations.json` for a dataset whose
`annotations_commit` is not cleared; `bundle_slices.py` refuses to include a dataset whose
`bundle_distribute` is not cleared, and says which row to fill. `UNCLEAR` is treated as `NO`.

Most of these will clear easily — SRS §9 already records VG150 as CC BY 4.0 and PSG as MIT, and
classroom distribution of a small teaching sample is the ordinary case — but the finding is written
down rather than assumed, because NFR-7 makes licence hygiene a ship requirement and because the
author, not this document, is the one distributing.

**Per-dataset ingest.** `cut_slice.py --dataset <ds>` expects the corpus laid out under the root as
the source publishes it, and each dataset gets one small adapter that converts to `SceneGraph`:

| Dataset | Expected under `SGS_CORPUS_ROOT` | Adapter converts from |
|---|---|---|
| `vg150-sgb` | `vg150-sgb/VG-SGG.h5`, `VG-SGG-dicts.json`, `images/` | HDF5 index arrays |
| `psg` | `psg/psg.json`, `coco/` | COCO-style JSON with RLE masks |
| `vrd` | `vrd/annotations_train.json`, `annotations_test.json`, `sg_dataset/` | VRD JSON |
| `indoorvg` | `indoorvg/` as the SGG-Benchmark release publishes it | VG-derived HDF5 |
| `haystack` | `haystack/` as published | Its own format, negatives included |

The adapter is the only dataset-specific code in the project. Everything downstream sees
`SceneGraph` and nothing else.

**If a dataset is never downloaded,** nothing breaks: `cut_slice.py` skips it, `/api/datasets`
reports it absent with a reason, and the labs fall back to the placeholder slice. Partial
acquisition is a supported state, not a broken one.

> ### D-08a AMENDMENT 2026-09-16 — the licence check ran, and it forces a second path
>
> `data/LICENCES.md` was filled in from each source's own page. Findings:
>
> | Dataset | annotations_commit | bundle_distribute | Basis |
> |---|---|---|---|
> | `vg150-sgb` | YES | YES | CC BY 4.0, stated in the Visual Genome homepage footer. Attribution is a condition, not a courtesy. |
> | `psg` | YES | **NO** | OpenPSG is MIT, which covers the annotations. The images are COCO photographs sourced from Flickr; COCO does not relicense them, and MIT on an annotation set does not reach through to photographs its authors never owned. |
> | `vrd` | NO | NO | The Stanford project page states no licence, no copyright notice and no terms. An absent statement is not a permissive one. |
> | `indoorvg` | NO | NO | SGG-Benchmark's code is MIT; nothing is stated for the data, which is a VG re-annotation. Pending its `DATASET.md` and dataset card. |
> | `haystack` | NO | NO | No LICENSE file, no declaration. Evaluation-only here, so the cost of staying shut is low. |
>
> **The consequence changes this decision.** D-08 assumed one distribution path — the bundle.
> PSG cannot take it. `system/backend/scripts/fetch_images.py` is the second path: each student's
> machine downloads the images from the source by identifier, verified against the committed
> `MANIFEST.json` hashes. Fetching a file the source publishes, onto the machine of the person
> who will look at it, is not redistribution.
>
> The manifest now records `distribution: "bundle" | "fetch"` at cut time, and `/api/datasets`
> reports it, so which path a dataset takes is a licence fact carried in data rather than
> something each reader re-derives. The alternative — handing COCO photographs to a class under
> OpenPSG's MIT licence — is precisely what NFR-7 exists to prevent.

---

## D-09 One VG150 split, named so the ambiguity cannot recur

**Decision.** This project ships exactly one VG150 split: the Xu et al. (2017) split as redistributed in `Scene-Graph-Benchmark.pytorch`'s `VG-SGG.h5`. It is named **`vg150-sgb`** in every identifier, path, filename, and interface string. The bare string `vg150` never appears in code or content except when quoting another author.

The `dataset` union in SRS §3 becomes:

```typescript
dataset: 'vrd' | 'vg150-sgb' | 'psg' | 'indoorvg' | 'haystack' | 'mini-isg'
```

`data/slices/vg150-sgb/MANIFEST.json` carries the SHA-256 of the exact `VG-SGG.h5` the slice was cut from. SRS §10 hazard 1 states that three incompatible splits answer to the name VG150; naming the artefact after its provenance is what prevents this project from becoming a fourth instance of the problem. The hazard is still *taught* — it is knowledge point `X1` in the harvested corpus — but it is taught from a position of having named our own.

---

## D-10 Slice composition

**Decision.** 200 images total, allocated as follows. Each slice is cut by `system/backend/scripts/cut_slice.py --dataset <ds> --n <count> --seed 20260915`, which is deterministic and committed.

| Dataset | Images | Chosen for |
|---|---|---|
| `vg150-sgb` | 80 | The main teaching corpus: M1–M7, L1, L2, L3, L4 |
| `psg` | 50 | Masks, and the L6 protocol comparison, which needs mask-pairing |
| `vrd` | 40 | The zero-shot benchmark; `zR@K` has no other home |
| `indoorvg` | 20 | A second domain, for the transfer discussion in M14 |
| `haystack` | 10 | Explicit negatives; the only slice on which a precision-style statement is honest |
| **Total** | **200** | |

**Selection rule, applied identically to every dataset.** Sample with the fixed seed, then accept only images satisfying: at least 4 objects; at least 3 ground-truth relations; at least one relation whose predicate falls outside the split's ten most frequent. The third condition is what makes `mR@K` non-degenerate on a slice this small — without it, a 200-image sample is almost all `on`, `has`, and `wearing`, and Phase 9's verification item 4 cannot fire.

The selection rule is asserted by a test, not merely documented.

---

## D-11 The evaluation engine is pure-Python stdlib

**Decision.** `system/backend/app/eval/` imports nothing outside the Python standard library. No numpy, no scipy, no pycocotools.

**Reasons.**

1. **Parity.** NFR-3 requires the Python and TypeScript engines to agree on every golden vector. Both languages compute IEEE-754 doubles. Introducing numpy introduces its own accumulation order, its own reductions, and a second set of float semantics to reconcile. Pure Python removes the problem instead of managing it.
2. **Determinism.** NFR-4 requires identical output including tie-break order. Stable `sorted()` with an explicit key is auditable in a way a numpy argsort is not.
3. **Version hazard.** DEV carries numpy 1.26.4 while the design document records 2.4.4 on TEACH. A component under a hard TDD mandate must not straddle a major version boundary.
4. **Scale.** The largest evaluation this project performs is 200 images with at most a few hundred triplets each. Pure Python is comfortably inside NFR-8's 100 ms interaction budget.

numpy remains available to `app/infer/` and the image pipeline, where it is unavoidable.

---

## D-12 COCO RLE decode is implemented in-house, in both languages

**Decision.** `system/backend/app/eval/rle.py` and `system/frontend/packages/sgg-metrics/src/rle.ts` each implement COCO RLE decoding and mask IoU from the format specification. `pycocotools` is not a dependency.

**Reason.** SRS §4.1 requires mask IoU to substitute for box IoU on mask-based datasets, and NFR-3 requires the TypeScript engine to reach the same answer. There is no `pycocotools` for the browser, so a second implementation was always going to be necessary; taking the dependency on the Python side would buy nothing and would give the two engines different reference implementations of the same operation — precisely the failure mode NFR-3 exists to prevent. `pycocotools` additionally needs a C toolchain on Windows, which is an install barrier for students.

The RLE implementation is held to the same golden-vector discipline as the metrics: its fixtures include an empty mask, a full mask, two disjoint masks, two identical masks, and one pair whose IoU is exactly at the threshold.

---

## D-13 `system/web/knowledge-map` is harvested, then frozen

**Decision, per the user's answer to B3.** The existing static page is the seed corpus for the content build and is then frozen.

**What is harvested, and to where.**

| Source | Destination | Task |
|---|---|---|
| `kp-data.js` `CLUSTERS` — 93 knowledge points, 12 clusters, each `[id, en, zh, knobs, status]` | `data/content/kp.json`, typed and validated | Plan 02 |
| `pg.js` `MATH` — 28 display-math definitions in LaTeX | The **formal statement** slot of the matching module's MDX | Plan 02 |
| `pg.js` `DERIV` — 22 multi-step derivations with justification columns | The **worked example** and **implications** slots | Plan 02 |
| `pg.js` `PGS` control surfaces | The `knobs` field of each `kp.json` record, which the lab components read | Plan 02 |
| `imagelab.js` | Reference implementation for the SVG overlay's drag-to-ground interaction; re-written in TypeScript, not ported verbatim | Plan 02 |
| `index.html` bilingual `<span lang>` pairs | Seed entries for `i18n/zh-TW.json` and `i18n/en.json` | Plan 02 |

The harvest is mechanical where it can be: `system/tools/harvest.mjs` parses `kp-data.js` and `pg.js` and emits `data/content/kp.json`, `data/content/math.json` and `data/content/deriv.json`. The MDX authoring in Phase 4 then consumes those three files rather than the JavaScript sources.

`kp-data.js` already records `status: 'live' | 'spec'`, where `spec` means "controls specified, built in the app (Phases 3-7)". The page was written as this plan's seed; the harvest is the use it was designed for.

**What freezing means.** `system/web/knowledge-map/FROZEN.md` is added, stating the date, the harvest commit, and the rule: the page is not extended, and content changes are made in `data/content/` and the MDX corpus. `system/tools/audit.js` and `system/tools/check.js` stay in the CI command of D-15, so the frozen page cannot rot silently. The page remains the offline single-file fallback, which is a genuine asset on a machine with no Node.

---

## D-14 `pg.js evaluate()` must never become the engine

**Decision.** The `evaluate(opts)` function in `pg.js` is explicitly excluded from the harvest. The Python engine and its TypeScript mirror are written test-first from `METRICS.md` and arXiv 2404.09616, with no reference to it.

**Reason.** `evaluate()` is a teaching instrument, and a good one, but it is not the specified metric. Reading it against SRS §4:

- It matches a prediction to ground truth by **string equality on the triplet**, then compares a **precomputed per-prediction `iou` scalar** against τ. SRS §4.1 requires two independent box IoU computations, one for the subject and one for the object, against the matched ground-truth boxes.
- It carries no protocol, no constraint mode, and no mask pairing. It approximates the constraint through a `perPair` rank filter over a fixed 15-row `PRED` array.
- Its `Ra` weighting dial (`w_p ∝ n_p^α`) is a pedagogical interpolation between R and mR. It is not a published metric and must not appear in an API response.
- Its ground truth and predictions are eight hard-coded objects and fifteen hard-coded rows.

Promoting it would ship a plausible-looking engine that disagrees with the field on mask datasets and on every constraint mode. NFR-3's cross-implementation check would still pass, because both sides would be wrong together. This is the exact failure SRS §1 names — "a silent error there teaches students something false" — and it is worth naming explicitly because `evaluate()` is the most tempting shortcut in the repository.

The α dial survives as *content*: it is knowledge point `E6`, whose derivation proves `R@k − mR@k = Cov(n, R)/n̄`. It is taught, not computed by the engine.

---

## D-15 CI is one command, mirrored by a path-filtered workflow

**Decision.** `npm run ci`, run from `AI-LLM/scene-graph-studio/`, is the definition of green. `.github/workflows/scene-graph-studio.yml` runs the same command and nothing else.

```jsonc
// package.json at AI-LLM/scene-graph-studio/
"scripts": {
  "ci": "npm run test:py && npm run test:ts && npm run lint:parity && npm run lint:i18n && npm run lint:content && npm run lint:frozen",
  "test:py":     "pytest backend/tests -q",
  "test:ts":     "vitest run",
  "lint:parity": "node tools/parity.mjs",
  "lint:i18n":   "node tools/i18n_parity.mjs",
  "lint:content":"node tools/content_lint.mjs",
  "lint:frozen": "node tools/audit.js && node tools/check.js"
}
```

The workflow triggers only on `paths: ['AI-LLM/scene-graph-studio/**']`. `course-lab` is a mixed teaching repository whose other tracks emit large PowerPoint files; an unfiltered workflow would run on every deck commit and be ignored within a week.

`lint:parity` executes the golden vectors through both engines and diffs the results, which is the mechanism NFR-3 asserts and previously lacked. `lint:frozen` runs the two existing validators against the frozen page, which is how D-13 stays honest.

**The local command is primary.** NFR-1 requires the application to work offline; the development loop must too. The workflow is a second opinion, not the gate.

---

## D-16 Golden vectors are one JSON file read by both engines

**Decision.** `data/golden/vectors.json` is the single fixture artefact. Both engines load it from disk. Neither embeds a copy.

```jsonc
{
  "$schema_version": 1,
  "cases": [
    {
      "id": "gv-001-trivial-exact-match",
      "why": "One GT, one prediction, identical boxes. The simplest thing that can be right.",
      "gt":   { /* a full SceneGraph */ },
      "pred": { /* a full SceneGraph */ },
      "params": { "protocol": "predcls", "constraint": "graph",
                  "k": [20, 50, 100], "iou_thresh": 0.5, "mask_pairing": "single_mpo" },
      "expect": {
        "R":   { "20": 1.0, "50": 1.0, "100": 1.0 },
        "mR":  { "20": 1.0, "50": 1.0, "100": 1.0 },
        "ngR": { "20": 1.0, "50": 1.0, "100": 1.0 },
        "zR":  { "20": null, "50": null, "100": null },
        "verdicts": [ { "pred_index": 0, "verdict": "match", "gt_index": 0 } ]
      },
      "hand_checked": true
    }
  ]
}
```

**Rules.** Every expected value is computed by hand on paper before the fixture is written, and `hand_checked` records that. Floating-point comparison uses an absolute tolerance of `1e-9`. `zR` is `null` where the case declares no training split. `verdicts` is part of the contract because the four-colour diff renders it, and a metric that is right for the wrong reason is still wrong.

**Required cases**, from SRS §8, each a separate `id`: empty ground truth; empty prediction; all-tied scores; duplicate predictions; IoU exactly at the threshold; a predicate class with exactly one ground-truth instance; and — added here — the greedy-versus-maximum-matching adversarial case that SRS §11.2 says must be discharged rather than asserted, plus one mask case per D-12.

---

## D-17 The live VLM provider is Claude

**Decision.** The opt-in live provider in `system/backend/app/vlm/providers/` is Claude, configured through `.env`. The offline transcript player remains the default and the only provider any P0 feature may require.

**Reason.** The repository already maintains Claude API knowledge as a first-class concern, and the anchor paper's own providers (GPT-4V, Gemini-Pro-Vision) are superseded — a fact the interface must state in any case. Selecting one provider keeps the `VLMProvider` protocol honest at two implementations rather than one, which is the minimum that proves it is a protocol.

`.env` is git-ignored, and the repository rule against committing credentials applies without exception. `/api/health` reports whether a live provider is configured; it never reports what the key is.

**Design §7 item 2 is closed by this decision.**

---

## D-18 Mini-ISG licence gate

**Decision.** No industrial frame is committed until `data/mini-isg/LICENCE.md` records, for its source dataset: the licence identifier, the URL of the statement, the date checked, and an explicit finding on whether redistribution of individual frames is permitted.

The source frames are downloaded by the author, as D-08 has every corpus downloaded. If redistribution to the class is **not** permitted for a source, its frames are excluded from the slice bundle and the committed artefact is the hand-corrected **annotation** only, alongside a `MANIFEST.json` of frame identifiers and hashes so the set stays reproducible. Annotations are this project's own work and carry this project's licence.

Design §5 names IndustReal and MECCANO as sources and calls both "open" without citing a licence. That is the single most likely breach of NFR-7 in the plan, because Phase 7 is where frames get copied into the repository. The gate is placed before the copy, not after.

`data/mini-isg/README.md` states plainly, in both languages, that this is **our** teaching set built with the paper's method, that it is **not** the authors' ISG, and that ISG remains request-only — as design §5 already requires.

---

## D-19 Effort estimates and the cut order

**Decision.** Estimates are in focused working days for one implementer who has read the specifications. They exist so that a scope cut can be reasoned about; design §8 invites the cut without supplying the numbers.

| Plan | Phases | Deliverable | Days | Cuttable |
|---|---|---|---|---|
| 01 | 1–2 | Skeleton, health, schema, slices, evaluation engine ×2, golden vectors, CI | 8 | **No** |
| 02 | 3–4 | Graph, overlay, four-colour diff, L1, L2, harvest, 15 modules, ~70 cards | 14 | No (Phase 3); content depth is negotiable |
| 03 | 5–6 | Prediction registry, RelTR live, L4, L6, VLM protocol, IndVisSGG replica, L5 | 10 | L6 only, and only if D-06's spike fails and reconstruction proves unsound |
| 04 | 7–9 | L3, L7, L8, mini-ISG, lecture shell, assessment, hardening | 12 | L7, L8, mini-ISG, FSRS |
| | | **Total** | ~~44~~ **40** | |

**Cut order, if the term calendar binds.** Cut in this sequence and stop when the budget is met: FSRS spaced repetition → L8 and the mini-ISG build → L7 → the paper-card corpus reduced from ~70 to the ~25 named in the curriculum table → L6.

**What may never be cut.** Plan 01 in its entirety, and the lecture shell. Plan 01 is the correctness foundation; design §8 already states that cutting Phase 2 does not leave a coherent product. The lecture shell is the only deliverable PRD §3 ties to a dated obligation — the professor teaching the course.

**Minimum teachable product:** plans 01 and 02. That yields the triplet model, the metrics, the scoring diff, L1, L2, and the full bilingual module corpus — enough for M0 through M7.

**One caveat on plan 01's eight days.** It assumes the source corpora are already downloaded and sitting under `SGS_CORPUS_ROOT` when Task 14 starts, and it counts roughly half a day per dataset adapter. Five adapters is two and a half of the eight. Downloading the corpora is the author's own time and is not counted here at all; if only `vg150-sgb` and `psg` are acquired before the build begins, plan 01 lands closer to six days and the remaining adapters are written later against the same `read(root) -> Iterator[SceneGraph]` signature.

---

## D-20 The track is documented in the repository `CLAUDE.md`

**Decision.** `CLAUDE.md` at the repository root gains a `scene-graph-studio` entry under `AI-LLM/`, and the subdirectory count is corrected.

`CLAUDE.md` currently describes `AI-LLM/` as holding `paper/`, `beamer/` and `intro/`. `scene-graph-studio/` landed at `5341aee` and is undocumented, which means a session opened on this repository will not know that it exists, that it is a full-stack application rather than a PPTX track, or that the §3 deck specification does not apply to it. The entry states all three, alongside `security/` which is the existing precedent for a non-deck track.

---

## D-21 The paper corpus is two tiers, and only the scored methods carry numbers

**Decided 2026-09-16**, accepting the plan-02 scope reduction D-19 offered.

**First, a correction.** D-19 proposed cutting the corpus "from ~70 to the ~25 named in the
curriculum". That figure was wrong. PRD §7 names **35** distinct methods across M5–M13, and the
harvested derivations quote numbers from roughly seven more (FREQ, HiLo, PSGTR, the ECCV 2024
mask-pairing correction, LLM4SGG, R1-SGG, FlowSG). The curriculum-named set is about 42, not 25,
so "cut to the curriculum" saves far less than it sounds.

**The cost is numbers, not cards.** NFR-2 requires every quantitative claim to carry `source`,
`source_table`, `constraint`, `protocol` and `verified` — which means opening the paper and
reading the figure off the named table. A card with no `reported` entries costs minutes; a card
with six verified numbers costs an hour. Roughly 200 numbers across 70 cards is what makes plan
02 a fourteen-day plan.

**Decision.** The corpus keeps **35 cards** — every method the curriculum names — in two tiers:

| Tier | Count | Carries | Chosen for |
|---|---|---|---|
| **A — scored** | ~12 | Full `reported` arrays, every number verified against its named table | The methods the labs, the leaderboards and the derivations actually quote: IMP, Neural Motifs (with FREQ), VCTree, MOTIFS-TDE, RelTR, EGTR, SGTR, PSGFormer, PSGTR, HiLo, STTran, IndVisSGG |
| **B — lineage** | ~23 | Venue, year, DOI or arXiv, core idea, predecessor, and the defect it fixes. **`reported: []`** | Everything else the curriculum names |

**Why this is the right cut.** PRD §4's G3 asks a student to place any paper on the taxonomy and
name both its predecessor and the specific defect it fixes. A tier-B card does that completely. It
is G1, G2 and G4 — computing the metrics, running the frequency baseline, predicting the
ablations — that need numbers, and those live on the twelve tier-A methods.

**Enforcement.** `system/tools/test/papers.test.mjs` keeps the existing assertion that every
curriculum-named method has a card, and gains two: a tier-A card must carry at least one
`reported` entry, and every `reported` entry in either tier must be `verified: true` with a
`source_table`. **There is no unverified tier.** A number we have not checked does not get carried
at all, which is a stronger position than rendering it in a distinct style and hoping.

**Effect on the estimate.** Roughly 200 verified numbers fall to roughly 70. Plan 02 drops from
14 days to **10**, and the project total from 36 remaining to **32**.

**Reversible.** Promoting a tier-B card is additive: fill its `reported` array and the test
starts enforcing it. Nothing has to be restructured, which is why the tier is a property of the
data rather than a separate file.

---

## What is now closed

| Review finding | Closed by |
|---|---|
| B1 data acquisition unspecified | D-08 (author downloads; class gets a bundle), D-09, D-10 |
| B2 precomputed predictions unresolved | D-06, D-07 |
| B3 `system/web/knowledge-map` unreconciled | D-13, D-14 |
| B4 no CI exists | D-15, D-16 |
| No per-phase task breakdown | Plans 01–04 |
| API contracts stop at endpoint names | `…-contracts.md` §1 |
| Frontend architecture is a directory tree | `…-contracts.md` §2 |
| Content corpus has no schema | `…-contracts.md` §3 |
| Mini-ISG licence hole | D-18 |
| Stale repository path and environment table | D-01, D-02, D-04 |
| No effort estimates, no cut order | D-19 |
| Track undocumented in `CLAUDE.md` | D-20 |
| **New, found at re-probe:** Node 20.16.0 cannot run Vite 8 | D-03 |
| **New:** mask IoU had no implementation strategy | D-11, D-12 |
