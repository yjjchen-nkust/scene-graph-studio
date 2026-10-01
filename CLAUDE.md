# CLAUDE.md — Scene Graph Studio

## Read this first

`docs/INDEX.md` is the knowledge index for this track. It indexes the specs, the plans,
`docs/VERIFICATION.md` (the nine checks of design §6, each with its date and outcome — all nine
run and passed — plus §10 NFR-8 measured, §11 the dependency pins, §12 the interpreter, §13 the
CUDA build, §14 the runner gate, §15 the M0 playgrounds, §16 the lint suite by mutation, §17 the M1 playgrounds, §18 the M1 minors, §19 the review of the day's merges, §20 the split playgrounds, §21 the M2 playground, §22 the M3 playgrounds, §23 the graph constraint's key, §24 the review minors, §25 the deferred minors, §26 the open checks, §27 the review of the open checks, §28 the empty training split, §29 the M4 playgrounds, §30 the M5 playgrounds and §31 the M0 demos), and all 121 logged deviations. It is kept current. **Read it
before changing anything.**

## What this is

A full-stack teaching application for scene graph generation, built for 大語言模型技術與應用
(2026) and anchored on Wang et al., *IndVisSGG*, Advanced Engineering Informatics 65 (2025)
103107. It teaches 15 bilingual modules over 93 knowledge points, with 8 labs, 16 playgrounds, 60 paper
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
stayed at the track root; `data/` is now a link to the NAS (D110). **Every `npm` command runs from `system/`.**

```powershell
cd scene-graph-studio ; .\start.ps1     # checks both toolchains, installs on first run, launches
cd scene-graph-studio\system ; npm run ci
```

- **Node ≥ 22.12 is a hard prerequisite** (`vite@8.3.0` engines). Measured: 24.19.0. D-03 closed.
- **Python is `py12`, never the bare `python` on PATH, except in `start.ps1`.** `system/tools/Resolve-Python.ps1`
  (PowerShell) and `system/tools/py.mjs` (Node) resolve it; `SGS_PYTHON` overrides both, which is
  what CI sets. `start.ps1` defaults to WekaExt's `..\.venv` instead and falls back to the
  resolver without it (D121); that default is the one thing the track reads from outside itself.
- **`npm run ci` is the gate**, eleven steps: harvest, pytest, the metrics build, vitest, ruff,
  parity, i18n, content, frozen, standalone, frontend build. The static UI mockup and its
  `lint:mockup` check were removed on 2026-09-29 (D107).
- **Four checks `ci` does not run**, each for a reason: `npm run test:e2e` (check 8, the keyboard
  walkthrough at three projector resolutions, 107 tests, over the production build with no backend
  running), `npm run check:offline` (check 6, a torch-free interpreter with every outward request
  intercepted), `npm run check:perf` (NFR-8, cold start on five routes and input-to-paint on five
  labs and sixteen playgrounds, and on two demos, against a backend it starts itself), `npm run check:pins`.

## Traps

- **Two numbering schemes coexist and collide.** `D-01…D-23` are binding decisions in
  `docs/superpowers/specs/…-decisions.md`. `D1…D121` are deviations in `DEVIATIONS.md`. **`D-22`
  and `D22` are different documents about different things.**
- **`system/web/knowledge-map/` was frozen** (2026-09-15, D-13) and harvested into
  `data/content/` as the seed corpus. **The freeze was released 2026-09-27 (D-23)**: the page may
  be extended, but it is still the harvest's source, so edit the page, run `npm run harvest`,
  whose output lands on the NAS through `data/`, and commit the page (D110); and it must still open from disk with no build step. Its `pg.js evaluate()` is a
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
  in both locales (**D76**). All 129 steps carry theirs; 258 notes.
- **`docs/brief.standalone.html` is generated** from `system/web/brief/index.html`, and
  `npm run lint:standalone` asserts they agree. Edit the source, then run
  `npm run build:standalone` in the same commit.
- **Generated files are pinned to LF in `.gitattributes`, and the reasons are written there.**
  `core.autocrlf=true` checks a file out as CRLF while every generator here writes LF, which
  either fails a byte-equality step or — worse, because it is silent — leaves `git status`
  dirty after every green gate with `git diff` showing nothing (**D89**). Adding a generator
  that writes into a tracked path means adding its path there too. Nothing under `data/` is
  tracked since D109, so the six `data/` rules of D89 and D91 are gone; the Python generators
  still write LF (`newline=""`).
- **`data/` is a directory junction to `C:\DataRaw\scene-graph`, and no data file lives in the
  checkout (D109, D110).** `.gitignore` ignores `/data/` whole, so git carries none of it:
  corpora, slice images, annotations, manifests, `data/content/`, the golden vectors, the
  predictions and `data/LICENCES.md`. Every reader keeps its `data/` path and reaches the one
  copy through the link; `SGS_DATA_DIR` names another target. `start.ps1` and `fetch-data.ps1`
  make the link through `system/tools/Connect-DataDirectory.ps1`. **A fresh clone has no
  `data/`** until one of them runs, and a gate run on a machine without the NAS fails at its
  first read of it. Vite checks real paths, so `vitest.config.ts` allows the link's target
  through `data.dir.ts`; the dev server still cannot show the playgrounds' photographs, which
  it could not before D110 either, and the build can. `sync-data.ps1` (D108) was retired: there
  is no second copy to keep in step. WekaExt's root `.gitignore` has no rule over this tree, so
  every exclusion the track needs is stated locally.
