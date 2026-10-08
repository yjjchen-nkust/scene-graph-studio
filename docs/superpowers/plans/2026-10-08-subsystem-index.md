# Subsystem Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An index of sixteen subsystem pages and a map above the track's chronological records, held complete by a coverage test in `npm run ci`.

**Architecture:** A pure ESM module, `system/tools/docs_index.mjs`, parses the records and the pages and exports one function per rule (R1 to R8). Its vitest suite runs each rule over in-memory fixtures and once over the real tree. The pages are hand-written Markdown under `docs/subsystems/`, built in three passes: skeletons with ownership, then the assignment of every record, then the content, group by group, each group checked by a second reader.

**Tech Stack:** Node ≥ 22.12, vitest 3 (the `tools` project), Markdown. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-subsystem-index-design.md`

## Global Constraints

- Branch `docs/subsystem-index`. Every `npm` and `node tools/…` command runs from `system/`.
- No new dependency. `system/tools/` is `"type": "commonjs"`, so the new tool is an `.mjs` file.
- `npm run ci` stays eleven steps: harvest, pytest, metrics build, vitest, ruff, parity, i18n, content, frozen, standalone, frontend build. The coverage test runs inside step 4 (vitest).
- No product code or content changes, apart from the two new tools files.
- Nothing is written under `data/`. Never `rm -rf data/` (D110).
- Chronological records are append-only: D1 to D125 and `VERIFICATION.md` §1 to §35 are not edited. The only in-place edits to specs are the superseded notes of Task 2.
- Writing register for every new line: formal English, no em dashes in sentences, no rhetorical questions. Numbers are copied from their source and never recomputed or rounded. A fact with no source is not written. A reason that no record states is written as "not recorded".
- Citation forms (spec §5), exactly: `D-24`; `D99`; `VERIFICATION §23`; `contracts §1.5`, `SRS §4.3`, `design §4.3`, `PRD §5`; spec or plan file names in backticks; repository-root-relative paths in backticks; knowledge points as `kp:D1`.
- Page file names are `docs/subsystems/S01-…md` to `S16-…md`; each title is `# S<n> <Name>`, with no zero padding.
- Ownership exempt list: `docs/`, `CLAUDE.md`, `README.md`, `DEVIATIONS.md`.
- Working copies are CRLF (`core.autocrlf=true`). Every parser normalises `\r\n` to `\n` first.

## Review Focus

