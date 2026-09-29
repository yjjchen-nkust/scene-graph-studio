# Knowledge index

Every planning document in this track, what it governs, and where each piece of knowledge is
defined. Current as of **2026-09-28**.

**Read order for someone new:** `decisions.md` → `contracts.md` → the plan you are about to
execute. The PRD and SRS explain *why*; those two say *what is binding*.

**The rule that outranks everything below:** no P0 feature may depend on `torch`, on CUDA, on the
network, or on an API key. A task that appears to violate it has been misread.

---

## 1. The documents

| Document | Governs | Status |
|---|---|---|
| `superpowers/specs/2026-09-15-…-PRD.md` | Users, goals G1–G5, curriculum M0–M14, what we will not claim | approved |
| `superpowers/specs/2026-09-15-…-SRS.md` | Architecture, data model, eval engine, API surface, NFR-1…8 | approved |
| `superpowers/specs/2026-09-15-…-design.md` | PRD + SRS + the nine-phase plan; §7 open items, all closed | approved |
| `superpowers/specs/2026-09-15-…-decisions.md` | **D-01…D-23. Binding. Read before any task.** | live |
| `superpowers/specs/2026-09-15-…-contracts.md` | **Normative field names, types, enum spellings** | live |
| `superpowers/specs/2026-09-16-indvissgg-reading.md` | The anchor paper read as M11's source | reference |
| `superpowers/specs/2026-09-19-playgrounds-design.md` | The `playground` step kind, and the three that complete M0 | **executed** |
| `superpowers/specs/2026-09-26-playgrounds-m1-design.md` | F6, F7, X1, and what the opened sources say about VG150 | **executed** |
| `superpowers/specs/2026-09-26-split-and-distinct-design.md` | A playground split across steps as parts; triplets counted as a set | **executed** |
| `superpowers/specs/2026-09-27-playgrounds-m2-design.md` | F3, and three statements about IoU the opened sources contradict | **executed** |
| `superpowers/specs/2026-09-27-playgrounds-m3-design.md` | E1, E10, and four statements about matching and protocols the engine and sources contradict | **executed** |
| `superpowers/specs/2026-09-27-graph-constraint-key-design.md` | The graph and semi constraints keyed on object pairs, as the reference keys them | **executed** |
| `superpowers/specs/2026-09-28-playgrounds-m4-design.md` | E3, E4, E7, E13, X2, and five statements about constraints, blends and VRD's per-pair count the engine contradicts | **executed** |
| `superpowers/specs/2026-09-29-playgrounds-m5-design.md` | T1, T2, and the pair and averaging statements the corpus and M5's derivation contradict | **executed** |
| `superpowers/specs/2026-09-29-m0-demos-design.md` | The `demo` step kind, D-T and D-V over recorded artefacts, the clip and ten frames, and what a demo may compute | **executed** |
| `superpowers/plans/…-00-master.md` | Index, dependency graph, global constraints | live |
| `superpowers/plans/…-01-skeleton-and-eval-engine.md` | Phases 1–2 | **executed** |
| `superpowers/plans/…-02-graph-labs-and-content.md` | Phases 3–4: graph, L1, L2, harvest, corpus | **executed** |
| `superpowers/plans/…-03-models-and-vlm.md` | Phases 5–6: registry, RelTR, L4, L6, L5 | **executed**; the measured prediction tier is blocked on licences, see PROVENANCE.md |
| `superpowers/plans/…-04-labs-shells-hardening.md` | Phases 7–9: L3, L7, L8, shells, hardening | **executed** |
| `superpowers/plans/2026-09-19-playgrounds-m0.md` | The `playground` step kind, F1, F2, F8, the golden file, the lint rules | **executed** |
| `superpowers/plans/2026-09-26-playgrounds-m1.md` | X1's cited figures, rules 9 and 12, the corrections, F6, F7, X1 | **executed** |
| `superpowers/plans/2026-09-27-playgrounds-m2.md` | The IoU corrections, F3's arithmetic and golden cases, the component, M2 s3 and s4 | **executed** |
| `superpowers/plans/2026-09-27-playgrounds-m3.md` | M3's corrections, `PhotoMarks`, E1 and E10, their golden cases, M3 s3 to s7 | **executed** |
| `superpowers/plans/2026-09-27-graph-constraint-key.md` | Both engines re-keyed, gv-014, `semi` described, D51 corrected | **executed** |
| `superpowers/plans/2026-09-28-playgrounds-m4.md` | M4's corrections, the ranked list and its arithmetic, E3, E4, E7, E13 and X2, their golden cases, M4 s3 to s16 | **executed** |
| `superpowers/plans/2026-09-29-playgrounds-m5.md` | M5's corrections, the slice ordered and the six beliefs, T1 and T2, their golden cases, M5 s3, s5 and s6 | **executed** |
| `superpowers/plans/2026-09-29-m0-demos.md` | The live VLM provider's frame, the clip, D-T and D-V recorded and derived, the demo components, the lint rules, M0 s7 to s15, the Chromium checks | **executed** |
| `PLAYBOOK.md` | How this was built, as reusable prompts for the next project | reference |
| `../DEVIATIONS.md` | **D1…D117. Every departure from plan, with its reason.** | live |
| `VERIFICATION.md` | **The nine checks of design §6, plus NFR-8 (§10), the pins (§11), the interpreter (§12), the CUDA build (§13), the runner (§14), the playgrounds (§15), the lint suite by mutation (§16), the M1 playgrounds (§17), the M1 minors (§18), the review of the day's merges (§19), the split playgrounds (§20), the M2 playground (§21), the M3 playgrounds (§22), the graph constraint's key (§23), the review minors (§24), the deferred minors (§25), the open checks (§26), the review of the open checks (§27), the empty training split (§28), the M4 playgrounds (§29), the M5 playgrounds (§30) and the M0 demos (§31)** | live |
| `../data/LICENCES.md` | The two licence gates, per dataset | live |
| `../system/web/knowledge-map/FROZEN.md` | The freeze, its release by D-23, and every correction made under it | live |

