# Scene Graph Studio — PRD, SRS, and Implementation Plan

Anchor paper: **Wang Z., Yan Z., Li S., Liu J. "IndVisSGG: VLM-based scene graph generation for industrial spatial intelligence." Advanced Engineering Informatics 65 (2025) 103107.** doi `10.1016/j.aei.2024.103107`. Local PDF at `docs/superpowers/specs/@@wang25 - IndVisSGG-VLM-based scene graph generation for industrial spatial intelligence.pdf`.

---

## 1. Context

The user teaches 大語言模型技術與應用 (2026) and wants a web UI to learn scene graph generation (SGG) completely — not a paper summary. IndVisSGG is the anchor case study inside a full-field map: classic two-stage → debiasing → transformer one-stage → panoptic → open-vocabulary → VLM/LLM-era → video → 3D → embodied.

Two audiences, one content base: the professor lecturing from it, and students working through it alone. The content must be **vision-complete** — students should explain Neural Motifs' frequency bias and VCTree's dynamic trees as rigorously as IndVisSGG's TEC and 3-expert loop.

Delivery order: **PRD → SRS → Artifact (bilingual design brief, for discussion) → implementation plan → build.**

### Decisions locked with the user

| Question | Answer |
|---|---|
| Audience | Both — lecture mode + self-study mode |
| Interactivity | Full backend |
| Delivery | Local full-stack repo is the product; a bilingual 中/EN **Artifact is the design brief** |
| Content depth | Full field survey, IndVisSGG as anchor |
| Backend scope | Eval engine + live VLM pipeline + real SGG checkpoints |
| Student access | Each student runs localhost |
| Lecture features | Step-through figures, live demo panel, presenter notes + timing. **Polling dropped** (needs a shared server) |
| Framing | Vision-complete |
| ISG gap | **Build a mini-ISG** from downloadable industrial frames |

### Hard environment constraints (probed, not assumed)

> **SUPERSEDED 2026-09-15 — see decision D-02 in `…-decisions.md`.** The table below was probed
> on the **teaching** machine (TEACH). A re-probe on the **development** machine (DEV) on the same
> day returned materially different values: AMD64 Intel i7-12700H, an NVIDIA RTX 3070 Ti Laptop
> GPU, `torch 2.11.0+cpu` with `cuda_available → False` *by installation rather than by hardware*,
> Node **v20.16.0**, `numpy 1.26.4`, `pydantic 2.13.3`, `fastapi 0.136.1`, and no
> `opencv-contrib-python`. Two machines are in play; D-02 records both and D-04 pins the versions
> the build actually targets. Node 20.16.0 fails `vite@8.3.0`'s `engines` range, which is a
> blocker closed by D-03.

| Fact | Value (TEACH) | Consequence |
|---|---|---|
| CPU | Windows **ARM64** (Snapdragon X) | Python 3.12.10 is an **x64 build under emulation** |
| GPU | Qualcomm Adreno X1-45 | **No CUDA.** All torch inference is CPU, emulated → slow |
| Installed | `fastapi 0.139.2`, `uvicorn 0.51.0`, `torch 2.11.0`, `numpy 2.4.4`, `opencv-contrib-python 5.0.0.93`, `pillow 12.2.0`, `pydantic 2.13.4`, `scipy 1.17.1` | Backend is ~80% provisioned already |
| Missing | `transformers`, `huggingface_hub`, `timm`, `onnxruntime` | pip-installable |
| Node | v24.15.0 / npm 11.12.1 | Vite + React + TS unblocked |

**Design consequence — the cache-first rule.** `detectron2` / `maskrcnn-benchmark` will not build here, so Neural Motifs, VCTree, and PSGFormer can never run live on this machine. Only DETR-family models (RelTR, EGTR) are feasible, and only on CPU. Therefore: **every model comparison ships as committed precomputed predictions**; live inference is an opt-in path, RelTR-only, behind a measured latency warning. The app must be fully functional with the network off and `torch` uninstalled.

> **The rule stands; its rationale is corrected — D-05.** The ARM64 objection is true of TEACH
> only. On DEV the architecture is AMD64 and a CUDA device is present, so `detectron2` is not
> architecturally excluded there. The cache-first rule survives on three reasons that hold on both
> machines: the professor lectures from TEACH; students run localhost on unknown hardware and
> PRD §8 requires every P0 lab to run with `torch` uninstalled; and `maskrcnn-benchmark` is
> unmaintained and pinned to a PyTorch and CUDA generation `torch 2.11` does not provide.
> D-06 adds a four-hour timeboxed `detectron2` spike on DEV, whose outcome nothing depends on.

---

## 2. Research findings that drive the design

Three independent web sweeps (datasets · methods/SOTA · prior art + web stack) completed 2026-09-15. Full tables go into the shipped `content/` corpus; what follows is what changes the architecture.

### 2.1 The five teaching assets the research uncovered