1. **CRLF documents.** On this machine every `.md` file is checked out with CRLF, so a heading regex that is anchored on `$`, or an exact heading comparison, sees `\r` and fails, or passes on nothing. Expected: identical results for LF and CRLF input. Pinned in Task 1 (`reads CRLF documents as LF`).
2. **Words that look like deviations.** `kp:D1`, the demo names D-T and D-V, `3D` and `D12x` are not citations. Expected: none counts toward R1 or R5. Pinned in Task 1 (`ignores tokens that only resemble a deviation`).
3. **Path decorations.** A cited path may carry a trailing slash, a `:604` or `:123-145` suffix, a glob (`*`), or the `data/` prefix. Expected: the slash and the suffix are stripped before the existence check, globs are skipped, and `data/` is exempt. Pinned in Task 1 (`R6 strips decorations and exempts data/ and globs`).
4. **Section ids of every shape.** The documents number sections as `4.`, `4.3` and `1.4a`. Expected: `contracts §1.4a` and `design §4.3` resolve, and `design §4.` reads as §4. Pinned in Task 1 (`reads section ids of every shape`).
5. **Non-ASCII tracked names.** `git ls-files` quotes a name such as `docs/ref/Blueprints ・ Render Dashboard.url` unless it is run with `-z`. Expected: every listed file exists on disk as named. Pinned in Task 1 (`lists tracked files exactly as they exist on disk`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `system/tools/docs_index.mjs` | Parse records and pages; rules R1 to R8; `loadTree`; command-line report | 1 |
| `system/tools/test/docs_index.test.mjs` | Fixture case per rule; parser cases; the real tree | 1, 4 |
| `docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md` | D-24; D-22 annotated | 2 |
| `docs/superpowers/specs/2026-09-15-scene-graph-studio-PRD.md` | §5 cloud-deployment non-goal annotated | 2 |
| `DEVIATIONS.md` | D126 to D129 (Task 2), D130 (Task 10) | 2, 10 |
| `docs/subsystems/README.md` | The map | 3, 9 |
| `docs/subsystems/S01-evaluation-engine.md` … `S16-repository-and-deployment.md` | The sixteen pages | 3 to 8 |
| `docs/HISTORY.md` | `INDEX.md` §5, verbatim | 9 |
| `docs/INDEX.md` | Register and entry point; §3 to §6 as pointers | 9 |
| `CLAUDE.md` | Read-first pointer, D-24, slimmed traps | 9 |
| `docs/VERIFICATION.md` | §36 | 10 |

The sixteen page files, with their titles:

| File | Title |
|---|---|
| `S01-evaluation-engine.md` | `# S1 Evaluation engine` |
| `S02-api-and-schema.md` | `# S2 API and schema` |
| `S03-datasets-slices-licences.md` | `# S3 Datasets, slices and licences` |
| `S04-models-and-predictions.md` | `# S4 Models and predictions` |
| `S05-vlm-pipeline.md` | `# S5 VLM pipeline` |
| `S06-course-content.md` | `# S6 Course content` |
| `S07-papers-and-reference-pages.md` | `# S7 Papers and reference pages` |
| `S08-knowledge-map-and-brief.md` | `# S8 Knowledge map and brief` |
| `S09-graph-and-readouts.md` | `# S9 Graph and readouts` |
| `S10-shells-and-learner-state.md` | `# S10 Shells and learner state` |
| `S11-labs.md` | `# S11 Labs` |
| `S12-playgrounds.md` | `# S12 Playgrounds` |
| `S13-demos.md` | `# S13 Demos` |
| `S14-checks-and-instruments.md` | `# S14 Checks and instruments` |
| `S15-data-infrastructure.md` | `# S15 Data infrastructure` |
| `S16-repository-and-deployment.md` | `# S16 Repository and deployment` |

Every page carries these eight headings, verbatim and in this order (rule R8):

```
## 1. Purpose and boundary
## 2. Code and data
## 3. Interfaces
## 4. Current rules
## 5. Verification
## 6. Traps
## 7. History
## 8. Open items
```

---

### Task 1: The coverage module and its fixture suite

**Files:**
- Create: `system/tools/docs_index.mjs`
- Create: `system/tools/test/docs_index.test.mjs`

**Interfaces:**
- Produces (all named exports of `docs_index.mjs`):
  - `normalise(text: string): string`, which replaces `\r\n` with `\n`. Every function below that reads text calls it first.
  - `deviationIds(text): number[]` reads `^## D(\d+)\b`. `verificationIds(text): number[]` reads `^## (\d+)\. `. `decisionIds(text): number[]` reads `^## D-(\d{2}) `. `sectionIds(text): Set<string>` reads `^#{2,4} (\d+(?:\.\d+)*[a-z]?)[.\s]`.
  - `citations(text): { deviations: Set<number>, decisions: Set<number>, verification: Set<number>, sections: {doc: 'contracts'|'SRS'|'design'|'PRD', id: string}[], records: Set<string>, paths: Set<string> }`. The patterns:
    - deviations `(?<![\w:-])D(\d{1,3})(?![\w-])`;
    - decisions `(?<![\w:-])D-(\d{2})(?!\d)`;
    - verification `VERIFICATION §(\d+)`;
    - sections `\b(contracts|SRS|design|PRD) §(\d+(?:\.\d+)*[a-z]?)`;
    - records: the base name of any backticked token whose base name matches `^\d{4}-\d{2}-\d{2}-.+\.md$`;
    - paths: any backticked token that starts with `system/`, `fixtures/`, `docs/`, `.github/`, `.claude/` or `data/`. A `:\d+(-\d+)?` suffix is stripped, then a trailing `/`. Root-level files such as `start.ps1` are not path citations; R7 covers their ownership.
  - `ownership(mapText): {prefix: string, id: string}[]`. It reads rows matching ``^\| `([^`]*)` \| (S\d{1,2}) \|`` between `## Path ownership` and the next `## `.
  - `HEADINGS: string[]`, the eight headings above, and `EXEMPT = ['docs/', 'CLAUDE.md', 'README.md', 'DEVIATIONS.md']`.
  - `RULES: { R1 … R8: (tree: Tree) => string[] }`. Each value is a named function `r1` to `r8`, declared as `function rN(tree) {`, because Task 10's mutation run edits that line.
  - `check(tree): {rule: string, message: string}[]`.
  - `trackedFiles(repoRoot): string[]`. It runs `git ls-files -z`, splits on `\0` and drops empty entries.
  - `loadTree(repoRoot): Tree`.
- The `Tree` type, written as a JSDoc typedef in the module:
  - `pages: {file: string, text: string}[]` holds `docs/subsystems/S??-*.md`, sorted by name.
  - `map: string` is `docs/subsystems/README.md`, or `''` when that file is absent.
  - `deviations`, `verification` and `decisions` are strings.
  - `sectioned: {contracts, SRS, design, PRD}` holds the four documents' text.
  - `records: string[]` holds the base names of `docs/superpowers/specs/*.md` and `plans/*.md`.
  - `tracked: string[]`.
  - `exists: (path) => boolean` is repository-root-relative.
- Messages, exactly:

| Rule | Message |
|---|---|
| R1 | `D${n}: cited by no subsystem page` |
| R2 | `VERIFICATION §${n}: cited by no subsystem page` |
| R3 | `${name}: cited by no subsystem page` |
| R4 | `D-${nn}: cited by no subsystem page and not by the map` |
| R5 | `${file}: ${token} resolves to nothing`, where the token is written as `D9`, `D-09`, `VERIFICATION §9`, `contracts §9.9` or the record name |
| R6 | `${file}: ${path} does not exist` |
| R7 | `${path}: owned by no prefix` / `${prefix}: matches no tracked file` / `${prefix}: an empty or root prefix owns everything` / `${prefix}: listed twice` |
| R8 | `${file}: missing "${heading}"` / `${file}: "${heading}" out of order` / `${file}: title is not "# S${n} …"` |

- Rule details:
  - R1, R2 and R3 count pages only.
  - R4 counts the pages and the map.
  - R5 resolves records against `tree.records`, and sections against `sectionIds(tree.sectioned[doc])`. Within a page, it reports in the order deviations, decisions, verification, sections, records.
  - R6 skips tokens under `data/` and tokens containing `*`, `…`, `<` or a space.
  - R7 reads `ownership(tree.map)`. It applies `startsWith` matching, the exempt list, and the four checks of its message row. A prefix of `''`, `/` or `./` counts as root.
  - R8 flags a missing heading, then, for each heading present, an index lower than the previous present heading's. For the title, the first non-empty line must start with `# S${parseInt(file.slice(1, 3))} `.