`brief.standalone.html` in this directory is a build output, not a source. Edit
`../system/web/brief/index.html`; `npm run build:standalone` regenerates it and CI fails if it
drifts.

---

## 2. Decisions — D-01 … D-23

| | | |
|---|---|---|
| **D-01** | Repository lives at `AI-LLM/scene-graph-studio/` | **superseded 2026-09-19 by D-22** |
| **D-02** | Two machines; the ship target is the weaker | TEACH is ARM64, no CUDA |
| **D-03** | Node ≥ 22.12 is a hard prerequisite | **closed: 24.19.0 on both machines** |
| **D-04** | Dependency versions pinned at measured values | see master plan |
| **D-05** | Cache-first rule stands, rationale corrected | `maskrcnn-benchmark` is the real blocker |
| **D-06** | Live inference tier list; timeboxed detectron2 spike | RelTR only |
| **D-07** | Prediction provenance has three tiers | `measured` / `reconstructed` / `published` |
| **D-08** | **Author downloads corpora; class gets a cut bundle** | no script downloads a dataset |
| **D-09** | `vg150-sgb` is the split; bare `vg150` is forbidden | several releases share the short name; annotated 2026-09-26 (D93) |
| **D-10** | Slice composition: 200 images, allocated per dataset | plus the selection rule |
| **D-11** | Eval engine is pure-Python stdlib | no numpy, no pycocotools |
| **D-12** | COCO RLE decoded in-house, both languages | |
| **D-13** | The knowledge-map is harvested, then frozen | **freeze released 2026-09-27 by D-23**; the harvest stands |
| **D-14** | `pg.js evaluate()` is a teaching toy, never the engine | both sides would be wrong together |
| **D-15** | CI is one local command, mirrored by a workflow | `npm run ci` |
| **D-16** | Golden vectors are one JSON both engines read | neither embeds a copy |
| **D-17** | Live VLM provider is Claude, opt-in via `.env` | offline player is the default |
| **D-18** | Mini-ISG licence gate precedes any frame commit | |
| **D-19** | Effort estimates and the cut order | 44 days, four plans |
| **D-20** | The track is documented in the repo `CLAUDE.md` | **superseded 2026-09-19 by D-22** |
| **D-21** | Paper corpus is two tiers; only scored methods carry numbers | 35 cards decided; 60 built, reason never recorded, closed at 60 (D92); no unverified tier |
| **D-22** | Repository lives at `scene-graph-studio/` inside WekaExt | supersedes D-01, D-20; still not its own repo |
| **D-23** | The knowledge-map freeze is released | the page may be extended; still the harvest source, still no build step; D-14 stands |

---

## 3. Non-functional requirements — NFR-1 … 8

| | | Enforced by |
|---|---|---|
| **NFR-1** | Offline-complete; every P0 feature works with the network down and `torch` absent | the placeholder slice, in `data/`, which comes from the NAS (D109) |
| **NFR-2** | Honest numbers: every figure carries a source and a `verified` flag | `content_lint.mjs` |
| **NFR-3** | Two implementations, one truth | `parity.mjs`, 21 golden vectors |
| **NFR-4** | Determinism, including tie-break order | `sorted(key=(-score, relationship_id))` |
| **NFR-5** | Projector-legible; colour-blind-safe diff | lecture shell |
| **NFR-6** | Bilingual parity; no fallback locale | `i18n_parity.mjs` |
| **NFR-7** | Licence hygiene | `data/LICENCES.md`, two gates |
| **NFR-8** | Cold start < 10 s; labs < 100 ms | `npm run check:perf`, measured — VERIFICATION §10 |

---

## 4. Where each thing is defined

| Looking for | Go to |
|---|---|
| Field names, types, enum spellings | `contracts.md` — normative, not descriptive; §1.10 is marked **superseded** (D72) |
| `SceneGraph`, `SGObject`, `SGRelationship`, `BBox` | `system/backend/app/schema.py` |
| The match relation, R@K, mR@K, ng-R@K, zR@K | `design.md` §4.3; code in `system/backend/app/eval/` |
| Protocols `predcls` / `sgcls` / `sgdet` | `design.md` §4.3; the `gt_boxes_not_pairs` warning is raised on every `predcls` and `sgcls` response (contracts §1.5) |
| Constraint modes `graph` / `none` / `semi` | `design.md` §4.3 |
| Mask pairing `single_mpo` / `multi_mpo` | `design.md` §4.3; L6 runs both |
| The 21 golden vectors | `system/backend/scripts/build_golden.py`, each with a `why` |
| Corpus layouts, per dataset | `system/backend/app/datasets/adapters/__init__.py` — `LAYOUTS` |
| Which datasets may be cut or distributed (nothing under `data/` is committed, D109) | `data/LICENCES.md`, on the NAS |
| The slice selection rule | `system/backend/app/datasets/loader.py` — `SELECTION_RULE` |
| What may change on the knowledge-map page, and what may not | D-23, `FROZEN.md`, and D-14 |
| The eight labs L1–L8 | `PRD.md` §6.2; per-lab tasks in plans 02–04 |
| The anchor paper's four equations | `design.md` §4.5 and `2026-09-16-indvissgg-reading.md` |
| The `playground` step kind, and its twelve lint rules | `contracts.md` §2.4; rules in `system/tools/content_lint.mjs` |
| The playground arithmetic, and the sixty-four cases that pin it | `system/frontend/src/playgrounds/logic.ts`; `data/content/playground_golden.json` |
| How to build a project like this again | `PLAYBOOK.md` |

---

## 5. State, 2026-09-26

