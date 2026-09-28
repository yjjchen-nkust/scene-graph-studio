# SRS — Scene Graph Studio

**Status:** approved 2026-09-15
**Companion:** `2026-09-15-scene-graph-studio-PRD.md`

---

## 1. Scope

This document specifies the software that realizes the PRD. It covers architecture, the canonical data model, the evaluation engine, the API surface, the IndVisSGG replica, non-functional requirements, and the test strategy.

The evaluation engine is the component on which everything else depends. It is specified first in detail and built first, under a hard test-driven mandate, because a silent error there teaches students something false.

## 2. Architecture

```
scene-graph-studio/
├── frontend/                  Vite + React 19 + TypeScript + Tailwind v4
│   ├── src/shells/            study/ | lecture/     one content base, two shells
│   ├── src/labs/              L1..L8, one directory each
│   ├── src/graph/             Cytoscape wrapper, SVG image overlay, four-colour diff
│   ├── src/metrics/           R@K, mR@K, ng-R@K, zR@K   mirrors the backend engine
│   ├── src/i18n/              zh-TW.json | en.json | useLocale()
│   └── src/content/           modules as MDX with typed frontmatter
├── backend/                   FastAPI + Pydantic v2
│   ├── app/eval/              the reference evaluation engine (authoritative)
│   ├── app/infer/             reltr_cpu.py | cached.py | registry.py
│   ├── app/vlm/               indvissgg.py — three steps, N experts, TEC
│   ├── app/datasets/          slice loaders, schema validation
│   └── app/api/               routers
├── data/
│   ├── slices/                ~200 curated images with annotations (committed)
│   ├── predictions/           precomputed model outputs (committed)
│   ├── mini-isg/              the hand-corrected industrial teaching set
│   └── content/               field-map cards, leaderboard tables (JSON)
└── docs/superpowers/specs/    PRD, SRS, design
```

### 2.1 Dependency choices

**Frontend.** Cytoscape.js 3.34.2 for graph rendering — graph-theory-native selectors, MIT, actively maintained. cytoscape-dagre 4.0.1 for layered layout. D3 7.9.0 for charts and scroll-driven transitions. KaTeX for the metric definitions. ts-fsrs 5.4.2 for spaced repetition.

Rejected, with reasons: G6 carries roughly three times the weight for no gain here; React Flow requires a hand-written `jsxRuntime` shim and pins React to 18; ELK.js costs 467 KB gzipped for layout quality this application does not need; vis-network carries a large open-issue backlog.

**Image overlay is hand-rolled SVG with no library.** One `<img>` plus an absolutely positioned `<svg viewBox="0 0 imgW imgH" preserveAspectRatio="xMidYMid meet">`. Boxes are `<rect>`, masks are `<path>`, graph edges are `<path>` between box centroids. Every element is a real DOM node, which yields hit-testing, CSS hover states, and accessibility for free, and keeps the overlay inspectable in developer tools. The approach degrades past roughly two thousand elements, which is irrelevant for a single image carrying at most fifty objects. Konva is added only if alpha-blended panoptic mask compositing proves necessary.

**Backend.** FastAPI with Pydantic v2 models on every boundary. `torch` is an optional import; its absence disables live inference and nothing else.

## 3. Canonical data model

Deliberately compatible with the Visual Genome Python driver (`Image` / `Object` / `Relationship` / `Attribute` / `Graph`) so that graphs exported from the app interoperate with the standard ecosystem.

```typescript
type BBox = { x: number; y: number; w: number; h: number };   // image pixels, top-left origin

interface SGObject {
  object_id: number;
  names: string[];              // VG permits synonyms; VG150 collapses to one
  bbox: BBox;
  mask?: { counts: string; size: [number, number] };   // COCO RLE, PSG only
  attributes?: string[];
  synsets?: string[];           // WordNet, from the VG lineage
}

interface SGRelationship {
  relationship_id: number;
  subject_id: number;
  object_id: number;
  predicate: string;
  score?: number;               // absent on ground truth, present on predictions
}

interface SceneGraph {
  image_id: string;
  dataset: 'vrd' | 'vg150' | 'psg' | 'indoorvg' | 'haystack' | 'mini-isg';
  width: number;
  height: number;
  objects: SGObject[];
  relationships: SGRelationship[];
  provenance: {
    kind: 'ground_truth' | 'model' | 'vlm' | 'user';
    model?: string;             // 'reltr' | 'motifs' | 'psgformer' | 'egtr'
    vlm?: string;               // model identifier, when kind is 'vlm'
    generated_at?: string;      // ISO 8601
  };
}
```

**Invariant.** `subject_id` and `object_id` must reference objects present in the same graph. This is validated on load and at every API boundary. A violation returns 422; it is never silently dropped.

## 4. The evaluation engine

