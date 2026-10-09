# S16 Repository and deployment

## 1. Purpose and boundary

S16 is the repository and the ways the course reaches a reader: the standalone repository with its two remotes, the two local front doors, `start.ps1` and `npm start`, the GitHub Actions workflow that runs the gate and publishes the frontend to GitHub Pages, the Render blueprint of the backend, the launch configuration and `deploy.ps1`. It does not define the gate's steps, which are S14's, or the `data/` link and the CI fixture, which are S15's, and the hosted backend it configures serves no corpus, only that fixture.

## 2. Code and data

| Path | Role |
|---|---|
| `start.ps1` | Windows front door that sets up and runs the application |
| `deploy.ps1` | Merges a branch, pushes to both remotes and watches the CI/CD run |
| `render.yaml` | Render Blueprint for the backend |
| `.github/` | GitHub Actions workflow `ci-cd`: the gate, and the frontend's deployment to GitHub Pages |
| `.claude/` | Launch configuration |
| `system/tools/start.mjs` | Starts backend and dev server together |

## 3. Interfaces

**Provides:**

- `npm start`, which is `system/tools/start.mjs`, declared as the `start` script of S14's `system/package.json`, and run by `start.ps1` and by the launch configuration `.claude/launch.json`.
- The hosted course: the frontend on GitHub Pages and the backend `scene-graph-studio-api` on Render. The Pages build hands S10's `system/frontend/vite.config.ts` its base as `SGS_BASE` and S11's `system/frontend/src/labs/api.ts` the backend's origin as `VITE_API_BASE`; Render hands S2's `system/backend/app/main.py` the allowed origin as `SGS_CORS_ORIGINS`.
- The run of S14's gate on GitHub Actions, and `deploy.ps1`, which merges, pushes to both remotes and follows that run.

**Consumes:**

