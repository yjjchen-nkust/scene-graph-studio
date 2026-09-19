# Relocation to WekaExt — design

scene-graph-studio moves out of the teaching repository `course-lab` and becomes a tracked
subdirectory of `WekaExt`. This document specifies the target layout, how the history travels,
which dependencies the move severs, and what replaces them.

Governed by `…-decisions.md` and `docs/INDEX.md`. Where this document and those disagree, they
win and this one is wrong. Nothing here changes the application: no source file under
`system/backend`, `system/frontend` or `system/packages` is edited except for path strings and
one paragraph of prose.

---

## 1. Context

The track sits at `C:\dev\course-lab\AI-LLM\scene-graph-studio`, inside a Traditional Chinese
teaching-materials repository whose other tracks build PowerPoint decks and LaTeX courseware. It
shares nothing with them but the repository. Its CI is a path-filtered GitHub Actions workflow at
`course-lab/.github/workflows/scene-graph-studio.yml`.

The destination `C:\dev\WekaExt` is not an empty folder. It is the working tree of a separate
repository — the WekaWeb teaching platform, hosted on Gitea at
`gitea.cillab.me/CIL-Team/WekaExt.git`, with CI and a manual production deployment under
`.gitea/workflows/`. The move is therefore a transfer between two repositories on two different
forges, not a rename.

`WekaExt` already owns `backend/`, `frontend/`, `docs/` and `scripts/` at its root, so the track
must occupy a subdirectory of its own.

### State at the time of writing

| | |
|---|---|
| `course-lab` branch | `feat/playgrounds-m0` at `6491b79`, seven commits past `main` |
| `course-lab` main | `0631617`, one commit ahead of `origin/main` and unpushed |
| Uncommitted | `system/frontend/src/playgrounds/mounts.tsx` modified; `playgrounds/F1/LabelsToStructure.tsx` and its test untracked |
| Commits touching the track | 79 at `main`, 86 at `6491b79` |
| Tracked files | 382 |
| Working tree | 5.2 GB, of which `data/_raw` is 4.7 GB and `node_modules` plus `.offline-venv` a further 442 MB |

M0 of the playgrounds cycle is mid-flight: tasks 1 through 5 are committed, task 6 is the
uncommitted F1 work, and tasks 7 through 13 remain.

## 2. Decisions locked with the user, 2026-09-19

| Question | Answer |
|---|---|
| Repository model | **A tracked subdirectory of the WekaExt repository** at `scene-graph-studio/`. Rejected: a nested independent repository that WekaExt ignores; a git submodule. Independence comes from a path filter and a separate CI job, not from a separate repository. |
| History | **Carried over, rewritten.** `git subtree` extracts the commits with paths rewritten and grafts them into WekaExt, so `git log` and `git blame` keep working on every file. Rejected: a single import commit. |
| In-flight M0 work | **Committed, then both refs move.** `main` and `feat/playgrounds-m0` are pushed to `course-lab` as the rollback, task 6 is committed, and both refs cross. M0 resumes at task 7 in the new location. Rejected: replaying the branch as patches; finishing M0 before moving. |
| CI and CD scope | **CI only.** The workflow is translated to Gitea Actions as its own path-filtered file. WekaExt's `ci.yml` and `deploy.yml` are not edited. CD stays out of scope; the earlier deployment attempt was abandoned over a private repository, third-party content and the backend dependency, and none of those has changed. |
| `course-lab` afterwards | **The track is removed and the documentation updated.** `course-lab` returns to being purely a teaching-materials repository. Its history still holds all 86 commits. |

## 3. Target layout

```
C:\dev\WekaExt\
  .gitea/workflows/
    ci.yml                    unchanged
    deploy.yml                unchanged
    scene-graph-studio.yml    new, path-filtered
  .gitignore                  unchanged
  backend/ frontend/ agent/ deploy/ docs/ scripts/
  scene-graph-studio/
    CLAUDE.md                 new
    README.md
    DEVIATIONS.md
    .gitignore                one comment rewritten
    start.ps1  fetch-data.ps1
    data/  docs/  system/
```

