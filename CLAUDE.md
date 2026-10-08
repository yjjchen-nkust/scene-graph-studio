# CLAUDE.md — Scene Graph Studio

## Read this first

`docs/subsystems/README.md` is the map of this repository. Its ownership table names the
subsystem that owns each path, and that subsystem's page under `docs/subsystems/` states its
current rules, its traps and the records behind them; a change to a subsystem updates its page's
current rules in the same commit. `docs/INDEX.md` is the register of the documents: the specs, the
plans, the binding decisions, `docs/VERIFICATION.md` (§1 to §35, each check with its date and
outcome) and the logged deviations. **Read the map, then the page of the subsystem being changed,
before changing anything.**

## What this is

A full-stack teaching application for scene graph generation, built for 大語言模型技術與應用
(2026) and anchored on Wang et al., *IndVisSGG*, Advanced Engineering Informatics 65 (2025)
103107. It teaches 15 bilingual modules over 93 knowledge points, with 8 labs, 16 playgrounds, 60 paper
cards and 5 frozen leaderboards.

It is its own repository (decision **D-24**, 2026-10-08, which superseded D-22's location, its
independence clause and its exclusion of deployment; D-22 had superseded D-01 and D-20 when the
track moved from the `course-lab` teaching repository into WekaExt). Its remotes are `origin`
(`gitea.cillab.me/CIL-Team/scene-graph-studio`) and `github`
(`github.com/yjjchen-nkust/scene-graph-studio`). Its history begins at `db5cdb1`, a rewrite of
WekaExt's subtree-add commit, so `git blame` stops there and the `course-lab` commits D-22 names do
not resolve (D126). The course is hosted: the frontend on GitHub Pages and the backend on Render,
which serves `fixtures/data` without `torch`, so live inference reports unavailable (D127). Every
departure from plan is logged in `DEVIATIONS.md`: 129 deviations, D1 to D129.

## Layout and commands

**All machinery lives under `system/`** — the npm workspace root, `backend/`, `frontend/`,
`packages/sgg-metrics/`, `tools/`, `web/`. `data/`, `docs/`, `start.ps1` and `fetch-data.ps1`
stayed at the track root; `data/` is a link to the data directory (D110, D125), whose target
`docs/subsystems/S15-data-infrastructure.md` states. **Every `npm` command runs from `system/`.**

```powershell
cd scene-graph-studio ; .\start.ps1     # checks both toolchains, installs on first run, launches
cd scene-graph-studio\system ; npm run ci
```

- **Node ≥ 22.12 is a hard prerequisite** (`vite@8.3.0` engines). Measured: 24.19.0. D-03 closed.
- **Python is `py12`, never the bare `python` on PATH, except in `start.ps1`.** `system/tools/Resolve-Python.ps1`
  (PowerShell) and `system/tools/py.mjs` (Node) resolve it; `SGS_PYTHON` overrides both, which is
  what CI sets. `start.ps1` defaults to WekaExt's `..\.venv` instead and falls back to the
  resolver without it (D121); that default is the one thing the track reads from outside itself.
  A standalone checkout has no such `.venv` beside it, so the script warns and falls back on every
  run, an open item on S16 (D-24).
- **`npm run ci` is the gate**, eleven steps: harvest, pytest, the metrics build, vitest, ruff,
  parity, i18n, content, frozen, standalone, frontend build. The static UI mockup and its
  `lint:mockup` check were removed on 2026-09-29 (D107).
- **Four checks `ci` does not run**, each for a reason: `npm run test:e2e` (check 8, the keyboard
  walkthrough at three projector resolutions, 107 tests, over the production build with no backend
  running), `npm run check:offline` (check 6, a torch-free interpreter with every outward request
  intercepted), `npm run check:perf` (NFR-8, cold start on five routes and input-to-paint on five
  labs and sixteen playgrounds, and on two demos, against a backend it starts itself), `npm run check:pins`.

## Traps

- **Two numbering schemes coexist and collide.** `D-01…D-24` are binding decisions in
  `docs/superpowers/specs/…-decisions.md`. `D1…D129` are deviations in `DEVIATIONS.md`. **`D-22`
  and `D22` are different documents about different things.**
- **The knowledge map's `pg.js evaluate()` is a teaching toy over fifteen hard-coded rows and must
  never be promoted to the evaluation engine** (D-14, which D-23's release of the freeze leaves
  standing), and `system/tools/audit.js` exists to catch a `\\` line break inside display math
  outside an alignment, which MathJax renders as a visible red error rather than failing loudly.
  See `docs/subsystems/S08-knowledge-map-and-brief.md` §6.
- **The graph constraint keys on the ordered object pair, not the class pair, and `semi` caps
  predicates per object pair rather than computing the Semi Constraint STTran proposed for Action
  Genome** (D99). See `docs/subsystems/S01-evaluation-engine.md` §6.
- **Box selection is `geometry.pickObjectAt` on the `<svg>`, not the browser's hit test, because a
  box drawn `fill="none"` is hit-tested on its outline only; do not move it back onto the rects**
  (D75). See `docs/subsystems/S09-graph-and-readouts.md` §6.
- **`ImageOverlay` has no width of its own, and a mark layer over a photograph
  (`playgrounds/PhotoMarks.tsx`) must have the photograph's box exactly: given no width, the
  photograph renders 0×0, and given a stretched column, every mark lands off its object while every
  readout stays correct** (D96, D97). See
  `docs/subsystems/S09-graph-and-readouts.md` §6 and `docs/subsystems/S12-playgrounds.md` §6.
