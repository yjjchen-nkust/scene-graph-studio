# Subsystem index: design

**Date:** 2026-10-08. **Branch:** `docs/subsystem-index`. **Status:** approved in brainstorming, awaiting
review of this written form.

---

## 1. Purpose and readers

The track's knowledge is recorded by date. Fifteen specs and sixteen plans under `docs/superpowers/`, 125
deviations in `DEVIATIONS.md` (5,592 lines) and 35 sections of `docs/VERIFICATION.md` (2,197 lines) each
grew in the order the work happened. `docs/INDEX.md` lists the documents by date, and its §5 is a
changelog of about 440 lines. Nothing answers the question a maintainer starts from: *I am changing this
part of the system; what binds it, what built it, what checks it, and what has already gone wrong in it?*

This work adds an index above those records, organised by subsystem, so that each subsystem can be
maintained from one page. The readers are the author and future Claude sessions; `CLAUDE.md` routes both
to it.

## 2. Findings that shape the design

**F1. The chronological records are complete but unrouted.** Every spec and plan is marked executed in
`INDEX.md` §1. The current truth about any one subsystem is spread across a binding decision, a contracts
section, a design section, several deviations and several verification sections. `INDEX.md` §4 answers
sixteen lookups; §6 lists 41 traps with no subsystem attached.

**F2. The index already drifts.** Its header reads "Current as of **2026-09-28**" while its §5 runs to
2026-10-02. A date stamp is a claim nothing checks.

**F3. Nine commits after the D125 merge (`3e3090b`) are recorded in no deviation** and contradict two
records. The first is dated 2026-10-02 and the rest 2026-10-08; a tenth, `d3629f8`, adds two reference
links under `docs/ref/` and needs no record.

| Commit | Change |
|---|---|
| `70fd0dc` | launch configuration (`.claude/launch.json`) |
| `371c2db` | frontend on GitHub Pages, backend on Render, CORS (`test_cors.py`) |
| `1c8bea2` | the repository stands alone; `.github/workflows/ci-cd.yml`, `render.yaml` |
| `fab7b41`, `695b4fd` | data shared through Google Drive with `gdown`: `data.drive.json`, `system/backend/scripts/data_bundles.py` |
| `1ee42e9` | the favicon |
| `0398bc8`, `803bc76` | `deploy.ps1` |
| `428ab53` | L4 states that the hosted demo offers no live inference |

D-22 says the track "remains **not** a separate repository" (`decisions.md`, line 572) and "Deployment of
this track remains out of scope" (line 604); the PRD lists cloud deployment as a non-goal; `CLAUDE.md` repeats both and
names `.gitea/workflows/scene-graph-studio.yml`, which this repository does not contain. The remotes are
Gitea `origin` (`CIL-Team/scene-graph-studio`) and `github` (`yjjchen-nkust/scene-graph-studio`).

**F4. `start.ps1` still defaults to WekaExt's `..\.venv`** (D121). A standalone checkout has no such
directory beside it, so the script warns and falls back to `py12` on every run.

**F5. The two facts D-24 rests on were checked on 2026-10-08.**

- The GitHub repository is public, with Pages enabled (`gh api repos/yjjchen-nkust/scene-graph-studio`:
  `"visibility":"public"`, `"has_pages":true`).
- The tracked media under `fixtures/data` are 11 files of `demos/m0`, 40 of `slices/mini-isg` and 6 of
  `slices/placeholder`; `fixtures/data/LICENCES.md` gives each of the three `bundle_distribute: YES`.
  `slices/vg150-sgb` carries annotations only, under `annotations_commit: YES`. The three JPEGs under
  `system/backend/tests/fixtures/psg/` are synthetic (`make_psg_fixture.py`, `Image.new`).
- **Unresolved.** `bundle_distribute` is defined as distribution "to enrolled students for classroom use".
  A public repository and a public Render service reach a wider audience than that definition states.
  Whether the named licences (Apache-2.0, CC BY 4.0, MIT) cover it is the author's finding to record; this
  work records the question, not an answer.

## 3. Decisions taken in brainstorming

| Question | Answer |
|---|---|
| Depth of extraction | Each page states the current truth in its own words and cites the records behind every statement. The chronological records stay as the audit trail. |
| Treatment of F3 | Record first (D-24 and new deviations), then index as current truth. |
| Structure | One page per subsystem under `docs/subsystems/`, a map page, and a coverage test. |
| Decomposition | Sixteen subsystems in four groups (§4), as listed. |
| Template and map | As §5 and §6; no date stamps on pages. |
| `CLAUDE.md` traps | Cross-cutting traps stay in full; each subsystem trap shrinks to its rule and a pointer. |
| D-24 | The standalone repository is final. Reason: students reach the course without a local install, and setting up the deployment is itself a course exercise. |
| Enforcement | The coverage test of §8, accuracy pass of §9 and acceptance of §10. |

