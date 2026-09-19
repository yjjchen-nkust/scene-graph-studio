# Relocation to WekaExt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move scene-graph-studio out of the `course-lab` teaching repository and into the `WekaExt` repository as the tracked subdirectory `scene-graph-studio/`, carrying its history, restoring the two dependencies the move severs, and leaving it with green CI on Gitea.

**Architecture:** `git subtree split` rewrites the track's paths out of `AI-LLM/scene-graph-studio/`; `git subtree add` and `git subtree merge` graft the result under `scene-graph-studio/` in WekaExt, once for `main` and once for the in-flight `feat/playgrounds-m0`. The application itself is not modified: only path strings, one paragraph of bilingual prose, the decision register, a new `CLAUDE.md`, and a new Gitea workflow.

**Tech Stack:** git (subtree, filter-repo as fallback), Gitea Actions, Node 22.12 / npm workspaces, Python 3.12 / pytest / ruff, PowerShell 7.

**Spec:** `docs/superpowers/specs/2026-09-19-relocation-design.md`

## Global Constraints

- **Source of truth for every decision in this plan is the spec.** Where they disagree, the spec wins.
- **Node ≥ 22.12.0** — a hard prerequisite of `vite@8.3.0`. Measured on this machine: 24.19.0.
- **Python is `py12`**, never the bare `python` on PATH. Node scripts resolve it through `system/tools/py.mjs`; PowerShell through `system/tools/Resolve-Python.ps1`. In CI, `SGS_PYTHON: python` overrides both.
- **Every `npm` command runs from the workspace root**, which after the move is `C:\dev\WekaExt\scene-graph-studio\system`.
- **Nothing destructive happens before Task 1's push succeeds.** That push is the rollback.
- **`course-lab` is not modified after Task 1 until Task 10.** Its working tree stays as the reference copy while the new one is verified.
- **Completed plans are not rewritten when directories move.** `plans/2026-09-15-01-skeleton-and-eval-engine.md` keeps all five of its `AI-LLM/` references. Only live documents change.
- **Both repositories have no `.gitattributes` and both set `core.autocrlf=true`.** Blobs are LF in the object store and CRLF in the working tree on both sides, so the graft must not produce line-ending churn. Task 3 asserts this.
- **Commit style follows the track's existing log:** a `type(sgs): lowercase summary` subject, then prose explaining why. No trailer lines.

> **Every count in this plan was measured at `6491b79`, before this plan, its spec and the F1
> commit were themselves committed into the track.** 382 should be read as 386, 86 as 89, and "the
> further 7" as "the further 10". The figures are left as written because a plan records what was
> decided at the time; the measured values live in deviation D87 and decision D-22.

## Review Focus

Five conditions the spec implies that no single task's deliverable would otherwise exercise. Each has a test, placed in the task that owns the code.

1. **A fresh clone of WekaExt must reproduce all 382 tracked files.** `git check-ignore` tested path *names* against the ignore rules; it did not prove that a clone materialises them. A rule that silently swallows `data/golden/vectors.json` would leave the test suite passing locally and failing for everyone else. → Task 8, Step 5.
2. **The graft must not rewrite line endings.** Identical `core.autocrlf` on both sides makes this safe in theory; a single file with a committed CRLF blob would show up as a spurious modification the moment WekaExt is checked out. → Task 3, Step 7.
3. **`start.ps1` and `fetch-data.ps1` must still find their track root.** Both anchor on `$PSScriptRoot`, which is the reason the move is safe — but that reasoning has never been executed from the new path. → Task 8, Step 4.
4. **`docs/brief.standalone.html` must agree with its source after the prose edit.** `npm run lint:standalone` is step 11 of 12 in `npm run ci`, so forgetting `npm run build:standalone` fails the gate late and confusingly. → Task 4, Step 6.
5. **The Gitea runner may not honour `on.push.paths`.** If it does not, the workflow runs on every push to WekaExt — correct but wasteful, and it must be recorded rather than discovered later. → Task 9, Step 3.

---

## Task 1: Commit the in-flight work and push both refs

This is the rollback. Everything after it is recoverable; nothing before it is.