- [ ] **Step 1: Write the failing suite.** `base()` returns a Tree that passes every rule. Each case below derives from it.

```js
const page = (cites) => ['# S1 X', ...HEADINGS.map((h, i) => (i === 3 ? `${h}\n${cites}` : h))].join('\n\n');
const base = () => ({
  pages: [{ file: 'S01-x.md', text: page('D1 D-01 VERIFICATION §1 contracts §1.1 `2026-01-01-a-design.md` `system/a.ts`') }],
  map: '## Path ownership\n\n| Prefix | Id |\n|---|---|\n| `system/` | S1 |\n\n## Next',
  deviations: '## D1 — a', verification: '## 1. A', decisions: '## D-01 A',
  sectioned: { contracts: '### 1.1 X', SRS: '', design: '', PRD: '' },
  records: ['2026-01-01-a-design.md'], tracked: ['system/a.ts', 'docs/x.md', 'README.md'],
  exists: (p) => ['system/a.ts', 'system'].includes(p),
});
```

The cases to write, by name, with the expected result of each:

- `the base tree passes every rule`: `check(base())` is `[]`.
- `R1 names an uncited deviation`: with `deviations += '\n## D2 — b'`, R1 returns `['D2: cited by no subsystem page']`.
- `R2 names an uncited verification section`: with `## 2. B` added, R2 returns `['VERIFICATION §2: cited by no subsystem page']`.
- `R3 names an uncited spec or plan`: with `records` plus `'2026-01-02-b.md'`, R3 returns `['2026-01-02-b.md: cited by no subsystem page']`.
- `R4 accepts the map and names an uncited decision`: with `## D-02 B` added, R4 returns `['D-02: cited by no subsystem page and not by the map']`. With `map += ' D-02'` it returns `[]`.
- `R5 names each dangling citation`: page cites `D9 D-09 VERIFICATION §9 contracts §9.9 \`2026-09-09-z.md\``. R5 returns those five, in that order, each as `S01-x.md: <token> resolves to nothing`.
- `R6 names a missing path`: `` `system/missing.ts` `` gives `['S01-x.md: system/missing.ts does not exist']`.
- `R6 strips decorations and exempts data/ and globs` (Review Focus 3): `` `system/a.ts:12` `system/a.ts:3-9` `system/` `system/*.ts` `data/x.json` `` gives `[]`.
- `R7 names an unowned file, a stale prefix, a root prefix and a duplicate`: these four mutations, applied one at a time, give the four R7 messages:
  - `tracked` plus `'fixtures/f.json'`;
  - the row `` `web/` | S1 ``;
  - the row `` `/` | S1 ``;
  - the `` `system/` `` row twice.
- `R7 exempts docs/, CLAUDE.md, README.md and DEVIATIONS.md`: the base tree's `docs/x.md` and `README.md` raise nothing.
- `R8 names a missing heading, a heading out of order and a wrong title`:
  - dropping `## 6. Traps` gives `S01-x.md: missing "## 6. Traps"`;
  - swapping headings 4 and 5 gives `S01-x.md: "## 5. Verification" out of order`;
  - the title `# S2 X` gives `S01-x.md: title is not "# S1 …"`.
- `reads CRLF documents as LF` (Review Focus 1): `base()` with every string's `\n` replaced by `\r\n` still gives `check(...) === []`, and `deviationIds('## D1 — a\r\n## D2 — b\r\n')` is `[1, 2]`.
- `ignores tokens that only resemble a deviation` (Review Focus 2): `citations('kp:D1 D-T D-V 3D D12x').deviations.size` is `0`.
- `reads section ids of every shape` (Review Focus 4):
  - `sectionIds('## 4. SRS — x\n### 4.3 The eval\n### 1.4a \`GET\`')` equals `new Set(['4', '4.3', '1.4a'])`;
  - `citations('contracts §1.4a and design §4.3.').sections` equals `[{doc: 'contracts', id: '1.4a'}, {doc: 'design', id: '4.3'}]`.
- `lists tracked files exactly as they exist on disk` (Review Focus 5): for `root = resolve(import.meta.dirname, '../../..')`, every entry of `trackedFiles(root)` satisfies `existsSync(join(root, f))`, and none starts with `"`.

- [ ] **Step 2: Run the suite to confirm it fails.** Run `npx vitest run --project tools tools/test/docs_index.test.mjs`. Expected: FAIL, because `../docs_index.mjs` cannot be resolved.

- [ ] **Step 3: Implement `docs_index.mjs`** to the Interfaces block. The command-line entry runs when `import.meta.url === pathToFileURL(process.argv[1]).href`. It loads the tree at `resolve(import.meta.dirname, '../..')` and prints one line per problem, as `${rule} ${message}`. It then prints `docs_index: ${n} problems` and exits with 1 when `n > 0`. The module performs no work at module scope.

- [ ] **Step 4: Run the suite to confirm it passes.** Run the command of Step 2. Expected: every case passes.

- [ ] **Step 5: Run the report over the real tree.** Run `node tools/docs_index.mjs`. Expected: exit 1. The problems are R1 to R4 for every record and R7 for every tracked file outside the exempt list, because no page and no map exist yet. There are no R5, R6 or R8 problems.

