# PRD — Scene Graph Studio / 場景圖工坊

**Status:** approved 2026-09-15
**Anchor paper:** Wang Z., Yan Z., Li S., Liu J. *IndVisSGG: VLM-based scene graph generation for industrial spatial intelligence.* Advanced Engineering Informatics 65 (2025) 103107. doi `10.1016/j.aei.2024.103107`
**Course:** 大語言模型技術與應用 (2026)

---

## 1. Summary

A bilingual (繁體中文 / English), locally-run web application that teaches scene graph generation (SGG) from first principles to the 2026 frontier, using IndVisSGG as its anchor case study. One content base drives two shells: a lecture shell for the classroom and a study shell for self-paced work.

## 2. Problem

Scene graphs sit at the junction of object detection, relational reasoning, and language. The literature is unusually treacherous:

- Three mutually incompatible dataset splits all answer to the name "VG150". *(Annotated 2026-09-26: not supported as worded. The releases differ in the validation carve-out and in filtering, and one published release drew its validation set from the test pool; see `specs/2026-09-26-playgrounds-m1-design.md` §2 and D93.)*
- The headline metric, Recall@K, rewards a model for predicting `on` — a pure co-occurrence prior with no access to pixels outscores the learned models of its era.
- A major benchmark's public ranking was demonstrably wrong for two years before anyone published the correction.
- The only public leaderboard, Papers With Code, was sunset on 24 July 2025. Nothing replaced it.