Authority: *A Review and Efficient Implementation of Scene Graph Generation Metrics* (arXiv 2404.09616) and `Scene-Graph-Benchmark.pytorch/METRICS.md`.

The engine is implemented twice — in Python, which is authoritative, and in TypeScript, for instant feedback in the browser — and the two are held identical by a shared golden-vector fixture. If they disagree on any fixture, continuous integration fails.

### 4.1 Triplet matching

A predicted triplet ⟨subject, predicate, object⟩ matches a ground-truth triplet if and only if all of the following hold:

1. The subject class matches.
2. The object class matches.
3. The predicate matches.
4. IoU between the subject boxes is at least the threshold.
5. IoU between the object boxes is at least the threshold.

For mask-based datasets, mask IoU substitutes for box IoU.

The threshold defaults to 0.5. That value is field convention inherited from Xu et al. and Neural Motifs; it is **not stated in `METRICS.md`**. The interface therefore exposes it as a labelled, adjustable parameter rather than concealing it as folklore.

### 4.2 Assignment

Greedy one-to-one assignment over the prediction list sorted by descending score. Each ground-truth triplet may be credited at most once. The matching order is part of this specification because it is observable in the diff view.

### 4.3 Metrics

- **R@K** — take the top K predictions by score; report matched ground truth over total ground truth. K ranges over {20, 50, 100}.
- **mR@K** — compute R@K independently for each predicate class, then average without weighting over the classes present in the ground truth of that split.
- **ng-R@K** — no graph constraint: every predicate for each subject-object pair enters the ranking, not only the highest-scoring one.
- **zR@K** — restrict ground truth to subject-predicate-object combinations absent from the training split. [**Amended 2026-09-28 (D105):** a training split that is not supplied, or is supplied empty, leaves zR@K undefined: the value is null and the response carries `zero_shot_unavailable`. Read literally, this definition would count every triplet as absent from an empty split and give zR@K = R@K; the author ruled that an empty split is no split. Golden vector gv-021 pins it.]

### 4.4 Protocols

- **PredCls** — ground-truth boxes and ground-truth labels are supplied; predict predicates only.
- **SGCls** — ground-truth boxes are supplied; predict labels and predicates.
- **SGDet** — predict everything.

Every response carries an explicit warning field restating that PredCls and SGCls supply ground-truth **boxes, not ground-truth pairs**. This is the most common misreading in the field and is a designed quiz item.

### 4.5 Constraint modes

`graph` — at most one predicate per ordered subject-object pair. `none` — the no-constraint variant. `semi` — the Action Genome semi-constraint mode.