- [ ] **Step 6: Commit.** Run `git add system/tools/docs_index.mjs system/tools/test/docs_index.test.mjs` and commit with the message `feat(sgs): docs_index, the coverage rules for the subsystem index`.

---

### Task 2: The records the drift needs (D-24, D126 to D129)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md`:
  - the Index table gets a row after D-23;
  - a superseded note goes under the `## D-22` heading;
  - a new `## D-24` section goes before `## What is now closed`.
- Modify: `docs/superpowers/specs/2026-09-15-scene-graph-studio-PRD.md`, `## 5. Non-goals`: an annotation after the paragraph.
- Modify: `DEVIATIONS.md`: append D126 to D129.

**Interfaces:**
- Produces: decision `D-24` and deviations `D126` to `D129`, which the pages of Tasks 4 to 8 cite.

- [ ] **Step 1: Read the sources.**
  - Run `git show --stat` and `git show` for each of `70fd0dc 371c2db 1c8bea2 fab7b41 695b4fd 1ee42e9 0398bc8 803bc76 428ab53`.
  - Read `.github/workflows/ci-cd.yml`, `render.yaml`, `docs/DEPLOY-GITHUB.md`, `data.drive.json`, `system/backend/scripts/data_bundles.py` and `deploy.ps1`.
  - Read the spec's F3 to F5.

- [ ] **Step 2: Write D-24.** Follow the form of D-22 and D-23: a bold "Decided" line, then **Decision.**, **Why.**, **D-22's three reasons, as they now stand.**, **Open.**
  - The heading is `## D-24 The repository stands alone, and the course is hosted`.
  - **Decided** 2026-10-08, by the author. It supersedes D-22's location, its independence clause and "Deployment of this track remains out of scope".
  - **Decision.** A standalone repository with remotes `origin` (`gitea.cillab.me/CIL-Team/scene-graph-studio`) and `github` (`github.com/yjjchen-nkust/scene-graph-studio`). The frontend is on GitHub Pages and the backend on Render; the backend serves `fixtures/data` and has no `torch`, so live inference reports unavailable.
  - **Why.** Copy the reason verbatim from spec §3: students reach the course without a local install, and setting up the deployment is itself a course exercise.
  - **D-22's three reasons, as they now stand.** Each is stated with the spec's F5 facts:
    - a private repository: the GitHub repository is public;
    - third-party content: only `fixtures/data` is served, and its media rows are YES;
    - the backend dependency: Render runs without `torch`.
  - **Open.** F5's unresolved question about the `bundle_distribute` definition, and F4.
  - Add the Index row `| D-24 | The repository stands alone, and the course is hosted | supersedes D-22 |`.
  - Under `## D-22` add `> **Superseded 2026-10-08 by D-24.** …`, in the form of D-01's note. It names what D-24 replaces, and states that the text below is left intact.
  - Annotate PRD §5 in the same form: cloud deployment of the course frontend and a fixture-only backend are in scope since D-24.

- [ ] **Step 3: Write D126 to D129** in the file's heading form `## D126 — <title>`. Each entry opens with a **Commits.** line naming its SHAs, and states what changed, from the diff. Every reason the commits do not state is written as not recorded.
  - **D126, the repository stands alone** (`1c8bea2`, `70fd0dc`). It must state:
    - CI moved from WekaExt's `.gitea/workflows/scene-graph-studio.yml` to `.github/workflows/ci-cd.yml`;
    - the runner now links the fixture with `ln -s fixtures/data ../data`, where D125 had `devdata pull --ci` and the secret `REMOTEX_READ_TOKEN`;
    - `.claude/launch.json` was added.
  - **D127, the frontend on GitHub Pages and the backend on Render** (`371c2db`, `1ee42e9`, `428ab53`). It must state:
    - the workflow's `pages-build` and `pages-deploy` jobs, which run only after `ci` and only on `main`;
    - `SGS_BASE` and `VITE_API_BASE`;
    - `SGS_CORS_ORIGINS` and `system/backend/tests/test_cors.py`;
    - `render.yaml`;
    - the L4 message;
    - the favicon.
  - **D128, data through Google Drive with `gdown`** (`fab7b41`, `695b4fd`). It must state `data.drive.json`, `data_bundles.py`, `requirements-data.txt`, `npm run data:fetch` and `data:pack`, and the change to `test_data_dir_guard.py`. It must also state how this sits beside D125's devdata link, as the code shows.
  - **D129, `deploy.ps1`** (`0398bc8`, `803bc76`). It must state what the script does, as its commit names it ("merge, push to both remotes and watch the CI/CD run"), and the wrapper fix.

- [ ] **Step 4: Verify.**
  - Run `grep -c '^## D[0-9]' ../DEVIATIONS.md`. Expected: `129`.
  - Run `grep -n '^## D-24\|^> \*\*Superseded 2026-10-08' ../docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md`. Expected: two lines.
  - Run `grep -n -- '—' ../DEVIATIONS.md | tail -n 4`. Expected: the four headings only, with no em dash in the new prose.

- [ ] **Step 5: Commit.** Commit the three files with the message `docs(sgs): D-24 and D126 to D129, the standalone repository, hosting and Drive data recorded`.

---

### Task 3: The map's ownership and the sixteen skeletons

**Files:**
- Create: `docs/subsystems/README.md`
- Create: the sixteen pages of the File Structure table