## 4. Decomposition

Sixteen subsystems in four groups. Pages are `docs/subsystems/S01-<slug>.md` to `S16-<slug>.md`; the
two-digit number is for sort order, and prose writes the id as S1 to S16.

| Id | Page | Owns (repository-root paths) | Anchors known before drafting |
|---|---|---|---|
| **I. Core** |||
| S1 | `S01-evaluation-engine.md` | `system/backend/app/eval/`, `system/packages/sgg-metrics/`, `system/backend/scripts/build_golden.py`, `run_golden.py`, `system/tools/parity.mjs` | D-11, D-12, D-16; SRS §4; D99, D105 |
| S2 | `S02-api-and-schema.md` | `system/backend/app/main.py`, `app/api/`, `schema.py`, `errors.py`, `settings.py` | contracts §1; D72, D120 |
| S3 | `S03-datasets-slices-licences.md` | `system/backend/app/datasets/`, `cut_slice.py`, `bundle_slices.py`, `verify_bundle.py`, `make_placeholders.py`, the mini-ISG scripts | D-08, D-09, D-10, D-18; D17, D45 to D48 |
| S4 | `S04-models-and-predictions.md` | `system/backend/app/infer/`, `reconstruct_predictions.py` | D-05, D-06, D-07; D41, D42 |
| S5 | `S05-vlm-pipeline.md` | `system/backend/app/vlm/`, `rekey_step2_transcripts.py` | D-17; `2026-09-16-indvissgg-reading.md`; D38, D39, D112, D114, D115 |
| **II. Content** |||
| S6 | `S06-course-content.md` | `system/frontend/src/content/`, `system/mdx.plugin.ts`, `system/tools/harvest.mjs`, `kp_latex.mjs`, `gen_modules.py`, `content_lint.mjs` (module rules) | SRS §11; D28 to D31, D76 |
| S7 | `S07-papers-and-reference-pages.md` | `system/tools/gen_papers.py`, `system/frontend/src/pages/` | D-21; D32 to D35 |
| S8 | `S08-knowledge-map-and-brief.md` | `system/web/`, `system/tools/audit.js`, `check.js`, `build_standalone.mjs` | D-13, D-14, D-23; D101 |
| **III. Frontend** |||
| S9 | `S09-graph-and-readouts.md` | `system/frontend/src/graph/`, `src/components/` | contracts §2.6; D54, D75 |
| S10 | `S10-shells-and-learner-state.md` | `src/shells/`, `src/routes.tsx`, `src/main.tsx`, `src/store/`, `src/assess/`, `src/export/`, `src/i18n/`, `system/tools/i18n_parity.mjs` | contracts §2.2 to §2.4, §2.7 |
| S11 | `S11-labs.md` | `system/frontend/src/labs/` | plans 02 to 04 |
| S12 | `S12-playgrounds.md` | `system/frontend/src/playgrounds/`, `content_lint.mjs` (playground rules) | the M0 to M5 and split specs; D88, D92 to D98, D100, D102, D106, D111 |
| S13 | `S13-demos.md` | `system/frontend/src/demos/`, the `*_demo_*` scripts, `content_lint.mjs` (demo rules) | `2026-09-29-m0-demos-design.md`; D113 to D118, D124 |
| **IV. Platform** |||
| S14 | `S14-checks-and-instruments.md` | `system/package.json`, `system/e2e/`, `vitest.config.ts`, `playwright.config.ts`, `perf_check.mjs`, `offline_check.mjs`, `servers.mjs`, `py.mjs`, `Resolve-Python.ps1`, `check_pins.py`, `.gitattributes` | D-03, D-04, D-15 |
| S15 | `S15-data-infrastructure.md` | `data.toml`, `data.drive.json`, `fetch-data.ps1`, `fixtures/`, `system/data.dir.ts`, `system/fs.plugin.ts`, `data_dir.mjs`, `fixture.mjs`, `Connect-DataDirectory.ps1`, `data_bundles.py`, `.gitignore` | D108 to D110, D123, D125 |
| S16 | `S16-repository-and-deployment.md` | `start.ps1`, `deploy.ps1`, `render.yaml`, `.github/`, `.claude/`, `system/tools/start.mjs` | D-01, D-20, D-22, D-24; `2026-09-19-relocation-design.md`; D87, D121 |

