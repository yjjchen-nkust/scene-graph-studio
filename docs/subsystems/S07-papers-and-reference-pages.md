# S7 Papers and reference pages

## 1. Purpose and boundary

S7 is the course's reference pages: the field map at `/map`, which lays the paper cards out by branch and, as a second view, indexes the knowledge points by the module that teaches them, and the frozen per-paper leaderboards at `/leaderboards`. It owns the paper corpus `papers.json` and its view `leaderboards.json`, in which every published figure names the table it was read from and nothing is ranked. It is not the component that renders a figure (S9's `MetricReadout`), not the modules or the knowledge points themselves (S6), and not the evaluation engine (S1): no figure on these pages is computed.

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/pages/` | Reference pages: field map, knowledge index, paper cards, leaderboards |
| `system/tools/gen_papers.py` | Authors the paper corpus |
| `system/tools/test/papers.test.mjs` | Tests of the paper corpus |
| `system/tools/test/leaderboards.test.mjs` | Tests of the leaderboards |
| `data/content/papers.json` | The paper corpus (NAS) |

## 3. Interfaces

**Provides:**

- `FieldMap` (`/map`, with `KnowledgeIndex` as its `?view=kp`) and `Leaderboards` (`/leaderboards`), in `system/frontend/src/pages/`, which S10's `frontend/src/routes.tsx` imports and mounts.
- `PAPERS`, `byKey` and the card types in `pages/papers.ts`, `BOARDS` in `pages/boards.ts`, and `PaperCard`; S9's test `components/test/MetricReadout.test.tsx` imports `PAPERS`, `BOARDS`, `PaperCard` and `Leaderboards`.
- The paper corpus `data/content/papers.json`, whose card keys S6's `content_lint.mjs` reads to resolve every module claim's `source`.

**Consumes:**

- S1 (`pages/papers.ts` and `pages/boards.ts` import the types `ReportedProtocol` and `ReportedConstraint` from `sgg-metrics`).
- S6 (`pages/knowledge.ts` and `pages/KnowledgeIndex.tsx` import `getMeta` from `content/registry`; `knowledge.ts` imports `data/content/kp.json` and `assignment.json`).
- S9 (`pages/Leaderboards.tsx` and `pages/PaperCard.tsx` import `MetricReadout`).
- S10 (every page imports `useLocale` from `i18n/useLocale`).
- S11 (`pages/FieldMap.tsx` and `pages/KnowledgeIndex.tsx` import `useLabParams` from `labs/useLabParams`).
- S12 (`pages/test/KnowledgeIndex.test.tsx` imports `PLAYGROUND_IDS` from `playgrounds/mounts`, in a test only).
- S15 (`pages/papers.ts` and `pages/boards.ts` import `papers.json` and `leaderboards.json` through the `data/` link, and `papers.test.mjs` and `leaderboards.test.mjs` read them from `../data/content/`; the CI copy is `fixtures/data`).

## 4. Current rules

1. The field map at `/map` shows the cards in nine columns, one per branch in curriculum order, and draws a card's predecessor only when both cards survive the filter. Its filters, by branch, year range, dataset and whether a card carries figures, and the card it has opened, live in the URL. [contracts §2.2] [`system/frontend/src/pages/FieldMap.tsx`]
2. `/map?view=kp` is a second view of the same route: the 93 knowledge points under the twelve clusters of `kp.json`, with a cluster filter and a search over the id and both titles, each in the URL. The papers stay the default view, and the paper filters survive a round trip through the other view. [D101] [contracts §2.2]
3. Every knowledge point links to the module that owns it, read from `assignment.json` and not from the modules' `knowledge_points`, and a point with a playground also links to the lecture step that mounts it, the first part when the playground is split. [D101] [`system/frontend/src/pages/knowledge.ts`]
4. A typed field over a value in the URL keeps its own text while it has focus and writes the URL beside it, writing nothing while an input method composes; an emptied year field means no bound. [D122] [`system/frontend/src/pages/useFieldDraft.ts`]
5. The paper corpus, `data/content/papers.json`, holds 60 cards, where D-21 and PRD §6.3 give 35. The author closed the count at 60 on 2026-09-26, and why the method cards number 56 is not recorded. [D-21] [D92] [PRD §6.3]
6. The cards sit on nine branches, the eight method lineages and `foundations`, which holds the four dataset cards, Visual Genome, GQA, Haystack and IndoorVG. D33 records this departure from the eight branches of contracts §3.2. [D33] [contracts §3.2] [`system/frontend/src/pages/papers.ts`]
7. Every card's key has the form method-year, and every card carries a DOI or an arXiv identifier, a branch, a year, a venue and its core idea in both languages; `title` and `authors`, which contracts §3.2 names, are absent rather than guessed. [D33] [`system/tools/test/papers.test.mjs`]
8. A card that names a predecessor states in both languages the defect it fixes, every predecessor is a card, and no chain of predecessors cycles. [PRD §6.3] [`system/tools/test/papers.test.mjs`]
9. Every method the curriculum names has a card, and so does every source a module claim cites. [D32] [PRD §7] [`system/tools/test/papers.test.mjs`]
10. A figure is carried only if it was read off the table named beside it. There is no unverified tier: every reported figure is `verified: true` and names its `source_table`, which D-21 decided over the unverified style of contracts §3.2. [D-21] [contracts §3.2] [`system/tools/test/papers.test.mjs`]
11. A card is tier A exactly when it carries reported figures, so a tier follows from what has been read rather than from a list written in advance; ten cards are tier A, and they carry 87 figures. [D32] [VERIFICATION §9]
12. Every figure names, as `source`, the card of the paper whose table it was read from, and a figure printed in another paper's table carries a note in both languages saying whose measurement it is. [D32] [D34] [`system/tools/test/papers.test.mjs`]
13. A figure's protocol and constraint come from a closed set that widens the engine's by one value, `unstated`, and every figure read from IndVisSGG is `unstated` on both, with a note in both languages quoting the paper's §5.1.3; the engine's `Protocol` and `Constraint` are unchanged. [D34] [`system/tools/test/papers.test.mjs`]
14. Every figure carries a `backbone`, a name or `null`, which is what separates IndVisSGG's two ISG rows, on GPT-4V and on Gemini-Pro-Vision; the Gemini-Pro-Vision card is tier B, with a caveat saying where its figures went. [D34] [`system/tools/test/papers.test.mjs`]
15. The leaderboards at `/leaderboards` are one board per source, source table and dataset: five boards over 19 rows and 87 figures. D35 records this departure from contracts §3.3, whose key of dataset, protocol and constraint would put Tang et al.'s 16.0 and KERN's 15.8 for FREQ in one column. [D35] [contracts §3.3]
16. `leaderboards.json` is a view of `papers.json`: each figure on a board equals a card's reported figure on dataset, metric, k, value, protocol, constraint, source, source table and backbone, and a figure on no card fails the gate. [D35] [`system/tools/test/leaderboards.test.mjs`]
17. Every row carries `detector_backbone`, `codebase` and `epoch_budget`, each a value or `null`, and the page renders `null` as "not stated by the source" rather than a blank cell; D35 records this departure from the `string` of contracts §3.3. [D35] [contracts §3.3] [PRD §6.4]
18. Each board's non-comparability banner names the backbone, the codebase and the epoch budget, stands above its table and has no control that folds it away, and each board carries the dated notice that Papers With Code was sunset on 24 July 2025. [PRD §6.4] [D35] [`system/frontend/src/pages/Leaderboards.tsx`]
19. Boards are never merged, sorted or ranked: rows keep the order their source table prints, no control sorts a table, and no exported function takes two boards. [PRD §6.4] [contracts §3.3] [`system/tools/test/leaderboards.test.mjs`]
20. Every figure on a card or a board is rendered through S9's `MetricReadout` as a `published` value tagged with its metric, k, protocol, constraint and source table, and prints every decimal place it carries. [D122] [`system/frontend/src/pages/PaperCard.tsx`] [`system/frontend/src/pages/Leaderboards.tsx`]
21. A card's reported figures are labelled not comparable and are listed, not ranked. [`system/frontend/src/pages/PaperCard.tsx`] [`system/frontend/src/pages/test/FieldMap.test.tsx`]
22. The pages import `papers.json` and `leaderboards.json` at build time, so the corpus is in the bundle and renders with the backend stopped; no `/api/content` route exists or is to be built. [D72] [contracts §1.10]
23. `gen_papers.py` has no driver and writes nothing, and `npm run ci` does not invoke it; `papers.json` is the source of truth. [D79] [`system/tools/gen_papers.py`]

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §10, VERIFICATION §32.

**`npm run ci` steps:** 4 vitest, the `tools` project (`system/tools/test/papers.test.mjs`, `leaderboards.test.mjs`) and the `frontend` project (`system/frontend/src/pages/test/FieldMap.test.tsx`, `KnowledgeIndex.test.tsx`, `Leaderboards.test.tsx`); 5 ruff, over `backend` and `tools`, `gen_papers.py` among them; 8 content, whose claim rule resolves every module claim's `source` against the card keys of `papers.json`; 11 frontend build, which compiles `papers.json` and `leaderboards.json` into the bundle.

**Outside `ci`:** `npm run check:perf` times the cold start of `/map` and `/leaderboards` against NFR-8's 10 s budget (`system/e2e/perf.spec.ts`). None of `test:e2e`, `check:offline` and `check:pins` is specific to S7.

**What the records measure.** §9 counted 60 cards, ten of them carrying 87 figures, and corrected an index that said eleven. §10 measured the cold start of `/map` at 218 ms and of `/leaderboards` at 227 ms on 2026-09-19. §32 includes the frontend build with `pages/useFieldDraft.ts`, 825 modules.

## 6. Traps

- A list of methods that must carry figures, written before their tables are opened, can be met only by carrying figures nobody checked. [D32]
- A presence check on an enum is not a check: `toBeTruthy()` passed 82 figures tagged `sgdet` by a source that names no protocol. [D34]
- A row labelled "IndVisSGG-Gemini (ours)" is IndVisSGG on a different backbone, not a score for Gemini-Pro-Vision as a method. [D34]
- "They differ" is a claim about numbers nobody read; "the paper does not state them" is what the source supports. [D34]
- Windows resolves imports case-insensitively, so `../Leaderboards` from a test found `leaderboards.ts` and handed React `undefined`; the data module is `boards.ts`. [D35]
- A specification that is silently wrong recruits people to make it true: contracts §1.10's `/api/content` is marked superseded in place so that nobody builds it. [D72] [contracts §1.10]
- The router applies a navigation inside a transition, so a field whose value is read back from the URL loses its caret on each keystroke and its input-method composition. [D122] [`system/frontend/src/pages/useFieldDraft.ts`]

## 7. History

**Binding decisions:** D-21.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-scene-graph-studio-PRD.md`.

