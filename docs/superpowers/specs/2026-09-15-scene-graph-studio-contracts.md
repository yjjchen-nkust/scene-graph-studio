# Contracts — Scene Graph Studio

**Status:** resolved 2026-09-15
**Companions:** `2026-09-15-scene-graph-studio-SRS.md` (what), this document (exactly what), `2026-09-15-scene-graph-studio-decisions.md` (why)

SRS §5 lists nine endpoints by path and purpose. This document gives their request and response bodies, the error model, the frontend architecture the SRS left as a directory tree, and the content frontmatter schema the SRS required but did not define. Implementation tasks in plans 01–04 reference this document by section; where a plan and this document disagree, this document governs.

Everything here is normative. Field names, types and enum spellings are exact.

---

## 1. API surface

### 1.0 Conventions

**Base.** `http://127.0.0.1:8000`, mounted under `/api`. The frontend dev server proxies `/api` to it; there is no CORS configuration in production because there is no production — every deployment is localhost.

**Casing.** `snake_case` in JSON on the wire, both directions. The TypeScript client converts nothing; its interfaces use `snake_case` too. Two casing conventions across a boundary is a class of bug this project has no budget for.

**Every numeric metric on the wire is a `MetricValue`,** never a bare number:

```typescript
interface MetricValue {
  value: number | null;          // null means "not applicable to this request", never 0
  metric: 'R' | 'mR' | 'ngR' | 'zR';
  k: 20 | 50 | 100;
  protocol: 'predcls' | 'sgcls' | 'sgdet';
  constraint: 'graph' | 'none' | 'semi';
  source: string;                // 'engine' for computed, else a citation key into papers.json
  verified: boolean;
  fidelity: 'measured' | 'reconstructed' | 'published';
}
```

SRS §4.5 says the interface refuses to render an untagged number. That refusal is enforced by the type: the renderer accepts `MetricValue` and there is no code path that formats a bare `number` as a metric. A `null` value renders as `—` with the reason in its tooltip.

**Enum spellings are lowercase throughout:** `predcls`, `sgcls`, `sgdet`; `graph`, `none`, `semi`; `single_mpo`, `multi_mpo`; `ground_truth`, `model`, `vlm`, `user`; `measured`, `reconstructed`, `published`.

### 1.1 Error model

One shape for every non-2xx response:

```typescript
interface ApiError {
  error: {
    code: string;        // stable, machine-readable; see the table
    message_en: string;  // one sentence, shown to the user
    message_zh: string;  // the same sentence in 繁體中文
    detail?: unknown;    // structured context; never a stack trace
  };
}
```

| Status | `code` | Raised when |
|---|---|---|
| 400 | `bad_request` | Malformed body that Pydantic did not catch |
| 404 | `not_found` | Unknown dataset, image, model, or module identifier |
| 422 | `dangling_reference` | A relationship names a `subject_id` or `object_id` absent from `objects`. SRS §3's invariant. `detail` lists every offending `relationship_id`. |
| 422 | `schema_invalid` | Pydantic validation failure. `detail` carries Pydantic's error list. |
| 422 | `slice_images_missing` | The annotations exist but the image file is absent. `detail` names the slice bundle to unpack and the `verify_bundle.py` command. |
| 503 | `inference_unavailable` | Live inference requested for a model that cannot run here. `detail` carries `{model, reason, torch_present, checkpoint_present}`. |
| 503 | `vlm_unavailable` | Live VLM requested with no provider configured. `detail` names the `.env` key. |

NFR-1 requires degradation with a visible reason and never a stack trace. A FastAPI exception handler converts every unhandled exception to `500 internal_error` with a fixed bilingual message and logs the traceback server-side only.

### 1.2 `GET /api/health`

No parameters.

```typescript
interface HealthResponse {
  status: 'ok';
  version: string;              // package version
  torch_present: boolean;
  torch_version: string | null; // e.g. '2.11.0+cpu'
  cuda_available: boolean;
  device: 'cpu' | 'cuda';
  live_models: string[];        // model ids that can run right now
  vlm_provider: 'transcript' | 'claude';
  slices_present: Record<string, boolean>;   // dataset id → images unpacked on disk
}
```

