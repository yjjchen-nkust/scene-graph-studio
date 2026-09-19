# Knowledge index

Every planning document in this track, what it governs, and where each piece of knowledge is
defined. Current as of **2026-09-19**.

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
| `superpowers/specs/2026-09-15-…-decisions.md` | **D-01…D-21. Binding. Read before any task.** | live |
| `superpowers/specs/2026-09-15-…-contracts.md` | **Normative field names, types, enum spellings** | live |
| `superpowers/specs/2026-09-16-indvissgg-reading.md` | The anchor paper read as M11's source | reference |
| `superpowers/specs/2026-09-19-playgrounds-design.md` | The `playground` step kind, and the three that complete M0 | **awaiting review** |
| `superpowers/plans/…-00-master.md` | Index, dependency graph, global constraints | live |
| `superpowers/plans/…-01-skeleton-and-eval-engine.md` | Phases 1–2 | **executed** |
| `superpowers/plans/…-02-graph-labs-and-content.md` | Phases 3–4: graph, L1, L2, harvest, corpus | **executed** |
| `superpowers/plans/…-03-models-and-vlm.md` | Phases 5–6: registry, RelTR, L4, L6, L5 | **executed**; the measured prediction tier is blocked on licences, see PROVENANCE.md |
| `superpowers/plans/…-04-labs-shells-hardening.md` | Phases 7–9: L3, L7, L8, shells, hardening | **executed** |
| `PLAYBOOK.md` | How this was built, as reusable prompts for the next project | reference |
| `../DEVIATIONS.md` | **D1…D86. Every departure from plan, with its reason.** | live |
| `VERIFICATION.md` | **The nine checks of design §6, plus NFR-8 (§10), the pins (§11), the interpreter (§12), the CUDA build (§13) and the runner (§14)** | live |
| `../data/LICENCES.md` | The two licence gates, per dataset | live |
| `../system/web/knowledge-map/FROZEN.md` | What is frozen, and every correction since | live |

`brief.standalone.html` in this directory is a build output, not a source. Edit
`../system/web/brief/index.html`; `npm run build:standalone` regenerates it and CI fails if it
drifts.

---

## 2. Decisions — D-01 … D-21

| | | |
|---|---|---|
| **D-01** | Repository lives at `AI-LLM/scene-graph-studio/` | not its own repo |
| **D-02** | Two machines; the ship target is the weaker | TEACH is ARM64, no CUDA |
| **D-03** | Node ≥ 22.12 is a hard prerequisite | **closed: 24.19.0 on both machines** |
| **D-04** | Dependency versions pinned at measured values | see master plan |
| **D-05** | Cache-first rule stands, rationale corrected | `maskrcnn-benchmark` is the real blocker |
| **D-06** | Live inference tier list; timeboxed detectron2 spike | RelTR only |
| **D-07** | Prediction provenance has three tiers | `measured` / `reconstructed` / `published` |
| **D-08** | **Author downloads corpora; class gets a cut bundle** | no script downloads a dataset |
| **D-09** | `vg150-sgb` is the split; bare `vg150` is forbidden | three things share the short name |
| **D-10** | Slice composition: 200 images, allocated per dataset | plus the selection rule |
| **D-11** | Eval engine is pure-Python stdlib | no numpy, no pycocotools |
| **D-12** | COCO RLE decoded in-house, both languages | |
| **D-13** | The knowledge-map is harvested, then frozen | see `FROZEN.md` |
| **D-14** | `pg.js evaluate()` is a teaching toy, never the engine | both sides would be wrong together |
| **D-15** | CI is one local command, mirrored by a workflow | `npm run ci` |
| **D-16** | Golden vectors are one JSON both engines read | neither embeds a copy |
| **D-17** | Live VLM provider is Claude, opt-in via `.env` | offline player is the default |
| **D-18** | Mini-ISG licence gate precedes any frame commit | |
| **D-19** | Effort estimates and the cut order | 44 days, four plans |
| **D-20** | The track is documented in the repo `CLAUDE.md` | and `KNOWLEDGE_BASE.md` §19 |
| **D-21** | Paper corpus is two tiers; only scored methods carry numbers | 35 cards, no unverified tier |

---

## 3. Non-functional requirements — NFR-1 … 8