**Interfaces:**
- Consumes: `ownership()`, R6, R7 and R8 from Task 1.
- Produces:
  - The map's sections, verbatim and in this order: `# Subsystem map`, `## How to use it`, `## Path ownership`, `## Dependencies`, `## Cross-cutting rules`, `## Non-functional requirements`, `## Citation forms`, `## Maintenance rule`.
  - Pages whose §2 is complete; the other sections hold the single line `DRAFT`.

- [ ] **Step 1: Write `## Path ownership`** as the table `| Prefix | Id |` with exactly these rows. Where prefixes overlap, the longest wins.

| Id | Prefixes |
|---|---|
| S1 | `system/backend/app/eval/` `system/packages/sgg-metrics/` `system/backend/scripts/build_golden.py` `system/backend/scripts/run_golden.py` `system/tools/parity.mjs` `system/backend/tests/test_constraint.py` `system/backend/tests/test_golden.py` `system/backend/tests/test_iou.py` `system/backend/tests/test_match.py` `system/backend/tests/test_metrics.py` `system/backend/tests/test_pairing.py` `system/backend/tests/test_rle.py` |
| S2 | `system/backend/app/__init__.py` `system/backend/app/main.py` `system/backend/app/api/` `system/backend/app/schema.py` `system/backend/app/errors.py` `system/backend/app/settings.py` `system/backend/tests/test_eval_api.py` `system/backend/tests/test_health.py` `system/backend/tests/test_schema.py` `system/backend/tests/test_cors.py` |
| S3 | `system/backend/app/datasets/` `system/backend/scripts/cut_slice.py` `system/backend/scripts/bundle_slices.py` `system/backend/scripts/verify_bundle.py` `system/backend/scripts/make_placeholders.py` `system/backend/scripts/cut_mini_isg.py` `system/backend/scripts/build_mini_isg.py` `system/backend/scripts/fetch_images.py` `system/backend/scripts/make_adapter_fixture.py` `system/backend/scripts/make_psg_fixture.py` `system/backend/tests/fixtures/` `system/backend/tests/test_adapters.py` `system/backend/tests/test_psg_adapter.py` `system/backend/tests/test_slices.py` `system/backend/tests/test_mini_isg.py` |
| S4 | `system/backend/app/infer/` `system/backend/scripts/reconstruct_predictions.py` `system/backend/requirements-infer.txt` `system/backend/tests/test_reconstruct.py` `system/backend/tests/test_registry.py` `system/backend/tests/test_reltr.py` |
| S5 | `system/backend/app/vlm/` `system/backend/scripts/rekey_step2_transcripts.py` `system/backend/tests/test_indvissgg.py` `system/backend/tests/test_openai_compat.py` `system/backend/tests/test_vlm_provider.py` |
| S6 | `system/frontend/src/content/` `system/mdx.plugin.ts` `system/tools/harvest.mjs` `system/tools/kp_latex.mjs` `system/tools/gen_modules.py` `system/tools/content_lint.mjs` `system/tools/test/harvest.test.mjs` `system/tools/test/kp_latex.test.mjs` `system/tools/test/content_lint.test.mjs` |
| S7 | `system/frontend/src/pages/` `system/tools/gen_papers.py` `system/tools/test/papers.test.mjs` `system/tools/test/leaderboards.test.mjs` |
| S8 | `system/web/` `system/tools/audit.js` `system/tools/check.js` `system/tools/build_standalone.mjs` `system/tools/test/standalone.check.mjs` |
| S9 | `system/frontend/src/graph/` `system/frontend/src/components/` |
| S10 | `system/frontend/` `system/frontend/src/pages/Home.tsx` `system/frontend/src/pages/Status.tsx` `system/tools/i18n_parity.mjs` `system/tools/test/i18n_parity.test.mjs` |
| S11 | `system/frontend/src/labs/` |
| S12 | `system/frontend/src/playgrounds/` |
| S13 | `system/frontend/src/demos/` `system/backend/scripts/cut_demo_m0.py` `system/backend/scripts/build_demo_m0.py` `system/backend/scripts/record_demo_indvissgg.py` `system/backend/scripts/record_demo_traditional.py` `system/backend/tests/test_demo_indvissgg.py` `system/backend/tests/test_demo_m0.py` `system/backend/tests/test_demo_traditional.py` |
| S14 | `system/package.json` `system/package-lock.json` `system/.gitignore` `system/vitest.config.ts` `system/playwright.config.ts` `system/e2e/` `system/tools/package.json` `system/tools/perf_check.mjs` `system/tools/offline_check.mjs` `system/tools/servers.mjs` `system/tools/py.mjs` `system/tools/Resolve-Python.ps1` `system/tools/docs_index.mjs` `system/tools/test/py.test.mjs` `system/tools/test/servers.test.mjs` `system/tools/test/docs_index.test.mjs` `system/backend/scripts/check_pins.py` `system/backend/tests/__init__.py` `system/backend/tests/test_pins.py` `system/backend/pyproject.toml` `system/backend/requirements.txt` `.gitattributes` |
| S15 | `data.toml` `data.drive.json` `fetch-data.ps1` `fixtures/` `.gitignore` `system/data.dir.ts` `system/fs.plugin.ts` `system/tools/data_dir.mjs` `system/tools/fixture.mjs` `system/tools/Connect-DataDirectory.ps1` `system/backend/scripts/data_bundles.py` `system/backend/requirements-data.txt` `system/backend/tests/test_data_bundles.py` `system/backend/tests/test_data_dir_guard.py` `system/tools/test/connect_data.test.mjs` `system/tools/test/data_dir.test.mjs` `system/tools/test/fixture.test.mjs` `system/tools/test/fs_plugin.test.mjs` `system/tools/test/dev_server.test.mjs` |
| S16 | `start.ps1` `deploy.ps1` `render.yaml` `.github/` `.claude/` `system/tools/start.mjs` |