**Files:**
- Commit (already on disk): `system/frontend/src/playgrounds/F1/LabelsToStructure.tsx`, `system/frontend/src/playgrounds/F1/test/LabelsToStructure.test.tsx`, `system/frontend/src/playgrounds/mounts.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `origin/main` at `13657e7` or later, and `origin/feat/playgrounds-m0` existing on GitHub. Tasks 2 and 3 split from these refs.

- [ ] **Step 1: Confirm what is uncommitted**

```bash
cd /c/dev/course-lab
git status --porcelain --untracked-files=all AI-LLM/scene-graph-studio/system/frontend/src/playgrounds/
```

Expected: exactly three lines — `M …/mounts.tsx`, `?? …/F1/LabelsToStructure.tsx`, `?? …/F1/test/LabelsToStructure.test.tsx`. If anything else appears, stop and report it; this plan assumes no other in-flight change.

- [ ] **Step 2: Run the F1 test to learn its state**

```bash
cd /c/dev/course-lab/AI-LLM/scene-graph-studio/system
npx vitest run frontend/src/playgrounds/F1/test/LabelsToStructure.test.tsx
```

Record the outcome. **Both outcomes are acceptable and they change only the commit subject**, because task 6 of the playgrounds cycle is mid-flight and this plan does not finish it:

- PASS → subject `feat(sgs): the F1 playground, labels to structure`
- FAIL → subject `wip(sgs): the F1 playground, mid-implementation`, and the body states which assertions fail and that M0 task 6 resumes after the relocation.

Do not fix the test. Finishing M0 is out of scope; §12 of the spec says so.

- [ ] **Step 3: Commit**

```bash
cd /c/dev/course-lab
git add AI-LLM/scene-graph-studio/system/frontend/src/playgrounds/
git commit    # subject per Step 2; body explains the state and that M0 resumes at task 7
```

- [ ] **Step 4: Push both refs**

```bash
git push origin feat/playgrounds-m0
git push origin main
```

- [ ] **Step 5: Verify the rollback exists**

```bash
git log --oneline -1 origin/main
git log --oneline -1 origin/feat/playgrounds-m0
git status --porcelain | wc -l      # expect 0
```

Expected: both remote refs resolve, and the working tree is clean. **If either push failed, stop here.** No later task may run without this.

---

## Task 2: Rehearse the split and prove the ancestry property

The two-ref split works only if `git subtree split` is deterministic, so that the playgrounds split descends from the main split instead of forming a second unrelated root. The spec asserts this is proven, not assumed.

**Files:**
- Create (throwaway): `C:\Temp\claude\C--dev-course-lab-AI-LLM-scene-graph-studio\50957e72-992a-4b18-8a43-400bf6307b58\scratchpad\wekaext-rehearsal\`

**Interfaces:**
- Consumes: `origin/main` and `origin/feat/playgrounds-m0` from Task 1
- Produces: local branches `sgs-split-main` and `sgs-split-playgrounds` in `course-lab`, and a yes/no on the ancestry property that decides whether Task 3 uses `subtree` or `filter-repo`

- [ ] **Step 1: Produce both splits**

```bash
cd /c/dev/course-lab
git subtree split -P AI-LLM/scene-graph-studio -b sgs-split-main        main
git subtree split -P AI-LLM/scene-graph-studio -b sgs-split-playgrounds feat/playgrounds-m0
```

This walks 86 commits and takes a minute or two. It creates two branches and changes nothing else.

- [ ] **Step 2: Assert the ancestry property — the test this task exists for**

```bash
git merge-base --is-ancestor sgs-split-main sgs-split-playgrounds && echo ANCESTOR-OK || echo ANCESTOR-FAILED
```

Expected: `ANCESTOR-OK`.

**On `ANCESTOR-FAILED`, stop and switch to the fallback** rather than improvising: delete both branches, and produce the two histories with `git filter-repo --path AI-LLM/scene-graph-studio --path-rename AI-LLM/scene-graph-studio/: --refs <ref>` against a bare mirror clone of `course-lab`, which rewrites deterministically by construction. Report the switch before continuing; it is a deviation and Task 5 records it.

- [ ] **Step 3: Check the shapes**

```bash
git log --oneline sgs-split-main        | wc -l    # expect 79
git log --oneline sgs-split-playgrounds | wc -l    # expect 86
git ls-tree --name-only sgs-split-main            # expect track-root names, no AI-LLM/
```

Expected: 79, 86, and a listing whose entries are `README.md`, `DEVIATIONS.md`, `data`, `docs`, `start.ps1`, `fetch-data.ps1`, `system` — the `AI-LLM/scene-graph-studio/` prefix gone.

- [ ] **Step 4: Rehearse the graft in a throwaway clone**

```bash
cd /c/Temp/claude/C--dev-course-lab-AI-LLM-scene-graph-studio/50957e72-992a-4b18-8a43-400bf6307b58/scratchpad
git clone /c/dev/WekaExt wekaext-rehearsal
cd wekaext-rehearsal
git remote add course-lab /c/dev/course-lab
git fetch course-lab sgs-split-main:sgs-main sgs-split-playgrounds:sgs-playgrounds
git subtree add -P scene-graph-studio sgs-main
git ls-files scene-graph-studio | wc -l    # expect 382
```

Expected: 382. This clone is throwaway; it proves the sequence and is then deleted.

- [ ] **Step 5: Rehearse the branch graft too**

```bash
git switch -c feat/playgrounds-m0
git subtree merge -P scene-graph-studio sgs-playgrounds
git log --oneline scene-graph-studio | wc -l     # expect 86 + WekaExt's own merge commits
git status --porcelain | wc -l                   # expect 0
```

Expected: a clean tree. A non-empty `git status` here means the merge left conflicts; report the conflicting paths and stop.

- [ ] **Step 6: Delete the rehearsal**

```bash
cd /c/Temp/claude/C--dev-course-lab-AI-LLM-scene-graph-studio/50957e72-992a-4b18-8a43-400bf6307b58/scratchpad
rm -rf wekaext-rehearsal
```

Nothing is committed in this task. Its deliverable is the proof, and the two split branches that Task 3 consumes.

---

## Task 3: Graft both refs into WekaExt and move the untracked payloads

**Files:**
- Create: `C:\dev\WekaExt\scene-graph-studio\` (382 tracked files, grafted)
- Move: `data/_raw` (4.7 GB), `data/slices/*/images`, `system/node_modules`, `system/.offline-venv`

**Interfaces:**
- Consumes: `sgs-split-main` and `sgs-split-playgrounds` from Task 2
- Produces: `C:\dev\WekaExt\scene-graph-studio\` on branch `feat/playgrounds-m0`, with WekaExt's `main` holding the 79-commit graft. Tasks 4 through 9 all work in that directory.

- [ ] **Step 1: Confirm WekaExt is clean before touching it**

```bash
cd /c/dev/WekaExt
git status --porcelain | wc -l      # expect 0
git branch --show-current           # expect main
```

Expected: 0 and `main`. **If the tree is dirty, stop** — a graft onto uncommitted work is not recoverable by `git reset --hard`.

- [ ] **Step 2: Graft main**

```bash
git remote add course-lab C:/dev/course-lab
git fetch course-lab sgs-split-main:sgs-main sgs-split-playgrounds:sgs-playgrounds
git subtree add -P scene-graph-studio sgs-main
```

Both splits are fetched into named local refs because `FETCH_HEAD` holds only the last ref of a multi-ref fetch.

- [ ] **Step 3: Verify the main graft**

```bash
git ls-files scene-graph-studio | wc -l                          # expect 382
git log --oneline --follow scene-graph-studio/system/frontend/src/routes.tsx | wc -l
```

Expected: 382, and a `--follow` count well above 1 — the history reaches back past the graft. A count of 1 means the history did not travel; stop and report.

- [ ] **Step 4: Graft the branch**

```bash
git switch -c feat/playgrounds-m0
git subtree merge -P scene-graph-studio sgs-playgrounds
```

- [ ] **Step 5: Drop the temporary refs and the remote**

```bash
git branch -D sgs-main sgs-playgrounds
git remote remove course-lab
```

They exist only to carry the graft. Leaving them behind would make `course-lab` look like an upstream of WekaExt, which it is not.

- [ ] **Step 6: Move the untracked payloads by rename**

```bash
cd /c/dev/course-lab/AI-LLM/scene-graph-studio
mv data/_raw            /c/dev/WekaExt/scene-graph-studio/data/_raw
mv system/node_modules  /c/dev/WekaExt/scene-graph-studio/system/node_modules
mv system/.offline-venv /c/dev/WekaExt/scene-graph-studio/system/.offline-venv
for d in data/slices/*/images; do
  [ -d "$d" ] && mv "$d" "/c/dev/WekaExt/scene-graph-studio/$d"
