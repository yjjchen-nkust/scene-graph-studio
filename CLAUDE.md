# CLAUDE.md — Scene Graph Studio

## Read this first

`docs/INDEX.md` is the knowledge index for this track. It indexes the specs, the plans,
`docs/VERIFICATION.md` (the nine checks of design §6, each with its date and outcome — all nine
run and passed — plus §10 NFR-8 measured, §11 the dependency pins, §12 the interpreter, §13 the
CUDA build, §14 the runner gate, §15 the M0 playgrounds, §16 the lint suite by mutation, §17 the M1 playgrounds, §18 the M1 minors, §19 the review of the day's merges, §20 the split playgrounds, §21 the M2 playground, §22 the M3 playgrounds, §23 the graph constraint's key, §24 the review minors, §25 the deferred minors, §26 the open checks, §27 the review of the open checks, §28 the empty training split and §29 the M4 playgrounds), and all 106 logged deviations. It is kept current. **Read it
before changing anything.**

## What this is

A full-stack teaching application for scene graph generation, built for 大語言模型技術與應用
(2026) and anchored on Wang et al., *IndVisSGG*, Advanced Engineering Informatics 65 (2025)
103107. It teaches 15 bilingual modules over 93 knowledge points, with 8 labs, 14 playgrounds, 60 paper
cards and 5 frozen leaderboards.

It lives at `scene-graph-studio/` inside the WekaExt repository and is **not** a separate
repository (decision **D-22**, which superseded both D-01 and D-20 on 2026-09-19 when the track
moved here from the `course-lab` teaching repository). It is independent of the rest of WekaExt:
it shares no code, no build, no dependency and no deployment with the platform, and its own CI is
a separate path-filtered workflow. That independence runs one way: WekaExt's `ci.yml` has no
`paths:` filter of its own, so a commit touching only this track still runs the platform's backend
and frontend jobs — that is the platform's file to fix, not this one. Do not wire this track into
WekaExt's `docker-compose.yml`, `ci.yml` or `deploy.yml`.

## Layout and commands

**All machinery lives under `system/`** — the npm workspace root, `backend/`, `frontend/`,
`packages/sgg-metrics/`, `tools/`, `web/`. `data/`, `docs/`, `start.ps1` and `fetch-data.ps1`
stayed at the track root. **Every `npm` command runs from `system/`.**

```powershell
cd scene-graph-studio ; .\start.ps1     # checks both toolchains, installs on first run, launches
cd scene-graph-studio\system ; npm run ci
```

- **Node ≥ 22.12 is a hard prerequisite** (`vite@8.3.0` engines). Measured: 24.19.0. D-03 closed.
- **Python is `py12`, never the bare `python` on PATH.** `system/tools/Resolve-Python.ps1`
  (PowerShell) and `system/tools/py.mjs` (Node) resolve it; `SGS_PYTHON` overrides both, which is
  what CI sets. The track is self-contained and reads no environment script from outside itself.
- **`npm run ci` is the gate**, twelve steps: harvest, pytest, the metrics build, vitest, ruff,
  parity, i18n, content, frozen, mockup, standalone, frontend build.
- **Four checks `ci` does not run**, each for a reason: `npm run test:e2e` (check 8, the keyboard
  walkthrough at three projector resolutions, 79 tests, over the production build with no backend
  running), `npm run check:offline` (check 6, a torch-free interpreter with every outward request
  intercepted), `npm run check:perf` (NFR-8, cold start on five routes and input-to-paint on five
  labs and fourteen playgrounds, against a backend it starts itself), `npm run check:pins`.

## Traps

- **Two numbering schemes coexist and collide.** `D-01…D-23` are binding decisions in
  `docs/superpowers/specs/…-decisions.md`. `D1…D106` are deviations in `DEVIATIONS.md`. **`D-22`
  and `D22` are different documents about different things.**