An empty directory tree `frontend/src/playgrounds/test/` currently sits at the track root, a
mistaken sibling of the real `system/frontend/src/playgrounds/`. Git never recorded it, because
git does not track empty directories. It is deleted rather than carried.

## 4. History transfer

Two splits and two grafts:

```bash
# in course-lab
git subtree split -P AI-LLM/scene-graph-studio -b sgs-split-main        main
git subtree split -P AI-LLM/scene-graph-studio -b sgs-split-playgrounds feat/playgrounds-m0

# in WekaExt
git remote add course-lab C:/dev/course-lab
git fetch course-lab sgs-split-main:sgs-main sgs-split-playgrounds:sgs-playgrounds
git subtree add   -P scene-graph-studio sgs-main          # 79 commits
git switch -c feat/playgrounds-m0
git subtree merge -P scene-graph-studio sgs-playgrounds   # the further 7
```

Both splits are fetched into named local refs rather than read from `FETCH_HEAD`, which holds
only the last ref of a multi-ref fetch. The two temporary refs are deleted once the grafts land,
and the `course-lab` remote with them.

`subtree split` rewrites every path from `AI-LLM/scene-graph-studio/x` to `x`, and
`subtree add -P scene-graph-studio` places them at `scene-graph-studio/x`. The graft is a merge
commit, so WekaExt's own history stays linear beneath it.

**The assumption this rests on, and how it is tested.** Splitting two refs works only because
`subtree split` synthesises commits deterministically from tree and parents, which makes the
playgrounds split a descendant of the main split rather than a second unrelated root. That
property is asserted, not assumed: the whole sequence runs first against a throwaway clone of
WekaExt, and `git merge-base --is-ancestor sgs-split-main sgs-split-playgrounds` must succeed
before the real repository is touched. If it fails, `git filter-repo`, which is installed on this
machine, performs the same rewrite and the grafts proceed unchanged.

## 5. Dependency audit

Each row below was verified against the working tree, not inferred.

| Dependency | Finding | Action |
|---|---|---|
| Python interpreter | `system/tools/Resolve-Python.ps1` and `system/tools/py.mjs` resolve `py12` through `SGS_PYTHON`, `PY12_HOME`, `WORKON_HOME`, an activated environment, and fixed disk locations. Neither mentions `course-lab`. | None |
| Path resolution | `start.ps1` and `fetch-data.ps1` anchor on `$PSScriptRoot`; `system/tools/start.mjs` derives `ROOT` and `TRACK` from `import.meta.url`. Nothing resolves above the track root. | None |
| Ignore rules | `git check-ignore` over all 382 tracked paths against WekaExt's `.gitignore` matches nothing. WekaExt has no bare `data` rule, so the two un-ignore negations that `course-lab` needs are unnecessary here. | Negations stay behind; see §8 |
| Track-local ignore rules | `scene-graph-studio/.gitignore` travels intact. Its `data/checkpoints/` rule still earns its place by excluding model weights, but line 13 explains itself by reference to the repo-root un-ignore, which will no longer exist. | Rewrite the comment |
| `data/_raw`, 4.7 GB | Untracked, refetchable through `fetch-data.ps1`. Source and destination share drive C, so the transfer is a rename. | Move, do not copy |
| References to the old path | Nine tracked files name `AI-LLM/`. Three are live and must change; one is generated; two are historical records that must **not** change; three are live specs and an index, covered below. | §7 |
| Binding decision **D-01** | D-01 states that the repository location is `AI-LLM/scene-graph-studio/` inside `course-lab`, and that the project is not a separate repository. This move contradicts the location and upholds the rest. A live decision cannot be quietly falsified. | §7, new **D-22** |
| Project instructions | **The one genuine loss.** The track holds no `CLAUDE.md` and inherits `course-lab`'s, which carries the operational rules for working in it. WekaExt has no root `CLAUDE.md` to inherit instead. | §7 |

## 6. CI port