The anchors column is a starting point, not the assignment. Drafting assigns every deviation, verification
section, spec and plan (§8, R1 to R3); one file may be cited by several pages, and a review sweep such as
D120 or D122 is cited on every page it touched. `content_lint.mjs` is one file with three owners by rule
group; the ownership table (§6) assigns the file to S6, and S12 and S13 cite their rule groups. Tracked
paths the column does not name (for example `system/frontend/src/assets/`, `src/index.css`, and
`src/pages/Home.tsx` and `Status.tsx`, which are not reference pages) are assigned in drafting, under R7.

**Dependencies between subsystems** are drafted as "consumes" lists on each page and drawn on the map.
Each edge is verified by an import or file-read search during drafting; an edge without such evidence is
not drawn.

## 5. The subsystem page

Every page has these eight sections, in this order, with these headings:

1. **Purpose and boundary.** Two or three sentences: what the subsystem does, and what it is not
   (for S12, that it computes no metric).
2. **Code and data.** Table of path and role. Paths under `data/` are marked NAS.
3. **Interfaces.** What it provides and consumes, by subsystem id, with contracts sections.
4. **Current rules.** Numbered statements in the present tense. Each ends with its sources in brackets,
   for example `[D-11] [D99] [contracts §1.5]`. A statement without a source is not written.
5. **Verification.** The `npm run ci` step that covers it, the test files, any of the four checks
   outside `ci`, and the `VERIFICATION §n` sections.
6. **Traps.** One sentence each, with a citation, taken from `CLAUDE.md` and `INDEX.md` §6.
7. **History.** The specs and plans by file name; then a table of Dnn, one-line effect, and primary or
   secondary.
8. **Open items.** Each with its citation.

No page carries a "current as of" date (F2). Coverage is the test's job (§8).

**Citation forms**, fixed so that the test can parse them:

| Kind | Form | Example |
|---|---|---|
| Binding decision | `D-` and two digits | `D-22` |
| Deviation | `D` and digits, with no hyphen | `D99` |
| Verification section | the word and the sign | `VERIFICATION §23` |
| Contracts, SRS, design, PRD section | document name and sign | `contracts §1.5`, `SRS §4.3` |
| Spec or plan | the file name in backticks | `2026-09-27-graph-constraint-key-design.md` |
| Path | repository-root-relative, in backticks | `system/backend/app/eval/` |
| Knowledge point | `kp:` prefix | `kp:D1`, so it is never read as deviation D1 |

## 6. The map page

`docs/subsystems/README.md` holds:

- **How to use it.** Find the file you are changing in the ownership table; open that page.
- **Path ownership.** A table from repository-root path prefix to subsystem id; the longest matching
  prefix wins. Exempt: `docs/`, `CLAUDE.md`, `README.md`, `DEVIATIONS.md`.
- **The dependency graph** of S1 to S16, as text, from the pages' verified "consumes" lists.
- **Cross-cutting rules**, stated here and not repeated on pages: the P0 rule (no P0 feature depends on
  `torch`, CUDA, the network or an API key), the two numbering schemes, the single shared `data/` and
  its deletion hazard, and the LF pins.
- **NFR-1 to NFR-8**, each with the subsystem that enforces it (moved from `INDEX.md` §3).
- **The maintenance rule.** A change to subsystem X updates X's current rules in the same commit. A new
  deviation or verification section fails `npm run ci` until a page cites it.

## 7. Changes to existing documents

**Added.**

- **D-24** in `decisions.md`: the repository is standalone, with remotes `origin` (Gitea) and `github`;
  deployment is in scope as the frontend on GitHub Pages and the backend on Render serving
  `fixtures/data`, with no `torch`, so live inference reports unavailable. Reason as §3 records it. It
  states F5's checks and F5's unresolved question. D-22 is annotated "superseded by D-24" in place, as
  D-01 was; the PRD's cloud-deployment non-goal is annotated in place.
- **D126 onward** in `DEVIATIONS.md`, one per departure in F3, written from each commit's diff. A reason
  the commit does not state is written as not recorded.
- **`docs/subsystems/`**: the map and sixteen pages.
- **`docs/HISTORY.md`**: `INDEX.md` §5 moved verbatim, under a one-line header naming its origin.
- **`system/tools/docs_index.mjs`** and **`system/tools/test/docs_index.test.mjs`** (§8).