- **`data/` is one copy, shared by every branch and every checkout.** A branch that changes
  `data/` changes it for every branch at once: merge it promptly, and do not run another branch's
  gate or harvest in between. M5's playgrounds were the first such branch: until they merge, `main`
  fails `npm run ci` against the NAS, and running `main`'s harvest writes M5's old text back into
  `data/content/`; a revert after the merge needs a hand edit of `playground_golden.json` on the
  NAS and a fresh harvest (D111).
  The M0 demos branch is the second: its rekey of `fig2-pipeline.json` and `fig2-corrections.json` (D115) leaves
  `main` failing two backend tests and L5's Figure 2 replay against the NAS until it merges, and a revert needs the
  old `step2_prompt` text and `rekey_step2_transcripts.py` run against it; the pre-rekey files are in
  `C:\DataRaw\scene-graph\vlm\transcripts-pre-D115\`.
- **Never `rm -rf data/` in Git Bash.** With the trailing slash it deletes the files on the NAS
  through the link (measured on a scratch junction, D110), and the NAS copy is the only copy.
  `rm -rf data`, `git clean -fdX` and PowerShell `Remove-Item -Recurse` remove the link alone.
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
  count, a bound, a set membership or a value of the rule its step teaches, never a metric** (D111) — a metric is a lab's business and the
  boundary is the point. Nothing in `frontend/src/playgrounds/` imports from `sgg-metrics` except
  its types, and three tests in `playgrounds/test/logic.test.ts` that hold F3's IoU to `boxIou`, on the golden cases and at every knob setting, and E1's verdict to `classify` (D97, D98, D100), and four more there that hold M4's cap to `applyConstraint`, its counts to `evaluate`, and E13's admission to `applyPairing` and its match to `evaluate` (D106). M0 carries three (F1, F2, F8), M1
  three (F6, F7, X1), M2 one (F3), M3 two (E1, E10), M4 five (E3, E4, E7, E13, X2) and M5 two (T1, T2); 12 live knowledge points have none. See D88, D93, D97, D98, D106 and D111. **`PlaygroundFrame`
  clips only a picture** (`clip`, default on): a playground of words and figures passes
  `clip={false}`, because a word under the clip is beyond the reach of the step's scroll (D93).
  **`PlaygroundFrame`'s `dense` is M4's**, for its twelve-row lists at 1024×768, and M5's, for T1's
  six readouts and T2's table (D111); the earlier
  playgrounds keep the measured default, and their records (D95 to D102) measure it (D106);
  `playgrounds/test/Playground.test.tsx` requires the dense frame of exactly E3, E4, E7, E13, X2, T1 and T2.
  **A playground too tall for one panel spans consecutive steps as parts** (D96): `part: n` on
  each step and its tag, the count in `PLAYGROUND_PARTS` in `mounts.tsx`, E1, E10, E3, E4, E7, F1, F3, F6, F7 and T2 in two
  and X1 in three. The stepper carries the knobs between the parts of one playground and nowhere
  else, and the projector suite asserts that every part fits 1024×768 in 繁體中文 in its longest
  state. **F6 and F7 count distinct triplets** (D96): E is a set, and 208 of the slice's 892
  relationship rows repeat a triplet of the same frame.
- **A `demo` is the second such step kind** (D112 to D117): `kind: demo` with `demo:`, `part: n` and a
  `seconds_budget`, and one `<Demo id="DT" part="1" />` in the body, mounted from
  `frontend/src/demos/mounts.tsx`. Its three tables, `DEMO_MOUNTS`, `DEMO_PARTS = { DT: 4, DV: 5 }` and
  `DEMO_ARTEFACTS`, are read by `content_lint.mjs` as text, one entry to a line, so keep that form. A demo
  replays a recording and computes counts, set memberships and set differences over it, never a metric:
  D-T (four parts) is a COCO detector with an 80-frame frequency prior, D-V (five parts) is IndVisSGG's
  three steps. **Five lint rules** hold it, each failing a test in `tools/test/content_lint.test.mjs` when
  disabled: a registered demo and an integer part; exactly one `<Demo>` per step, agreeing with the
  frontmatter, and every tag answering to a step; parts 1 to n on consecutive steps of one module, in order;
  the recorded artefact exists and carries a provenance object; a positive `seconds_budget`. The data are
  under `data/demos/m0/` (the 18.0 s clip, ten frames, `traditional.json`, `indvissgg.json`) and D-V's
  transcript is `data/vlm/transcripts/m0-demo.json`, all on the NAS. **Every graph a demo produces is filed
  under `mini-isg`** with no `DatasetId` of its own, though its frames are not the slice's (D113). D-V was
  recorded on the author's own vLLM server, `stamping-vlm` (`Qwen/Qwen3.8-27B`), through
  `app/vlm/openai_compat.py` and not on the Anthropic API (D114); its graphs are `reconstructed`, and no label
  says "measured" of a replay. The projector suite holds every demo part to 1024×768 in 繁體中文 only, and
  three parts run past it in English (D117). M0's lab and checkpoint are s16 and s17 since the nine demo
  steps were inserted, so a quiz schedule stored under `m00:s8:*` is orphaned (D117).

## CI

`.gitea/workflows/scene-graph-studio.yml` at the WekaExt root, filtered to
`scene-graph-studio/**`, Node 22.12, Python 3.12, `SGS_PYTHON: python`, running `npm run ci`.
Deployment is out of scope: the earlier attempt was abandoned over a private repository,
third-party content and the backend dependency, and none of those has changed.
