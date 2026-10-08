# S6 Course content

## 1. Purpose and boundary

S6 is the course text: fifteen bilingual MDX modules, the build-time pipeline that compiles and typesets them, the registry that turns each module into a step sequence, the harvest that carries the knowledge map's knowledge points, formulas and derivations into `data/content/`, and the content lint that holds the corpus to its schema. It also hosts the lint's other sections, whose rules belong to S1, S3, S12 and S13. It is not the shells that present the steps (S10), not the playgrounds and demonstrations a step mounts (S12, S13), and not the knowledge-map page the harvest reads (S8).

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/content/` | The 15 modules as bilingual MDX |
| `system/mdx.plugin.ts` | Vite plugin that compiles the MDX modules |
| `system/tools/harvest.mjs` | Harvests the knowledge map into the seed corpus |
| `system/tools/kp_latex.mjs` | Converts harvested LaTeX to the delimiters MDX reads |
| `system/tools/gen_modules.py` | Driverless scaffold kept as a record of how the modules were shaped; writes nothing (D79) |
| `system/tools/content_lint.mjs` | Content lint: golden vectors, licence gates and the module rules |
| `system/tools/test/harvest.test.mjs` | Tests of the harvest |
| `system/tools/test/kp_latex.test.mjs` | Tests of the LaTeX delimiter conversion |
| `system/tools/test/content_lint.test.mjs` | Tests of the playground and demo lint rules and three module rules, run over fixture corpora |
| `data/content/` | Harvested corpus and golden playground cases (NAS) |

## 3. Interfaces

**Provides:**

- `getModule(id, locale)`, `getMeta(id, locale)`, `moduleIds()` and the `ModuleStep` type, in `system/frontend/src/content/registry.tsx`. S10 imports them (`frontend/src/routes.tsx`, `pages/Home.tsx`, `shells/lecture/LectureShell.tsx`, `shells/lecture/PresenterWindow.tsx`, `shells/study/StudyShell.tsx`), and S7 imports `getMeta` (`pages/knowledge.ts`, `pages/KnowledgeIndex.tsx`).
- `mdxPlugin()` in `system/mdx.plugin.ts`, imported by S10's `frontend/vite.config.ts` and S14's `vitest.config.ts`.
- The harvested corpus `data/content/kp.json`, `math.json` and `deriv.json`, and the assignment `data/content/assignment.json`; S7's `pages/knowledge.ts` imports `kp.json` and `assignment.json`.
- `npm run harvest` and `npm run lint:content`, steps 1 and 8 of `npm run ci`, declared in S14's `system/package.json`.

**Consumes:**

- S8 (`harvest.mjs` reads `web/knowledge-map/kp-data.js` and `pg.js`; `registry.test.tsx` reads `pg.js`, `index.html` and `FROZEN.md` of the map and `web/brief/index.html`).
- S10 (`registry.tsx` imports the type `Locale` from `i18n/useLocale`; `math/Parts.tsx` imports `useLocale`).
- S12 (`registry.tsx` imports `Playground`; `content_lint.mjs` reads `frontend/src/playgrounds/mounts.tsx`; `registry.test.tsx` imports `PLAYGROUND_MOUNTS` and `PLAYGROUND_PARTS`).
- S13 (`registry.tsx` imports `Demo`; `content_lint.mjs` reads `frontend/src/demos/mounts.tsx` and each artefact `DEMO_ARTEFACTS` names under `data/demos/`; `registry.test.tsx` imports `demos/data` and `demos/logic`).
- S7 (`content_lint.mjs` reads the `key` of every card in `data/content/papers.json`).
- S1 (`content_lint.mjs` reads `data/golden/vectors.json`).
- S3 (`content_lint.mjs` reads `data/LICENCES.md` and `data/slices/`).
- S15 (`harvest.mjs` imports `DATA_DIR` and `requireDataDir` from `system/tools/data_dir.mjs`; `content_lint.mjs`, `kp_latex.mjs` and the tests read `data/` through the link, whose CI copy is `fixtures/data`).

## 4. Current rules

1. The course is fifteen modules, `m00` to `m14`, each two files under `system/frontend/src/content/`, `mNN.zh-TW.mdx` and `mNN.en.mdx`, and the content lint refuses a module present in one locale only. [contracts §2.5] [PRD §7] [`system/tools/content_lint.mjs`]
2. A module's frontmatter carries `id`, `order`, `title_en`, `title_zh`, `anchor_labs`, `knowledge_points`, `symbols`, `claims` and `steps`, and the lint refuses a frontmatter `id` that differs from the file name. [contracts §3.1] [`system/tools/content_lint.mjs`]
3. The lint reads the frontmatter with its own reader, which must be stricter than the YAML parser that compiles it: it refuses an escape that a double-quoted YAML scalar refuses, so a LaTeX symbol is written with its backslashes doubled. [D31] [`system/tools/content_lint.mjs`]
4. One plugin, `system/mdx.plugin.ts`, compiles the modules for the build and for vitest alike: `@mdx-js/rollup` with `remark-frontmatter`, `remark-mdx-frontmatter` exporting the frontmatter as `meta`, `remark-math` and `rehype-katex`. [D28] [contracts §2.5] [`system/mdx.plugin.ts`]
5. KaTeX typesets the mathematics at build time, and its stylesheet and fonts are bundled from npm, so a module fetches nothing at run time. [contracts §2.5] [`system/mdx.plugin.ts`] [`system/frontend/src/main.tsx`]
6. The frontend depends on `remark-mdx-frontmatter` `^6.0.0`, whose 6.0.0 parses TOML with `smol-toml`; the corpus carries YAML frontmatter only, and the bundle was byte-identical across the change from 5.2.0. [D119]
7. MDX compiles a module to one component, so the body marks each step with `<Step id="…">`, the ids are declared once in the frontmatter, and each step's node renders the whole body with a `Step` that admits only its own id. D28 records this departure from contracts §2.4's sentence that the compiler emits `ModuleStep[]`. [D28] [contracts §2.4] [`system/frontend/src/content/registry.tsx`]
8. The registry finds the modules with an eager `import.meta.glob`, with no hand-kept list, and builds each module's steps once per module and locale, so a re-render keeps every step mounted. [D72] [D120] [`system/frontend/src/content/registry.tsx`]
9. Both shells read `getModule`, so the study shell and the lecture shell render one content base. [D53] [contracts §2.4]
10. `Step`, `Playground` and `Demo` reach a module through the MDX `components` prop, and no module imports them; a module with a `math` step imports `Intuition`, `Formal`, `Worked` and `Implications` from `./math/Parts`. [contracts §2.4] [`2026-09-19-playgrounds-design.md`] [`system/frontend/src/content/registry.tsx`]
11. A step's kind is `prose`, `math`, `figure`, `lab`, `checkpoint`, `playground` or `demo`, and no module uses `figure`. The corpus holds 129 steps a locale. [contracts §2.4] [D117] [`system/frontend/src/content/`]
12. Both locales of a module declare the same number of steps with the same ids in the same order, since the shells index both locales by position, and a module declares each step id once. [contracts §2.5] [D120] [`system/tools/content_lint.mjs`]
13. Every step carries presenter notes in its own file's locale: a `zh-TW` file declares only `presenter_notes_zh` and an `en` file only `presenter_notes_en`, a note is never empty, the two locales carry notes on the same steps, and the lint refuses a step with none. [D57] [D76] [contracts §2.4]
14. The corpus carries 258 presenter notes, one per step in each locale. A note is procedural and introduces no claim the module does not already make. [D76] [D117]
15. A math step is written in the four parts of SRS §11.2, `<Intuition>`, `<Formal>`, `<Worked>` and `<Implications>`, in that order, the components of `system/frontend/src/content/math/Parts.tsx`; §8 records how far the lint enforces it. [contracts §3.1] [SRS §11.2] [D28]
16. A formula a module takes from the knowledge map is copied verbatim, `kp_latex.mjs` changing only the delimiters `\[ … \]` to `$$ … $$`, and a correction made in a module is carried back by rebuilding the map's entry from the corrected MDX and running the harvest. [`system/tools/kp_latex.mjs`] [D98] [D106] [D111]
17. `gen_modules.py` has no driver and writes nothing, and `npm run ci` does not invoke it; the MDX files are the source of truth. [D79] [`system/tools/gen_modules.py`]
18. Every claim in a module's frontmatter carries `source`, `source_table`, `constraint`, `protocol` and `verified`, and its `source` is the `key` of a card in `papers.json`. A claim may carry `verified: false`. [contracts §3.1] [D33] [D106] [`system/tools/content_lint.mjs`]
19. A claim read from IndVisSGG carries `unstated` for its protocol and its constraint, since the paper names neither. [D34] [`system/frontend/src/content/m11.en.mdx`]
20. Symbols are global: the lint refuses a `sym` glossed two ways anywhere in the corpus, and a module that quotes a paper spending a letter differently states the local meaning in prose at the point of use, while the symbol table keeps the course-wide gloss. The corpus holds 50 symbols. [contracts §3.1] [D30] [D111]
21. Which module teaches a knowledge point is `data/content/assignment.json`, not a `module` field of `kp.json`, which the harvest rewrites; D29 records the departure from contracts §3.4. Each of the 93 points is assigned to exactly one of the fifteen modules, and the lint refuses a point assigned twice and an assigned point absent from `kp.json`. [D29] [contracts §3.4] [VERIFICATION §9] [`system/tools/content_lint.mjs`]
22. A module's `knowledge_points` lists every point assigned to it and may list points it draws on, so the frontmatter does not name a point's owner; every listed point is in `kp.json`. [D101] [`system/tools/content_lint.mjs`]
23. The lint reads a body as MDX compiles it: `{/* … */}` comments are removed before every body rule, an HTML comment, which MDX 3 does not compile, is refused, and a tag is read in any attribute order or quote, over several lines, with a literal in braces. [D122] [VERIFICATION §32]
24. The content lint also holds the structure of the golden vectors (S1), the licence gates (S3), twelve playground rules over the steps, `playground_golden.json` and `vg150_splits.json` (S12), and five demo rules (S13); the comparison of a playground or demo step's component and part across the two locales belongs with them. [contracts §2.4] [`system/tools/content_lint.mjs`]
25. The harvest reads `CLUSTERS` from `kp-data.js` and `MATH` and `DERIV` from `pg.js` as text, evaluates those three declarations alone in a `node:vm` context with no globals, and writes `kp.json`, `math.json` and `deriv.json` under `data/content/`; `pg.js evaluate()` is not harvested. [D-13] [D-14] [`system/tools/harvest.mjs`]
26. The harvest refuses to write unless it reads 93 knowledge points in 12 clusters, 27 of them live, with every formula and derivation keyed to a point, and it writes only through the `data/` link, or `SGS_DATA_DIR`, stopping when that is absent. [D125] [`system/tools/harvest.mjs`]
27. The harvest gives 26 formulas and 23 derivations, which `harvest.test.mjs` asserts, and each point's record carries its own formula and derivation. [D98] [D106] [D111] [`system/tools/test/harvest.test.mjs`]
28. `npm run harvest` is step 1 of `npm run ci`, so every gate run rewrites the three files from the page. [D29] [`system/package.json`]
29. The frontend imports `data/content/` at build time; no `/api/content` route exists or is to be built, and contracts §1.10 is superseded. [D72] [contracts §1.10]
30. Chinese text is formal written Chinese: titles are noun phrases, no sentence addresses the reader in the second person, technical terms stay in English inside Chinese prose, and the punctuation is Chinese. [`2026-09-15-02-graph-labs-and-content.md`] [PRD §6.1]
31. M11 is transcribed from `2026-09-16-indvissgg-reading.md`, a primary-source reading of the anchor paper with every figure quoted against its named table. [`2026-09-15-02-graph-labs-and-content.md`] [`2026-09-16-indvissgg-reading.md`]
32. The course teaches the recall ordering of SGDet, SGCls and PredCls as observed in published tables, and only the inclusion of their hypothesis spaces as forced, with its condition. [D98] [VERIFICATION §22]
33. M4 teaches R@k ≤ ngR@k only once k covers the unconstrained pool, since the constraint filters the ranking before the cut is taken; at a smaller k either side can be larger. [D106] [`system/web/knowledge-map/FROZEN.md`]
34. A module's statements about the engine, the slices, the map and the recordings are held by tests in `registry.test.tsx` that read what they describe: M2's strict √2 boundary, M3's inclusion and verdict table, `semi` described as a cap per object pair, M4's and M5's corrections against the harvested formulas and the map, and M0's demonstration prose against the recordings. [D97] [D98] [D99] [D106] [D111] [D124]
35. The test in `registry.test.tsx` that typesets every math step carries a 60-second budget, and its two M4 tests that ran past vitest's 5,000 ms default under contention carry 20,000 ms. [D43] [D111]
36. The records tests of `registry.test.tsx` read each fact where the subsystem index put it: `INDEX.md`'s former §5 in `docs/HISTORY.md`, its NFR table on the map, its count of golden vectors and the facts of `CLAUDE.md`'s former traps on the subsystem pages, and `CLAUDE.md`'s counts in their present form, `N deviations, D1 to DN` and `§1 to §N`. `docs/HISTORY.md` states that its text is not edited, so its figures are held as written, and each live figure is held equal to the code on its live home. [D130] [`system/frontend/src/content/test/registry.test.tsx`]
37. The D110 records test of `registry.test.tsx` holds `data/` to the three forms S15 states, a link or a directory, so the gate passes where `npm run data:fetch` filled `data/` from Google Drive. [D110] [D131] [`system/frontend/src/content/test/registry.test.tsx`]

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §16, VERIFICATION §17, VERIFICATION §32.

**`npm run ci` steps:** 1 harvest, `system/tools/harvest.mjs`; 4 vitest, the `tools` project (`system/tools/test/harvest.test.mjs`, `kp_latex.test.mjs`, `content_lint.test.mjs`) and the `frontend` project (`system/frontend/src/content/test/registry.test.tsx`); 5 ruff, over `backend` and `tools`, `gen_modules.py` among them; 8 content, `system/tools/content_lint.mjs`; 11 frontend build, which compiles every module through `system/mdx.plugin.ts`.

**Outside `ci`:** `npm run test:e2e` (check 8) walks M0 to M14 forward on the keyboard at 24 px base type (`system/e2e/lecture.spec.ts`); its projector suite requires, at three panel sizes, that no display formula of M2 to M6 and M11 runs past the panel and that the slides it lists, from M0 to M5, hold the 18 px floor (`system/e2e/projector.spec.ts`). `npm run check:offline` (check 6) opens all fifteen modules and walks M0 to M14 with the network intercepted, and opens M4's mathematics with no font or script fetched (`system/e2e/offline.spec.ts`).

**What the records measure.** §9 is the content lint over 15 of 15 modules in both locales, 93 points assigned and 43 symbols, on 2026-09-18. §16 is the lint suite by mutation, over the playground section only, and says the older sections were not mutated. §17 is M1's gate, with the content lint over 22 playground cases and 25 release figures and 23 mutants of the twelve playground rules. §32 includes the lint reading tags as MDX compiles them and refusing an HTML comment.

## 6. Traps

- Presenter notes are mandatory: the lint refuses a step without them in either locale, so a new step or module is written with its notes; all 129 steps carry theirs, 258 notes. [D76] [`CLAUDE.md`]
- `kp.json` is harvest output that step 1 of the gate rewrites wholesale, so an editorial field written into it is erased by the next run, after the lint has already passed on it. [D29]
- A hand-written frontmatter reader is defensible only while it is stricter than the real parser; more permissive, it reports clean on a module that cannot compile, as a lone `\o` did. [D31]
- Two MDX pipelines would let a formula typeset under vitest and arrive as dollar signs on the projector, which is why one plugin serves both. [D28]
- KaTeX keeps a formula's TeX in a MathML `<annotation>`, so a test that the rendered text lacks the TeX asserts the reverse of typesetting. [D28]
- Content between one step's `</Step>` and the next step's opening tag has no filter over it and renders on every slide of the module. [D91] [`system/tools/content_lint.mjs`]
- A lint rule watched failing by hand and then only described in prose leaves nothing that notices its deletion. [D91]
- A test suite is an instrument too: a fixture with one module and one frontmatter cannot express a cross-module or cross-locale defect, so those rules could be deleted with the suite green until each was disabled in turn. [D92] [VERIFICATION §16]
- A lint that reads `id` where the schema names `key` reports every claim as citing a paper that does not exist. [D33]
- A regularity quoted as forced is checked by asking what the argument proves: an inclusion of what each protocol allows bounds no model's recall. [D98] [VERIFICATION §22]
- Two pools that nest do not make their top k nest: each cut is taken from its own pool, so at a fixed k either recall can be the larger. [D106] [`system/web/knowledge-map/FROZEN.md`]
- Inserting steps renumbers every later step: a citation of a step by id elsewhere in the corpus goes stale, and a quiz schedule stored under an old step key is orphaned. [D106] [D117]
- An HTML comment fails the MDX 3 build, and a tag inside `{/* … */}` mounts nothing. [D122]

## 7. History

**Binding decisions:** D-13.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-scene-graph-studio-PRD.md`, `2026-09-15-scene-graph-studio-contracts.md`, `2026-09-16-indvissgg-reading.md`, `2026-09-19-playgrounds-design.md`.