1. **The FREQ humiliation (CVPR 2018).** A predictor using only the (subject-class, object-class) co-occurrence prior — zero pixels — scores PredCls mR@100 = **16.0**, beating IMP+ (10.5) and MOTIFS (15.3). This is the field's founding embarrassment and the reason mR@K exists. It is also ~40 lines of JavaScript, so students can **run it themselves in the browser** and watch it win.
2. **The PSG protocol correction — the single most valuable find.** "A Fair Ranking and New Model for PSG" (ECCV 2024, [arXiv 2407.09216](https://arxiv.org/abs/2407.09216)) showed the original PSG ranking used *MultiMPO*, permitting duplicate masks and multiple predicate distributions per pair — farmable. Under corrected *SingleMPO*: PSGTR mR@50 **20.8 → 11.62**, PSGFormer **17.0 → 8.20**, HiLo **30.3 → 18.33**; two-stage methods barely move. One-stage methods lost up to **19.3 mR@50 points**. A benchmark was wrong for two years and nobody noticed.
3. **Cross-paper numbers are not comparable.** Neural Motifs PredCls R@50 is reported as **65.3** (PE-Net table) and **64.6** (RA-SGG table); MOTIFS SGDet R@50 as **31.0** (J-2) and **25.1** (UniQ's table). Different detector backbones, codebases, epoch budgets. The app must display **per-paper tables with an explicit non-comparability banner**, never one merged leaderboard.
4. **Zero-shot frontier VLMs collapse on VG-150 SGDet**: LLaVA-next-7B R@50/100 = **2.37 / 3.07**; Qwen2-VL-7B = **0.87 / 1.28**; Qwen2-VL-72B = **1.88 / 2.73** ([arXiv 2506.08189](https://arxiv.org/abs/2506.08189)). Scale does not solve structured visual relations. Meanwhile R1-SGG's GRPO training cuts *format failure* from **54.46% → 0.06%** ([arXiv 2504.13617](https://arxiv.org/abs/2504.13617)). Together these are the course's punchline and directly contextualize IndVisSGG's prompt-engineering approach.
5. **Two genuine gaps worth naming in class.** (a) **Papers With Code was sunset 24 July 2025** — there is no live SGG leaderboard anywhere; the de-facto living survey is a GitHub list. (b) **No dedicated survey of SGG in the LLM/VLM era exists** — the newest comprehensive survey (Neurocomputing 566:127052, 2024) predates the R1/GRPO wave entirely. That is a publishable opening for the user's own lab.

### 2.2 Datasets — what actually ships

**The paper's ISG dataset is not publicly available.** GitHub search for "IndVisSGG" returns zero repos; second author Zhijie Yan's page lists it paper-link-only while his other work carries `[Code]` badges; no matching HF dataset. HF `shuaishuaicdp/ISG-Bench` is an unrelated "Interleaved Scene Graph" benchmark — a name collision to warn students about. Sibling works ManufVisSGG (IEEE CASE 2024) and VLM-MSGraph (RCIM 2025, vol. 94 art. 102978) also have no public data.

**Tier 1 — bundled with the repo** (open license, small, one-click):

| Dataset | Scale | License | Role |
|---|---|---|---|
| **VRD** (ECCV'16) | 5,000 img · 100 obj · 70 pred · 37,993 rels; 4k/1k; **1,877 test-only triplets = the zero-shot benchmark** | public | First lessons — small enough to load whole |
| **VG150** | ~108k img → **150 obj / 50 pred** | CC BY 4.0 | The benchmark behind every R@K students will see |
| **PSG** (ECCV'22) | 48,749 img · 133 obj (80 thing + 53 stuff) · 56 pred | **MIT** | Masks-vs-boxes; the Fair Ranking lesson |
| **IndoorVG** | 84 obj / 37 pred; 9,538/733/4,403 | open (HF) | "What if we fix VG150's ambiguous classes" |
| **Haystack** (ICCVW'23) | >11,300 img, eval-only, **carries explicit NEGATIVE annotations** | open | The only dataset enabling precision-style metrics |

Only curated slices are committed (≈200 images total, with their annotations) — not the full corpora.

**Tier 2 — reference cards only**: GQA (113k img, 1,702 obj, 310 pred), VrR-VG (58,983 img, 117 pred, positional predicates deliberately removed), Open Images V6 SGG (301/31, **different metric family**: wmAP_rel / wmAP_phr / score_wtd), SpatialSense (adversarial — VG150-strong models collapse), UnRel, STAR, ReCon1M.

**Tier 3 — lesson content**: Action Genome (10k videos, 234,253 frames, 35 obj, **26 pred** = 3 attention + 6 spatial + 17 contacting, 1,715,568 instances) · VidOR · PVSG · 3DSSG (534/41 full, **160/26 is what everyone reports**) · 4D-OR (**10 simulated** surgeries, MIT) · MM-OR.

**The industrial-datasets point that motivates the whole paper**: CHICO ships pose + cobot trajectories and **no object or relation labels**; Ego4D is license-gated; EPIC-KITCHENS-100 is CC BY-NC and 740 GB; HA-ViD (3,222 videos / 1.5M frames), IKEA ASM, and CALVIN (simulation-only) ship none either. **No industrial dataset had scene-graph labels.** That absence is why ISG had to be built — and the user will reproduce that labor at miniature scale.

### 2.3 Gotchas that become lessons, not footnotes

1. **"VG150" names three incompatible splits**: Xu 75,651/32,422 · Neural-Motifs/Tang 57,723+5,000 val/26,446 · SGG-Benchmark HF 73,538/4,844/27,032.
2. **Graph-constraint vs no-constraint swings R@K 10–20 points.** STTran PredCls R@50 on Action Genome: **71.8 constrained vs 99.1 unconstrained.** AG adds a third "semi-constraint" mode.
3. **VRD's R@K depends on an undeclared `k`** (1 / 10 / 70 predicates per pair).
4. **Missing annotations score as false positives** in VG/VRD/VidVRD — "wrong" predictions are often correct-but-unlabelled.
5. **Predicate synonymy has no hierarchy**: VG150 treats `on/above/over/laying on/sitting on/standing on` as distinct classes, and `man/person/people/men/guy` as distinct objects.
6. **PredCls/SGCls give ground-truth *boxes*, not ground-truth *pairs*** — the most common misreading in the field, per `METRICS.md`. Ideal quiz item.
7. **Counts disagree across papers**: AG 25 vs 26 predicates; 3DSSG 26 vs 27; Open Images 288 vs 301 objects; VG 108,073 vs 108,777 images (typo propagation).
8. **Name collisions**: "OpenPSG" = ECCV'22 codebase *or* ECCV'24 open-set method. "ISG" = this paper's dataset *or* HF's Interleaved Scene Graph benchmark.
9. **`maelic/PSG-coco-format` on HF is boxes-only** — cannot train a real panoptic model.
10. **Authority for our own eval engine**: [arXiv 2404.09616](https://arxiv.org/abs/2404.09616), "A Review and Efficient Implementation of SGG Metrics," documents why published implementations disagree. Cite it in the UI.

### 2.4 Prior art — the niche is empty, and what to steal

No maintained live public SGG demo exists in 2026: PSG's HF Space is `BUILD_ERROR` since Aug 2022, `psgdataset.org` fails DNS, RelTR has no HF Space (Colab only), and HF Spaces search returns only dead zero-like projects. Meanwhile the explorable-explanation genre is mature but has never covered SGG.

Patterns to take:
- **Transformer Explainer / CNN Explainer / GAN Lab / Diffusion Explainer** (Georgia Tech Polo Club) — live model in-browser not canned animation; editable input recomputing downstream; hover-to-trace provenance; a slider that lets the learner *break* the model; progressive disclosure via expand-in-place.
- **Nicky Case's 8 explorable patterns** — Do & Show & Tell, Interest Curves, Start Small Build Big, Cognitive Gates (withhold content until the learner tries). Use as the section-structure rubric.
- **Open Images visualizer** — best overlay UX in existence: annotation-type cards, mask fill-vs-contour toggle, random-class button, arrow-key paging.
- **RelTR's own visualization** — click a triplet → subject box + object box + coupled attention maps light up. The single best interaction in SGG.
- **SGDraw** (ISVC'23) — object-owns-its-attributes tree, two-click relation gesture. (Uses commercially-licensed GoJS — copy the interaction, not the library.)
- **`bknyaz/sgg` graph perturbations** — corrupt one edge of a GT graph, ask the learner to find it. Free quiz generator.
- **Seeing Theory** — chapter rail + one canonical interactive per concept + consistent visual language.

**Frontend stack** (repo build, so npm not CDN): **Cytoscape.js 3.34.2** (MIT, 136 KB gz, graph-theory-native selectors, pushed 2026-09-14) + **cytoscape-dagre 4.0.1** for layered layout + **D3 7.9.0** for charts and scrollytelling + **KaTeX** + **ts-fsrs 5.4.2** for spaced repetition. Rejected: G6 (3× the weight), React Flow (needs a hand-written `jsxRuntime` shim), ELK.js (467 KB gz), vis-network (350 open issues).

**Image overlay = hand-rolled SVG, zero libraries.** One `<img>` plus an absolutely-positioned `<svg viewBox="0 0 imgW imgH" preserveAspectRatio="xMidYMid meet">`; boxes are `<rect>`, masks are `<path>`, edges are `<path>` between centroids. Every element is a real DOM node → free hit-testing, free CSS hover, free a11y. Add Konva only if alpha-blended panoptic mask compositing proves necessary.

---

## 3. PRD — Product Requirements

### 3.1 Product

**Scene Graph Studio / 場景圖工坊** — a bilingual (繁體中文 / English), locally-run web application that teaches scene graph generation from first principles to the 2026 frontier, using IndVisSGG as its anchor case study.

### 3.2 Problem

Scene graphs sit at the junction of detection, relational reasoning, and language — and the literature is uniquely treacherous: three datasets share the name "VG150", the headline metric rewards predicting `on`, a major benchmark's ranking was silently wrong for two years, and the only public leaderboard shut down in 2025. A student reading IndVisSGG cannot evaluate its claims without that context, and no existing resource supplies it interactively.

### 3.3 Users and jobs

| User | Job | Success looks like |
|---|---|---|
| **Professor (lecture mode)** | Teach a 50–100 min session without slides | Steps through pipeline figures by keyboard; drops an image into the live panel and gets a graph in front of the class; presenter notes and section timing on the second screen |
| **Graduate student (study mode)** | Learn SGG well enough to critique a paper | Works modules at their own pace; builds graphs by hand and is scored; can state why mR@K exists and what graph-constraint changes |
| **The professor as researcher** | Locate a contribution gap | Reads the field map, sees the un-surveyed LLM-era region and the dead leaderboard, and has citations to hand |

### 3.4 Goals

- **G1** A student who finishes can compute R@K, mR@K, ng-R@K, and zR@K by hand and say which protocol (PredCls/SGCls/SGDet) each assumes.
- **G2** A student can explain why FREQ beats IMP — having run FREQ themselves.
- **G3** A student can place any SGG paper on the taxonomy and name its predecessor and the defect it fixes.
- **G4** A student can reconstruct IndVisSGG's 3-step, 3-expert pipeline and predict what its ablations do before seeing Tables 3–4.
- **G5** The professor teaches the whole session from the app, offline, with no setup step performed in the room.
- **G6** The app never presents an unverifiable number as verified.

### 3.5 Non-goals

Training any model. Reproducing published numbers. Full-corpus dataset hosting. Multi-user accounts, cloud deployment, or class polling. A general-purpose annotation tool (Label Studio and CVAT already exist). Mobile-first layout — desktop and projector only.

### 3.6 Feature set (P0 = must ship)

**P0 — Curriculum shell**
- 15 modules (§3.7), left chapter rail, per-module progress, resume-where-you-left-off.
- Bilingual: every lesson string exists in `zh-TW` and `en`; **technical terms stay English inside Chinese prose** (scene graph, predicate, Recall@K). Instant toggle, no reload, choice persisted.
- Two shells over one content base: **study** (normal type, quizzes, SRS) and **lecture** (large type, high contrast, keyboard step-through, presenter notes on a second window via `BroadcastChannel`, section timer).

**P0 — Eight interactive labs** (the pedagogical core)

| # | Lab | What the learner does | Teaches |
|---|---|---|---|
| **L1** | **Triplet Builder** | Click two boxes on an image, choose a predicate, build a graph; submit for scoring | The triplet data model; grounding |
| **L2** | **Metric Explorer** | Drag K; toggle graph-constraint; switch PredCls/SGCls/SGDet; watch all four metrics move | Why papers report two numbers |
| **L3** | **Long-Tail Lab** | Run the FREQ co-occurrence predictor live; compare to a real model | Why mR@K exists |
| **L4** | **Method Comparator** | Same image through RelTR (live CPU) vs cached Motifs / PSGFormer / EGTR vs the VLM pipeline | Two-stage vs one-stage vs VLM |
| **L5** | **IndVisSGG Replica** ★ | Edit the TEC (objects *O*, predicates *P*, examples *E*), set expert count 1/2/3/5, run the 3 steps, replay Tables 3–4 | The anchor paper, by reconstruction |
| **L6** | **Protocol Forensics** | Score the same PSG predictions under MultiMPO and SingleMPO | How a benchmark can be wrong for two years |
| **L7** | **Caption → Graph** | Type a sentence; watch nouns become nodes, verbs/prepositions become edges | Language structure ↔ graph structure; the rules→learned arc |
| **L8** | **Mini-ISG Annotator** | Draft triplets on industrial frames with a VLM, then hand-correct them | Why ISG had to exist; what annotation actually costs |

**Scoring UI, shared by L1/L4/L5/L8** — a four-colour graph diff: **green** matched · **red** spurious edge · **grey-dashed** missed GT edge · **amber** right predicate but IoU < 0.5. Separating *localization failure* from *classification failure* visually is the highest-value pedagogical move available, and it is exactly the distinction the three protocols isolate.

**P0 — Field map & paper cards.** ~70 methods across 8 branches, each with venue, year, DOI/arXiv, one-line core idea, the defect it fixes in its predecessor, and reported numbers **tagged with their source table and constraint mode**. Filterable, linked to modules.

**P0 — Frozen leaderboards.** Per-paper tables, never merged, each with a non-comparability banner naming backbone, codebase, and epoch budget. A dated "no live leaderboard exists since 2025-07-24" notice.

**P1 — Assessment.** Quizzes per module; graph-perturbation items generated automatically by corrupting one GT edge; FSRS spaced repetition over `localStorage`.

**P2 — Export.** Any built graph to VG-driver-compatible JSON; any figure to SVG/PNG.

### 3.7 Curriculum

| # | Module | Anchor interactive |
|---|---|---|
| M0 | Why scene graphs — from labels to structure | Field map |
| M1 | The triplet and the VG data model | L1 |
| M2 | Grounding: boxes vs panoptic masks | L1 + mask toggle |
| M3 | Protocols: PredCls / SGCls / SGDet | L2 |
| M4 | Metrics: R@K, mR@K, ng-R@K, zR@K — and the FREQ humiliation | L2 + L3 |
| M5 | Two-stage era: IMP → Motifs → VCTree → GPS-Net | L4 |
| M6 | The bias problem: TDE → CogTree → DLFE → NICE → IETrans → ST-SGG → PE-Net → RA-SGG | L3 |
| M7 | One-stage: FCSGG → RelTR → SGTR/+ → EGTR/DSGG/SpeaQ → Hydra-SGG → REACT | L4 |
| M8 | Panoptic SGG and the Fair Ranking correction | **L6** |
| M9 | Open vocabulary: VS³ → OvSGTR → PGSG | Field map |
| M10 | LLM/VLM era, three modes: annotator · generator · RL-reasoner | L7 |
| **M11** | **★ IndVisSGG, end to end** | **L5** |
| M12 | Video / spatio-temporal: STTran → TEMPURA → OED → DiffVsgg → UNO | L2 (semi-constraint) |
| M13 | 3D / embodied: 3DSSG · Hydra · ConceptGraphs · Clio · SayPlan · VLM-MSGraph | Field map |
| M14 | Downstream, open problems, and the two gaps | **L8** |

M11 sits at position 11 deliberately: by then the student has the metrics, the bias problem, the one-stage lineage, and the open-vocabulary framing needed to judge the paper rather than admire it.

### 3.8 Success criteria

**Measurable:** app boots and every P0 lab runs with the network disconnected and `torch` uninstalled · cold start to first lesson < 10 s · every quantitative claim carries a source URL and a verified/unverified tag · lecture mode drives M0–M14 by keyboard alone · both languages complete at ship, no fallback strings.

**Qualitative:** the professor teaches a full session from it without touching slides; a student who finishes can critique IndVisSGG's evaluation section unaided.

---

## 4. SRS — Software Requirements

### 4.1 Architecture

```
scene-graph-studio/                Reorganised 2026-09-16. Machinery under system/,
├── data/                          content at the root. Nothing else moved.
│   ├── golden/vectors.json        the shared fixture both engines read
│   ├── LICENCES.md                the two licence gates, per dataset
│   └── slices/                    ~200 curated images + annotations (committed)
├── docs/
│   ├── PLAYBOOK.md                how this was built, as reusable prompts
│   ├── mockup/                    static UI mockup (no toolchain)
│   └── superpowers/               specs, decisions, contracts, plans
├── start.ps1                      Windows front door: set up, then run
├── fetch-data.ps1                 report and obtain slice data (D-08)
├── DEVIATIONS.md                  departures from plan, with reasons
└── system/
    ├── package.json               the npm workspace root
    ├── frontend/                  Vite + React 19 + TypeScript + Tailwind v4
    │   ├── src/shells/            study/ | lecture/  (one content base, two shells)
    │   ├── src/labs/              L1..L8, one directory each
    │   ├── src/graph/             Cytoscape wrapper, SVG overlay, 4-colour diff
    │   ├── src/i18n/              zh-TW.json | en.json | useLocale()
    │   └── src/content/           modules as MDX + typed frontmatter
    ├── packages/sgg-metrics/      the TypeScript mirror of the eval engine
    ├── backend/                   FastAPI + Pydantic v2
    │   ├── app/eval/              the reference eval engine (authoritative)
    │   ├── app/infer/             reltr_cpu.py | cached.py | registry.py
    │   ├── app/vlm/               indvissgg.py  (3 steps, N experts, TEC)
    │   ├── app/datasets/          slice loaders, schema validation
    │   ├── app/api/               routers
    │   └── scripts/               cut_slice, bundle_slices, fetch_images, build_golden
    ├── tools/                     start, parity, lints, standalone build
    └── web/
        ├── brief/                 the design brief (authored + standalone)
        └── knowledge-map/         the frozen teaching page (D-13)
```

Repo root: **`scene-graph-studio/` inside the WekaExt repository** (decision D-22, which superseded D-01 on 2026-09-19; originally committed to `course-lab` at `5341aee`). The path recorded in §4.1 above was superseded before any code was written; the `course-lab` path that replaced it was superseded by the move.

### 4.2 Canonical data model

Deliberately **VG-python-driver compatible** (`Image` / `Object` / `Relationship` / `Attribute` / `Graph`) so exported graphs interoperate with the standard ecosystem.

```typescript
type BBox = { x: number; y: number; w: number; h: number };   // image pixels, top-left origin

interface SGObject {
  object_id: number;
  names: string[];              // VG allows synonyms; VG150 collapses to one
  bbox: BBox;
  mask?: { counts: string; size: [number, number] };  // COCO RLE, PSG only
  attributes?: string[];
  synsets?: string[];           // WordNet, VG lineage
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
  width: number; height: number;
  objects: SGObject[];
  relationships: SGRelationship[];
  provenance: {
    kind: 'ground_truth' | 'model' | 'vlm' | 'user';
    model?: string;             // 'reltr' | 'motifs' | 'psgformer' | 'egtr'
    vlm?: string;               // model id, when kind === 'vlm'
    generated_at?: string;      // ISO 8601
  };
}
```

**Invariant:** `subject_id` and `object_id` must reference objects in the same graph. Validated on load and on every API boundary; a violation is a 422, never a silent drop.

### 4.3 The eval engine — the one component that must be exactly right

Authority: [arXiv 2404.09616](https://arxiv.org/abs/2404.09616) and `Scene-Graph-Benchmark.pytorch/METRICS.md`. Implemented twice — Python (authoritative) and TypeScript (for instant UI feedback) — and **held identical by a shared golden-vector fixture**. If the two disagree on any fixture, CI fails.

**Triplet match.** A predicted ⟨s, p, o⟩ matches a GT triplet iff subject class matches, object class matches, predicate matches, **and** IoU(subject boxes) ≥ 0.5 **and** IoU(object boxes) ≥ 0.5. Masks substitute mask-IoU. The 0.5 threshold is field convention inherited from Xu et al., **not stated in `METRICS.md`** — so the UI displays it as an adjustable, labelled parameter rather than hiding it as folklore.

**Assignment.** Greedy one-to-one over the score-sorted prediction list; each GT triplet may be credited at most once. Matching order is part of the spec because it is observable.

**Metrics.**
- `R@K` — top-K predictions by score, `|matched GT| / |GT|`, K ∈ {20, 50, 100}.
- `mR@K` — R@K computed per predicate class independently, then averaged unweighted over classes **present in the GT of that split**.
- `ng-R@K` — all predicates per (s,o) pair enter the ranking, not just the top-scoring one.
- `zR@K` — GT restricted to ⟨s,p,o⟩ combinations absent from the training split.

**Protocols.** `PredCls` (GT boxes + GT labels given; predict predicates) · `SGCls` (GT boxes; predict labels + predicates) · `SGDet` (predict everything). The API response carries an explicit warning field restating that PredCls/SGCls supply ground-truth **boxes, not pairs**.

**Constraint modes.** `graph` (≤1 predicate per ordered pair) · `none` · `semi` (Action Genome). Every returned number is tagged with its mode; the UI refuses to render an untagged number.

**PSG mask-pairing modes.** `multi_mpo` (original, gameable) and `single_mpo` (corrected). L6 runs both over identical predictions and diffs them.

### 4.4 API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/datasets` | Available slices, with counts and license |
| `GET` | `/api/datasets/{ds}/images/{id}` | One image's GT `SceneGraph` |
| `POST` | `/api/eval` | `{gt, pred, protocol, constraint, k[], iou_thresh, mask_pairing}` → tagged metrics + per-triplet match/miss/spurious verdicts driving the four-colour diff |
| `GET` | `/api/models` | Registry: id, family, whether live inference is available **on this machine** |
| `POST` | `/api/infer/{model}` | Live inference. RelTR only; 503 with a reason for anything else |
| `GET` | `/api/predictions/{ds}/{model}/{image_id}` | Precomputed predictions |
| `POST` | `/api/vlm/indvissgg` | `{image, O, P, E, n_experts, steps}` → per-step, per-expert outputs plus the summarized graph |
| `GET` | `/api/content/modules` · `/api/content/papers` · `/api/content/leaderboards` | Bilingual content corpus |
| `GET` | `/api/health` | Reports torch presence, device, which models are live-capable |

All bodies are Pydantic v2 models; every metric response carries `{value, k, protocol, constraint, source, verified: boolean}`.

### 4.5 The IndVisSGG replica (L5) — faithful to the paper

Three steps, per the paper's §3.1–3.3 and Fig. 2:

1. **Extract** — `out_trpl = VLM(V_t, Prompt)`; with the TEC supplied, `out^{s1}_t = VLM(V_t, O, P, E, Prompt)`. *O* = predefined objects, *P* = predefined predicates, *E* = positive and negative examples with analyses.
2. **Triple-check** — N experts in parallel: `(out^{s2}_t, a_i) = VLM(V_t, O, P, E, Prompt, out^{s1}_t)`, each returning a revised triplet set and an analysis *a*. The paper's three named corrections are reproduced as canned cases: deleting a hallucinated `wrench`; recovering missing `terminals`/`beam`/`panel`; and rewriting `taping` to the TEC-legal `knocking on`.
3. **Summarize** — `out^{s3}_t = VLM(out^{s2}_t, α, Prompt)` over `{out^{s2}_t, a_i | i ∈ 1..N}`.

Student controls: edit *O*, *P*, *E*; set N ∈ {1, 2, 3, 5}; ablate each of *O*, *P*, *E*&Analysis independently. Table 3 (R@20 rises 0.032 → 23.040 as components are added) and Table 4 (N=3 is optimal: R@20 23.158, mR@20 16.947) ship as **committed data from the paper**, clearly marked as the authors' reported numbers, alongside whatever the student's own run produces. The two are never conflated.

**VLM provider** is configured, not hard-coded: a `VLMProvider` protocol with an offline transcript player as the default, so L5 works with no API key. Live providers are opt-in via `.env`. The paper used GPT-4V and Gemini-Pro-Vision; both are superseded, and the app says so.

### 4.6 Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Offline-complete.** Every P0 feature works with the network down and `torch` absent. Live inference and live VLM are the only degradable paths, and they degrade with a visible reason, never a stack trace. |
| NFR-2 | **Honest numbers.** Every figure carries a source and a `verified` flag. Unverified figures render in a distinct style with a tooltip saying why. No number appears without its constraint mode and protocol. |
| NFR-3 | **Two implementations, one truth.** Python and TypeScript eval engines agree on every golden vector, enforced in CI. |
| NFR-4 | **Determinism.** Identical inputs to `/api/eval` yield identical output, including tie-break order. |
| NFR-5 | **Projector-legible.** Lecture mode ≥ 24 px base type, contrast ≥ 7:1, colour-blind-safe diff palette (green/red distinguished by shape and dash pattern as well as hue). |
| NFR-6 | **Bilingual parity.** CI fails if a key exists in one locale and not the other. |
| NFR-7 | **Licence hygiene.** Every bundled asset carries its licence; CC BY-NC material (EPIC-KITCHENS) is never redistributed. VG and Open Images annotations (CC BY 4.0) are the preferred demo assets. |
| NFR-8 | **Cold start < 10 s**; lab interactions < 100 ms; live RelTR inference shows a measured estimate before it starts. |

### 4.7 Testing

- **Golden vectors** for the eval engine: hand-computed R@K / mR@K / ng-R@K / zR@K on small synthetic graphs where the answer is checkable on paper, plus edge cases — empty GT, empty prediction, all-tied scores, duplicate predictions, IoU exactly 0.5, one predicate class with a single GT instance (mR@K denominator trap).
- **Cross-implementation test**: the TypeScript engine runs the same fixtures under Vitest; CI diffs the outputs.
- **Schema round-trip**: every committed slice validates against `SceneGraph`; export → import is lossless.
- **Content lint**: every quantitative claim in `content/` has a `source` and `verified` field; every i18n key exists in both locales.
- **Lecture-mode smoke test**: Playwright drives M0→M14 by keyboard only.

TDD applies to the eval engine and the metric mirror without exception — it is the component where a silent error would teach students something false.

---

## 5. Implementation plan

Nine phases. Phases 3–6 are independent once Phase 2 lands and can be reordered or parallelized.

| Phase | Deliverable | Depends on |
|---|---|---|
| **0. Design artifacts** ✅ | `PRD.md` + `SRS.md` written to `docs/superpowers/specs/`; the **bilingual Artifact design brief published for discussion**. `git init` is struck — the project lives inside `course-lab` (D-01). | — |
| **0.5 Decisions and contracts** ✅ | `…-decisions.md` (D-01…D-20) and `…-contracts.md` (API bodies, frontend architecture, content schema); plans 01–04 under `docs/superpowers/plans/` | 0 |
| **1. Skeleton** | Vite + React 19 + TS + Tailwind v4 frontend; FastAPI backend; `/api/health` reporting torch/device/live-capable models; i18n scaffolding with parity lint | 0 |
| **2. Data + eval engine** ★ | `SceneGraph` schema both sides; Tier-1 slice ingestion (~200 images); **the eval engine, TDD, both languages, golden vectors, CI cross-check** | 1 |
| **3. Graph + overlay** | Cytoscape wrapper; SVG image overlay (boxes, masks, edges); the four-colour diff; **L1 Triplet Builder**, **L2 Metric Explorer** | 2 |
| **4. Content corpus** | 15 modules as bilingual MDX; 35 paper cards in two tiers (D-21); frozen per-paper leaderboards with non-comparability banners; field map | 1 |
| **5. Models** | Prediction registry + committed precomputed outputs; RelTR CPU live path with measured latency; graceful 503 for detectron2-family models; **L4 Method Comparator**, **L6 Protocol Forensics** | 2 |
| **6. VLM pipeline** ★ | `VLMProvider` protocol + offline transcript player; the 3-step / N-expert IndVisSGG replica; TEC editor; ablation replay; **L5** | 2 |
| **7. Remaining labs** | **L3** Long-Tail Lab (FREQ in the browser), **L7** Caption→Graph, **L8** Mini-ISG Annotator; build the mini-ISG set from IndustReal/MECCANO frames | 3, 6 |
| **8. Shells + assessment** | Lecture mode (keyboard step-through, presenter window via `BroadcastChannel`, section timer); quizzes; perturbation-item generator; FSRS scheduling | 3, 4 |
| **9. Hardening** | Offline verification, licence audit, Playwright lecture smoke test, README with the ARM64/CPU caveats stated plainly | all |

**Ordering rationale.** Phase 2 is first and is the only phase with a hard TDD mandate, because every lab reads its output and a wrong metric teaches a false fact. Phase 4 is decoupled from the labs so content can be written while code is built. Phase 5 lands after Phase 3 so there is somewhere to display predictions.

**The mini-ISG build (Phase 7), explicitly.** Pull ~40 frames from IndustReal (open, GitHub, includes CAD models) and MECCANO (open, project page); run the L5 IndVisSGG prompt to draft triplets; hand-correct in L8; commit as `data/mini-isg/` with a README stating plainly that this is *our* teaching set built with the paper's method, **not** the authors' ISG, and that ISG remains request-only. This is the one place where a student sees what annotation actually costs — which is the paper's own motivation, reproduced at 0.4% scale.

---

## 6. Verification

Not "the tests pass" — end-to-end checks that the thing teaches correctly.

1. **Eval engine truth.** `pytest backend/tests/test_eval.py -v` and `npm test -- metrics` both green on the shared golden vectors; CI cross-check diff empty. Then hand-verify one fixture on paper against `METRICS.md` and confirm the engine agrees.
2. **Reproduce a known number.** Feed committed RelTR predictions for the VG150 slice through `/api/eval` at SGDet, graph-constraint, K=50. The result will not equal the paper's 27.5 — the slice is ~200 images, not 26,446 — so the check is that the **magnitude is plausible and the constraint/protocol tags are right**. Documented as a sanity check, never as a reproduction claim.
3. **The constraint gap is visible.** In L2, toggling graph-constraint off must move R@K substantially upward on the same predictions. If it does not, `ng-R@K` is wrong.
4. **The FREQ humiliation reproduces.** L3's in-browser co-occurrence predictor must beat a real model's mR@K-free R@K on the VG150 slice, and lose badly on mR@K. If it does not, either the slice is unrepresentative or mR@K is wrong — investigate before shipping.
5. **The protocol correction reproduces.** L6 scoring the same PSG predictions under `multi_mpo` and `single_mpo` must show one-stage numbers falling and two-stage numbers roughly stable, matching the direction (not the exact magnitude) of ECCV'24's Table.
6. **Offline run.** Disconnect the network, `pip uninstall torch`, start both servers, walk M0→M14. Every P0 feature works; live inference and live VLM show a stated reason.
7. **Bilingual parity.** `npm run lint:i18n` reports zero missing keys either direction; spot-check three modules in 繁中 for term consistency.
8. **Lecture rehearsal.** Run the Playwright keyboard walkthrough, then do it manually on a projector-resolution window at 24 px base type.
9. **Source audit.** `npm run lint:content` confirms every numeric claim has a source URL and a `verified` flag; manually re-check the ten flagged-unverified items still render as unverified.

---

## 7. Open items — ALL CLOSED 2026-09-15

Answered in `2026-09-15-scene-graph-studio-decisions.md`. Retained here with their answers so that
a reader of this document alone is not misled into re-opening them.

1. **Repo location** — **CLOSED, D-22** (which superseded D-01). `scene-graph-studio/` inside
   WekaExt. Not a separate repository; no `git init`.
2. **Live VLM provider** — **CLOSED, D-17.** Claude, opt-in through `.env`. The offline transcript
   player remains the default and the only provider any P0 feature may require.
3. **Which precomputed models to commit** — **CLOSED, D-06 and D-07.** RelTR and EGTR are produced
   here and committed with `fidelity: 'measured'`. Motifs, VCTree and PSGFormer ship as
   `fidelity: 'reconstructed'` files carrying a required `note`, after a four-hour timeboxed
   `detectron2` spike on DEV that nothing downstream depends on.

Four further gaps found in the 2026-09-15 plan review are closed in the same document: slice
acquisition and the licence gate (D-08 … D-10), the disposition of `system/web/knowledge-map` (D-13,
D-14), the CI mechanism and the golden-vector format (D-15, D-16), and the mini-ISG licence hole
(D-18). Two new problems were found while resolving them: Node 20.16.0 cannot run Vite 8 (D-03),
and mask IoU had no implementation strategy (D-11, D-12).

---

## 8. Note on scope

This is a large build: 15 modules, 8 labs, two shells, a dual-implementation eval engine, and a bilingual content corpus of 35 paper cards in two tiers (D-21). Phases 0–3 alone produce something teachable — the triplet model, the metrics, and the scoring diff — and Phase 6 (the IndVisSGG replica) is the piece most specific to the anchor paper. If the term calendar bites, cutting Phases 7–8 down to L3 plus quizzes leaves a coherent product; cutting Phase 2 does not.

**Estimates and the cut order are D-19:** 44 focused days across four plans, cut in the order FSRS → L8 and the mini-ISG → L7 → the card corpus reduced to the curriculum's ~25 → L6. Plan 01 and the lecture shell are never cut.
