# devdata migration, WekaExt wave 2 — plan

**Goal:** Scene Graph Studio's data follows remotex's devdata convention (spec
`C:\dev\remotex\docs\superpowers\specs\2026-10-01-devdata-design.md`, decision 4.5 and §10): one linked dataset whose
master is on the NAS under the `raw` root at `WekaExt/scene-graph-studio`, a tracked CI fixture in its place on the
runner, generators that stop when the link is absent, and no tracked file naming a data location.

**Decisions locked with the author, 2026-10-02.**

| Question | Answer |
|---|---|
| Which plan | The devdata spec's wave 2 for WekaExt (§10.2), whose only data mechanism is this track's (§10.3). |
| Location | Move the NAS folder to `<raw>/WekaExt/scene-graph-studio`, decision 4.5's place, and set `source` to match. |
| Lint | Rewrite every line `devdata lint` reports, records included, until it reports zero. |
| CI | The runner installs remotex and links the fixture with `devdata pull --ci`. |

**Not in this plan.** Spec §10.1 steps 5 and 6: the author runs `git pull`, `devdata pull` and the tests on a second
machine, and only then are `Connect-DataDirectory.ps1`, `fetch-data.ps1`'s link step, `SGS_DATA_DIR` and
`SGS_CORPUS_ROOT` retired.

---

### Task 1: Move the NAS folder and relink

- Stop every process reading `data/` (the dev server). Rename the `raw` root's
  `scene-graph` to `WekaExt/scene-graph-studio` (one volume, so a rename, not a copy). Never `rm -rf data/`.
- `data.toml`: `source = "raw:WekaExt/scene-graph-studio"`. `devdata pull` replaces the junction (`wrong-target`);
  `devdata status` reports `linked`.
- Verify: `npm run ci` green; hashes of the D124 transcript and derived file unchanged.

### Task 2: Generators stop when `data/` is absent (rule 10.4)

- Python: one guard in `app/settings.py`, called at the start of every script under `backend/scripts/` that writes
  under `DATA_DIR`; it stops with a message naming `devdata pull` and creates nothing.
- Node: the same guard for `tools/harvest.mjs`.
- Tests: a script run against an absent data directory exits non-zero, names `devdata pull`, and leaves no directory
  behind; a static test that every writing script calls the guard.

### Task 3: The CI fixture

- `fixtures/data/`, tracked: the smallest self-consistent subset with which `npm run ci` passes on a machine without
  the NAS. Determined by running the gate in a worktree whose `data/` is linked to the candidate by
  `devdata pull --ci`.
- `data.toml` declares `fixture = "fixtures/data"`.
- A test whose input the fixture omits is skipped under `--ci` (`CI=true`) and fails outside it (rule 10.4).

### Task 4: Lint to zero

- Code: `Connect-DataDirectory.ps1` reads the target from devdata (`roots.toml`'s `raw` and `data.toml`'s `source`)
  instead of a literal path; messages in `start.ps1` and `start.mjs`, comments and tests name the entry path.
- Records: every line `devdata lint` reports is rewritten to name the entry path or the root by name.
- Verify: `devdata lint` exits 0.

### Task 5: CI workflow

- `.gitea/workflows/scene-graph-studio.yml`: install remotex from `https://gitea.cillab.me/CIL-Team/remotex.git`,
  run `devdata pull --ci` at the track root, then `npm run ci`.
- Unverified until a runner takes the job: whether the runner can clone remotex without a token (spec risk R5).

### Task 6: Records

- D125 in `DEVIATIONS.md`; `CLAUDE.md`'s data traps; INDEX; README; VERIFICATION §35.