A new `.gitea/workflows/scene-graph-studio.yml`, translating the GitHub workflow one step at a
time: `paths: scene-graph-studio/**` on push and pull request,
`defaults.run.working-directory: scene-graph-studio/system`, `actions/setup-node@v4` at 22.12,
`actions/setup-python@v5` at 3.12, `SGS_PYTHON: python`, then
`pip install -r backend/requirements.txt`, `npm ci`, and `npm run ci`.

`SGS_PYTHON: python` keeps its original reason: a runner has no `py12`, and without the variable
the resolver falls back to PATH with a warning on every step. The interpreter `setup-python`
installed is the intended one, so the workflow says so.

Two properties of the Gitea runner cannot be settled from a workstation:

1. whether it honours `on.push.paths` filters, and
2. whether `setup-node@v4` can fetch Node 22.12.

WekaExt's own `ci.yml` already uses `setup-node@v4` and `setup-python@v5`, so the actions
themselves resolve on this runner; only the version and the filter are new. Both are settled by
pushing a branch and reading the run, which §10 makes the final acceptance step. Should the path
filter prove unsupported, the workflow runs on every push instead — wasteful but correct, and a
recorded deviation rather than a silent regression.

## 7. Documentation and project instructions

**New `scene-graph-studio/CLAUDE.md`.** It carries forward the operational facts that today live
only in `course-lab/CLAUDE.md`, and nothing else:

- `docs/INDEX.md` is read first; it indexes the specs, the plans, `docs/VERIFICATION.md` and the
  82 logged deviations.
- Node ≥ 22.12 is a hard prerequisite of `vite@8.3.0`; every `npm` command runs from `system/`.
- `npm run ci` is the gate. Four further checks sit outside it: `npm run test:e2e`,
  `npm run check:offline`, `npm run check:perf`, `npm run check:pins`.
- Two numbering schemes coexist and collide: `D-01…D-21` are binding decisions in
  `…-decisions.md`; `D1…D82` are deviations in `DEVIATIONS.md`. `D-21` and `D21` are different
  documents about different things.
- `system/web/knowledge-map/` is frozen. Do not extend it, and never promote its `pg.js
  evaluate()` to the evaluation engine (D-14).
- Box selection is `geometry.pickObjectAt`, not the browser's hit test (D75). Do not move it back
  onto the rects.
- The Python interpreter resolves through `system/tools/Resolve-Python.ps1` and
  `system/tools/py.mjs`; `SGS_PYTHON` overrides.

**The decision register.** D-01 is a binding decision, so the move supersedes it rather than
contradicting it in silence. Two edits, matching the practice this project already follows for
the superseded ARM64 hardware table — mark it in place, do not delete it:

- `…-decisions.md` gains **D-22, repository location**: the project lives at
  `scene-graph-studio/` inside the WekaExt repository. It remains **not** a separate repository,
  which is the half of D-01 the move upholds. D-01's consequence — that large binary corpora are
  not committed, so slice images are handled per D-08 — stands on its own merits and is restated
  under D-22 with its new reason: WekaExt is a deployed platform repository, not a teaching
  repository, and a 4.7 GB corpus belongs in neither.
- D-01 itself gains a superseded marker naming D-22 and this document. Its text is left intact.

**`DEVIATIONS.md`** gains **D87**, the relocation: what moved, from where, at which commit, and
what the move severed. D86 is the current highest.

**Live documents that change.**

| File | Change |
|---|---|
| `README.md` lines 44, 54 | Drop the `AI-LLM/` prefix from both `cd` commands |
| `docs/INDEX.md` line 46 | The D-01 row records the new location and the supersession |
| `…-design.md` lines 256, 417 | Both state D-01's path as closed; both are amended to D-22 |
| `…-contracts.md` line 290 | Directory-tree listing, rooted at the old path |
| `plans/2026-09-19-playgrounds-m0.md` line 15 | **The active plan.** Its working-directory instruction would send tasks 7–13 to a path that no longer exists |
| `.gitignore` line 13 | Rationale rewritten; the rules themselves stand |
| `system/web/brief/index.html` lines 820–821 | See below |

