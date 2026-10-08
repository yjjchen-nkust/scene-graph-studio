# S6 Course content

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/content/` | The 15 modules as bilingual MDX |
| `system/mdx.plugin.ts` | Vite plugin that compiles the MDX modules |
| `system/tools/harvest.mjs` | Harvests the knowledge map into the seed corpus |
| `system/tools/kp_latex.mjs` | Converts harvested LaTeX to the delimiters MDX reads |
| `system/tools/gen_modules.py` | Emits the remaining module files |
| `system/tools/content_lint.mjs` | Content lint: golden vectors, licence gates and the module rules |
| `system/tools/test/harvest.test.mjs` | Tests of the harvest |
| `system/tools/test/kp_latex.test.mjs` | Tests of the LaTeX delimiter conversion |
| `system/tools/test/content_lint.test.mjs` | Tests that each lint rule fails when disabled |
| `data/content/` | Harvested corpus and golden playground cases (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §16, VERIFICATION §17.

DRAFT

## 6. Traps

DRAFT

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

## 8. Open items

DRAFT