This endpoint is the first thing plan 01 builds and the first thing every later phase checks. It must answer in under 50 ms and must never import `torch` eagerly — it probes with `importlib.util.find_spec`.

### 1.3 `GET /api/datasets`

```typescript
interface DatasetsResponse {
  datasets: Array<{
    id: 'vrd' | 'vg150-sgb' | 'psg' | 'indoorvg' | 'haystack' | 'mini-isg';
    name_en: string;
    name_zh: string;
    image_count: number;
    object_class_count: number;
    predicate_class_count: number;
    has_masks: boolean;
    licence: string;            // SPDX identifier or a short phrase
    licence_url: string;
    licence_commit_cleared: boolean;      // D-08: may annotations be committed
    licence_bundle_cleared: boolean;      // D-08: may images be distributed to the class
    images_present: boolean;              // unpacked on this machine
    notes_en: string;
    notes_zh: string;
  }>;
}
```

### 1.4 `GET /api/datasets/{ds}/images`

The frames in a slice, in the order the annotations are committed in:

```typescript
interface SliceImages {
  dataset: string;
  image_count: number;
  images: Array<{
    image_id: string;
    width: number; height: number;
    object_count: number; relationship_count: number;
    present: boolean;            // the image file, not the annotation
  }>;
}
```

A slice that was never cut is `[]` and `200`, not `404` — "no frames" and "no such dataset" are different statements and the labs act on them differently. `present` is per frame because a partially unpacked bundle is the case a lab has to survive. Added in plan 04's lab-route work; DEVIATIONS D60.

### 1.4a `GET /api/datasets/{ds}/images/{image_id}`

Returns one `SceneGraph` with `provenance.kind === 'ground_truth'` and `provenance.fidelity === 'measured'`.

Query parameter `include_image=true` adds `image_data_url`, a base64 data URL, so a lab can render without a second request. Default `false`.

404 `not_found` for an unknown identifier; 422 `slice_images_missing` when the annotation exists but the file does not — the detail names the bundle, because that is the action the caller must take.

### 1.5 `POST /api/eval`

The endpoint the whole application depends on.

```typescript
interface EvalRequest {
  gt: SceneGraph;
  pred: SceneGraph;
  protocol: 'predcls' | 'sgcls' | 'sgdet';
  constraint: 'graph' | 'none' | 'semi';
  k: number[];                          // subset of [20, 50, 100]; default all three
  iou_thresh: number;                   // default 0.5; SRS §4.1 exposes it deliberately
  mask_pairing: 'single_mpo' | 'multi_mpo';   // ignored when neither graph carries masks
  zero_shot_train_triplets?: Array<[string, string, string]>;
                                        // ⟨subject class, predicate, object class⟩ seen in training.
                                        // Omitted → every zR MetricValue has value null.
  semi_constraint_max_per_pair?: number;      // required when constraint === 'semi'; default 2
}

interface EvalResponse {
  metrics: MetricValue[];               // one per (metric, k) the request asked for
  verdicts: Verdict[];                  // drives the four-colour diff, in prediction rank order
  matched_count: number;
  gt_count: number;
  pred_count_considered: number;        // after constraint filtering, before top-K
  per_predicate: Array<{
    predicate: string;
    gt_count: number;
    matched: Record<string, number>;    // k (as string) → matched count
  }>;
  warnings: Warning[];
  params_echo: EvalRequest;             // determinism aid; NFR-4
}

interface Verdict {
  pred_index: number;                   // index into pred.relationships as submitted
  gt_index: number | null;              // index into gt.relationships, when matched
  verdict: 'match' | 'spurious' | 'localization' | 'missed';
  iou_subject: number | null;
  iou_object: number | null;
  rank: number;                         // 1-based position in the score-sorted ranking
  entered_top_k: Record<string, boolean>;   // k (as string) → whether it was inside top-K
}

interface Warning {
  code: 'gt_boxes_not_pairs' | 'empty_ground_truth' | 'empty_prediction'
      | 'ties_broken_by_index' | 'masks_ignored' | 'zero_shot_unavailable';
  message_en: string;
  message_zh: string;
}
```

**`missed` verdicts** carry `pred_index: -1` and a valid `gt_index`. They are appended after the prediction-ordered entries so the diff can render grey-dashed edges for unmatched ground truth.