**Changed.**

- **`INDEX.md`** keeps its six section numbers, because `DEVIATIONS.md`, `VERIFICATION.md` and one spec
  cite "INDEX §4", "INDEX §5" and "INDEX §6". §1 stays the document register, gains a Subsystems column
  and lists this spec and its plan. §2 stays the decisions table and gains D-24. §3, §4, §5 and §6 become
  one-line pointers: to the map, to the map's ownership table, to `HISTORY.md`, and to the pages' Traps
  sections. The stale date stamp is removed.
- **`CLAUDE.md`**: "Read this first" names the map; "What this is" and "CI" state D-24; the deviation
  count is updated; the cross-cutting traps (the shared `data/` and its deletion hazard, the two
  numbering schemes, the LF pins) stay in full; every other trap becomes its one-sentence rule and the
  page that owns it.

**Unchanged.** D1 to D125, `VERIFICATION.md`, every spec and plan except the in-place annotations above,
and all code except the two new tools files.

**Recorded, not fixed.** F4 (`start.ps1` and `..\.venv`) is an open item on S16. F5's unresolved question
is an open item on S3 and S16.

## 8. Enforcement: the coverage test

`system/tools/docs_index.mjs` exports a parser and one function per rule; each function takes the
documents' text and returns its violations, so a fixture can exercise it without the real tree.
`system/tools/test/docs_index.test.mjs` runs each rule over fixtures and once over the real documents. It
runs in the tools project of vitest, step 4 of `npm run ci`, which therefore stays at eleven steps.

| Rule | Violation |
|---|---|
| R1 | A `## Dnn` heading in `DEVIATIONS.md` that no page cites |
| R2 | A `## n.` heading in `VERIFICATION.md` that no page cites |
| R3 | A `.md` file under `docs/superpowers/specs/` or `plans/` that no page cites |
| R4 | A decision `D-nn` in `decisions.md` that neither a page nor the map cites |
| R5 | A citation that resolves to nothing: a Dnn, D-nn, `VERIFICATION §n`, spec or plan, or a `contracts`, `SRS`, `design` or `PRD` section number absent from that document |
| R6 | A backticked repository path that does not exist; paths under `data/` are exempt |
| R7 | A tracked file (`git ls-files`) outside the exempt list that matches no ownership prefix; a prefix that matches no tracked file; an empty or root prefix |
| R8 | A page missing one of the eight headings of §5, or giving them out of order |

**Mutation obligation.** Each rule has a fixture case that passes with the rule and fails with it
disabled. Disabling each rule in turn, as `VERIFICATION.md` §16 did for the lint, must catch 8 of 8; the
result is recorded as a new `VERIFICATION.md` section.

## 9. Accuracy obligation

Each page is drafted from its cited sources, read in full for the parts cited. A second pass, by a reader
other than the drafter, checks each current rule against each of its citations and deletes any statement
a citation does not support. Numbers are copied, never recomputed or rounded. Where two sources disagree,
the later binding record wins and the page says which.

## 10. Acceptance

1. `npm run ci` is green on the branch.
2. The mutation run of §8 catches 8 of 8, recorded in `VERIFICATION.md`.
3. Five maintenance questions are answered from the map and one page, without opening `DEVIATIONS.md`:
   - What keys the graph constraint, and which golden vector pins it? (S1)
   - Which lint rules hold a `demo` step, and which tests fail when one is removed? (S13)
   - Where does `data/` point, and what does a writer do when the link is absent? (S15)
   - Why is a box selected by `geometry.pickObjectAt`, and what must not be changed? (S9)
   - What does the hosted deployment serve, and why does live inference report unavailable? (S16)
4. `INDEX.md` §4, §5 and §6 citations in the existing records still resolve to a pointer.

## 11. Out of scope

Rewriting or splitting `DEVIATIONS.md` or `VERIFICATION.md`; renumbering any record; changing
`start.ps1` (F4); deciding F5's licence question; any change to product code or content.

## 12. Risks

| Risk | Mitigation |
|---|---|
| A page restates a rule wrongly, and is then trusted over the source | Every statement cites; §9's second reader; numbers copied |
| Pages go stale as new work lands | R1 and R2 block an uncited new record; the maintenance rule in the map and `CLAUDE.md` |
| R7 is noisy on every new file | Prefixes are directories, so a new file inside an owned directory passes |
| The deviation regex reads a knowledge point or a demo name as a deviation | `kp:` prefix for knowledge points; D-T and D-V carry no digits |