**Historical records that do not change.** `plans/2026-09-15-01-skeleton-and-eval-engine.md`
names the old path five times, including the full text of the GitHub workflow. It is a completed
plan and a record of what was decided at the time. `course-lab`'s own convention is that saved
plans are not rewritten when directories move, and that convention travels with the project.
Rewriting it would destroy evidence and gain nothing.

**`system/web/brief/index.html`.** Lines 820–821 state, in both languages, that the project sits
inside the teaching repository and inherits its conventions, the most consequential being that
large binary corpora are not committed. The first half becomes false and the second stays true
for its own reasons. Both language variants are rewritten together.

> **Build gotcha.** `docs/brief.standalone.html` is generated from `system/web/brief/index.html`,
> and `npm run lint:standalone` asserts the two agree. Editing the brief without running
> `npm run build:standalone` in the same commit fails `npm run ci` at step 11 of 12.

## 8. Cleanup in course-lab

- `git rm -r AI-LLM/scene-graph-studio`
- Delete `.github/workflows/scene-graph-studio.yml`. It is the only workflow in that directory.
- Drop the two un-ignore negations `!AI-LLM/scene-graph-studio/data/` and
  `!AI-LLM/scene-graph-studio/data/**`, and the paragraph of comment that justifies them.
- Rewrite the scene-graph-studio entries in `CLAUDE.md`, `KNOWLEDGE_BASE.md` and
  `docs/superpowers/INDEX.md` to record that the track moved, when, and to where.
- Amend the note at `use-py12.ps1` line 21, which cites the track's self-resolving interpreter as
  an example.

`.superpowers/sdd/` holds session scratch for the playgrounds cycle and is untracked, so it needs
no git action.

## 9. Order of operations

The sequence exists to keep a recoverable copy in front of every destructive step.

1. Commit the in-flight F1 work in `course-lab`.
2. Push `main` and `feat/playgrounds-m0` to `course-lab`'s GitHub remote. **This push is the
   rollback.** Nothing destructive happens before it succeeds.
3. Rehearse §4 against a throwaway clone of WekaExt; assert the ancestry property.
4. Split both refs; graft both into the real WekaExt.
5. Move `data/_raw` and the other untracked payloads by rename.
6. Apply §7 inside WekaExt; commit.
7. Add the CI workflow; commit.
8. Verify per §10 locally.
9. Push the branch to Gitea; read the run.
10. Only now, apply §8 to `course-lab` and commit.

## 10. Acceptance

The move is done when all of the following hold in `C:\dev\WekaExt\scene-graph-studio`:

| Check | Command |
|---|---|
| Gate | `npm ci && npm run ci` green, all twelve steps |
| Keyboard walkthrough | `npx playwright test` green, 26 tests |
| Offline | `npm run check:offline` green |
| Performance, NFR-8 | `npm run check:perf` green |
| Pins | `npm run check:pins` green |
| History | `git log --follow scene-graph-studio/system/frontend/src/routes.tsx` reaches back past the graft |
| CI | one Gitea run observed green |
| Independence | `AI-LLM` survives in exactly one tracked file, `plans/2026-09-15-01-skeleton-and-eval-engine.md`, and nowhere else |

## 11. Rollback

Before step 4, rollback is to do nothing. After it, `course-lab`'s pushed refs hold every commit,
and WekaExt's graft is a merge commit that `git reset --hard` removes. After step 10, the
`course-lab` deletion is a single revertible commit. No step destroys the only copy of anything.

## 12. Out of scope

- Any deployment of scene-graph-studio, and any edit to WekaExt's `ci.yml` or `deploy.yml`.
- Tasks 7 through 13 of the playgrounds M0 cycle, which resume after the move.
- The 4.7 GB `data/_raw` corpus as version-controlled content. It stays untracked and refetchable.
- Any change to `course-lab`'s other tracks.
- Rewriting completed plans to the new path. §7 states why.