- [ ] **Step 2: Write the rest of the map.**
  - **`## How to use it`** has three sentences: find the file in the ownership table, open that page, and update its current rules in the same commit.
  - **`## Dependencies`** is the line `DRAFT` until Task 9.
  - **`## Cross-cutting rules`** gives each rule one paragraph, with its citations:
    - the P0 rule (spec §6; `2026-09-15-00-master.md`);
    - the two numbering schemes, D-xx and Dnn;
    - the single shared `data/`, which every branch reads (D111, D115, D124);
    - `rm -rf data/` with the trailing slash deletes the NAS copy (D110);
    - the LF pins (D89, D91).
  - **`## Non-functional requirements`** is `INDEX.md` §3's table with an Id column. NFR-1 is S3 and S15; NFR-2 is S6 and S9; NFR-3 and NFR-4 are S1; NFR-5 is S9 and S10; NFR-6 is S10; NFR-7 is S3; NFR-8 is S14.
  - **`## Citation forms`** is spec §5's table.
  - **`## Maintenance rule`** is spec §6's last bullet.

- [ ] **Step 3: Write the sixteen skeletons.** Each has its title, the eight headings, and §2 as a table `| Path | Role |`. The table carries one row per prefix the map assigns to the page; the role is one phrase, read from the file itself. Paths on the NAS that the page will discuss (for example `data/golden/vectors.json` for S1) get a row marked `NAS`. Every other section holds `DRAFT`.

- [ ] **Step 4: Verify.** Run `node tools/docs_index.mjs`. Expected: no R5, R6, R7 or R8 line; the R1 to R4 lines remain.

- [ ] **Step 5: Commit.** Commit with the message `docs(sgs): the subsystem map's ownership and sixteen page skeletons`.

---

### Task 4: Assign every record, and turn on the real-tree test

**Files:**
- Modify: §5 and §7 of all sixteen pages
- Modify: `system/tools/test/docs_index.test.mjs`, which gains the real-tree block

**Interfaces:**
- Consumes: `loadTree` and `RULES` from Task 1, and D-24 and D126 to D129 from Task 2.
- Produces: §7 History on every page, in this shape:

```
**Binding decisions:** D-11, D-12, D-16.

**Specs and plans:** `2026-09-27-graph-constraint-key-design.md`, `2026-09-27-graph-constraint-key.md`.

| Deviation | Effect | Role |
|---|---|---|
| D99 | the graph and semi constraints keyed on object pairs | primary |
```

The same step also writes §5's opening line, `**Records:** VERIFICATION §1, VERIFICATION §23.`

- [ ] **Step 1: Assign.**
  - **Scope:** D1 to D129, VERIFICATION §1 to §35, D-01 to D-24, and every `.md` under `docs/superpowers/specs/` and `plans/`, this plan included.
  - **Primary owner:** the subsystem whose code the record changed most, or whose rule it states.
  - **Secondary owners:** every other subsystem whose code or rule the record changed. Read each deviation's opening paragraph and grep its body for the ownership prefixes.
  - **Review sweeps:** D90, D94, D100, D102, D103, D104, D118, D120 and D122 are secondary on every page they touched.
  - **Decisions:** a D-xx that governs every subsystem goes to the map's cross-cutting rules (R4 accepts the map). These are D-02 and D-19. Every other decision goes to a page.
  - **This work:** this plan and its spec go to S14.
  - **Effect phrases:** each "Effect" cell is the deviation's own title, shortened where needed and not reworded.

- [ ] **Step 2: Write §7 and §5's records line** on every page.

- [ ] **Step 3: Add the failing real-tree block** to `docs_index.test.mjs`:

```js
describe('the real documents', () => {
  const tree = loadTree(resolve(import.meta.dirname, '../../..'));
  it.each(Object.keys(RULES))('%s holds over the repository', (rule) => {
    expect(RULES[rule](tree)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it.** Run `npx vitest run --project tools tools/test/docs_index.test.mjs`. Expected: PASS for all eight rules. Any R1 to R4 failure names a record that Step 1 missed; assign it and run again.

- [ ] **Step 5: Commit.** Commit with the message `docs(sgs): every deviation, check, decision and spec assigned to a subsystem`.

---

### The drafting procedure (Tasks 5 to 8)

Each drafting task applies these steps to each of its pages.

1. **Read the sources.** Read every source the page's §7 and §5 cite: each deviation entry in full, each VERIFICATION section, the cited spec and plan sections, the decisions, and the contracts, SRS and design sections the deviations name. Then read the code entry points of §2.
2. **§1 Purpose and boundary.** Two or three sentences, the last one stating what the subsystem is not.
3. **§3 Interfaces.** Write **Provides:** and **Consumes:**. Each consumed edge names a subsystem id and the evidence for it, an import or a file read, found by `rg` over the owned paths. An edge without evidence is not written.
4. **§4 Current rules.** Numbered statements in the present tense, each ending in at least one bracketed citation. Where a record and the code disagree, the page states neither as the rule; it writes an §8 item that cites both.
5. **§5 Verification.** After the records line, give:
   - the `npm run ci` steps that cover the subsystem, by number and name (1 harvest, 2 pytest, 3 metrics build, 4 vitest, 5 ruff, 6 parity, 7 i18n, 8 content, 9 frozen, 10 standalone, 11 frontend build);
   - the test files;
   - any of `test:e2e`, `check:offline`, `check:perf` and `check:pins` that measure it.
6. **§6 Traps.** Take every row of `INDEX.md` §6, and every `CLAUDE.md` trap, whose subject the page owns. Write each as one sentence plus its citation. A source outside this repository is named as such: the first §6 row cites `KNOWLEDGE_BASE.md` §19.2, which is WekaExt's.
7. **§8 Open items.** Each with a citation. Write `None.` only after every §7 deviation's "Left for the author" or "open" paragraph has been read.
8. **Check.** Run `node tools/docs_index.mjs`. Expected: `docs_index: 0 problems`. Then run `grep -n 'DRAFT' ../docs/subsystems/<page>`. Expected: no output.
9. **Second reader.** Dispatch a fresh subagent with the page and the instruction: "For each numbered statement of §4 and each sentence of §6, open every citation it carries. Report each statement that no citation supports, each number that differs from its source, and each consumed edge in §3 whose evidence you cannot find. Do not edit." Delete or correct every reported line. Re-run the check of item 8.

### Task 5: Group I pages (S1 to S5)

**Files:** Modify `S01` to `S05`.

**Interfaces:** Consumes Task 4's §7. Produces finished pages S1 to S5.

- [ ] **Step 1:** Apply the drafting procedure to S1. §4 must answer acceptance question 1: what keys the graph constraint, and which golden vector pins it. The sources are D99, `2026-09-27-graph-constraint-key-design.md` and VERIFICATION §23.
- [ ] **Step 2:** Apply it to S2, S3, S4 and S5. S3's §8 carries the spec's F5 unresolved question, citing D-24.
- [ ] **Step 3:** Second reader for S1 to S5; correct every report; `node tools/docs_index.mjs` gives 0 problems.
- [ ] **Step 4: Commit** with the message `docs(sgs): subsystem pages S1 to S5, the core`.

### Task 6: Group II pages (S6 to S8)

**Files:** Modify `S06` to `S08`.

- [ ] **Step 1:** Apply the drafting procedure to S6, S7 and S8. S8's §4 states D-14 and D-23 together: what the page may become, and what it may never become.
- [ ] **Step 2:** Second reader; correct; 0 problems.
- [ ] **Step 3: Commit** with the message `docs(sgs): subsystem pages S6 to S8, the content`.

### Task 7: Group III pages (S9 to S13)

**Files:** Modify `S09` to `S13`.

- [ ] **Step 1:** Apply the drafting procedure to S9. §4 must answer acceptance question 4: why a box is selected by `geometry.pickObjectAt`, and what must not be changed (D75).
- [ ] **Step 2:** Apply it to S10, S11 and S12. S12's §4 states what a playground may compute (D111) and its lint rules by number (contracts §2.4, D92 to D95).
- [ ] **Step 3:** Apply it to S13. §4 must answer acceptance question 2: which lint rules hold a `demo` step, and which tests fail when one is removed (`system/tools/test/content_lint.test.mjs`).
- [ ] **Step 4:** Second reader for S9 to S13; correct; 0 problems.
- [ ] **Step 5: Commit** with the message `docs(sgs): subsystem pages S9 to S13, the frontend`.

### Task 8: Group IV pages (S14 to S16)

**Files:** Modify `S14` to `S16`.

- [ ] **Step 1:** Apply the drafting procedure to S14. §4 includes the coverage test's eight rules as Task 1 built them.
- [ ] **Step 2:** Apply it to S15. §4 must answer acceptance question 3: where `data/` points, and what a writer does when the link is absent (D110, D125, D128).
- [ ] **Step 3:** Apply it to S16. §4 must answer acceptance question 5: what the hosted deployment serves, and why live inference reports unavailable (D-24, D127). §8 carries the spec's F4 (`start.ps1` and `..\.venv`, D121) and F5's unresolved question (D-24).
- [ ] **Step 4:** Second reader; correct; 0 problems.
- [ ] **Step 5: Commit** with the message `docs(sgs): subsystem pages S14 to S16, the platform`.

---

### Task 9: Dependencies, INDEX, HISTORY and CLAUDE.md

**Files:**
- Modify: `docs/subsystems/README.md` (`## Dependencies`)
- Create: `docs/HISTORY.md`
- Modify: `docs/INDEX.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Draw the dependency graph** in `## Dependencies`, as a text adjacency list (`S11 consumes S1, S2, S9`). Every edge copies a page's §3 consumed edge; nothing else is added.

- [ ] **Step 2: Check §6 is fully carried.** For each of the 41 rows of `INDEX.md` §6, find the page whose §6 states it. Search `docs/subsystems/` with `grep` for the row's cited deviation, or for its cited source where it names none (`data/LICENCES.md`, `LAYOUTS`, `FROZEN.md`, `KNOWLEDGE_BASE.md`, this index). Expected: every row is found on at least one page. Add any row that is missing before going on.