done
rm -rf /c/dev/course-lab/AI-LLM/scene-graph-studio/frontend
```

Source and destination share drive C, so each `mv` is a rename and returns immediately. The last line deletes the empty `frontend/src/playgrounds/test/` tree the spec §3 identifies as a stray; git never tracked it, so no commit records its removal.

- [ ] **Step 7: Assert no line-ending churn — Review Focus item 2**

```bash
cd /c/dev/WekaExt
git status --porcelain scene-graph-studio | wc -l      # expect 0
```

Expected: 0. Both repositories set `core.autocrlf=true` and neither has a `.gitattributes`, so a checked-out file must match its blob exactly. **A non-zero count means files differ from what was committed**; run `git diff --stat scene-graph-studio` and report before proceeding, because every later verification would inherit the discrepancy.

- [ ] **Step 8: Confirm the payloads arrived**

```bash
du -sh scene-graph-studio/data/_raw            # expect ~4.7G
ls scene-graph-studio/system/node_modules | wc -l
```

Expected: the corpus is present and `node_modules` is populated. Nothing to commit in this step — all four paths are ignored.

- [ ] **Step 9: Commit nothing; report state**

The grafts are already commits made by `git subtree`. Confirm with:

```bash
git log --oneline -3
```

Expected: the subtree merge for the branch, WekaExt's prior tip beneath it.

---

## Task 4: Correct the paths and the prose inside the track

**Files:**
- Modify: `scene-graph-studio/README.md:44,54`
- Modify: `scene-graph-studio/.gitignore:13-14`
- Modify: `scene-graph-studio/system/web/brief/index.html:820-821`
- Modify: `scene-graph-studio/docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md:290`
- Modify: `scene-graph-studio/docs/superpowers/plans/2026-09-19-playgrounds-m0.md:15`
- Regenerate: `scene-graph-studio/docs/brief.standalone.html`
- **Do not modify:** `scene-graph-studio/docs/superpowers/plans/2026-09-15-01-skeleton-and-eval-engine.md`

**Interfaces:**
- Consumes: the grafted tree from Task 3
- Produces: a tree in which the only tracked file naming `AI-LLM/` is the completed plan. Task 8 asserts that.

All paths below are relative to `C:\dev\WekaExt\`.

- [ ] **Step 1: README, both `cd` commands**

Replace `cd AI-LLM\scene-graph-studio` with `cd scene-graph-studio`, and `cd AI-LLM/scene-graph-studio/system` with `cd scene-graph-studio/system`.

- [ ] **Step 2: `.gitignore`, the stale rationale**

The `data/checkpoints/` rule stays; only its justification changes, because the repo-root un-ignore it cites will not exist here.

Replace:

```
# Model weights. The repo-root .gitignore un-ignores this whole data/ tree (it had already
# cost two tracks their data directory), so anything large has to be excluded here.
data/checkpoints/
```

with:

```
# Model weights. WekaExt's root .gitignore has no rule over this tree at all, so every
# exclusion the track needs has to be stated here. (In course-lab a bare `data` rule swallowed
# this directory twice before two un-ignore negations were added; that hazard is gone, and with
# it the negations -- but the weights still must not be committed.)
data/checkpoints/
```

- [ ] **Step 3: The brief, both language variants together**

In `system/web/brief/index.html`, replace the two `<span>` bodies of the `Where should the repository live?` answer:

```html
        <p><span lang="en">Inside the WekaExt repository at <code>scene-graph-studio/</code>, not as a repository of its own. It moved there from the teaching repository on 2026-09-19. Large binary corpora are not committed either way &mdash; which is why slice annotations are versioned and slice images are not.</span>
        <span lang="zh">放在 WekaExt repository 內的 <code>scene-graph-studio/</code>，不另建獨立 repository；2026-09-19 自教材 repository 遷入。兩者皆不將大型二進位語料納入版控——這正是切片標註納入版控、切片影像不納入的原因。</span></p>
```

The heading above it (`Where should the repository live? — settled` / `程式碼要放在哪裡？ — 已定案`) is unchanged: the question is still settled, by a different answer.

- [ ] **Step 4: The contracts workspace tree**

Line 290 reads `AI-LLM/scene-graph-studio/` as the root of a tree whose entries (`package.json`, `packages/`) actually live under `system/`. The old path and that pre-existing staleness are corrected in one edit. Replace `AI-LLM/scene-graph-studio/` with `scene-graph-studio/system/`.

- [ ] **Step 5: The active playgrounds plan**

`plans/2026-09-19-playgrounds-m0.md` line 15 currently reads:

```
- **Working directory is `AI-LLM/scene-graph-studio/system/`.** Every `npm` command runs there.
```

Replace with:

```
- **Working directory is `scene-graph-studio/system/` inside the WekaExt repository.** Every `npm` command runs there. (The track moved on 2026-09-19, between tasks 6 and 7 of this plan; see `specs/2026-09-19-relocation-design.md`.)
```

This plan is live — tasks 7 through 13 have not run — so leaving the old path would send its executor to a directory that no longer exists.

- [ ] **Step 6: Regenerate the standalone brief and prove it agrees — Review Focus item 4**

```bash
cd /c/dev/WekaExt/scene-graph-studio/system
npm run build:standalone
npm run lint:standalone
```

Expected: both succeed. `lint:standalone` is step 11 of 12 in `npm run ci` and it asserts `docs/brief.standalone.html` matches `system/web/brief/index.html`. Editing the brief without this step fails the gate late and for a reason that reads as unrelated.

- [ ] **Step 7: Confirm the completed plan was left alone**

```bash
cd /c/dev/WekaExt
git diff --name-only scene-graph-studio/docs/superpowers/plans/2026-09-15-01-skeleton-and-eval-engine.md
```

Expected: empty. That file names the old path five times, including the full text of the GitHub workflow, and it is a record of what was decided at the time.

- [ ] **Step 8: Commit**

```bash
git add scene-graph-studio/README.md scene-graph-studio/.gitignore \
        scene-graph-studio/system/web/brief/index.html scene-graph-studio/docs/brief.standalone.html \
        scene-graph-studio/docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md \
        scene-graph-studio/docs/superpowers/plans/2026-09-19-playgrounds-m0.md
