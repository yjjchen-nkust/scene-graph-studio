# CLAUDE.md — Scene Graph Studio

## Read this first

`docs/INDEX.md` is the knowledge index for this track. It indexes the specs, the plans,
`docs/VERIFICATION.md` (the nine checks of design §6, each with its date and outcome — all nine
run and passed — plus §10 NFR-8 measured, §11 the dependency pins, §12 the interpreter, §13 the
CUDA build, §14 the runner gate, §15 the M0 playgrounds, §16 the lint suite by mutation, §17 the M1 playgrounds, §18 the M1 minors and §19 the review of the day's merges), and all 95 logged deviations. It is kept current. **Read it
before changing anything.**

## What this is

A full-stack teaching application for scene graph generation, built for 大語言模型技術與應用
(2026) and anchored on Wang et al., *IndVisSGG*, Advanced Engineering Informatics 65 (2025)
103107. It teaches 15 bilingual modules over 93 knowledge points, with 8 labs, 6 playgrounds, 60 paper
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
  walkthrough at three projector resolutions, 48 tests, over the production build with no backend
  running), `npm run check:offline` (check 6, a torch-free interpreter with every outward request
  intercepted), `npm run check:perf` (NFR-8, cold start on five routes and input-to-paint on five
  labs and six playgrounds, against a backend it starts itself), `npm run check:pins`.

## Traps

- **Two numbering schemes coexist and collide.** `D-01…D-22` are binding decisions in
  `docs/superpowers/specs/…-decisions.md`. `D1…D95` are deviations in `DEVIATIONS.md`. **`D-22`
  and `D22` are different documents about different things.**
- **`system/web/knowledge-map/` is frozen** (2026-09-15) and was harvested into `data/content/`
  as the seed corpus. Do not extend it. Its `pg.js evaluate()` is a teaching toy over fifteen
  hard-coded rows and **must never be promoted to the evaluation engine** (decision **D-14**).
  `system/tools/audit.js` and `check.js` validate it; `audit.js` exists to catch a `\` line break
  inside display math outside an alignment, which MathJax renders as a visible red error rather
  than failing loudly.
- **Box selection is `geometry.pickObjectAt`, not the browser's hit test** (deviation **D75**). A
  bounding box is drawn `fill="none"`, so SVG hit-tests its outline and a click in the middle of
  an object selects nothing. `pointer-events: all` would hand the choice to paint order, so the
  click handler sits on the `<svg>` and picks the smallest box containing the point, ties broken
  by the lower object id. **Do not move it back onto the rects.**
- **Presenter notes are mandatory.** `system/tools/content_lint.mjs` refuses a step without them
  in both locales (**D76**). All 98 steps carry theirs; 196 notes.
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
  its types. M0 carries three (F1, F2, F8) and M1
  three (F6, F7, X1); 22 live knowledge points have none. See D88 and D93. **`PlaygroundFrame`
  clips only a picture** (`clip`, default on): a playground of words and figures passes
  `clip={false}`, because a word under the clip is beyond the reach of the step's scroll (D93).

## CI

`.gitea/workflows/scene-graph-studio.yml` at the WekaExt root, filtered to
`scene-graph-studio/**`, Node 22.12, Python 3.12, `SGS_PYTHON: python`, running `npm run ci`.
Deployment is out of scope: the earlier attempt was abandoned over a private repository,
third-party content and the backend dependency, and none of those has changed.