| | | Enforced by |
|---|---|---|
| **NFR-1** | Offline-complete; every P0 feature works with the network down and `torch` absent | the committed placeholder slice |
| **NFR-2** | Honest numbers: every figure carries a source and a `verified` flag | `content_lint.mjs` |
| **NFR-3** | Two implementations, one truth | `parity.mjs`, 13 golden vectors |
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
| Protocols `predcls` / `sgcls` / `sgdet` | `design.md` §4.3; the `gt_boxes_not_pairs` warning is unconditional |
| Constraint modes `graph` / `none` / `semi` | `design.md` §4.3 |
| Mask pairing `single_mpo` / `multi_mpo` | `design.md` §4.3; L6 runs both |
| The 13 golden vectors | `system/backend/scripts/build_golden.py`, each with a `why` |
| Corpus layouts, per dataset | `system/backend/app/datasets/adapters/__init__.py` — `LAYOUTS` |
| Which datasets may be committed or distributed | `data/LICENCES.md` |
| The slice selection rule | `system/backend/app/datasets/loader.py` — `SELECTION_RULE` |
| Why the frozen page must not be extended | `FROZEN.md`, and D-13 / D-14 |
| The eight labs L1–L8 | `PRD.md` §6.2; per-lab tasks in plans 02–04 |
| The anchor paper's four equations | `design.md` §4.5 and `2026-09-16-indvissgg-reading.md` |
| How to build a project like this again | `PLAYBOOK.md` |

---

## 5. State, 2026-09-19

**Built.** Plan 01: FastAPI backend, the evaluation engine in Python and TypeScript held identical
by 13 golden vectors, slice ingestion with both licence gates, `/api/health`, `/api/eval`,
`/api/datasets`, the Vite frontend skeleton, and CI as one command.

**Data.** Corpora at `C:\DataRaw` (`SGS_CORPUS_ROOT`). Three slices cut with seed 20260915:
`vg150-sgb` 80 images, `indoorvg` 20, `psg` 50. Annotations and manifests committed; images
ignored, as the gate requires. `psg` took a manual download on three paths — `psg.json` from an
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

**Presenter notes are complete, 2026-09-19.** All 92 steps carry them in both locales, 184 in
total, written against each step's own content: what has to land, what to put on the board before
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

**Verification.** `npm run ci` green, 2026-09-19: **266 pytest** and 7 skipped (the ten newest
compare the requirement files to the interpreter), parity 13 agree, i18n 198 keys both locales,
**527 vitest** in 45 files across metrics, tools and frontend, content lint clean (15 of 15 modules x 2 locales, 93 points
assigned, 43 symbols, **and every step's presenter notes in both locales**), `ruff` clean over
`backend` **and `tools`** (D79),
frozen-page lints clean, standalone current (250 equations), frontend builds. `npm run test:e2e`:
26 passed across the keyboard walkthrough and the three projector resolutions. `npm run
check:offline`: 8 passed, re-run 2026-09-19 on a freshly built torch-free interpreter. `npm run
check:perf`: 13 passed, NFR-8 measured plus the D75 selection guard.

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
| An input-to-paint measurement that awaits two animation frames cannot report less than two frame intervals, so five different labs all came back at the display's cadence | `DEVIATIONS.md` D74 |
| `<rect fill="none">` is hit-tested on its outline only, and handing the interior to the browser hands the choice to paint order | `DEVIATIONS.md` D75 |
| jsdom has no hit testing, so a DOM test of "what does this click select" passes against a component nothing can click | `DEVIATIONS.md` D75 |
| A pin that no longer matches the interpreter still reads as a version somebody tested | `DEVIATIONS.md` D74, `VERIFICATION.md` §11 |
| A module that reads `process.platform` at its top, and `node:path`'s host-flavoured `join`, can only be asserted on the host the test runs on — so make the surroundings an argument rather than add a second machine | `DEVIATIONS.md` D83 |
| The configuration that unskips the tests worth running is the configuration nobody runs the suite in | `DEVIATIONS.md` D84 |
| Three documents quoting the same measurement will give three different numbers unless something compares them to a run | `VERIFICATION.md` §14 |
| A jsdom gap can make a whole navigation silently not happen, leaving the assertion to compare the old value | `DEVIATIONS.md` D55 |