git commit    # subject: docs(sgs): the track's own paths, after the move to WekaExt
```

---

## Task 5: Supersede D-01 and D-20; record D87

Two binding decisions describe a location and a documentation arrangement the move changes. A live decision cannot be quietly falsified.

**Files:**
- Modify: `scene-graph-studio/docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md` (index table, D-01, D-20, new D-22)
- Modify: `scene-graph-studio/docs/superpowers/specs/2026-09-15-scene-graph-studio-design.md:256,417`
- Modify: `scene-graph-studio/docs/INDEX.md:46`
- Modify: `scene-graph-studio/DEVIATIONS.md` (append D87)

**Interfaces:**
- Consumes: the tree from Task 4
- Produces: `D-22` as the current authority on repository location, cited by Task 6's `CLAUDE.md`

- [ ] **Step 1: Add the two index rows**

In `…-decisions.md`, after the `| D-21 | … |` row of the Index table, append:

```
| D-22 | Repository location is `scene-graph-studio/` inside WekaExt | supersedes D-01, D-20 |
```

- [ ] **Step 2: Mark D-01 superseded in place**

Immediately under the `## D-01 Repository location` heading, insert:

```
> **Superseded 2026-09-19 by D-22.** The location this decision fixes is no longer where the
> project lives; the rest of it — that this is not a separate repository, and that large binary
> corpora stay out — was carried forward rather than discarded. The text below is left intact as
> the record of what was decided on 2026-09-15. See `specs/2026-09-19-relocation-design.md`.
```

Change nothing else in that section. Marking in place is what this project already does for the superseded ARM64 hardware table.

- [ ] **Step 3: Mark D-20 superseded in place**

D-20 requires `CLAUDE.md` at the repository root to carry a `scene-graph-studio` entry. WekaExt's root has no `CLAUDE.md`, and the track now carries its own. Immediately under the `## D-20 The track is documented in the repository \`CLAUDE.md\`` heading, insert:

```
> **Superseded 2026-09-19 by D-22.** The repository whose `CLAUDE.md` this decision amends is
> `course-lab`, which no longer holds the track. The requirement it expresses — that a session
> opening this code learns what it is before touching it — is met instead by
> `scene-graph-studio/CLAUDE.md`, which the track now carries itself.
```

- [ ] **Step 4: Write D-22**

Append after the D-21 section:

```markdown
---

## D-22 Repository location is `scene-graph-studio/` inside WekaExt

**Decided 2026-09-19.** Supersedes D-01 (location) and D-20 (where the track is documented).

**Decision.** The project lives at `scene-graph-studio/` inside the WekaExt repository
(`gitea.cillab.me/CIL-Team/WekaExt.git`). It remains **not** a separate repository and still does
not get its own `git init` — that half of D-01 is upheld, not overturned. Its history was carried
over by `git subtree`, so `git log` and `git blame` reach back to `5341aee`.

**Why it moved.** `course-lab` is a teaching-materials repository; eleven of its twelve tracks
build PowerPoint decks and LaTeX courseware, and this one shares nothing with them but the
repository. WekaExt is a full-stack platform repository, which is what this is.

**Rejected alternatives.** A nested independent repository that WekaExt ignores — strongest
independence, but it needs its own remote and leaves the two trees related only by disk layout.
A git submodule — an explicit recorded link, at the cost of `--recurse-submodules` on every clone
and a pointer bump on every change.

**Consequence, carried forward from D-01.** Large binary corpora are still not committed, and
the reason is now its own rather than inherited: a 4.7 GB corpus belongs in neither a teaching
repository nor a deployed platform repository. `data/_raw/` and `data/slices/*/images/` stay
excluded by the track's own `.gitignore`; see D-08 for how slice images are handled instead.

**What the move severed, and what replaced it.** The track inherited its project instructions
from `course-lab/CLAUDE.md` and would have inherited none, since WekaExt's root has no such file;
`scene-graph-studio/CLAUDE.md` now carries them. The two un-ignore negations `course-lab`
required are gone, because WekaExt has no rule over this tree — `git check-ignore` over all 382
tracked paths matches nothing.

**Independence.** CI is a separate path-filtered workflow, `.gitea/workflows/scene-graph-studio.yml`.
WekaExt's own `ci.yml` and `deploy.yml` are untouched, so the two pipelines cannot interfere.
Deployment of this track remains out of scope.
```

- [ ] **Step 5: Update the design document's two closed-item references**

Line 256 — replace:

```
Repo root: **`AI-LLM/scene-graph-studio/` inside the `course-lab` repository** (decision D-01; committed at `5341aee`). The earlier path recorded here was superseded before any code was written.
```

with:

```
Repo root: **`scene-graph-studio/` inside the WekaExt repository** (decision D-22, which superseded D-01 on 2026-09-19; originally committed to `course-lab` at `5341aee`). The path recorded in §4.1 above was superseded before any code was written; the `course-lab` path that replaced it was superseded by the move.
```

Line 417 — replace:

```
1. **Repo location** — **CLOSED, D-01.** `AI-LLM/scene-graph-studio/` inside `course-lab`. Not a
   separate repository; no `git init`.
```

with:

```
1. **Repo location** — **CLOSED, D-22** (which superseded D-01). `scene-graph-studio/` inside
   WekaExt. Not a separate repository; no `git init`.
```

- [ ] **Step 6: Update the knowledge index**

`docs/INDEX.md` §2 heading reads `## 2. Decisions — D-01 … D-21`. Change it to `## 2. Decisions — D-01 … D-22`. Replace the D-01 row:

```
| **D-01** | Repository lives at `AI-LLM/scene-graph-studio/` | not its own repo |
```

with two rows, D-01 kept so the register stays complete:

```
| **D-01** | Repository lives at `AI-LLM/scene-graph-studio/` | **superseded 2026-09-19 by D-22** |
```

and, after the D-21 row:

```
| **D-22** | Repository lives at `scene-graph-studio/` inside WekaExt | supersedes D-01, D-20; still not its own repo |
```

Also amend the D-20 row in the same table to read `**superseded 2026-09-19 by D-22**` in its third column.

- [ ] **Step 7: Append D87 to DEVIATIONS.md**

```markdown
## D87 — the track moved out of `course-lab` and into WekaExt

**Plan:** none. This is not a deviation from a plan but a change of the ground every plan stands
on, recorded here because `DEVIATIONS.md` is where this project keeps things that would otherwise
become folklore.

**What moved.** `AI-LLM/scene-graph-studio/` in `course-lab` became `scene-graph-studio/` in
`gitea.cillab.me/CIL-Team/WekaExt.git`, on 2026-09-19, from `feat/playgrounds-m0` at the tip that
followed `13657e7`. `git subtree split` rewrote the paths and `git subtree add` grafted 79 commits
onto WekaExt's `main`; `git subtree merge` carried the further 7 of the in-flight playgrounds
branch. All 382 tracked files and all 86 commits travelled. `git blame` is unaffected.

**Why, and what the alternatives were.** Recorded as decision D-22, which supersedes D-01 and
D-20.

**What the move severed.** Two things, both restored in the same cycle. The track had no
`CLAUDE.md` and inherited `course-lab`'s; WekaExt's root has none, so it now carries its own.
And `course-lab`'s root `.gitignore` held a bare `data` rule plus two un-ignore negations naming
this track — the hazard that had already cost two tracks their data directory. WekaExt has no
rule over this tree, verified by `git check-ignore` over all 382 tracked paths, so the negations
stayed behind.

**What did not move, deliberately.** `plans/2026-09-15-01-skeleton-and-eval-engine.md` still
names `AI-LLM/scene-graph-studio/` five times, including the full text of the GitHub workflow it
specified. It is a completed plan and a record of what was decided at the time. Rewriting it
would destroy evidence and gain nothing.

**CI changed forge.** `.github/workflows/scene-graph-studio.yml` (GitHub Actions) became
`.gitea/workflows/scene-graph-studio.yml` (Gitea Actions), path-filtered on `scene-graph-studio/**`
and running the same `npm run ci`. WekaExt's own `ci.yml` and `deploy.yml` were not edited.
Deployment of this track remains out of scope, blocked by the same three reasons as before: a
private repository, third-party content, and the backend dependency.
```

If Task 2 Step 2 required the `filter-repo` fallback, say so in D87's second paragraph in place of the `subtree` sentence, naming the command actually used.

- [ ] **Step 8: Verify the register is internally consistent**

```bash
cd /c/dev/WekaExt/scene-graph-studio
grep -c '^## D-[0-9]' docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md   # expect 22
grep -n 'D-22' docs/INDEX.md docs/superpowers/specs/2026-09-15-scene-graph-studio-design.md | wc -l
grep -c '^## D8[0-9]' DEVIATIONS.md    # expect 8 (D80-D87)
```

Expected: 22 decision sections, at least three D-22 citations outside the register itself, and D87 present.

- [ ] **Step 9: Commit**

```bash
cd /c/dev/WekaExt
git add scene-graph-studio/docs scene-graph-studio/DEVIATIONS.md
git commit    # subject: docs(sgs): D-22 supersedes D-01 and D-20; D87 records the move
```

---

## Task 6: Give the track its own `CLAUDE.md`

The one dependency the move genuinely severs. The track holds no `CLAUDE.md`, inherits `course-lab`'s, and WekaExt's root has none to inherit instead.

**Files:**
- Create: `scene-graph-studio/CLAUDE.md`

**Interfaces:**
- Consumes: D-22 from Task 5
- Produces: project instructions for any session opened on the track. Nothing else reads it.

- [ ] **Step 1: Write the file**

Create `C:\dev\WekaExt\scene-graph-studio\CLAUDE.md`:

```markdown
# CLAUDE.md — Scene Graph Studio

## Read this first

`docs/INDEX.md` is the knowledge index for this track. It indexes the specs, the plans,
`docs/VERIFICATION.md` (the nine checks of design §6, each with its date and outcome — all nine
run and passed — plus §10 NFR-8 measured and §11 the dependency pins), and all 87 logged
deviations. It is kept current. **Read it before changing anything.**

## What this is

A full-stack teaching application for scene graph generation, built for 大語言模型技術與應用
(2026) and anchored on Wang et al., *IndVisSGG*, Advanced Engineering Informatics 65 (2025)
103107. It teaches 15 bilingual modules over 93 knowledge points, with 8 labs, 60 paper cards and
5 frozen leaderboards.

It lives at `scene-graph-studio/` inside the WekaExt repository and is **not** a separate
repository (decision **D-22**, which superseded D-01 on 2026-09-19 when the track moved here from
the `course-lab` teaching repository). It is independent of the rest of WekaExt: it shares no
code, no build, no dependency and no deployment with the platform, and its CI is a separate
path-filtered workflow. Do not wire it into WekaExt's `docker-compose.yml`, `ci.yml` or
`deploy.yml`.

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
  walkthrough at three projector resolutions, 26 tests, over the production build with no backend
  running), `npm run check:offline` (check 6, a torch-free interpreter with every outward request
  intercepted), `npm run check:perf` (NFR-8, cold start on five routes and input-to-paint on five
  labs, against a backend it starts itself), `npm run check:pins`.

## Traps

- **Two numbering schemes coexist and collide.** `D-01…D-22` are binding decisions in
  `docs/superpowers/specs/…-decisions.md`. `D1…D87` are deviations in `DEVIATIONS.md`. **`D-22`
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
  in both locales (**D76**). All 92 steps carry theirs; 184 notes.
- **`docs/brief.standalone.html` is generated** from `system/web/brief/index.html`, and
  `npm run lint:standalone` asserts they agree. Edit the source, then run
  `npm run build:standalone` in the same commit.
- **Large binary corpora are not committed.** `data/_raw/` (4.7 GB) and `data/slices/*/images/`
  are excluded by this track's own `.gitignore`; `fetch-data.ps1` retrieves them. WekaExt's root
  `.gitignore` has no rule over this tree, so every exclusion the track needs is stated locally.
- **The design document's ARM64/Snapdragon hardware table describes a different machine** and is
  marked superseded in place.

## CI

`.gitea/workflows/scene-graph-studio.yml` at the WekaExt root, filtered to
`scene-graph-studio/**`, Node 22.12, Python 3.12, `SGS_PYTHON: python`, running `npm run ci`.
Deployment is out of scope: the earlier attempt was abandoned over a private repository,
third-party content and the backend dependency, and none of those has changed.
```

- [ ] **Step 2: Check every factual claim against the tree**

```bash
cd /c/dev/WekaExt/scene-graph-studio
node -e "const p=require('./system/package.json');console.log(p.scripts.ci.split('&&').length)"   # expect 12
grep -c '^## D[0-9]' DEVIATIONS.md                                                # expect 87
grep -c '^## D-[0-9]' docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md # expect 22
ls system/tools/audit.js system/tools/check.js system/tools/content_lint.mjs
grep -rl 'pickObjectAt' system/frontend/src | head -3
```

Expected: 12 steps, 87 deviations, 22 decisions, the three tools present, and `pickObjectAt` found. **Correct the file to match the tree wherever a number disagrees** — an instruction file that misstates a count teaches the wrong thing on the first read.

- [ ] **Step 3: Commit**

```bash
cd /c/dev/WekaExt
git add scene-graph-studio/CLAUDE.md
git commit    # subject: docs(sgs): the track carries its own CLAUDE.md
```

---

## Task 7: The Gitea CI workflow

**Files:**
- Create: `.gitea/workflows/scene-graph-studio.yml`
- **Do not modify:** `.gitea/workflows/ci.yml`, `.gitea/workflows/deploy.yml`

**Interfaces:**
- Consumes: the working tree from Task 6
- Produces: the workflow Task 9 observes running

- [ ] **Step 1: Write the workflow**

Create `C:\dev\WekaExt\.gitea\workflows\scene-graph-studio.yml`:

```yaml
name: scene-graph-studio

# 這個 track 與 WekaExt 平台本身無關：不共用程式碼、相依套件或部署，
# 因此獨立成一個 workflow，並以路徑過濾，不與 ci.yml 互相影響。
on:
  push:
    paths:
      - 'scene-graph-studio/**'
      - '.gitea/workflows/scene-graph-studio.yml'
  pull_request:
    paths:
      - 'scene-graph-studio/**'

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        # package.json 位於 system/；data/ 與 docs/ 留在 track 根目錄。
        working-directory: scene-graph-studio/system
    env:
      # 本機的 Python 步驟會解析 py12 虛擬環境（D80）。runner 上沒有 py12，
      # 解析器會退回 PATH 並在每個步驟印出警告。setup-python 安裝的直譯器
      # 正是這裡要用的，所以直接指定，不要讓它猜。
      SGS_PYTHON: python
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python -m pip install -r backend/requirements.txt
      - run: npm ci
      - run: npm run ci
```

The steps are the GitHub workflow's, unchanged except for `working-directory` and the path filter. `SGS_PYTHON: python` keeps its original reason, restated in the comment.

- [ ] **Step 2: Verify the YAML parses and says what it should**

```bash
cd /c/dev/WekaExt
node -e "
const fs=require('fs');const s=fs.readFileSync('.gitea/workflows/scene-graph-studio.yml','utf8');
console.log('working-directory:', /working-directory:\s*(\S+)/.exec(s)[1]);
console.log('node:', /node-version:\s*'([^']+)'/.exec(s)[1]);
console.log('paths ok:', s.includes(\"'scene-graph-studio/**'\"));
console.log('no AI-LLM:', !s.includes('AI-LLM'));
"
```

Expected: `scene-graph-studio/system`, `22.12`, `true`, `true`.

- [ ] **Step 3: Confirm the other two workflows are untouched**

```bash
git status --porcelain .gitea/
```

Expected: exactly one line, `?? .gitea/workflows/scene-graph-studio.yml`. Any modification to `ci.yml` or `deploy.yml` is out of scope by spec §12.

- [ ] **Step 4: Commit**

```bash
git add .gitea/workflows/scene-graph-studio.yml
git commit    # subject: ci(sgs): the track's own Gitea workflow, path-filtered
```

---

## Task 8: Full local verification

The acceptance table of spec §10, run against the new location.

**Files:** none modified. This task produces evidence.

**Interfaces:**
- Consumes: everything from Tasks 3 through 7
- Produces: the go/no-go for Task 9

- [ ] **Step 1: Install from the lockfile and run the gate**

```bash
cd /c/dev/WekaExt/scene-graph-studio/system
npm ci
npm run ci
```

Expected: all twelve steps pass. `npm ci` deletes and rebuilds `node_modules`, so the directory moved in Task 3 Step 6 is a convenience, not a dependency.

- [ ] **Step 2: The four checks the gate does not run**

```bash
npx playwright test          # check 8, 26 tests
npm run check:offline        # check 6
npm run check:perf           # NFR-8
npm run check:pins
```

Expected: all four green. Run them one at a time and report each; `check:perf` starts its own backend and is the slowest.

- [ ] **Step 3: History reaches back past the graft**

```bash
cd /c/dev/WekaExt
git log --oneline --follow scene-graph-studio/system/frontend/src/routes.tsx | tail -3
```

Expected: the oldest entries are the original commits from `course-lab`, not the graft.

- [ ] **Step 4: The PowerShell front doors resolve their own root — Review Focus item 3**

```powershell
cd C:\dev\WekaExt\scene-graph-studio
pwsh -NoProfile -File .\fetch-data.ps1 -Status
```

`-Status` is `fetch-data.ps1`'s default parameter set and is read-only: it prints the per-dataset table and downloads nothing. **Do not run `-Fetch`** — that pulls the corpus again, and Task 3 already moved it.

Expected: a data table naming datasets under `C:\dev\WekaExt\scene-graph-studio\data`, with no error and no mention of `course-lab`. Reaching the table at all proves three things at once: `$PSScriptRoot` resolved the new track root, `Join-Path $PSScriptRoot 'system'` found `system/tools/Resolve-Python.ps1` to dot-source, and that resolver chose an interpreter without reading anything outside the track.

`start.ps1` is not run here — it has no read-only mode and launching two servers proves nothing this does not. It uses the identical `$track`/`$system` idiom and dot-sources the same resolver, which is the whole of the risk.

- [ ] **Step 5: A fresh clone materialises all 382 files — Review Focus item 1**

```bash
cd /c/Temp/claude/C--dev-course-lab-AI-LLM-scene-graph-studio/50957e72-992a-4b18-8a43-400bf6307b58/scratchpad
rm -rf clone-check && git clone -b feat/playgrounds-m0 /c/dev/WekaExt clone-check
find clone-check/scene-graph-studio -type f -not -path '*/.git/*' | wc -l
ls clone-check/scene-graph-studio/data/golden/vectors.json
ls clone-check/scene-graph-studio/data/LICENCES.md
rm -rf clone-check
```

Expected: 382 files, and both named files present. `git check-ignore` tested path *names*; this tests that a clone actually produces them. `data/golden/vectors.json` is the file that holds the two evaluation engines identical, and it is exactly what `course-lab`'s bare `data` rule swallowed twice.

- [ ] **Step 6: The old path survives in exactly one tracked file**

```bash
cd /c/dev/WekaExt
git ls-files scene-graph-studio | xargs grep -Il 'AI-LLM'
```

Expected: one line, `scene-graph-studio/docs/superpowers/plans/2026-09-15-01-skeleton-and-eval-engine.md`. Any other file means a path edit was missed.

- [ ] **Step 7: Report the evidence**

State each of the six results. **If any failed, stop and fix before Task 9** — `course-lab` still holds the reference copy and Task 10 has not run, so nothing is lost.

---

## Task 9: Push to Gitea and read the run

**Files:** none.

**Interfaces:**
- Consumes: a green Task 8
- Produces: the observed CI result, and a recorded deviation if the path filter is unsupported

- [ ] **Step 1: Push the branch**

```bash
cd /c/dev/WekaExt
git push -u origin feat/playgrounds-m0
```

The branch, not `main`. The subtree graft on `main` reaches Gitea when the branch merges, which is a separate decision the user makes after seeing CI green.

- [ ] **Step 2: Read the run**

Open `https://gitea.cillab.me/CIL-Team/WekaExt/actions` and find the `scene-graph-studio` workflow run for this branch. Report: whether it started, which step it reached, and the outcome.

Expected: green. Two failure modes are anticipated and neither is a defect in this plan:

- **`setup-node@v4` cannot fetch Node 22.12** — the runner's action cache or network. Report the exact error. WekaExt's `ci.yml` already uses this action at Node 20, so the action itself resolves; only the version is new.
- **The runner rejects or ignores `on.push.paths`** — see Step 3.

- [ ] **Step 3: Determine whether the path filter took effect — Review Focus item 5**

Check whether `ci.yml` (backend and frontend) also ran for this push. It changes no file under `backend/` or `frontend/`, so under a working filter it should not have — and `scene-graph-studio.yml` should not run on a push that touches only WekaExt's own code.

If the filter was ignored, the workflow runs on every push: **correct but wasteful**. Do not remove the filter. Append to `DEVIATIONS.md` under D87 a paragraph naming the runner version and the observed behaviour, then commit.

- [ ] **Step 4: Report before proceeding**

Task 10 deletes the reference copy. Do not run it until CI has been observed and its result reported to the user.

---

## Task 10: Remove the track from course-lab

Last, because it is the only step that destroys the second copy. `origin/main` and `origin/feat/playgrounds-m0` on GitHub still hold everything, and this task's commit is revertible.

**Files:**
- Delete: `AI-LLM/scene-graph-studio/` (382 files), `.github/workflows/scene-graph-studio.yml`
- Modify: `.gitignore:44-50`, `CLAUDE.md:17,32,53`, `KNOWLEDGE_BASE.md:2250-2432` (§19) and `:2307`, `docs/superpowers/INDEX.md:73-86`, `use-py12.ps1:20-23`

**Interfaces:**
- Consumes: a reported-green Task 9
- Produces: `course-lab` as a teaching-materials repository only

All paths below are relative to `C:\dev\course-lab\`.

- [ ] **Step 1: Confirm the new copy is live and CI is green**

Do not proceed on an unread or failed CI run. This is a gate, not a formality.

- [ ] **Step 2: Remove the track and its workflow**

```bash
cd /c/dev/course-lab
git rm -r --quiet AI-LLM/scene-graph-studio
git rm --quiet .github/workflows/scene-graph-studio.yml
rmdir .github/workflows .github 2>/dev/null || true
```

It is the only workflow in that directory, so the directory goes with it.

- [ ] **Step 3: Drop the un-ignore negations**

In `.gitignore`, delete lines 44–50 — the comment paragraph and both negations:

```
# The bare `data` rule above is repo-wide and has now cost two tracks their data
# directory when work moved between machines (AI-RPA/data/, then scene-graph-studio's
# golden vectors and licence ledger). Un-ignore the scene-graph-studio tree, which is
# small, generated-but-verified, and required by its test suite. Large binaries stay
# out via that track's own .gitignore (data/_raw/, data/slices/*/images/).