- S14 (`system/tools/start.mjs` imports `pickPython` from `system/tools/py.mjs` and `portFree` and `stopTree` from `system/tools/servers.mjs`; `start.ps1` dot-sources `system/tools/Resolve-Python.ps1`; `.github/workflows/ci-cd.yml` runs `npm ci` against `system/package-lock.json` and `npm run ci`; `deploy.ps1` runs `npm run ci` under `-Gate`).
- S15 (`start.ps1` dot-sources `system/tools/Connect-DataDirectory.ps1`; `system/tools/start.mjs` checks `data/LICENCES.md` through the link; `.github/workflows/ci-cd.yml` links `fixtures/data` as `data/`; `render.yaml` sets `SGS_DATA_DIR` to the fixture).
- S2 (`system/tools/start.mjs` starts `uvicorn app.main:app` from `system/backend/` and polls `/api/health`; `render.yaml` starts the same application and checks `/api/health`).
- S3 (`start.ps1` and `system/tools/start.mjs` run `system/backend/scripts/make_placeholders.py` when the placeholder slice is absent).
- S10 (`system/tools/start.mjs` runs Vite's bin in `system/frontend/`; the Pages job runs `npm run build:frontend` and uploads its output).
- S1 and S6 (the Pages job runs `npm run build:metrics` and `npm run harvest`).

## 4. Current rules

1. Scene Graph Studio is its own repository, with two remotes: `origin` (`gitea.cillab.me/CIL-Team/scene-graph-studio`) and `github` (`github.com/yjjchen-nkust/scene-graph-studio`). D-24 superseded D-22's location and its independence clause, as D-22 had superseded D-01 and D-20. [D-24] [D126] [D-22]
2. Its history begins at `db5cdb1`, a parentless rewrite of WekaExt's subtree-add commit of 2026-09-19. The `course-lab` commits D-22 names do not resolve here, and `git blame` on a line unchanged since the move stops at `db5cdb1`; how the history was extracted is not recorded. [D126]
3. Large binary corpora stay out of git: that consequence of D-22 is not superseded, `.gitignore` ignores `/data/`, and git carries only the CI fixture, `fixtures/data`. [D-24] [D109] [D125]
4. Deployment is in scope, and PRD §5's non-goal of cloud deployment carries D-24's annotation in place. Students reach the course without a local install, and setting up the deployment is itself a course exercise, whose one-time steps `docs/DEPLOY-GITHUB.md` gives. [D-24] [PRD §5] [`docs/DEPLOY-GITHUB.md`]
5. `.github/workflows/ci-cd.yml` runs on every push to `main`, every pull request and `workflow_dispatch`, with no path filter, and a newer run of the workflow on the same ref cancels one in progress. [D126] [`.github/workflows/ci-cd.yml`]
6. Its `ci` job runs on `ubuntu-latest` from `system/`, with Node 22.12, Python 3.12 and `SGS_PYTHON: python`: it installs `system/backend/requirements.txt`, links `fixtures/data` as `data/`, runs `npm ci` and then `npm run ci`. [D126] [`.github/workflows/ci-cd.yml`]
7. The frontend is published to GitHub Pages only after `ci` passes and only from `main`: `pages-build` needs `ci` and runs on no pull request and only for `refs/heads/main`. It sets `SGS_BASE` to `/<repository name>/` and `VITE_API_BASE` to the repository variable `SGS_API_BASE`, links the fixture, runs `npm run harvest`, `npm run build:metrics` and `npm run build:frontend`, copies `index.html` to `404.html` so that a deep link reaches the client router, and uploads the build, which `pages-deploy` publishes with `actions/deploy-pages@v4`. [D-24] [D127] [`.github/workflows/ci-cd.yml`]
8. The frontend build follows its base path and its API origin: `SGS_BASE` sets Vite's `base`, `/` when unset, and the router takes the base as its `basename`; `VITE_API_BASE` prefixes the frontend's requests as `API_BASE`, and empty, its default, keeps the local run, where Vite proxies `/api`. [D127] [`system/frontend/vite.config.ts`] [`system/frontend/src/labs/api.ts`]
9. The backend runs on Render from `render.yaml`: one web service, `scene-graph-studio-api`, on the `free` plan in `singapore`, deployed on each commit. It installs `system/backend/requirements.txt`, starts `uvicorn app.main:app` from `system/backend`, checks `/api/health`, and sets `PYTHON_VERSION` to 3.12.8, `SGS_DATA_DIR` to `../../fixtures/data` and `SGS_CORS_ORIGINS` to `https://yjjchen-nkust.github.io`. [D127] [`render.yaml`]
10. The hosted backend serves `fixtures/data` and nothing more: only the datasets in the fixture have slices there, and the others report `images_present: false`. [D-24] [D127] [`docs/DEPLOY-GITHUB.md`]
11. Live inference reports unavailable on the hosted backend because it has neither `torch` nor a model checkpoint: `system/backend/requirements.txt` lists no `torch`, the fixture holds no checkpoint, and the registry reports a model live only when `torch` is importable, a checkpoint sits under `data/checkpoints/<model>/` and the model is wired, while `registry.WIRED` is empty. [D-24] [D37] [D120] [`system/backend/app/infer/registry.py`] [`docs/DEPLOY-GITHUB.md`]
12. On the hosted site L4 says so in its own words: `MethodComparator`'s `hosted` defaults to `API_BASE !== ''`, and when it is true a model that is not live shows `l4.live_hosted`, "Live inference is not offered on this hosted demo: the server has no `torch` and no model checkpoint", in place of the registry's reason. [D-24] [D127] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
13. `deploy.ps1` publishes and stops at the first problem. It requires `git`, and `gh` unless `-NoWatch`; refuses uncommitted changes; requires the remote `origin` and adds `github` when it is missing; fetches both; merges `-Branch`, by default the current branch, into `main` with `--ff-only`; refuses when `main` is behind or has diverged from either remote's `main`; under `-Gate` runs `npm run ci` in `system/` first; pushes `main` to `origin` and then to `github`, with no force; and, unless `-NoWatch`, follows the `ci-cd` run of the pushed commit to its end and prints the Pages URL and the Render health URL. `-DryRun` pushes nothing. [D129] [`deploy.ps1`]
14. The script's git wrapper is `Invoke-Git`, which throws on a non-zero exit code. [D129] [`deploy.ps1`]
15. Locally, `npm start` runs `system/tools/start.mjs`, which checks before it starts anything: Node 22.12 or later; an interpreter, resolved by `pickPython`, that imports `fastapi`, `uvicorn`, `pydantic` and `PIL`; `node_modules`; `data/LICENCES.md` through the link; the placeholder slice, which it generates when absent; and both ports free. [D14] [D110] [D122] [`system/tools/start.mjs`]
16. It starts the backend as `uvicorn app.main:app --reload` on 127.0.0.1, port 8000 by default, and the dev server by running Vite's own bin with `process.execPath` in `system/frontend/`, port 5173 by default with `--strictPort`. `SGS_BACKEND_PORT` and `SGS_FRONTEND_PORT` move them, and the backend's port reaches Vite's proxy. On exit it ends each child with its process tree. [D14] [D122] [`system/tools/start.mjs`]
17. `start.ps1` is the Windows front door for `npm start`: it makes the `data/` link before any install, checks that Node is 22.12 or later, D-03's floor, resolves the interpreter, installs on first run or under `-Setup`, generates the placeholder slice when absent, sets `SGS_BACKEND_PORT`, `SGS_FRONTEND_PORT` and `SGS_PYTHON`, and runs `npm start` in `system/`. [D110] [D-03] [`start.ps1`]
18. `start.ps1` resolves its interpreter through `Resolve-ProjectPython`, in the order of every other front door: `-Python`, `SGS_PYTHON`, an activated `py12`, `py12` on disk, then a choice offered to the user. It reads no environment from outside the repository: D121's default, WekaExt's `..\.venv`, and D122's pin check on it went when D-24 left no WekaExt above the track. [D80] [D121] [D122] [D132] [`start.ps1`]
19. `start.ps1` installs the npm packages when `node_modules` is absent, and this track's Python requirements only when `fastapi`, `uvicorn`, `pydantic` or `PIL` fails to import; `-Setup` forces both, and `-SkipInstall` skips both. [D121] [`start.ps1`]
20. `.claude/launch.json` holds one configuration, `scene-graph-studio`, which runs `node` on `system/tools/start.mjs`, a path relative to the repository root, and names port 5173. [D126] [`.claude/launch.json`]
21. A completed plan is not rewritten when the repository moves: `2026-09-15-01-skeleton-and-eval-engine.md` still names `AI-LLM/scene-graph-studio/`, including the full text of the GitHub workflow it specified, as the record of what was decided at the time. [D87] [`2026-09-19-relocation-design.md`]

## 5. Verification

**Records:** VERIFICATION §14, VERIFICATION §32, VERIFICATION §38.

**`npm run ci` steps:** none of S16's files runs inside the gate; S16's workflow runs the gate on GitHub. Tests elsewhere hold what S16 relies on: `system/tools/test/servers.test.mjs` (S14) the process-tree stop and the port probe that `system/tools/start.mjs` uses, `system/backend/tests/test_cors.py` (S2) the CORS the hosted backend needs, and `system/frontend/src/labs/L4/test/MethodComparator.test.tsx` (S11) the hosted L4 message.

**Outside `ci`:** none of `test:e2e`, `check:offline`, `check:perf` and `check:pins` measures S16.

**What the records measure.** §14 is the gate red on the GitHub Actions runner of the `course-lab` era for five consecutive pushes while green on the author's machine, and its fix by D83 and D84. §32 is the run of D122, whose changes include the process-tree stop of `system/tools/start.mjs` and `start.ps1`'s pin check; its table measures the gate and the four checks, not either script. §38 is D132's launch: `start.ps1 -SkipInstall` on spare ports named `py12` with no warning, and both servers answered. No VERIFICATION section records the hosted deployment: D126 and D127 read GitHub's run list on 2026-10-08, seven runs, with the `ci` job passing in all seven.

## 6. Traps

- On Windows `npm` is a `.cmd` shim that Node 24 refuses to spawn without a shell and Node 22 deprecates spawning with arguments through one, so `system/tools/start.mjs` runs Vite's own bin with `process.execPath`. [D14]
- In PowerShell a function runs before an external command of the same name, and names match without regard to case, so a git wrapper named `Git` calls itself. [D129]
- The repository's history was rewritten when it left WekaExt: `git blame` stops at `db5cdb1`, and the `course-lab` commits D-22 names, `fe1e9a9` among them, do not resolve here. [D126]
- The free Render instance sleeps after 15 minutes idle, the first lab request after that takes about a minute, and it has no persistent disk. [D127] [`docs/DEPLOY-GITHUB.md`]
- Where GitHub Pages is not set up, `pages-deploy` fails with "Failed to create deployment (status: 404)" and "Ensure GitHub Pages has been enabled"; the guide's second step sets the Pages source to GitHub Actions. [D127] [`docs/DEPLOY-GITHUB.md`]
- The Pages build reads `SGS_API_BASE` when it runs, so once the variable is set the workflow is run again for the build to read it. [D127] [`docs/DEPLOY-GITHUB.md`]

## 7. History

**Binding decisions:** D-01, D-03, D-15, D-20, D-22, D-24.

**Specs and plans:** `2026-09-15-01-skeleton-and-eval-engine.md`, `2026-09-15-scene-graph-studio-PRD.md`, `2026-09-15-scene-graph-studio-decisions.md`, `2026-09-19-relocation-design.md`, `2026-09-19-relocation.md`.

| Deviation | Effect | Role |
|---|---|---|
| D14 | `npm start` spawns Vite's bin directly, not `npm run dev` | primary |
| D80 | every Python step now names its interpreter: the `py12` environment | secondary |
| D87 | the track moved out of `course-lab` and into WekaExt | primary |
| D95 | the review of the day's merges: F6's status under its clip, and what surrounded it | secondary |
| D109 | all of `data/` on the NAS, and none of it in git | secondary |
| D110 | `data/` a link to the NAS, and no data file in the checkout | secondary |
| D121 | `start.ps1` runs on WekaExt's `.venv`, not on `py12` | primary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |
| D126 | the repository stands alone, with its own workflow and launch configuration | primary |
| D127 | the frontend on GitHub Pages and the backend on Render | primary |
| D129 | `deploy.ps1`: merge, push to both remotes, and watch the run | primary |
| D132 | `start.ps1` resolves its interpreter as every other front door does | primary |

## 8. Open items

1. **F5's unresolved question.** `bundle_distribute` is defined as distribution "to enrolled students for classroom use". A public repository and a public Render service reach a wider audience than that definition states. Whether the named licences (Apache-2.0, CC BY 4.0, MIT) cover it is the author's finding to record; D-24 records the question, not an answer. [D-24] [`2026-10-08-subsystem-index-design.md`]
2. **D-15's path filter and its "second opinion, not the gate".** D-15 has a path-filtered workflow run the one command, and states "The workflow is a second opinion, not the gate". `.github/workflows/ci-cd.yml` has no path filter; `deploy.ps1`'s help calls GitHub Actions "the gate and the deployment", and `docs/DEPLOY-GITHUB.md` lists the workflow as "Gate and frontend". Whether D-15's filter and that sentence still hold is the author's to rule; D-24 rules on neither. [D-24] [D-15] [D129]
3. `pages-deploy` failed on the pushes of `1c8bea2` and `695b4fd` with "Failed to create deployment (status: 404)", and the later runs passed all three jobs. No record states the outcome of a Render deployment. [D127]
4. The design document still gives the repository as `scene-graph-studio/` inside WekaExt under D-22: §4.1, its §5 Phase 0 and its §7 item 1, "Not a separate repository", with no note pointing to D-24. [design §4.1] [design §5] [design §7] [D-24]
5. D95 left the gate on the Gitea runner for the author: it had not been green there since the track moved into WekaExt, and D96 could not read the runner's logs. D126 moved CI to GitHub Actions, where the `ci` job passed in all seven runs read on 2026-10-08, and no record closes D95's item. [D95] [D96] [D126]
6. No test exercises `deploy.ps1`, and its commits record no run of it. [D129]