**The four verdicts map to the four colours** of PRD §6.2 exactly: `match` green, `spurious` red, `missed` grey-dashed, `localization` amber.

**`gt_boxes_not_pairs` is emitted on every `predcls` and `sgcls` response without exception.** SRS §4.4 names this the most common misreading in the field and requires the warning field; making it unconditional means a student cannot see a PredCls number without seeing it.

**`ties_broken_by_index` is emitted whenever two predictions share a score.** NFR-4 requires deterministic tie-breaks; the rule is `sorted(preds, key=lambda p: (-p.score, p.relationship_id))`, stable, and the warning says so in words.

### 1.6 `GET /api/models`

```typescript
interface ModelsResponse {
  models: Array<{
    id: string;                       // 'reltr' | 'egtr' | 'motifs' | 'vctree' | 'psgformer'
    name: string;
    family: 'two_stage' | 'one_stage' | 'panoptic' | 'vlm';
    year: number;
    venue: string;
    paper_key: string;                // into papers.json
    live: boolean;                    // can it run on this machine right now
    live_blocked_reason_en: string | null;
    live_blocked_reason_zh: string | null;
    estimated_seconds_per_image: number | null;   // NFR-8's measured estimate
    predictions_available: Array<{ dataset: string; fidelity: 'measured' | 'reconstructed' }>;
  }>;
}
```

### 1.7 `POST /api/infer/{model}`

```typescript
interface InferRequest {
  image_data_url?: string;      // exactly one of these two
  dataset?: string;             // with image_id, to infer on a slice image
  image_id?: string;
  max_triplets: number;         // default 100
}
```

Returns a `SceneGraph` with `provenance.kind === 'model'`, `fidelity: 'measured'`, `model` set, and `generated_at`. Any model other than `reltr` returns 503 `inference_unavailable` with the reason stated in both languages. `reltr` with `torch` absent returns the same 503.

### 1.8 `GET /api/predictions/{ds}/{model}/{image_id}`

Returns a committed `SceneGraph` whose `provenance.fidelity` is `measured` or `reconstructed`, with `note` populated in the latter case per D-07. 404 `not_found` when no prediction file exists for that triple.

### 1.9 `POST /api/vlm/indvissgg`

```typescript
interface IndVisSGGRequest {
  image_data_url?: string;
  dataset?: string;
  image_id?: string;
  O: string[];                  // predefined object set
  P: string[];                  // predefined predicate set
  E: Array<{ kind: 'positive' | 'negative'; triplet: [string, string, string]; analysis: string }>;
  n_experts: 1 | 2 | 3 | 5;
  steps: Array<1 | 2 | 3>;      // which of the three steps to run
  ablate: Array<'O' | 'P' | 'E'>;   // components to withhold, for the Table 3 replay
  provider: 'transcript' | 'claude';
}

interface IndVisSGGResponse {
  step1: { graph: SceneGraph; prompt_shown: string };
  step2: Array<{ expert_index: number; graph: SceneGraph; analysis_en: string; analysis_zh: string }>;
  step3: { graph: SceneGraph; prompt_shown: string };
  provider_used: 'transcript' | 'claude';
  published_reference: {
    table3: Array<{ components: string; r_at_20: number }>;
    table4: Array<{ n_experts: number; r_at_20: number; mr_at_20: number }>;
    note_en: string;            // "the authors' reported numbers; not this run"
    note_zh: string;
  };
}
```

`published_reference` is returned on every call and carries `fidelity: 'published'` semantics by construction. SRS §6 requires the student's own run and the authors' numbers to be displayed together and never conflated; returning them in separate, differently-named fields is how the API makes conflation awkward rather than merely discouraged.

`prompt_shown` returns the exact prompt the step used. The lab renders it. A student who cannot see the prompt cannot evaluate the method.

### 1.10 `GET /api/content/{modules|papers|leaderboards|kp}` — **superseded, never implemented**

**This endpoint does not exist and should not be built.** The frontend imports `data/content/*.json` directly, at build time, so the corpus is in the bundle rather than behind a request. Discovered in the plan-04 consistency review; the reasoning is DEVIATIONS D72.