| Deviation | Effect | Role |
|---|---|---|
| D28 | MDX compiles a module to one component, not to a step sequence | primary |
| D29 | Task 8 Step 1 writes the syllabus into a file the build regenerates | primary |
| D30 | global notation cannot survive quoting three papers verbatim | primary |
| D31 | the lint read the frontmatter more leniently than the build does | primary |
| D33 | three smaller corrections to Task 9 | secondary |
| D34 | eighty-two numbers carried a protocol their source never states | secondary |
| D43 | three of plan 04 Task 1's four assertions could not hold as written | secondary |
| D53 | the study shell the plan names and no task creates, and what `App` became | secondary |
| D56 | presenter notes are declared in three places and carried in none | primary |
| D57 | presenter notes: one locale per file, and the lint that holds them parallel | primary |
| D72 | `/api/content/*` is normative, absent, and should stay absent | secondary |
| D73 | the audit, reduced to what actually cannot be fixed | secondary |
| D76 | presenter notes existed for one module in fifteen | primary |
| D79 | `ruff` was in the gate for half the Python in the repository | secondary |
| D88 | the three M0 playgrounds, and the four things building them decided | secondary |
| D89 | the gate left the tree dirty on every green run | secondary |
| D90 | the eight minor findings the review deferred | secondary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D92 | the suite written to guard the lint rules missed eight of seventeen breaks | primary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | secondary |
| D94 | the final review's deferred findings, resolved | secondary |
| D95 | the review of the day's merges: F6's status under its clip, and what surrounded it | secondary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | secondary |
| D97 | M2's playground, F3, and three statements about IoU the sources contradict | secondary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D101 | the map indexes the knowledge points, and the knowledge-map freeze is released (D-23) | secondary |
| D102 | the five minors D100's review deferred, settled | secondary |
| D103 | the checks D102 left open: every golden vector's warnings, and the locales' placeholders | secondary |
| D104 | the review of the open checks: two warnings no vector raised, and five minors | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | secondary |
| D111 | M5's playgrounds, T1 and T2 | secondary |
| D117 | M0's lab and checkpoint moved to s16 and s17, and what the demos' steps leave unrecorded | secondary |
| D118 | two minors the M0 demos' final review left open | secondary |
| D119 | `remark-mdx-frontmatter` 6.0.0, which clears the last runtime-dependency advisory | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D124 | D-V names each hand, and is recorded again on the A6000 | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |
| D130 | the subsystem index: sixteen pages, a map, and a coverage test; the records tests follow the moved text | secondary |
| D131 | the gate accepts a `data/` filled from Google Drive | secondary |