[**Corrected 2026-09-27 (D99):** `graph` keeps one predicate per ordered object pair, as Tang's evaluator keys it on predicted object indices (`sgg_eval.py`, commit fca9860, line 66); the engine had keyed it on class pairs. `semi` keeps at most `semi_constraint_max_per_pair` predicates per ordered object pair and is not the Semi Constraint STTran proposed for Action Genome (Cong et al. 2021, arXiv 2107.12309, section 3), which STTran implements as one attention predicate plus every spatial or contacting predicate above 0.9 (`lib/evaluation_recall.py`, commit bcc72cf) and which this application does not implement.]

Every returned number is tagged with its mode. The interface refuses to render an untagged number.

### 4.6 Panoptic mask-pairing modes

`multi_mpo` reproduces the original PSG protocol, which permitted duplicate masks and multiple predicate distributions per pair. `single_mpo` reproduces the corrected protocol. Lab L6 runs both over identical predictions and diffs the results.

## 5. API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/datasets` | Available slices with counts and licence |
| `GET` | `/api/datasets/{ds}/images/{id}` | Ground-truth `SceneGraph` for one image |
| `POST` | `/api/eval` | `{gt, pred, protocol, constraint, k[], iou_thresh, mask_pairing}` returns tagged metrics plus per-triplet verdicts driving the four-colour diff |
| `GET` | `/api/models` | Registry: identifier, family, and whether live inference is available on this machine |
| `POST` | `/api/infer/{model}` | Live inference. RelTR only; anything else returns 503 with a stated reason |
| `GET` | `/api/predictions/{ds}/{model}/{image_id}` | Precomputed predictions |
| `POST` | `/api/vlm/indvissgg` | `{image, O, P, E, n_experts, steps}` returns per-step and per-expert output plus the summarized graph |
| `GET` | `/api/content/modules`, `/api/content/papers`, `/api/content/leaderboards` | The bilingual content corpus |
| `GET` | `/api/health` | Reports torch presence, device, and which models are live-capable |

Every metric value in a response is shaped `{value, k, protocol, constraint, source, verified}`.

## 6. The IndVisSGG replica

Faithful to sections 3.1 through 3.3 and Figure 2 of the anchor paper.

**Step 1 — extract spatial-temporal triplets.** Without criteria, `out_trpl = VLM(V_t, Prompt)`. With the Triplets Extraction Criteria supplied, `out^{s1}_t = VLM(V_t, O, P, E, Prompt)`, where *O* is the predefined object set, *P* the predefined predicate set, and *E* a set of positive and negative examples each carrying an analysis.

**Step 2 — triple-check across temporal domains.** N experts run in parallel. Each computes `(out^{s2}_t, a_i) = VLM(V_t, O, P, E, Prompt, out^{s1}_t)`, returning a revised triplet set and an analysis. The three corrections named in the paper ship as canned cases: deleting a hallucinated `wrench`; recovering missing `terminals`, `beam`, and `panel`; and rewriting an imprecise `taping` to the criteria-legal `knocking on`.

**Step 3 — summarize.** `out^{s3}_t = VLM(out^{s2}_t, α, Prompt)` over the set `{out^{s2}_t, a_i : i ∈ 1..N}`.

**Student controls.** Edit *O*, *P*, and *E*. Set N to 1, 2, 3, or 5. Ablate each of *O*, *P*, and examples-with-analysis independently.

**Published ablations ship as committed data**, marked clearly as the authors' reported numbers: Table 3 shows R@20 rising from 0.032 to 23.040 as components are added; Table 4 shows three experts to be optimal at R@20 23.158 and mR@20 16.947. Whatever the student's own run produces is displayed alongside and is never conflated with the published figures.

**The VLM provider is configured, not hard-coded.** A `VLMProvider` protocol has an offline transcript player as its default implementation, so L5 works with no API key and no network. Live providers are opt-in through `.env`. The paper used GPT-4V and Gemini-Pro-Vision; both are superseded, and the interface says so.

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Offline-complete.** Every P0 feature works with the network down and `torch` absent. Live inference and the live VLM path are the only degradable features; they degrade with a visible reason, never a stack trace. |
| NFR-2 | **Honest numbers.** Every figure carries a source and a verified flag. Unverified figures render in a distinct style with a tooltip explaining why. No number appears without its constraint mode and protocol. |
| NFR-3 | **Two implementations, one truth.** The Python and TypeScript engines agree on every golden vector, enforced in continuous integration. |
| NFR-4 | **Determinism.** Identical input to `/api/eval` yields identical output, including tie-break order. |
| NFR-5 | **Projector-legible.** Lecture mode uses at least 24 px base type and contrast of at least 7:1. The diff palette is colour-blind-safe: green and red are distinguished by shape and dash pattern as well as hue. |
| NFR-6 | **Bilingual parity.** Continuous integration fails if a key exists in one locale and not the other. |
| NFR-7 | **Licence hygiene.** Every bundled asset carries its licence. CC BY-NC material such as EPIC-KITCHENS is never redistributed. Visual Genome and Open Images annotations, both CC BY 4.0, are the preferred demo assets. |
| NFR-8 | **Responsiveness.** Cold start under ten seconds; lab interaction under 100 ms; live RelTR inference displays a measured estimate before it begins. |
| NFR-9 | **Mathematics is rendered, not described.** Every metric, invariant, and equation appears as typeset mathematics from LaTeX source, never as prose or ASCII. Each symbol is defined before its first use. Each formal statement is preceded by an intuition and followed by a worked numeric example. Complexity, invariants, and proof obligations are stated explicitly where they exist. |

## 8. Test strategy

**Golden vectors for the evaluation engine.** Hand-computed R@K, mR@K, ng-R@K, and zR@K on small synthetic graphs whose answers are checkable on paper, plus the edge cases: empty ground truth, empty prediction, all-tied scores, duplicate predictions, IoU exactly at the threshold, and a predicate class holding exactly one ground-truth instance — the mean-Recall denominator trap.

**Cross-implementation test.** The TypeScript engine runs the same fixtures under Vitest; continuous integration diffs the two outputs.

**Schema round-trip.** Every committed slice validates against `SceneGraph`. Export followed by import is lossless.

**Content lint.** Every quantitative claim in `content/` carries a source and a verified field. Every i18n key exists in both locales.

**Lecture-mode smoke test.** Playwright drives M0 through M14 by keyboard alone.

Test-driven development applies without exception to the evaluation engine and its TypeScript mirror.

## 9. Data tiers

**Tier 1, bundled as curated slices of roughly 200 images total.** VRD (5,000 images, 100 object classes, 70 predicates, 37,993 relations; 1,877 test-only triplets form the standard zero-shot benchmark). VG150 (150 object classes, 50 predicates; CC BY 4.0). PSG (48,749 images, 133 object classes, 56 predicates; MIT). IndoorVG (84 object classes, 37 predicates). Haystack (evaluation-only, and the only dataset carrying explicit negative annotations, which makes precision-style metrics possible).

**Tier 2, reference cards only.** GQA, VrR-VG, Open Images V6 SGG — which uses a different metric family entirely, wmAP_rel and wmAP_phr and score_wtd — SpatialSense, UnRel, STAR, ReCon1M.

**Tier 3, lesson content only.** Action Genome, VidOR, PVSG, 3DSSG, 4D-OR, MM-OR.

**The industrial context that motivates the anchor paper.** CHICO ships pose and cobot trajectories with no object or relation labels. Ego4D is licence-gated. EPIC-KITCHENS-100 is CC BY-NC and 740 GB. HA-ViD, IKEA ASM, and CALVIN ship no relation labels either. No industrial dataset carried scene-graph labels, which is precisely why ISG had to be built.

## 10. Known field hazards the software must encode

These are not footnotes; each is surfaced in the interface at the point where it would otherwise mislead.

1. "VG150" names three incompatible splits. *(Annotated 2026-09-26: not supported as worded. The releases differ in the validation carve-out and in filtering, and one published release drew its validation set from the test pool; see `specs/2026-09-26-playgrounds-m1-design.md` §2 and D93.)*
2. Graph-constraint versus no-constraint swings Recall by ten to twenty points.
3. VRD Recall depends on an undeclared *k*, the number of predicates permitted per pair.
4. Missing annotations are scored as false positives in VG, VRD, and VidVRD.
5. Predicate synonymy has no hierarchy: VG150 treats `on`, `above`, `over`, `laying on`, `sitting on`, and `standing on` as distinct classes.
6. PredCls and SGCls supply ground-truth boxes, not ground-truth pairs.
7. Class counts disagree across papers: Action Genome 25 versus 26 predicates; 3DSSG 26 versus 27; Open Images 288 versus 301 objects.
8. "OpenPSG" names both an ECCV 2022 codebase and an unrelated ECCV 2024 open-set method. "ISG" names both the anchor paper's dataset and an unrelated Hugging Face benchmark.
9. The `maelic/PSG-coco-format` export on Hugging Face is boxes-only and cannot train a panoptic model.


## 11. Mathematical presentation

### 11.1 Requirement

The metrics are the part of this subject most often taught wrongly, and prose definitions are how that happens — Lorenz et al. (CVPRW 2024) showed that published SGG implementations disagree precisely because the field circulated verbal definitions rather than formal ones. The application therefore treats mathematics as a first-class content type.

Every metric, protocol constraint, and equation is authored in LaTeX and rendered as typeset mathematics. No metric is ever presented only in words or in ASCII approximation.

### 11.2 Presentation contract

Each mathematical object in the content corpus follows a fixed four-part shape, matching the order in which the professor teaches:

1. **Intuition** — one or two sentences in plain language saying what the quantity measures and why anyone would want it.
2. **Formal statement** — the typeset definition, with every symbol already defined in the module's symbol table.
3. **Worked example** — the same definition evaluated on concrete numbers from a dataset slice the student can open, with the arithmetic shown.
4. **Implications** — what the definition permits, forbids, or hides; where it is gamed; what invariant it induces.

Complexity, invariants, and proof obligations are stated wherever they exist. Two carry through the whole application and are asserted in the test suite:

- The protocol ordering invariant, which holds for any model and any fixture. [**Superseded 2026-09-27 (D98):** what the protocols force is the inclusion of their hypothesis spaces, given boxes and labels inside what the next protocol allows; the recall ordering is observed in published tables, not implied, and the suite asserts it on L2's fixture only.]
- The greedy-assignment assumption — that score-ordered greedy matching attains the maximum bipartite matching — which is an assumption rather than a theorem, and is discharged on adversarial fixtures rather than asserted.

### 11.3 Rendering

**In the application** (a local repo, no content security policy): KaTeX, loaded from npm with its stylesheet and fonts bundled. Content is authored in MDX with `$…$` and `$$…$$` delimiters and rendered at build time by `remark-math` plus `rehype-katex`, so no client-side typesetting cost is paid at lecture time.

**In any published artifact** (strict content security policy): MathJax 3 with **SVG output**, `tex-svg.js` from cdnjs. This is the only viable choice there — the policy admits external stylesheets solely from the Google Fonts host, which blocks KaTeX's stylesheet and its WOFF2 files, whereas MathJax's SVG output carries its glyph outlines inside the JavaScript bundle and fetches nothing. Typeset output inherits `currentColor`, so it themes correctly without extra work.

### 11.4 Symbol table

Every module that introduces notation carries a symbol table rendered before the first formula, bilingual in its gloss and identical in its notation. Notation is global across modules: a symbol means the same thing in M4 as in M11, and the content lint rejects a module that redefines one.