It is the better answer under NFR-1 — a module that renders its own knowledge points with the backend stopped is offline-complete in a way a fetch never is — and it is the reason nobody noticed for three plans. The paragraph is kept rather than deleted because a reader who finds `/api/content/` referenced elsewhere needs to know it was considered, replaced, and why.

What the endpoint said is still true of the corpus: it is a few hundred kilobytes, it is served whole, `kp` is the harvested knowledge-point inventory of D-13, and every record carries `source` and `verified`, enforced by `system/tools/content_lint.mjs`.

### 1.11 Static images

`GET /images/{ds}/{image_id}` serves slice images from `data/slices/{ds}/images/` via FastAPI `StaticFiles`. It is deliberately outside `/api`. 422 `slice_images_missing` is impossible here — a missing file is a plain 404 — so the frontend probes `/api/health`'s `slices_present` before offering a dataset.

Those directories are git-ignored (D-08). They are populated either by `make_placeholders.py`, which every clone can run, or by unpacking the slice bundle the course distributes. A clone that has done neither still runs every lab on the committed `placeholder` slice.

---

## 2. Frontend architecture

### 2.1 Workspace layout

npm workspaces, so the TypeScript metric engine is a real package that both the app and the parity harness import.

```
scene-graph-studio/system/
├── package.json                  workspace root; holds the `ci` script of D-15
├── packages/
│   └── sgg-metrics/              the TypeScript engine — no DOM, no React, no fetch
│       ├── src/types.ts          SceneGraph, MetricValue, Verdict — the wire types
│       ├── src/iou.ts            box IoU
│       ├── src/rle.ts            COCO RLE decode + mask IoU (D-12)
│       ├── src/match.ts          the match relation and greedy assignment
│       ├── src/constraint.ts     graph / none / semi filtering
│       ├── src/metrics.ts        R, mR, ngR, zR
│       └── src/index.ts          evaluate(request): EvalResponse
├── frontend/                     Vite 8 + React 19 + TypeScript + Tailwind 4
└── backend/                      FastAPI + Pydantic v2
```

`sgg-metrics` depends on nothing. That is what makes it testable against the golden vectors in isolation and reusable by `system/tools/parity.mjs`.

### 2.2 Routing

`react-router` in data-router mode. Routes are the persistence layer for anything shareable:

| Route | Renders |
|---|---|
| `/` | Module index, resume affordance |
| `/m/:moduleId` | A module in the study shell |
| `/lecture/m/:moduleId/:stepIndex` | The same module in the lecture shell, one step per URL |
| `/lecture/notes` | The presenter window; opened by the lecture shell, driven by `BroadcastChannel` |
| `/lab/:labId` | L1 … L8 standalone |
| `/map` | Field map and paper cards |
| `/leaderboards` | Frozen per-paper tables |

**Lab state lives in the URL query string, not in a store.** `/lab/L2?ds=vg150-sgb&img=2317469&k=50&protocol=sgdet&constraint=none&tau=0.5` fully determines what L2 shows. The professor can bookmark a configuration mid-lecture, and a student can paste one into a question. This is also how the Playwright lecture smoke test navigates deterministically.

### 2.3 State

Three tiers, chosen so that no tier does another's job:

1. **URL** — lab parameters, module position, language. Anything a person might want to send someone else.
2. **TanStack Query** — everything from `/api/*`. The corpora are immutable for a session, so `staleTime: Infinity` and no refetch. This is the whole of the server-state story; there is no Redux, no Zustand, no context-based cache.
3. **`localStorage` behind one typed module** (`src/store/persist.ts`) — progress, quiz history, FSRS schedule, language preference. Every read is wrapped in `try`/`catch` and returns a typed default, because a student in a private window must still get a working application.

`localStorage` keys are namespaced `sgs:` and versioned: `sgs:v1:progress`, `sgs:v1:fsrs`, `sgs:v1:lang`. A version bump discards rather than migrates, and says so once in the interface.

### 2.4 The two shells

One content base, two shells, per PRD §6.1. A module is a component tree; a shell is a layout plus a step policy.

```typescript
interface ModuleStep {
  id: string;
  kind: 'prose' | 'math' | 'figure' | 'lab' | 'checkpoint' | 'playground';
  node: React.ReactNode;
  kp?: string;                  // required when kind is 'playground'
  presenter_notes_en?: string;
  presenter_notes_zh?: string;
  seconds_budget?: number;      // lecture timing
}
```