## 8. Open items

1. Contracts §3.1 says the lint fails a `math` step missing any of the four parts. The lint checks the module's body once, by the first occurrence of each part, so a second math step missing a part passes while the first carries all four; every math step of the corpus carries all four today. [contracts §3.1] [`system/tools/content_lint.mjs`]
2. Contracts §2.5 places the check that both locales declare the same steps in the build. The frontend build compares nothing; the check is the content lint's, and `registry.test.tsx` repeats it. [contracts §2.5] [`system/tools/content_lint.mjs`] [`system/frontend/src/content/test/registry.test.tsx`]
3. D-13 and plan 02 Task 1 give `pg.js` 28 formulas and 22 derivations; the harvest gives 26 and 23, and `harvest.test.mjs` asserts them. No record reconciles the two counts. [D-13] [`2026-09-15-02-graph-labs-and-content.md`] [`system/tools/test/harvest.test.mjs`]
4. The comments of `harvest.mjs` and `harvest.test.mjs` say that `check.js` asserts the harvest's counts against the page. `check.js` prints the counts and asserts none of them; the harvest itself refuses a count other than 93, 12 and 27. [`system/tools/harvest.mjs`] [`system/tools/check.js`]
5. `content_lint.test.mjs` exercises the playground and demo rules and, of the module rules, only the repeated step id, the HTML comment and a commented-out contract part. VERIFICATION §16 records that the older sections, the golden vectors, the licence gates, the four-part contract and the presenter notes, were not mutated, and no later record measures them or the locale, claim, symbol, escape and assignment rules. [VERIFICATION §16] [`system/tools/test/content_lint.test.mjs`]
6. With `SGS_DATA_DIR` set, the harvest writes under it, while `content_lint.mjs`, `kp_latex.mjs` and the tools tests read `../data`. D125 moved the harvest alone; no record says whether the readers follow. [D125] [`system/tools/harvest.mjs`] [`system/tools/content_lint.mjs`]
7. A tag quoted in inline code or a fenced block is still counted by the lint; the corpus has none. Left open by D122. [D122] [`system/tools/content_lint.mjs`]
8. M4's symbol table glosses `m` as predicates per ordered pair, the letter s13's Formal and Worked lines use for a mask, and s12's prior π_p shares its letter with the symbol table's pair map π. Found and left open by D106. [D106]
9. Contracts §3.4 says the lint reports how many points remain unassigned and does not fail on them. The lint fails on an unassigned point; D29 records the assignment's move to `assignment.json` and not this change. [contracts §3.4] [D29] [`system/tools/content_lint.mjs`]