!AI-LLM/scene-graph-studio/data/
!AI-LLM/scene-graph-studio/data/**
```

Replace with a one-line record, so the hazard the bare `data` rule represents is not forgotten now that its only surviving witness is gone:

```
# The bare `data` rule above is repo-wide and has cost two tracks their data directory
# (AI-RPA/data/, then scene-graph-studio's golden vectors). The scene-graph-studio
# negations that stood here moved out with that track on 2026-09-19; AI-RPA/data/ is
# still ignored on purpose and is regenerated by gen_synthetic_data.py.
```

The `!workshop_data/data/` negation below is unrelated and stays.

- [ ] **Step 4: Rewrite the `CLAUDE.md` entry**

Line 17 is the `AI-LLM/` bullet. It describes three bodies of work; it now describes two. Delete the sentence beginning `**`scene-graph-studio/` is the third body of work, added 2026-09-15 (`5341aee`)…` and everything after it to the end of that bullet, and replace with:

```
**`scene-graph-studio/` is gone from this repository.** The full-stack scene-graph teaching application that lived here from 2026-09-15 (`5341aee`) moved on 2026-09-19 to `WekaExt/scene-graph-studio/` (`gitea.cillab.me/CIL-Team/WekaExt.git`), where it carries its own `CLAUDE.md`, its own `.gitea` workflow and its own knowledge index. Its 86 commits remain readable in this repository's history. Do not recreate it here; `AI-LLM/` now holds two bodies of work, `paper|beamer/` and `intro/`.
```

Change the bullet's opening from `three unrelated bodies of work that must stay separate` to `two unrelated bodies of work that must stay separate`.

Line 32 — in the `docs/` bullet, `the three live `AI-LLM/scene-graph-studio/` specs` becomes `the three live scene-graph-studio specs, which left with that track on 2026-09-19`.

Line 53 — in the Python-environment paragraph, delete the sentence beginning ``AI-LLM/scene-graph-studio/` resolves the same environment by itself…` and the sentence that follows it naming `start.ps1`, `fetch-data.ps1` and `system/tools/Resolve-Python.ps1`.

- [ ] **Step 5: Mark `KNOWLEDGE_BASE.md` §19 moved**

§19 runs from line 2250 to line 2432, where §20 begins. **Do not delete it** — it is the knowledge base's record of the track, and this repository's convention is to mark superseded material in place. Insert immediately under the `## 19.` heading:

```
> **本 track 已於 2026-09-19 遷出。** 程式碼現位於 `WekaExt/scene-graph-studio/`
> （`gitea.cillab.me/CIL-Team/WekaExt.git`），自帶 `CLAUDE.md`、`.gitea` workflow 與
> `docs/INDEX.md`。以下內容保留為遷出前的紀錄，路徑均為舊路徑，不再更新；最新狀態請
> 讀該 repository 的 `docs/INDEX.md`。決策依據為 D-22（取代 D-01、D-20）。
```

The paragraph at line 2307 states that the root `.gitignore` un-ignores `!AI-LLM/scene-graph-studio/data/`. That is now false. Append to it:

```
（該反向解除規則已於 2026-09-19 隨 track 一併移除；WekaExt 根目錄對此樹沒有任何規則，
所需的排除全部寫在 track 自己的 `.gitignore`。）
```

§20 also names the track by its old path in three places, and §20 is **live** — `use-py12.ps1` is still this repository's Python front door. Three concrete edits:

1. **§20.1, the sentence above the resolver table** (line 2443) reads `兩支解析器套用相同順序，任一支改動時另一支必須同步：`. That instruction is now wrong: the resolvers are in different repositories and are free to diverge. Replace with:

```
兩支解析器原本套用相同順序。scene-graph-studio 已於 2026-09-19 遷至
`WekaExt/scene-graph-studio/`，兩者不再互相參照，亦無同步義務；下表保留為遷出前的對照紀錄。
```

2. **The two table rows** at lines 2449–2450 keep their old paths as the record, but each gains the destination. Change the second column of the PowerShell row to ``WekaExt/scene-graph-studio/system/tools/Resolve-Python.ps1`（2026-09-19 遷出）` and the npm row to ``WekaExt/scene-graph-studio/system/tools/py.mjs`（2026-09-19 遷出）`.

3. **§20.3's pin note** at line 2474 explains that `pyarrow` and `ruff` were installed into `py12` because `AI-LLM/scene-graph-studio/system/backend/requirements.txt` pinned them. That is a historical fact about why the environment holds those packages, so the sentence stays; append `（該檔已隨 track 於 2026-09-19 遷出）` to it.

§20.4 item 1 names `offline_check.mjs` without a repository path and needs no change.

- [ ] **Step 6: Update `docs/superpowers/INDEX.md` §2**

The heading reads `## 2. `AI-LLM/scene-graph-studio/docs/superpowers/specs/` — the only live spec set`. Replace the heading and its first two paragraphs with:

```markdown
## 2. scene-graph-studio — moved out of this repository

The track's fifteen planning documents left with it on 2026-09-19. It now lives at
`WekaExt/scene-graph-studio/` (`gitea.cillab.me/CIL-Team/WekaExt.git`) and carries its own
knowledge index at `docs/INDEX.md`, which cross-references decisions D-01…D-22, NFR-1…8 and
deviations D1…D87. Read that. Nothing in this repository governs it any longer.

This repository's own planning documents are the seven in §1, all COMPLETE or REFERENCE. **There
is no live spec set here.**
```

Delete the `| Group | Documents | Status |` table beneath, which described that track's specs and plans.

- [ ] **Step 7: Amend the `use-py12.ps1` note**

Lines 20–23 cite the track as a self-contained example. Replace:

```
    Scene Graph Studio resolves the same environment by itself, in the same order, from
    AI-LLM\scene-graph-studio\system\tools\Resolve-Python.ps1 and tools\py.mjs -- that track
    is self-contained and does not read this file. The candidate list below and the one there
    are the same list; change both together.
```

with:

```
    Scene Graph Studio kept its own copy of this search, in the same order, and moved out of
    this repository on 2026-09-19. Nothing here reads it and it reads nothing here. The two
    candidate lists were the same list; they are now free to diverge, and that is intended.
```

- [ ] **Step 8: Verify the removal is complete**

```bash
cd /c/dev/course-lab
git grep -Il 'scene-graph-studio' -- . ':!KNOWLEDGE_BASE.md' ':!CLAUDE.md' ':!docs/superpowers/INDEX.md' ':!.gitignore' ':!use-py12.ps1'
ls AI-LLM/                      # expect: beamer, intro, paper — no scene-graph-studio
ls .github 2>&1                 # expect: no such file or directory
```

Expected: the `git grep` returns nothing — every surviving mention is in one of the five files that deliberately record the move. `AI-LLM/` holds three entries. `.github/` is gone.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit    # subject: chore: scene-graph-studio moves to the WekaExt repository
git push origin feat/playgrounds-m0
```

The commit body should name the destination, the commit the move was taken from, and that the 86 commits stay readable here. **This commit is the rollback boundary**: reverting it restores the working tree, and `origin/main` on GitHub holds the pre-move state regardless.

- [ ] **Step 10: Clean up the split branches**

```bash
git branch -D sgs-split-main sgs-split-playgrounds
```

They were scaffolding for Task 2 and hold no commit that the graft did not carry.