The MDX compiler emits `ModuleStep[]`. The **study shell** renders every step in one scrolling column with normal type. The **lecture shell** renders one step at a time at ≥ 24 px base type, advances on `ArrowRight` / `Space`, retreats on `ArrowLeft`, and posts `{moduleId, stepIndex, remainingSeconds}` on a `BroadcastChannel` named `sgs-presenter` that `/lecture/notes` subscribes to.

**Space is two keys in one.** It means "next" to the deck and "activate" to whatever has focus, so the shell yields it to a focused button, link, `summary` or activatable input, and yields every key to a focused text field or `contenteditable` region. An arrow means nothing to a button and stays the deck's.

**Presenter notes live one locale per file.** A module is `mNN.zh-TW.mdx` and `mNN.en.mdx`; the first may declare `presenter_notes_zh` on a step and the second `presenter_notes_en`, and neither may declare the other's. Exactly one of the two fields is therefore ever populated on a step returned by `getModule(id, locale)`, and the window reads the one matching the locale it is displaying — there is no fallback, per §2.7. `content_lint.mjs` refuses a file carrying the other locale's field, an empty note, and — the one that matters — the two locales disagreeing on *which* steps carry notes. The fields were optional and mostly absent when this was written; as of 2026-09-20 all 95 steps carry them in both locales and `content_lint.mjs` refuses a step without them (D76). The window still states that a step has no notes rather than rendering an empty pane, which is what a module authored from here on gets before its notes are written. See DEVIATIONS D56 and D76.

The position message shape is fixed. The presenter window therefore cannot know when the lecture began and times its own session instead, labelled as such.

**A step may be a playground.** `kind: playground` with `kp: <knowledge point id>`, and its body carries exactly one `<Playground kp="…"/>` naming the same point. `Playground` is supplied through the MDX `components` prop, as `Step` is, so no module imports it. A playground computes a count, a bound or a set membership that its own knowledge point's definition contains, and never a metric; a metric belongs to a lab. `content_lint.mjs` enforces eleven rules over the step, its body and the golden file (rule 9 amended on 2026-09-26: a case carries `image_id` or a `scope`), and a twelfth over `data/content/vg150_splits.json`, enumerated in `docs/superpowers/specs/2026-09-19-playgrounds-design.md` §2.4 and exercised by `system/tools/test/content_lint.test.mjs`.

**The channel carries one other message, in the other direction: `{kind: 'hello'}`, posted once by `/lecture/notes` when it mounts.** A running shell answers it with the position message above; if no shell is running, nothing answers and the window keeps its waiting pane. The two are told apart by `kind`, which the position message does not carry, so the fixed shape above is unchanged. This is a query and not a command: the presenter window still cannot drive the deck, which is the property that matters. It exists because `BroadcastChannel` retains nothing — the shell posts on entering a step and on each tick of the section clock, and a step with no `seconds_budget` has no clock, so a window opened after such a step was entered heard nothing at all. Every module opens on a step with no budget. See DEVIATIONS D86.

Neither shell knows what a lab is. A lab step is a `ReactNode` the module supplied; the shells differ in layout and keyboard policy only. This is what keeps "one content base" true rather than aspirational.

### 2.5 The MDX pipeline

Vite plugin chain, fixed: `@mdx-js/rollup` → `remark-frontmatter` → `remark-mdx-frontmatter` → `remark-math` → `rehype-katex`.

KaTeX renders **at build time**, per SRS §11.3, so lecture mode pays no typesetting cost. KaTeX's stylesheet and WOFF2 fonts are imported from npm and bundled; nothing is fetched at run time, which is what NFR-1 requires.

Each module is two files — `src/content/m04.zh-TW.mdx` and `src/content/m04.en.mdx` — sharing one frontmatter schema (§3.1). A build-time check fails if the two files' `steps` arrays differ in length or in step `id`s, which is what makes the shells' step indices language-independent.

**MathJax appears nowhere in the application.** SRS §11.3 reserves it for published artifacts under a strict content security policy; the frozen `system/web/knowledge-map` page is the only thing in this repository that uses it, and it keeps using it.