A student reading IndVisSGG cannot evaluate its claims without that context, and no existing resource supplies it interactively. Research confirms the gap is real: as of September 2026 there is **no maintained live public SGG demo** (PSG's Hugging Face Space has been in `BUILD_ERROR` since August 2022; `psgdataset.org` fails DNS; RelTR is Colab-only), and the mature explorable-explanation genre has never covered this topic.

## 3. Users and jobs to be done

| User | Job | Success looks like |
|---|---|---|
| **Professor, lecture mode** | Teach a 50–100 minute session without slides | Steps through pipeline figures by keyboard; drops an image into the live panel and produces a scene graph in front of the class; presenter notes and section timing on a second screen |
| **Graduate student, study mode** | Learn SGG well enough to critique a paper | Works modules at their own pace; builds graphs by hand and is scored against ground truth; can state why mean Recall exists and what the graph-constraint switch changes |
| **Professor as researcher** | Locate a contribution gap | Reads the field map, finds the un-surveyed LLM-era region and the dead leaderboard, and has the citations to hand |

## 4. Goals

- **G1** A student who finishes can compute R@K, mR@K, ng-R@K, and zR@K by hand, and can say which evaluation protocol each assumes.
- **G2** A student can explain why the frequency baseline beats IMP — having run that baseline themselves.
- **G3** A student can place any SGG paper on the taxonomy and name both its predecessor and the specific defect it fixes.
- **G4** A student can reconstruct the three-step, N-expert pipeline of IndVisSGG and predict what its ablations will show before seeing Tables 3 and 4.
- **G5** The professor teaches a complete session from the app, offline, performing no setup in the room.
- **G6** The app never presents an unverifiable number as verified.

## 5. Non-goals

Training any model. Reproducing published benchmark numbers. Hosting full dataset corpora. Multi-user accounts, cloud deployment, or live class polling. A general-purpose annotation tool — Label Studio and CVAT already exist. Mobile layout; this targets desktop and projector only.

> **Annotated 2026-10-08 by D-24.** Cloud deployment of the course frontend and a fixture-only
> backend are in scope since D-24: the frontend on GitHub Pages, and the backend on Render serving
> `fixtures/data`. The paragraph above is left intact as the record of what was approved on
> 2026-09-15.

## 6. Features

### 6.1 Curriculum shell (P0)

Fifteen modules with a left chapter rail, per-module progress, and resume-where-you-left-off.

**Bilingual by construction.** Every lesson string exists in both `zh-TW` and `en`. Technical terms remain in English inside Chinese prose — scene graph, predicate, Recall@K — matching how the field is actually discussed in a Taiwanese graduate seminar. The toggle is instant, requires no reload, and persists.

**Two shells, one content base.** The study shell carries normal type, quizzes, and spaced repetition. The lecture shell carries large type, high contrast, keyboard step-through, a section timer, and presenter notes on a second window driven by `BroadcastChannel`.

### 6.2 Eight interactive labs (P0)

| # | Lab | The learner acts | What it teaches |
|---|---|---|---|
| L1 | **Triplet Builder** | Click two boxes on an image, choose a predicate, build a graph, submit for scoring | The triplet data model; grounding |
| L2 | **Metric Explorer** | Drag K; toggle graph-constraint; switch protocol; watch four metrics move | Why papers report two numbers |
| L3 | **Long-Tail Lab** | Run the frequency co-occurrence predictor live; compare against a real model | Why mean Recall exists |
| L4 | **Method Comparator** | One image through RelTR live, cached Motifs / PSGFormer / EGTR, and the VLM pipeline | Two-stage vs one-stage vs VLM |
| L5 | **IndVisSGG Replica** ★ | Edit the Triplets Extraction Criteria, set the expert count, run all three steps, replay the ablations | The anchor paper, by reconstruction |
| L6 | **Protocol Forensics** | Score identical PSG predictions under both mask-pairing protocols | How a benchmark stayed wrong for two years |
| L7 | **Caption → Graph** | Type a sentence; watch nouns become nodes and verbs become edges | Language structure ↔ graph structure |
| L8 | **Mini-ISG Annotator** | Draft triplets on industrial frames with a VLM, then hand-correct them | Why ISG had to exist; what annotation costs |

**The shared scoring view** — used by L1, L4, L5, and L8 — renders a four-colour graph diff: green for a matched triplet, red for a spurious edge, grey-dashed for a missed ground-truth edge, and amber for a right predicate whose localization failed the IoU threshold. Separating localization failure from classification failure visually is the single highest-value pedagogical move available, because it is precisely the distinction the three evaluation protocols exist to isolate.

### 6.3 Field map and paper cards (P0)

Thirty-five cards in two tiers across eight branches (revised 2026-09-16; the original figure was roughly seventy, cut so that every reported number can be read off a named table). Each card carries venue, year, DOI or arXiv identifier, a one-line statement of its core idea, the defect it fixes in its predecessor, and its reported numbers — each tagged with the source table and the constraint mode under which it was measured. Filterable, and linked to the module that covers it.

### 6.4 Frozen leaderboards (P0)

Per-paper tables, never merged into a single ranking, each carrying a non-comparability banner that names the detector backbone, the codebase, and the epoch budget. A dated notice records that no live leaderboard has existed since 24 July 2025.

### 6.5 Assessment (P1)

Per-module quizzes. Graph-perturbation items generated automatically by corrupting a single ground-truth edge and asking the learner to find it. FSRS spaced repetition, scheduled client-side and persisted to `localStorage`.

### 6.6 Export (P2)

Any constructed graph to Visual-Genome-driver-compatible JSON. Any figure to SVG or PNG.

## 7. Curriculum

| # | Module | Anchor interactive |
|---|---|---|
| M0 | Why scene graphs — from labels to structure | Field map |
| M1 | The triplet and the Visual Genome data model | L1 |
| M2 | Grounding: bounding boxes vs panoptic masks | L1 with mask toggle |
| M3 | Protocols: PredCls, SGCls, SGDet | L2 |
| M4 | Metrics: R@K, mR@K, ng-R@K, zR@K — and the frequency baseline that humiliated the field | L2 + L3 |
| M5 | The two-stage era: IMP → Neural Motifs → VCTree → GPS-Net | L4 |
| M6 | The bias problem: TDE → CogTree → DLFE → NICE → IETrans → ST-SGG → PE-Net → RA-SGG | L3 |
| M7 | One-stage: FCSGG → RelTR → SGTR → EGTR / DSGG / SpeaQ → Hydra-SGG → REACT | L4 |
| M8 | Panoptic SGG and the fair-ranking correction | **L6** |
| M9 | Open vocabulary: VS³ → OvSGTR → PGSG | Field map |
| M10 | The LLM/VLM era in three modes: annotator, generator, RL-reasoner | L7 |
| **M11** | **★ IndVisSGG, end to end** | **L5** |
| M12 | Video and spatio-temporal: STTran → TEMPURA → OED → DiffVsgg → UNO | L2, semi-constraint mode |
| M13 | 3D and embodied: 3DSSG, Hydra, ConceptGraphs, Clio, SayPlan, VLM-MSGraph | Field map |
| M14 | Downstream applications, open problems, and the two gaps | **L8** |

The anchor paper sits at position eleven deliberately. By that point the student holds the metrics, the bias problem, the one-stage lineage, and the open-vocabulary framing — everything needed to judge the paper rather than admire it.

## 8. Success criteria

**Measurable.** The app boots and every P0 lab runs with the network disconnected and `torch` uninstalled. Cold start to first lesson is under ten seconds. Every quantitative claim carries a source URL and a verified-or-unverified tag. Lecture mode drives M0 through M14 by keyboard alone. Both languages are complete at ship, with no fallback strings.

**Qualitative.** The professor teaches a full session from it without touching slides. A student who finishes can critique the evaluation section of IndVisSGG unaided.

## 9. Constraints that shape the product

The development and teaching machine is Windows on ARM64 with no CUDA device, running an x64-emulated Python. `detectron2` and `maskrcnn-benchmark` will not build there, which means Neural Motifs, VCTree, and PSGFormer can never run live. Every model comparison therefore ships as committed precomputed predictions; live inference is an opt-in path, RelTR only, behind a measured latency estimate. The application must remain fully functional with the network off and `torch` absent.

## 10. What we will not claim

The ISG dataset described in the anchor paper is not publicly available — no repository matches it, the authors' own pages omit the code badge they attach to their other work, and no Hugging Face dataset corresponds. The app teaches ISG from the published tables and figures, labels it request-only, and warns about the unrelated `ISG-Bench` name collision. In its place the app ships a mini-ISG built by the same method from openly licensed industrial frames, labelled unambiguously as our teaching set and not the authors'.