- [ ] **Step 3: Create `docs/HISTORY.md`.** Its first line is `# History`. Its second is the sentence `Moved verbatim from docs/INDEX.md §5 on <date>; the text below is not edited.` Then copy `INDEX.md` from its `## 5. State, 2026-09-26` heading up to, but not including, the `---` before `## 6.`. Verify with `diff --strip-trailing-cr`, since the working copies differ in line endings: write the copied range out with `sed -n` and compare it with `HISTORY.md` from line 4 on. Expected: no difference.

- [ ] **Step 4: Rewrite `INDEX.md`.**
  - Remove the "Current as of" sentence.
  - The read order becomes: `docs/subsystems/README.md`, then the page of the subsystem being changed, then the decisions and contracts that page cites.
  - §1 keeps its table, adds a `Subsystems` column taken from the pages' §7, and adds rows for:
    - this spec and plan, both **executed**;
    - `HISTORY.md` and `DEPLOY-GITHUB.md`;
    - `subsystems/README.md`, marked **live**.
  - §2 gains the D-24 row and annotates D-22 as superseded by D-24.
  - The headings `## 3.`, `## 4.`, `## 5.` and `## 6.` stay, each followed by one sentence:
    - §3: "Moved to the map's Non-functional requirements, with the subsystem that enforces each."
    - §4: "Superseded by the map's Path ownership table and each page's §2 and §4."
    - §5: "Moved verbatim to `HISTORY.md`."
    - §6: "Each trap is on the page of the subsystem it belongs to, in §6; the cross-cutting ones are on the map."

- [ ] **Step 5: Edit `CLAUDE.md`.**
  - "Read this first" names `docs/subsystems/README.md` first, then `docs/INDEX.md`. It drops the enumeration of VERIFICATION sections in favour of "§1 to §36".
  - "What this is" replaces D-22's paragraph with D-24, and gives the deviation count from `grep -c '^## D[0-9]' DEVIATIONS.md`.
  - "CI" describes `.github/workflows/ci-cd.yml` from D126 and D127, and drops "Deployment is out of scope".
  - Under "Traps", four stay verbatim, apart from the corrections D126 to D128 require:
    - the two numbering schemes;
    - generated files pinned to LF;
    - `data/` is one copy, shared by every branch;
    - never `rm -rf data/`.
  - Every other trap becomes one bullet: its rule in one sentence, then `See docs/subsystems/S<nn>-….md §6.`
  - The "data/ is a directory junction" trap becomes S15's one-liner, and D128's Drive bundles are named.
  - Verify with `grep -n 'gitea/workflows\|out of scope\|125 logged' CLAUDE.md`. Expected: no output.

- [ ] **Step 6: Verify the old citations still land.** Run `grep -rn 'INDEX §[0-9]' ../DEVIATIONS.md ../docs`. Expected: every hit names §2, §4, §5 or §6, and each of those headings exists in `INDEX.md`. Then run `node tools/docs_index.mjs`. Expected: 0 problems.

- [ ] **Step 7: Commit** with the message `docs(sgs): INDEX becomes the register and entry, HISTORY carries the changelog, CLAUDE.md routes to the map`.

---

### Task 10: Mutation run, records, the full gate, acceptance

**Files:**
- Modify: `DEVIATIONS.md` (D130)
- Modify: `docs/VERIFICATION.md` (§36)
- Modify: `docs/subsystems/S14-checks-and-instruments.md`, which cites D130 and VERIFICATION §36
- Modify: `docs/INDEX.md`, whose §1 entry for `VERIFICATION.md` gains §36

- [ ] **Step 1: The mutation run.** Write a Node script in the session scratchpad, not in the repository. For each `N` in 1 to 8, in sequence, it:
  - reads `tools/docs_index.mjs`;
  - writes it back with `function rN(tree) {` replaced by `function rN(tree) { return [];`;
  - runs `npx vitest run --project tools tools/test/docs_index.test.mjs` with `spawnSync`, and records the exit code and the failing test names;
  - restores the original in a `finally` block, before the next `N`.
  Expected: every mutant exits non-zero, 8 of 8. After the run, `git diff --quiet tools/docs_index.mjs` exits 0.

- [ ] **Step 2: Run the full gate.** Run `npm run ci`. Expected: green. Record the pytest, vitest and i18n counts as printed.

- [ ] **Step 3: Answer the five acceptance questions** of spec §10 from the map and one page each. Record, for each, the page and the §4 statement number that answers it. Do not open `DEVIATIONS.md` while answering.

- [ ] **Step 4: Write D130 and VERIFICATION §36.**
  - **D130:** heading `## D130 — the subsystem index: sixteen pages, a map, and a coverage test`. It gives the plan, the decisions of spec §3, what was added and moved, and the open items F4 and F5.
  - **§36:** heading `## 36. The subsystem index, measured <date>`. A table holds:
    - the coverage at close, each count read from the tree: deviations cited out of the total, VERIFICATION sections, specs and plans, decisions, and tracked files owned;
    - the mutation run, 8 of 8, with each rule's failing test name;
    - the `npm run ci` counts;
    - the five acceptance answers.
  - Add both citations to S14's §5 and §7, and add §36 to `INDEX.md` §1.

- [ ] **Step 5: Final check.**
  - Run `node tools/docs_index.mjs`. Expected: 0 problems.
  - Run `npx vitest run --project tools tools/test/docs_index.test.mjs`. Expected: PASS.
  - Run `grep -rn 'DRAFT' ../docs/subsystems`. Expected: no output.

- [ ] **Step 6: Commit** with the message `docs(sgs): D130 and VERIFICATION 36, the subsystem index measured`.