### 2.6 The graph and overlay components

```typescript
// src/graph/SceneGraphView.tsx
interface SceneGraphViewProps {
  graph: SceneGraph;
  verdicts?: Verdict[];          // present → four-colour diff mode
  layout: 'dagre' | 'preset';    // 'preset' pins nodes at box centroids over the image
  onEdgeClick?: (relationshipId: number) => void;
  onNodeClick?: (objectId: number) => void;
}

// src/graph/ImageOverlay.tsx
interface ImageOverlayProps {
  imageUrl: string;
  width: number; height: number;    // intrinsic pixels; the viewBox
  objects: SGObject[];
  relationships?: SGRelationship[];
  verdicts?: Verdict[];
  mode: 'view' | 'draw';            // 'draw' → drag to create a box, L1 and L8
  onBoxDrawn?: (bbox: BBox) => void;
  selection?: { subject?: number; object?: number };
  onSelect?: (objectId: number) => void;
}
```

The overlay is hand-rolled SVG per SRS §2.1: one `<img>` and one absolutely positioned `<svg viewBox="0 0 width height" preserveAspectRatio="xMidYMid meet">`. Boxes are `<rect>`, masks are `<path>`, edges are `<path>` between box centroids.

**The diff palette, fixed and colour-blind-safe per NFR-5** — hue is never the only channel:

| Verdict | Stroke | Dash | Marker |
|---|---|---|---|
| `match` | `#1b7f4b` | solid | filled arrowhead |
| `spurious` | `#b42318` | solid | open arrowhead, doubled stroke width |
| `missed` | `#667085` | `6 4` | open arrowhead |
| `localization` | `#b54708` | `2 3` | filled arrowhead, hollow centre |

### 2.7 Internationalisation

`src/i18n/{zh-TW,en}.json`, flat keys, dotted namespaces (`lab.L2.title`). `useLocale()` returns `{ locale, t, setLocale }`. The default is `zh-TW`, per the repository working-language rule.

**No fallback.** A missing key renders as `⟦key⟧` in development and fails `lint:i18n` in CI, which is how NFR-6 is enforced. Silent fallback to English would let a half-translated build ship, which PRD §8 forbids.

Technical terms stay in English inside Chinese strings — `scene graph`, `predicate`, `Recall@K` — per PRD §6.1. The lint checks key parity, not content; term consistency is a review item in plan 04.

---

## 3. Content schema

### 3.1 Module frontmatter

```yaml
---
id: m04                                  # m00 … m14
order: 4
title_en: "Metrics: R@K, mR@K, ng-R@K, zR@K"
title_zh: "評測指標：R@K、mR@K、ng-R@K、zR@K"
anchor_labs: [L2, L3]
knowledge_points: [E3, E5, E6, E7, E8, E11]   # keys into kp.json, from the harvest
symbols:                                  # SRS §11.4; rendered before the first formula
  - sym: "K"
    gloss_en: "rank cutoff"
    gloss_zh: "排序截斷位置"
  - sym: "\\mathcal{P}"
    gloss_en: "predicate class set"
    gloss_zh: "predicate 類別集合"
claims:                                   # every quantitative claim in the body
  - id: c-m04-freq
    text_en: "FREQ reaches mR@100 = 16.0 on VG150 PredCls, above MOTIFS at 15.3"
    source: "neural-motifs-2018"          # a key into papers.json
    source_table: "Table 1"
    constraint: graph
    protocol: predcls
    verified: true
steps:                                    # the ModuleStep sequence; ids must match across locales
  - { id: s1, kind: prose }
  - { id: s2, kind: math, seconds_budget: 180 }
  - { id: s3, kind: lab, lab: L2, seconds_budget: 420 }
  - { id: s4, kind: checkpoint }
---
```

A step may also carry the presenter-notes field its own locale owns (§2.4). The flow form above cannot hold one — a note contains commas — so a step with notes is written in block form:

```yaml
steps:
  - id: s1
    kind: prose
    presenter_notes_en: "Put the three photographs up and say nothing."
  - id: s2
    kind: math
    seconds_budget: 180
```

