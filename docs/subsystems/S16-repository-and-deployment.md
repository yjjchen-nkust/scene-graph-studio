# S16 Repository and deployment

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `start.ps1` | Windows front door that sets up and runs the application |
| `deploy.ps1` | Merges a branch, pushes to both remotes and watches the CI/CD run |
| `render.yaml` | Render Blueprint for the backend |
| `.github/` | GitHub Actions workflow for CI and deployment |
| `.claude/` | Launch configuration |
| `system/tools/start.mjs` | Starts backend and dev server together |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §14, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

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

## 8. Open items

DRAFT