- **Presenter notes are mandatory: `system/tools/content_lint.mjs` refuses a step without them in
  either locale** (D76), and all 129 steps carry theirs, 258 notes. See
  `docs/subsystems/S06-course-content.md` §6.
- **`docs/brief.standalone.html` is generated from `system/web/brief/index.html`: edit the source
  and run `npm run build:standalone` in the same commit, or `npm run lint:standalone` fails.** See
  `docs/subsystems/S08-knowledge-map-and-brief.md` §6.
- **Generated files are pinned to LF in `.gitattributes`, and the reasons are written there.**
  `core.autocrlf=true` checks a file out as CRLF while every generator here writes LF, which
  either fails a byte-equality step or — worse, because it is silent — leaves `git status`
  dirty after every green gate with `git diff` showing nothing (**D89**). Adding a generator
  that writes into a tracked path means adding its path there too. Nothing under `data/` is
  tracked since D109, so the six `data/` rules of D89 and D91 are gone; the Python generators
  still write LF (`newline=""`).
- **`data/` is a link to the data directory, and no data file lives in the checkout but the CI
  fixture `fixtures/data`** (D110, D125); a fresh clone has no `data/` until `devdata pull`,
  `start.ps1` or `fetch-data.ps1` links it, or `npm run data:fetch` unpacks D128's Google Drive
  bundles, `core` and `industreal` in `data.drive.json`, into a real directory, and the CI runner
  links the fixture in its place (D126). See `docs/subsystems/S15-data-infrastructure.md` §6, and
  its §8 for where the link pointed in the checkout observed on 2026-10-08.
- **`data/` is one copy, shared by every branch and every checkout.** A branch that changes
  `data/` changes it for every branch at once: merge it promptly, and do not run another branch's
  gate or harvest in between. M5's playgrounds were the first such branch: until they merge, `main`
  fails `npm run ci` against the NAS, and running `main`'s harvest writes M5's old text back into
  `data/content/`; a revert after the merge needs a hand edit of `playground_golden.json` on the
  NAS and a fresh harvest (D111).
  The M0 demos branch is the second: its rekey of `fig2-pipeline.json` and `fig2-corrections.json` (D115) leaves
  `main` failing two backend tests and L5's Figure 2 replay against the NAS until it merges, and a revert needs the
  old `step2_prompt` text and `rekey_step2_transcripts.py` run against it; the pre-rekey files are in
  `data/vlm/transcripts-pre-D115/`.
  D-V's recording again is the third (D124): until it merges, `main` fails its gate against the NAS, which
  holds the transcript recorded under `O_DEMO`; the files before it are `vlm/transcripts-pre-D124/m0-demo.json`
  and `demos/m0/pre-D124/indvissgg.json`.
  The CI runner, which links `fixtures/data` (D126), and a checkout whose `data/` was unpacked from
  Google Drive (D128) each hold a copy of their own.
- **Never `rm -rf data/` in Git Bash.** With the trailing slash it deletes the files on the NAS
  through the link (measured on a scratch junction, D110), and the NAS copy is the only complete
  copy; D128's Google Drive bundles hold a part of it.
  `rm -rf data`, `git clean -fdX` and PowerShell `Remove-Item -Recurse` remove the link alone.
- **The design document's ARM64/Snapdragon hardware table describes a different machine** and is
  marked superseded in place. See `docs/subsystems/S14-checks-and-instruments.md` §6.
- **A playground reads `data/` from outside vitest's root, so the frontend project of
  `system/vitest.config.ts` widens `server.fs.allow`, a list that replaces Vite's defaults rather
  than adding to them; removing it fails six suites at collection, at step 4 of the gate, with an
  error that names neither the configuration nor the cause.** See
  `docs/subsystems/S14-checks-and-instruments.md` §6.
- **A playground is a step kind, not a lab, and computes a count, a bound, a set membership or a
  value of the rule its step teaches, never a metric** (D111): nothing in `frontend/src/playgrounds/`
  imports a value from `sgg-metrics`, only its types. See `docs/subsystems/S12-playgrounds.md` §6.
- **A `demo` replays a recording and computes counts, set memberships and set differences over it,
  never a metric; `content_lint.mjs` reads the three tables of `frontend/src/demos/mounts.tsx` as
  text, one entry to a line, and every graph a demo produces is filed under `mini-isg` with no
  `DatasetId` of its own** (D112 to D117). See `docs/subsystems/S13-demos.md` §6, and
  `docs/subsystems/S05-vlm-pipeline.md` §6 for D-V's prompt and recording.

## CI

`.github/workflows/ci-cd.yml` runs on every push to `main`, every pull request and
`workflow_dispatch`, with no path filter (D126). Its `ci` job runs from `system/` on `ubuntu-latest`
with Node 22.12, Python 3.12 and `SGS_PYTHON: python`: it installs `backend/requirements.txt`,
links the fixture with `ln -s fixtures/data ../data`, and runs `npm ci` and `npm run ci`; it installs
no remotex and reads no `REMOTEX_READ_TOKEN`. After `ci` passes, and only from `main`, `pages-build`
and `pages-deploy` publish the frontend to GitHub Pages; the backend runs on Render from
`render.yaml` as `scene-graph-studio-api`, serving `fixtures/data` with no `torch` (D-24, D127).
`deploy.ps1` merges a branch into `main` with `--ff-only`, pushes to both remotes and follows the
run (D129), and `docs/DEPLOY-GITHUB.md` gives the one-time setup. Whether D-15's path filter and its
"second opinion, not the gate" still hold is the author's to rule. See
`docs/subsystems/S16-repository-and-deployment.md`.