**The four-part contract of SRS §11.2 is structural, not a convention.** A `math` step's MDX body must contain, in order, the components `<Intuition>`, `<Formal>`, `<Worked>`, `<Implications>`. `system/tools/content_lint.mjs` fails a `math` step missing any of the four. This is how the presentation contract survives contact with a deadline.

**Symbols are global.** `system/tools/content_lint.mjs` builds the union of every module's `symbols` and fails if two modules give the same `sym` different glosses, which is the redefinition SRS §11.4 forbids.

### 3.2 `papers.json`

```typescript
interface PaperCard {
  key: string;                    // 'neural-motifs-2018', stable, used as a citation key
  title: string;
  authors: string;
  venue: string;
  year: number;
  doi: string | null;
  arxiv: string | null;
  url: string;
  branch: 'two_stage' | 'debiasing' | 'one_stage' | 'panoptic'
        | 'open_vocab' | 'llm_vlm' | 'video' | 'three_d';
  module: string;                 // the module that covers it
  core_idea_en: string;           // one line
  core_idea_zh: string;
  predecessor: string | null;     // another paper's key
  defect_fixed_en: string | null; // PRD §6.3: the specific defect it fixes
  defect_fixed_zh: string | null;
  reported: Array<{
    dataset: string;
    metric: 'R' | 'mR' | 'ngR' | 'zR';
    k: 20 | 50 | 100;
    protocol: 'predcls' | 'sgcls' | 'sgdet';
    constraint: 'graph' | 'none' | 'semi';
    value: number;
    source_table: string;         // 'Table 3', so a reader can check
    verified: boolean;
  }>;
}
```

`doi` and `arxiv` may not both be `null`. `reported` entries with `verified: false` render in the unverified style of NFR-2.

### 3.3 `leaderboards.json`

```typescript
interface Leaderboard {
  id: string;
  dataset: string;
  protocol: 'predcls' | 'sgcls' | 'sgdet';
  constraint: 'graph' | 'none' | 'semi';
  banner_en: string;              // the non-comparability statement
  banner_zh: string;
  rows: Array<{
    paper_key: string;
    detector_backbone: string;    // PRD §6.4 requires all three named
    codebase: string;
    epoch_budget: string;
    values: Array<{ metric: string; k: number; value: number; verified: boolean }>;
  }>;
  dead_leaderboard_notice_en: string;   // the 24 July 2025 Papers With Code sunset
  dead_leaderboard_notice_zh: string;
}
```

**Leaderboards are never merged.** There is no endpoint, component or type that combines two `Leaderboard` records into one ranking. PRD §6.4 requires this, and the absence of the capability is the enforcement.

### 3.4 `kp.json`

The harvest target of D-13.

```typescript
interface KnowledgePoint {
  id: string;                     // 'E6', preserved from kp-data.js
  cluster: string;                // 'E'
  cluster_en: string;
  cluster_zh: string;
  title_en: string;
  title_zh: string;
  knobs: string;                  // the control surface, verbatim from the harvest
  status: 'live' | 'spec';        // 'live' = a playground exists in the frozen page
  math?: string;                  // LaTeX, from MATH
  deriv?: string;                 // LaTeX, from DERIV
  module?: string;                // assigned during Phase 4 authoring
  lab?: string;                   // the lab that realises the knobs, when one does
}
```

`system/tools/harvest.mjs` emits this file. `module` and `lab` start `undefined` and are filled by the Phase 4 authoring pass; `lint:content` reports how many remain unassigned but does not fail on them, because the assignment is the authoring work itself.

---

## 4. Repository conventions

**Python.** `ruff` with the default rule set plus `I` (import sorting). Line length 100. Type hints on every public function. `from __future__ import annotations` at the top of every module.

**TypeScript.** `strict: true`, `noUncheckedIndexedAccess: true`. No `any` in `system/packages/sgg-metrics`; the parity harness is the one place where a type error is a correctness error.

**Commits.** Conventional commits, scoped to this track: `feat(sgs): …`, `fix(sgs): …`, `test(sgs): …`, `docs(sgs): …`. The `sgs` scope lets the host repository's mixed history be filtered.

**Never committed.** `.env`, `node_modules/`, `.venv/`, `__pycache__/`, `dist/`, `data/slices/*/images/`, any API key or token in any form — including inside teaching content, fixtures, and prompt transcripts.