**Built.** Plan 01: FastAPI backend, the evaluation engine in Python and TypeScript held identical
by golden vectors (13 at plan 01's close, 16 after D99, 17 since D100, 20 after D104, 21 since D105), slice ingestion with both licence gates, `/api/health`, `/api/eval`,
`/api/datasets`, the Vite frontend skeleton, and CI as one command.

**Data.** Corpora at `C:\DataRaw` (`SGS_CORPUS_ROOT`). Three slices cut with seed 20260915:
`vg150-sgb` 80 images, `indoorvg` 20, `psg` 50. Annotations and manifests committed; images
ignored, as the gate requires. [Since D109 nothing under `data/` is committed, and since D110
`data/` is a link to the one copy, on the NAS at `C:\DataRaw\scene-graph`.] `psg` took a manual download on three paths — `psg.json` from an
interactive link, then COCO `val2017` and the panoptic annotations, both of which this network
serves only in ranged chunks. All 622 objects in the `psg` slice carry a mask, and the masks were
checked pixel-for-pixel against the source panoptic PNGs after the round trip.

**Adapters.** `vg150-sgb` and `indoorvg` written against real files; both COCO parquet with images
embedded, so one reader serves both. `psg` written against its own format and is the only one with
masks, which is what makes L6 Protocol Forensics possible. `vrd` and `haystack` unwritten — D-06,
and both are gate-shut anyway.

**Plan 02, Tasks 1–4, landed 2026-09-16/17.** `data/content/` carries 93 knowledge points, 26
formulas and 23 derivations, re-checked by CI on every run. `graph/palette.ts` styles the four
verdicts on three channels, `components/MetricReadout.tsx` is the only component that renders a
metric, `graph/ImageOverlay.tsx` draws boxes, masks and edges in the image's own coordinates with
a draw mode for L1 and L8, and `graph/SceneGraphView.tsx` renders the same graph as a node-link
diagram, where a `missed` verdict becomes a ghost edge that exists in no `relationships` array.

**L1 Triplet Builder landed 2026-09-17** (Task 5): click two boxes, name the relation, submit,
read the diff. Scored in the browser through `sgg-metrics` under PredCls, which is the protocol
that judges the predicate and nothing else. All shareable state is in the query string, so a
submitted diff is a link.

**L2 Metric Explorer landed 2026-09-17** (Task 6): K, protocol, constraint mode and τ, each a
control, each in the URL, with R and mR on one axis so the head-predicate gap is a picture. The
protocol knob degrades the *prediction* before scoring, because the engine treats `protocol` as a
tag and never reads it (D27). SRS §11.2's ordering invariant is asserted over the lab's fixture,
and asserted again as a strict inequality so it cannot pass by equality.

**The MDX pipeline landed 2026-09-17** (Task 7): mathematics is typeset by `rehype-katex` at
build time, with the fonts bundled from npm, so nothing is fetched at lecture time. M0 exists in
both locales. The four-part contract of SRS §11.2 is four components, and `tools/content_lint.mjs`
now refuses a module missing one, giving them out of order, missing a locale, disagreeing on its
step ids, citing a knowledge point that is not in `kp.json`, carrying a claim without its protocol
and constraint, or reglossing a symbol another module defined. Every one of those rules was
watched to fail before it was kept.

**All fifteen modules exist in both locales, 2026-09-17** (Task 8). Every one of the 93 harvested
knowledge points is assigned to a module in `data/content/assignment.json`, and the lint refuses an
unassigned point, a point assigned twice, and a module that does not declare what it owns. The
mathematics is the harvested LaTeX with only its delimiters changed, by `tools/kp_latex.mjs`.
M11 is transcribed from the primary-source reading of the anchor paper and does not reintroduce
the two errors that reading corrected.

**Paper cards and the field map landed 2026-09-17** (Task 9): 60 cards across nine branches, each
with its predecessor and the defect it fixed, filterable by branch, year, dataset and whether it
carries numbers. 87 figures, every one read off a named table and attributed to the paper that
printed it — which for a re-implementation is not the paper the card is about. There is no
unverified tier: ten cards carry numbers because ten papers' tables have been opened, and the
rest say so plainly. (The count read eleven until check 9 of `docs/VERIFICATION.md` counted the
`reported` lists: ten cards, 87 figures.)

**Plan 03 landed 2026-09-17/18.** The model registry, whose three gates — torch, checkpoint,
package — are the only answer to what can run; the reconstructed prediction tier; the RelTR live
path; L4 Method Comparator; L6 Protocol Forensics; the VLM provider seam with its transcript
player; and L5, the three-step N-expert IndVisSGG replica.

**Plan 04 Tasks 1–4 landed 2026-09-18.** L3 Long-Tail, L7 Caption to Graph, the mini-ISG licence
finding, and the mini-ISG teaching set with L8. Forty frames cut from IndustReal under an
Apache-2.0 finding verified on the 4TU data record; nothing cut from MECCANO, which states no
licence. 156 drafted triplets against 350 after correction, from one authored source that
generates both the transcript and the annotations.

**Plan 04 landed 2026-09-18.** Task 5, the lecture shell: `useStepper` owns the position — which
lives in the route and nowhere else — the keyboard policy, and the section clock that counts a
step's budget down and does not stop at zero. Task 6, the presenter window on `sgs-presenter`,
with notes wired, linted and seeded for M0 only. Task 7, typed persistence, generated
perturbation quizzes and FSRS scheduling, with progress written by both shells and a resume
affordance on the index. Task 8, a Visual Genome export that the driver can read and a
self-contained SVG export. Task 9, the nine checks, in `VERIFICATION.md`.

**The router is mounted**, which no task in any of the four plans had asked for (D52), and every
route in contracts §2.2 resolves — including `/lab/:labId`, whose containers hold the data
fetching the labs themselves refuse to do (D60). All eight labs are reachable from the index.

**The lecture palette is measured, not asserted.** `#1d4ed8` was written down at 7.06 and
measures 6.70; the accent is `#1e40af` at 8.72 and CI recomputes every ink token (D54).

**All nine checks of design §6 have now been run.** Check 6, the offline run, is
`npm run check:offline`: a torch-free interpreter, `SGS_DATA_DIR` pointed at a scratch directory
with one generated slice, and Playwright aborting every request to anything but this origin —
stricter than unplugging a cable, because it fails on the attempt rather than on the timeout.
Check 8 is `npm run test:e2e`, at XGA, WXGA and 1920×1080, and it found three defects: a lost
keypress (D67), one key with two encodings (D68), and three equations running off an XGA panel
(D70).

**A click selects the smallest box containing it, 2026-09-19 (D75).** A bounding box is drawn
`fill="none"`, so SVG hit-tested its outline and not its interior and a click aimed at the middle
of an object selected nothing, under a pointer cursor that said otherwise. `pointer-events: all`
would have handed the decision to paint order, which in a scene graph — where boxes nest — picks
the wrong object unpredictably; `geometry.pickObjectAt` makes it explicitly instead, ties broken
by the lower object id, the boundary counted as inside so the outline still works. Asserted in
jsdom for the rule and in Chromium for the hit testing jsdom does not have.

**Presenter notes are complete, 2026-09-19.** All 95 steps carry them in both locales, 190 in
total [**corrected 2026-09-26:** 92 steps and 184 notes on this date, as first written and as this
paragraph's last sentence says; 95 and 190 replaced them on 2026-09-20, after M0's playgrounds,
the corpus held 98 steps and 196 notes after M1's playgrounds, held 103 and 206 after D96, 105 and 210 after D97, 109 and 218 after D98, 117 and 234 after D106, 120 and 240 after D111, and holds 129 and 258 since D117], written against each step's own content: what
has to land, what to put on the board before
the slide does, what the room usually gets wrong, what to compress when the clock is short. They
are procedural rather than expository — none introduces a claim its module does not already make.
`content_lint.mjs` now refuses a step without them (D76). Until this date M00 was the only module
with any, and the presenter window reported "no notes" on 88 steps of 92.

**Not built, and each with a stated reason.** The measured prediction tier, blocked on licences.
`vrd` and `haystack`, whose licence gates are shut.

**Closed by the author's judgement rather than by a change:** 25 slides of 92 run past the bottom
of an XGA panel (D71). The options were to split them or leave them; the author reviewed the
rendering and accepted it on 2026-09-18. The numbers stay in `VERIFICATION.md` §8 so a different
hall re-opens it without re-measuring.

**NFR-8 is measured as of 2026-09-19**, and it was the one requirement in §3 with no enforcer.
`npm run check:perf` starts a backend — unlike checks 6 and 8, this one needs the machine at its
most complete — and measures cold start on five routes and input-to-paint on five labs.
Everything is comfortable: 202–270 ms against a ten-second budget, and 0.0–2.1 ms of work per
interaction. The first version of the table reported 33 ms for every lab, which is two frames at
60 Hz and is the instrument's own floor; the idle wait is now measured on the same page and
subtracted (D74). Three labs are recorded as untimed with their reasons.

**The dependency pins now match the interpreter**, which D-04 already said they did. Six of ten
in `requirements.txt` had drifted away from the environment producing a green CI, and
`pytest-cov` was pinned, never installed and never invoked. `backend/tests/test_pins.py` compares
both requirement files to the running interpreter on every CI run; VERIFICATION §11 has the
before and after.

**`ruff` is in the gate as of 2026-09-18.** It was pinned, configured and never called — which
reads as coverage and is not. Eleven findings: six mechanical, three long lines, and four `E741`
complaints about the name `O`, which is IndVisSGG's own symbol for the object vocabulary and is
exempted per-file with the reason written into `pyproject.toml` rather than renamed away from the
paper it reproduces.

**M0's three playgrounds landed 2026-09-20.** A `playground` step is a knowledge-point id in
the frontmatter and one `<Playground kp="…"/>` in the body, supplied through the MDX `components`
prop the way `Step` already is. F1 turns the layers off to leave the bare photograph and moves the
annotation density against a candidate space that does not move; F2 builds edges over six objects
as real buttons rather than a cytoscape canvas, because a canvas node cannot be a `<button>` and
check 8 walks the lecture by keyboard; F8 swaps subject and object and reports 「收錄於 E」 against
「未收錄於 E」, never 真 against 偽. Nothing a playground computes is a metric — a count, a bound and
a set membership are M0's own definitions, and R@K belongs to a lab. All three import their data
at build time from the committed placeholder slice, so they compute with no backend, no network
and no corpus, which `e2e/lecture.spec.ts` now asserts against a preview server with nothing behind
it. Nine golden cases in `data/content/playground_golden.json` pin the arithmetic, each writing out
the sum a reader would check. Eight lint rules hold the frontmatter, the body, the mount table and
the two locales together, and each was watched failing. M0 went from 4 steps to 7, and the corpus
from 92 to 95. See D88.

**Review found the projector check blind on exactly this content.** `projector.spec.ts` resolved
a colour by regex over `rgb()` and skipped what it could not parse; Tailwind v4 emits `oklch()`,
so 13 of 20 text rows on the F1 step were never measured and the readouts were sitting at 4.55:1
against a binding 7:1. The instrument paints to a canvas now, reports what it could not read, and
asserts that report is empty before judging anything else; the ink is `slate-700`, `emerald-900`
and `amber-900`, measured at 9.90, 9.20 and 8.66. The playgrounds were also the smallest type in
the corpus at 14 px, because Tailwind sizes in rem against the document root rather than em
against the 24 px shell, and they are sized in `em` now. See D88 and VERIFICATION §15.

**Twenty-two live knowledge points still have no playground.** `kp.json` marks 27 points
`status: 'live'`; F1, F2, F6, F7 and X1 are five of them, and F8 is not among them at all, so 22
remain. Each is its own cycle against the pattern M0 established. [21 after D97's F3, 19 after
D98's E1 and E10, and 14 since D106's E3, E4, E7, E13 and X2: E5, E6 and E11, which L2 and L3
score, and T1, T2, D1, O1, V1, L8, L9, L10, S1, G2 and G4.]

**M1's three playgrounds landed 2026-09-26, after the premise X1 rested on was corrected.** F6
merges four spatial predicates and three names for people over the committed `vg150-sgb` slice,
reporting class counts, the merged count as its written sum, and whether a substituted predicate
is recorded in E or in E′. F7 shows the shape of a Zipf distribution as ratios of counts, with the
slice's own ranking beside it and no recall at all, because L3 scores that. X1 shows four VG150
releases, every figure with the passage it was copied from, and computes differences that turn out
to equal figures the sources state independently. Opening those sources found that M1 s4's "share
a name and not a test set" was not supported, that D-09 described an `h5` corpus the project never
had, and that the frozen X1 labelled a withdrawn release as current; each is corrected or annotated
in place. A twelfth lint rule checks every X1 figure's digits against its quote. The final review
found X1's citations, F7's legend and, older than this branch, F1's candidate count and ratio
hidden under the frame's clip at every panel size; the frame now clips only pictures, and the
projector test reports any word an ancestor cuts off. M1 went from 6
steps to 9, the corpus from 95 to 98. See D93 and VERIFICATION §17.

**A review of the day's merges found F6's status line under the clip, 2026-09-26.** In the state
its step exists to show, with a merge ticked, F6's readouts wrap and the line saying whether the
edge is recorded in E′ fell below the frame's clip at 1024×768 and 1280×800; the projector test had
measured F6 only in its default state. F6 no longer clips, and the test measures it with both
merges. The same review bound X1's explanations to the split they are about, replaced a
disjointness verdict no source makes with the pool the card names, made rule 12 check shares as
written, and removed "withdrawn" from the brief. Overflow in every state, M0's included, is in
VERIFICATION §19 for the author. See D95.

**The long playgrounds split across steps, and triplets counted as a set, 2026-09-26.** On the
author's decisions about D95's open items, a playground too tall for one panel now spans
consecutive steps as parts, with its knobs carried between them: F1, F6 and F7 in two and X1 in
three. Every part fits 1024×768 in 繁體中文 in every state measured, where F1, F6, F7 and X1 had
run 387, 334, 188 and 619 px past it; English still runs up to 163 px past on X1's first part. M0
went from 7 steps to 8 and M1 from 9 to 13, the corpus from 98 to 103. F6 and F7 count distinct
triplets, 684 of the slice's 892 rows, and F6 writes out the two pairs its merge makes one. See
D96 and VERIFICATION §20. The branch review found F1's photograph rendering 0×0 at 1024 px and
wider, in both shells; it is sized now, and the projector suite measures it.

**M2's playground, F3, 2026-09-27.** One annotated box of `ph-001` and a prediction moved by Δx and
Δy and scaled by λ; F3 counts the pixels the two share and the pixels in either, divides them, and
sets the quotient against M2 s2's bound min(A, A′) / max(A, A′) and against τ, which starts at the
0.5 Xu et al. state. It spans two parts, M2 going from 6 steps to 8. Three statements about IoU the
opened sources contradict were corrected first: the frozen F3's scale ceiling was min(λ, λ⁻¹)
rather than min(λ², λ⁻²), its note said the reference implementation never states the threshold,
which its configuration does, and M2 s2's presenter notes said L2 demonstrates the bound, which
its same-size boxes cannot. A screenshot found F3's marks drawn 122 px below the objects in its
longest state, 96.5 px at Δx = 18, with every readout correct; the projector suite now measures the overlay against the photograph. See
D97 and VERIFICATION §21.

**M3's playgrounds, E1 and E10, 2026-09-27.** E1 injects one defect per toggle into box#3 on
table#1 of `ph-001`, each falsifying one conjunct of the match relation, and shows the verdict the
engine's diff gives, held to `classify` over all 32 settings. E10 shows what each protocol hands
the model and counts the hypotheses it leaves per triplet, exactly, from 480 to a 24-digit number
under SGDet. Each spans two parts, M3 going from 7 steps to 11. Four statements were corrected
first: s3 claimed the recall ordering for every model, where what is forced is the inclusion of
hypothesis spaces and the ordering is observed in the benchmark's own table; the frozen E10 said
the engine asserts it, which it does not; s3 counted |V|² pairs and set ⊇ between numbers; and s2
derived four diff colours from two failure modes, where the engine gives the four combinations
three verdicts. F3's overlay became `PhotoMarks`, shared by all three. See D98 and VERIFICATION
§22.

**The graph constraint keyed on object pairs, 2026-09-27.** Both engines had keyed the graph
and semi constraints on the ordered pair of class names, where Tang's evaluator, M4's E4 and the
SRS key on objects; two hands on one assembly kept one predicate between them. `Triplet` now
carries its object ids and both engines key on them; a fourteenth golden vector pins the
difference, and the golden builder now reproduces the two vectors it had been missing. D51's
thirteen imperfect mini-ISG frames are four, and `semi` is described in M4 and M12 as the cap it
is. See D99 and VERIFICATION §23.

**The review minors, 2026-09-27.** The nineteen minors that the reviews of D97, D98 and D99
deferred are settled. E10 numbers its boxes on the photograph, marks its chosen row with a sign,
prints B from the frame's size, and fits the panel in English, as E1 now does; `withDefects`
takes its table; F3's IoU is held to the engine's at every knob setting; both engines refuse a
repeated `object_id`; and `gv-017` pins `semi`'s cap per object pair. See D100 and
VERIFICATION §24.

**The knowledge points indexed, and the freeze released, 2026-09-27.** `/map?view=kp` lists the
93 knowledge points by cluster, each linked to the module that owns it and, where it has one,
to the lecture step of its playground; the papers stay the default view. The owner is read from
`assignment.json`, because a module's frontmatter also lists the points it only draws on. D-23
releases the knowledge-map page from D-13's freeze; the harvest, the validators and D-14 stand.
See D101 and D-23.

**The deferred minors, 2026-09-27.** The five minors D100's review deferred are settled. A graph
with both a dangling reference and a repeated id answers `dangling_reference`, as contracts §1.1
gives it; `gv-017` lists the two warnings the engine emits for it; E10 names the boxes SGCls hands
over by their ids, and F3, E1 and E10 take their frame from their setup; E1's toggles carry their
axes in both locales, filled from `E1_DEFECTS`; and E10's table holds its columns still when the
protocol changes, where they had moved by up to 40 px. See D102 and VERIFICATION §25.

**The open checks, 2026-09-28.** Every golden vector lists the complete set of warnings the
engine raises for it, derived in its `why`, and both harnesses compare that set exactly, so a
warning raised in error fails; eleven vectors had listed fewer. `i18n_parity.mjs` requires each
key to carry the same placeholders in both locales, each as often, and no value to repeat one,
and a suite holds its four rules. `npm run check:perf` passed 23 on the merged `main`. CI for `9b678af` is still waiting
for a runner. See D103 and VERIFICATION §26.

**The review of the open checks, 2026-09-28.** The exact comparison held only the warnings some
vector raises, and no vector ran SGCls or carried masks in one graph only, so either engine could
drop `masks_ignored` or SGCls's `gt_boxes_not_pairs` and every harness passed. gv-018 and gv-019
raise them, and two tests require the vectors to raise every warning and run every protocol;
gv-020 holds the tie rule on predictions without a score. An empty training split has no vector:
the engines treat it as none supplied, SRS §4.3's definition gives zR = R, and the choice is the
author's. [Settled by D105.] `i18n_parity.mjs` refuses a braced name outside `\w+` and a brace outside any
placeholder, neither of which its comparison could read; the missing-key check is tested in both
directions; each records test reads its own record alone, and the count of golden vectors is
taken from the file.
`npm run test:e2e` and `npm run check:perf` passed on `main` at `5eabab6`. CI for `5eabab6` is
still waiting for a runner. See D104 and VERIFICATION §27.

**The empty training split, 2026-09-28.** The author ruled that `zero_shot_train_triplets: []` is
no split: zR is null and `zero_shot_unavailable` is raised, as both engines already did, where SRS
§4.3 read literally gave zR = R. SRS §4.3, design.md §4.3 and contracts §1.5 are amended in place, the contract
also stating that an unscored prediction never ties, and gv-021 pins the ruling. No engine code
changed. See D105 and VERIFICATION §28.

**M4's playgrounds, E3, E4, E7, E13 and X2, 2026-09-28.** E3, E4 and E7 share one ranked list of
twelve predictions on `ph-001`, drawn as a table with the cut at k and the chosen row's pair on the
photograph. E3 counts the top k under the graph constraint; E4 counts it under graph, semi and
none, beside the unconstrained count at the same k; E7 caps the predicates per pair at m and shows
the pool growing 7, 11, 12 while the count at k = 2 falls from 2 to 1. E13 counts what SingleMPO and
MultiMPO admit at one mask pair and whether person holding wrench is matched; X2 counts VRD's
candidates, 30, 300 or 2,100, against the cut at 100. Each follows the math step that teaches it,
E3, E4 and E7 in two parts each, M4 going from 11 steps to 19. Five statements were corrected
first (M4's step ids before the renumbering): s3 derived R@k ≤ ngR@k from an inclusion between two top-k cuts, which three predictions on
the built engine refute (R@2=1, ngR@2=0); s5 derived recall rising with m at a fixed k; s4 named a
slider the lecture does not have and divided by C where the engine averages over |P′|; s6 called
recall affine in λ; and s8 wrote k for VRD's per-pair count and cited a proposition the course
never states. s10's account of L3 was corrected with them. M4's parts fit 1024×768 in 繁體中文 through `PlaygroundFrame`'s opt-in `dense`,
which leaves the nine earlier playgrounds' measured layout as it was. The branch's final review
found the first parts of E3, E4 and E7 described in their notes but not shown, and three other
modules citing M4's steps by their old ids; the first parts now name the chosen row and, for E4
and E7, the pool, the citations name s13, s8 and s17, s12's blend is the score σ_p(λ), and the
brief's unconditioned R@k ≤ PR@k is left open. See D106 and VERIFICATION §29.

**M5's playgrounds, T1 and T2, 2026-09-29.** T1 sets a frame's ordered pairs, N(N − 1), and its
N(N − 1) · 50 decisions over VG150's 50 predicates against the relationship rows and the related
ordered pairs the frame annotates, over the 80 frames of the vg150-sgb slice ordered by object
count: 5 of 240 pairs are related at the median frame, and 651 of 26,282 over the slice. T2 runs
the course's averaging rule, b⁽ᵗ⁺¹⁾ = (1 − w)b⁽⁰⁾ + wSb⁽ᵗ⁾, on `ph-001`'s six objects over their
annotated relations or every pair, and shows the six beliefs, their spread, for w < 1 the distance
to the fixed point beside its bound wᵗ‖b⁽⁰⁾ − b*‖∞, and at w = 1 the degree-weighted mean they
converge to, 0.5083 against the plain mean 0.4833. Each follows the math step that teaches it, T2 in two
parts, M5 going from 6 steps to 9. Two statements were corrected first (M5's step ids before the
insertion): s2 set GQA's 310 predicates against Visual Genome's relation rate, where the course's
corpus is VG150 with 50, and s3 claimed consensus for every w > 0, reached its fixed point in one
round under a whole-graph mean and wrote a per-step contraction that the checkpoint repeated. For
w < 1 the beliefs settle at a fixed point that keeps each node's own evidence, at a spread of
0.3924 when w = 0.5, and only at w = 1, on a connected graph with an odd cycle, do they meet. M7,
which quoted M5's old rate, and the map's Proposition 6 were corrected with them. The averaging
matrix is written S, since M2's A is area; CLAUDE.md's rule for what a playground computes now
admits a value of the rule its step teaches, and contracts §2.4 was amended in place to match,
accepted by the author on 2026-09-29; and both frames take M4's `dense`. Two M4 tests of
`registry.test.tsx`, which contention ran past vitest's 5000 ms default in four of the branch's
tasks, carry a measured timeout of 20,000 ms. The branch's eleven golden cases and its harvest are
on the NAS, which every branch reads, so `main` before the merge fails `npm run ci`: content lint
refuses golden cases for the unregistered T1 and T2, and the golden test fails at `pg-T1-rank1`;
and running `main`'s harvest rewrites `kp.json`, `math.json` and `deriv.json` on the NAS with M5's
old text. A revert after the merge needs the eleven cases deleted from
`data/content/playground_golden.json` by hand and `npm run harvest` run on the reverted tree. See
D111 and VERIFICATION §30.

**M0's demonstrations, D-T and D-V, 2026-09-30.** Nine steps, `m00` s7 to s15, replay two recorded
pipelines over one 18.0 s clip of IndustReal's `01_assy_0_1.mp4` (88.0 to 106.0 s, 2,139,278 bytes) and ten
frames cut from it. D-T, four parts, is the traditional pipeline: a COCO Faster R-CNN detects 52 objects over
the ten frames, and the 224 ordered pairs take a predicate from an 80-frame frequency prior, every one of them
the fallback `on`, 166 because a class maps to no slice class and 58 because the pair never occurs in the
prior. D-V, five parts, is IndVisSGG's three-step pipeline (a draft, three experts' revisions, a summary),
recorded on the author's pro6000 server with `stamping-vlm` (Qwen/Qwen3.8-27B) and not on the Anthropic API
(D114); the expert prompt and the revision parser were corrected first (D115), and the transcript is 132,893
bytes over 50 calls. A demo computes counts, set memberships and set differences over the recordings, never a
metric, and shows the model's words as model output, unrewritten. The `demo` step kind has five lint rules and
its own mount tables (`DEMO_PARTS = { DT: 4, DV: 5 }`), and the demonstrations' graphs are filed under
`mini-isg` (D113). Where the spec drew graphs, strips and three columns, the build lists, numbers and shows one
expert at a time, so that every part fits 1024×768 at 18 px in 繁體中文 (D116). M0's lab and checkpoint moved from
s7 and s8 to s16 and s17, which orphans stored quiz schedules keyed `m00:s8:*`, and the corpus went from 120 to
129 steps a locale (D117). The live VLM provider had sent no frame, so a live L5 run on the paper's Figure 2
now answers 503 (D112). Three parts run past the panel in English (D117). The recordings and derived files are
on the NAS, in no commit. See D112 to D117 and VERIFICATION §31.

**Verification.** `npm run ci` green, 2026-09-30, on branch `feat/m0-demos` with D117's records: **356 pytest** and 7 skipped, parity 21 agree, i18n 505 keys both locales,
**1234 vitest** in 83 files across metrics, tools and frontend, content lint clean (15 of 15 modules x 2 locales, 93 points
assigned, 50 symbols, 75 playground cases, 25 release figures, **and every step's presenter notes in both locales**), `ruff` clean over
`backend` **and `tools`** (D79),
frozen-page lints clean, standalone current (254 equations), frontend builds. `npm run test:e2e`,
2026-09-30, on branch `feat/m0-demos`:
107 passed across the keyboard walkthrough, the playgrounds, the demos and the three projector resolutions. `npm run
check:offline`: 9 passed, re-run 2026-09-30 on the torch-free interpreter. `npm run
check:perf`, 2026-09-30, on branch `feat/m0-demos`: 33 passed, NFR-8 measured over five labs and sixteen playgrounds and two demos, plus the D75 selection guard. `npm run check:pins`: 9 of 9 and 5 of 5 agree.

**The lint suite guards all eleven playground rules, 2026-09-26.** D91 wrote
`tools/test/content_lint.test.mjs` so that deleting a rule fails the gate. Disabling each rule in
turn showed it missed eight of seventeen mutants: rules 3 and 7, both halves of rule 8, and two
clauses of rule 9. Its fixture had one module and one frontmatter, so no defect needing two of
either could be expressed. It had 18 tests after that change and caught 17 of 17. It has 45 now,
over twelve rules (D93 to D96), and the mutation runs of VERIFICATION §17 to §20 caught 23 of 23,
10 of 10, 4 of 4 and 8 of 8. The same review found
VERIFICATION §15 still printing the clamped `0.0 ms` that D91 had withdrawn, and the paper corpus
at 60 cards against D-21's 35 with no entry recording why. See D92 and VERIFICATION §16.

**The gate was green here and red on the runner, 2026-09-19.** `main`'s GitHub Actions run had
failed on five consecutive pushes, including the two that recorded checks 12 and 13 as passed.
D81 fixed the first three and the same commit caused the next two: `tools/test/py.test.mjs`
spelled the Windows interpreter layout into all seven of its assertions while `py.mjs` read the
platform from the host. `platform` is an injected parameter now and both layouts are asserted
from either machine — 20 tests where there were 7 (D83). A second finding came from running the
suite the way this machine is configured: with `SGS_CORPUS_ROOT` set, which is the only
configuration in which the four adapter tests run at all, one settings test was asserting the
ambient environment instead of the rule (D84). VERIFICATION §14 has both, and the three
documents that carried three different test counts. `lint:mockup` also stopped printing a jsdom
`Error: Not implemented: window.scrollTo` in the middle of its 13 passes (D85).

Building that interpreter turned up two findings of its own. The offline harness could not be run
the way its own usage note says to run it — a relative `--python` path was resolved against the
backend's working directory (D77). And once the venv existed, the RelTR vendoring guard fired on
a `dns.py` inside it, because a virtual environment is neither `node_modules` nor `__pycache__`
(D78). A licence guard that fires on an ordinary developer action is the kind that gets waved
through, so the scan now skips `site-packages`.

---

## 6. Traps this project has already fallen into

Each cost real time. They are indexed here because a reader of the plans alone would not meet them
until they had already happened.

| Trap | Where it is written up |
|---|---|
| A bare `data` pattern in a parent `.gitignore` swallows a whole tree, and git will not descend into an ignored directory, so negations inside it never fire | `KNOWLEDGE_BASE.md` §19.2 |
| "Read the source's own statement" means **every** place the source publishes — IndoorVG states no licence on GitHub and CC BY 4.0 on Hugging Face | `data/LICENCES.md`, indoorvg |
| A recorded corpus layout written from memory was wrong in two of three fields | `LAYOUTS`, and D17 |
| A cutter that copies images from a directory writes a silent empty slice when the corpus embeds them instead | `DEVIATIONS.md` D17 |
| A test that asserts "nothing cut yet" goes stale the moment something is cut | `DEVIATIONS.md` D19 |
| Freezing forbids extending, not correcting — a frozen artefact teaching something false is worse than one out of date | `FROZEN.md` |
| Numbering an appended entry without reading the end of the file collides with what is there | this index, written after D7–D9 had to become D17–D19 |
| A unit test that waits for a render between two keypresses cannot see a lost keypress; a browser does not wait | `DEVIATIONS.md` D67 |
| One key with two encodings stays invisible until something writes it both ways | `DEVIATIONS.md` D68 |
| A scrolling container clamps its child's bounding rectangle, so the overflow you measure is zero | `DEVIATIONS.md` D70 |
| A layout measured before the webfonts decode is a layout that is never painted | `DEVIATIONS.md` D70 |
| A colour's contrast ratio written into a comment from memory reads as a measurement and is not one | `DEVIATIONS.md` D54 |
| A contrast instrument that parses one colour syntax silently skips every element written in another, and reports a pass over the quarter of the slide it could read | `DEVIATIONS.md` D88 |
| An instrument's skip list can only report what its loop reaches, so a tag allowlist is a second silent skip hiding behind the report that was added to end the first | `DEVIATIONS.md` D91 |
| A canvas keeps its previous `fillStyle` when handed a colour it cannot parse, so priming with black scores every unresolvable colour as the highest contrast on the slide | `DEVIATIONS.md` D91 |
| `Path.write_text` translates the newline to `os.linesep`, so a Python generator writes CRLF on Windows however the file is pinned in `.gitattributes` | `DEVIATIONS.md` D91 |
| Clamping a difference between two noisy samples at zero turns "below the resolution" into an apparent measurement of none | `DEVIATIONS.md` D91 |
| A lint rule watched failing by hand and then only described in prose leaves nothing that notices its deletion | `DEVIATIONS.md` D91 |
| A test suite is an instrument too: a fixture with one module and one locale cannot express a cross-module or cross-locale defect, so those rules can be deleted with the suite green, until each rule is disabled in turn | `DEVIATIONS.md` D92, `VERIFICATION.md` §16 |
| A correction recorded in a deviation is not a correction of the document that carried the error, which keeps printing it | `DEVIATIONS.md` D92 |
| A binding decision can describe an artefact the project never obtained, and nothing compares the two | `DEVIATIONS.md` D93 |
| Comparing a count with every digit of its quote run together passes a figure from the wrong column, and one straddling two numbers | `DEVIATIONS.md` D94 |
| A playground measured only in its default state says nothing about the state its step exists to show, and an acceptance of overflow inherits the same blind spot | `DEVIATIONS.md` D95, `VERIFICATION.md` §19 |
| Moving a step's text to a step of its own cannot fit a playground whose frame alone is taller than the panel; the playground itself has to be divided, and its knobs carried across the division | `DEVIATIONS.md` D96, `VERIFICATION.md` §20 |
| A count of relationship rows is not a count of triplets when a frame annotates one twice, and a merge can make two rows of one pair the same triplet | `DEVIATIONS.md` D96 |
| A regularity quoted as forced is checked by asking what the argument proves: an inclusion of what each protocol allows bounds no model's recall | `DEVIATIONS.md` D98, `VERIFICATION.md` §22 |
| Two pools that nest do not make their top k nest: each cut is taken from its own pool, so at a fixed k either recall can be the larger | `DEVIATIONS.md` D106, `FROZEN.md` 2026-09-28 |
| A layout tightened in the shared control kit to fit one playground moves every playground an earlier record measured, with every test still passing | `DEVIATIONS.md` D106, `VERIFICATION.md` §29 |
| An overlay on a photograph is right only if it has the photograph's box; given a stretched column instead, `meet` scaling moves every mark off its object while every number beside it stays right, and only a picture of the slide shows it | `DEVIATIONS.md` D97, `VERIFICATION.md` §21 |
| An `overflow: hidden` box inside a scrolling step hides words no scroll can reach, and a contrast walk that asks only whether a word is painted measures them as passing | `DEVIATIONS.md` D93, `VERIFICATION.md` §17 |
| A figure repeated across a page, a brief and a decision from one early reading is wrong everywhere at once, and only opening the source finds it | `DEVIATIONS.md` D93, `FROZEN.md` 2026-09-26 |
| A framework that sizes in rem puts its text at the document root, not at the shell the component is mounted in, so a 24 px lecture can contain 14 px type | `DEVIATIONS.md` D88 |
| A generated file that git checks out with different line endings than the generator writes leaves `git status` dirty after every green run, with `git diff` showing nothing | `DEVIATIONS.md` D89, and the rule above it in `.gitattributes` |
| An input-to-paint measurement that awaits two animation frames cannot report less than two frame intervals, so five different labs all came back at the display's cadence | `DEVIATIONS.md` D74 |
| `<rect fill="none">` is hit-tested on its outline only, and handing the interior to the browser hands the choice to paint order | `DEVIATIONS.md` D75 |
| jsdom has no hit testing, so a DOM test of "what does this click select" passes against a component nothing can click | `DEVIATIONS.md` D75 |
| A pin that no longer matches the interpreter still reads as a version somebody tested | `DEVIATIONS.md` D74, `VERIFICATION.md` §11 |
| A module that reads `process.platform` at its top, and `node:path`'s host-flavoured `join`, can only be asserted on the host the test runs on — so make the surroundings an argument rather than add a second machine | `DEVIATIONS.md` D83 |
| The configuration that unskips the tests worth running is the configuration nobody runs the suite in | `DEVIATIONS.md` D84 |
| Three documents quoting the same measurement will give three different numbers unless something compares them to a run | `VERIFICATION.md` §14 |
| A jsdom gap can make a whole navigation silently not happen, leaving the assertion to compare the old value | `DEVIATIONS.md` D55 |