| Deviation | Effect | Role |
|---|---|---|
| D32 | the tier-A list and D-21 cannot both be satisfied | primary |
| D33 | three smaller corrections to Task 9 | primary |
| D34 | eighty-two numbers carried a protocol their source never states | primary |
| D35 | a leaderboard row cannot name three things its source never states | primary |
| D72 | `/api/content/*` is normative, absent, and should stay absent | secondary |
| D79 | `ruff` was in the gate for half the Python in the repository | secondary |
| D92 | the suite written to guard the lint rules missed eight of seventeen breaks | secondary |
| D101 | the map indexes the knowledge points, and the knowledge-map freeze is released (D-23) | primary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |

## 8. Open items

1. Contracts §3.2 spells the branches with underscores and names `three_d`, where the corpus and `papers.ts` use hyphens and `embodied`; D33 records the ninth branch and not the spellings. [contracts §3.2] [D33] [`system/frontend/src/pages/papers.ts`]
2. PRD §6.3 says each card is linked to the module that covers it. `PaperCard` names the modules as text and renders no link to them; no record states which is intended. [PRD §6.3] [`system/frontend/src/pages/PaperCard.tsx`]
3. The field map's selects and checkboxes still read the URL directly; they have no caret and end correct. Left open by D122. [D122] [`system/frontend/src/pages/FieldMap.tsx`]
4. `gen_papers.py` still writes `protocol: sgdet` and `constraint: graph` on every IndVisSGG row and keys Table 2's ISG figures to `gemini-pro-vision-2023`, both of which D34 corrected in `papers.json`. It writes nothing, so the corpus is unaffected, and it is kept as a record of how the rows were shaped. [D34] [`system/tools/gen_papers.py`]