- **`system/web/knowledge-map/` was frozen** (2026-09-15, D-13) and harvested into
  `data/content/` as the seed corpus. **The freeze was released 2026-09-27 (D-23)**: the page may
  be extended, but it is still the harvest's source, so edit the page, run `npm run harvest`, and
  commit both; and it must still open from disk with no build step. Its `pg.js evaluate()` is a
  teaching toy over fifteen hard-coded rows and **must never be promoted to the evaluation
  engine** (decision **D-14**, which D-23 leaves standing).
  `system/tools/audit.js` and `check.js` validate it; `audit.js` exists to catch a `\` line break
  inside display math outside an alignment, which MathJax renders as a visible red error rather
  than failing loudly.
- **The graph constraint keys on the ordered object pair, not the class pair** (D99). Tang's
  evaluator keeps one predicate per pair of predicted object indices, and so do both engines:
  `Triplet` carries `subject_id` and `object_id`. Two hands on one assembly are two pairs.
  `semi` caps predicates per object pair; it is not the Semi Constraint STTran proposed for Action
  Genome, which the course states and the engine does not compute.
- **Box selection is `geometry.pickObjectAt`, not the browser's hit test** (deviation **D75**). A
  bounding box is drawn `fill="none"`, so SVG hit-tests its outline and a click in the middle of
  an object selects nothing. `pointer-events: all` would hand the choice to paint order, so the
  click handler sits on the `<svg>` and picks the smallest box containing the point, ties broken
  by the lower object id. **Do not move it back onto the rects.**
- **`ImageOverlay` has no width of its own.** Its children are all absolutely positioned, so a
  container that does not give it a width renders the photograph 0×0, with no error and a step
  that "fits" the panel. F1 did so on every projector until D96;
  `F1, F3, E3, E4 and E7 show their photographs, whole and on the screen` in
  `e2e/projector.spec.ts` now measures it. F3, E1 and E10 draw through
  `playgrounds/PhotoMarks.tsx`, an `<svg>` over the same kind of photograph that must have the
  photograph's box exactly (E3, E4 and E7 through `playgrounds/M4/PairPhoto.tsx`, which uses it):
  in a stretched column it drew every mark 122 px below its object in F3's
  longest state, 96.5 px at Δx = 18, with every readout correct (D97), and
  `F3, E1, E10, E3, E4 and E7 draw their marks on their photographs` now measures that (D98, D106).
- **Presenter notes are mandatory.** `system/tools/content_lint.mjs` refuses a step without them
  in both locales (**D76**). All 117 steps carry theirs; 234 notes.
- **`docs/brief.standalone.html` is generated** from `system/web/brief/index.html`, and
  `npm run lint:standalone` asserts they agree. Edit the source, then run
  `npm run build:standalone` in the same commit.
- **Generated files are pinned to LF in `.gitattributes`, and the reasons are written there.**
  `core.autocrlf=true` checks a file out as CRLF while every generator here writes LF, which
  either fails a byte-equality step or — worse, because it is silent — leaves `git status`
  dirty after every green gate with `git diff` showing nothing (**D89**). Adding a generator
  that writes into a tracked path means adding its path there too.
- **Large binary corpora are not committed.** `data/_raw/` (4.7 GB) and `data/slices/*/images/`
  are excluded by this track's own `.gitignore`; `fetch-data.ps1` retrieves them. WekaExt's root
  `.gitignore` has no rule over this tree, so every exclusion the track needs is stated locally.
- **The design document's ARM64/Snapdragon hardware table describes a different machine** and is
  marked superseded in place.
- **A playground reads `data/` from outside vitest's root, and the allow list is why that works.**
  `frontend/src/playgrounds/` imports the placeholder slice and its images from `data/`, which is a
  sibling of `system/` rather than a descendant, so Vite's filesystem guard denies the read and six
  suites fail to collect. `vitest.config.ts` sets `server: { fs: { allow: ['..'] } }` on the
  frontend project, which replaces Vite's defaults rather than adding to them — the root is itself
  under that parent, so listing the parent alone still covers everything the defaults did. Removing
  it turns the gate red at step 4 with an error that names neither the config nor the cause.
- **A playground is a step kind, not a lab.** `kind: playground` with `kp:`, one
  `<Playground kp="…"/>` in the body, registered in `frontend/src/playgrounds/mounts.tsx`;
  contracts §2.4 is normative and `content_lint.mjs` holds eleven rules over it, and a twelfth over
  `data/content/vg150_splits.json`, each
  failing a test in `tools/test/content_lint.test.mjs` when disabled (D92 for the eleven, D93 to
  D95 for the twelfth). **It computes a
  count, a bound or a set membership, never a metric** — a metric is a lab's business and the
  boundary is the point. Nothing in `frontend/src/playgrounds/` imports from `sgg-metrics` except
  its types, and three tests in `playgrounds/test/logic.test.ts` that hold F3's IoU to `boxIou`, on the golden cases and at every knob setting, and E1's verdict to `classify` (D97, D98, D100), and four more there that hold M4's cap to `applyConstraint`, its counts to `evaluate`, and E13's admission to `applyPairing` and its match to `evaluate` (D106). M0 carries three (F1, F2, F8), M1
  three (F6, F7, X1), M2 one (F3), M3 two (E1, E10) and M4 five (E3, E4, E7, E13, X2); 14 live knowledge points have none. See D88, D93, D97, D98 and D106. **`PlaygroundFrame`
  clips only a picture** (`clip`, default on): a playground of words and figures passes
  `clip={false}`, because a word under the clip is beyond the reach of the step's scroll (D93).
  **`PlaygroundFrame`'s `dense` is M4's**, for its twelve-row lists at 1024×768; the earlier
  playgrounds keep the measured default, and their records (D95 to D102) measure it (D106).
  **A playground too tall for one panel spans consecutive steps as parts** (D96): `part: n` on
  each step and its tag, the count in `PLAYGROUND_PARTS` in `mounts.tsx`, E1, E10, E3, E4, E7, F1, F3, F6 and F7 in two
  and X1 in three. The stepper carries the knobs between the parts of one playground and nowhere
  else, and the projector suite asserts that every part fits 1024×768 in 繁體中文 in its longest
  state. **F6 and F7 count distinct triplets** (D96): E is a set, and 208 of the slice's 892
  relationship rows repeat a triplet of the same frame.

## CI

`.gitea/workflows/scene-graph-studio.yml` at the WekaExt root, filtered to
`scene-graph-studio/**`, Node 22.12, Python 3.12, `SGS_PYTHON: python`, running `npm run ci`.
Deployment is out of scope: the earlier attempt was abandoned over a private repository,
third-party content and the backend dependency, and none of those has changed.
