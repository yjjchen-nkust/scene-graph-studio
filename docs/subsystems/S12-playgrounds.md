# S12 Playgrounds

## 1. Purpose and boundary

S12 is the sixteen playgrounds: interactive steps inside a module, each a small set of knobs that move a quantity the module has just defined, mounted by knowledge point from one table over a shared control kit, with the arithmetic they display, the photograph overlay six of them draw through, and the golden cases and release figures that pin that arithmetic. A playground demonstrates; it computes no metric. S12 is not the labs, which score (S11), not the demonstrations, which replay recordings (S13), not the step contract's host, the module registry and the content lint (S6), and not the stepper that carries knobs between parts (S10).

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/playgrounds/` | The sixteen playgrounds, their frame and control kit, logic, data loaders, photograph overlay and mounts |

## 3. Interfaces

**Provides:**

- `Playground` (`system/frontend/src/playgrounds/Playground.tsx`), which S6's `system/frontend/src/content/registry.tsx` passes to every module through the MDX `components` prop.
- `PLAYGROUND_MOUNTS`, `PLAYGROUND_PARTS` and `PLAYGROUND_IDS` (`system/frontend/src/playgrounds/mounts.tsx`): S6's `system/tools/content_lint.mjs` reads the file as text, S6's `system/frontend/src/content/test/registry.test.tsx` imports the first two, and S7's `system/frontend/src/pages/test/KnowledgeIndex.test.tsx` imports `PLAYGROUND_IDS`.
- `decimals` and `snap` (`system/frontend/src/playgrounds/logic.ts`), imported by S9 (`system/frontend/src/components/MetricReadout.tsx`) and S13 (`system/frontend/src/demos/DV/IndVisSGG.tsx`).
- The control kit and the overlay: S13 imports `Choice`, `Readout`, `PartContext` and `DensityContext` from `system/frontend/src/playgrounds/controls.tsx`, and D-T's first part imports `PhotoMarks` and `MARK_PREDICTED` from `system/frontend/src/playgrounds/PhotoMarks.tsx`.
- The golden cases `data/content/playground_golden.json` and X1's figures `data/content/vg150_splits.json`, which S6's content lint holds to rules 9 to 12.

**Consumes:**

- S1 (`system/frontend/src/playgrounds/logic.ts`, `slice.ts`, `PhotoMarks.tsx` and `system/frontend/src/playgrounds/F6/PredicateSynonymy.tsx` import types from `sgg-metrics`; `system/frontend/src/playgrounds/test/logic.test.ts` imports `applyConstraint`, `applyPairing`, `boxIou`, `classify`, `encodeCounts`, `evaluate`, `rank` and `toTriplets`).
- S9 (`system/frontend/src/playgrounds/F1/LabelsToStructure.tsx` imports `ImageOverlay`).
- S10 (every playground imports `useLocale`; several tests import `system/frontend/src/i18n/en.json` and `zh-TW.json`).
- S11 (every playground imports `useLabParams` from `system/frontend/src/labs/useLabParams.ts`).
- S15 (`slice.ts` imports the `placeholder` and `vg150-sgb` annotations, `images.ts` the placeholder photographs, `splits.ts` `data/content/vg150_splits.json`, and `golden.test.ts` and `logic.test.ts` `data/content/playground_golden.json`, all through the `data/` link, whose CI copy is `fixtures/data`).

## 4. Current rules

1. A playground is a step kind, not a lab: `kind: playground` with `kp:`, one `<Playground kp="…"/>` in the step's body, and a component registered for that knowledge point in `PLAYGROUND_MOUNTS`, one component per point over a shared control kit. [contracts §2.4] [`2026-09-19-playgrounds-design.md`] [`system/frontend/src/playgrounds/mounts.tsx`]
2. A playground computes a count, a bound, a set membership or a value of the rule its step teaches, each a quantity its knowledge point's own definition contains, and never a metric; a metric is a lab's business. The value of a rule entered with T2, by contracts §2.4's amendment of 2026-09-29, which the author accepted. [contracts §2.4] [D111] [`2026-09-19-playgrounds-design.md`]
3. No playground component imports a value from `sgg-metrics`, only its types. The value imports are in `logic.test.ts`, whose tests hold F3's IoU to `boxIou` on the golden cases and at every knob setting, E1's verdict to `classify`, M4's cap to `applyConstraint`, its counts to `evaluate`, and E13's admission to `applyPairing` and its match to `evaluate`. [`CLAUDE.md`] [D97] [D98] [D100] [D106] [`system/frontend/src/playgrounds/test/logic.test.ts`]
4. Sixteen playgrounds are registered: F1, F2 and F8 in M0; F6, F7 and X1 in M1; F3 in M2; E1 and E10 in M3; E3, E4, E7, E13 and X2 in M4; T1 and T2 in M5. Twelve live knowledge points have none. [D111] [`system/frontend/src/playgrounds/mounts.tsx`] [`system/frontend/src/playgrounds/test/Playground.test.tsx`]
5. A tag naming a point the table does not register, or a part it does not give, renders a panel that names it on the slide rather than nothing, and a part is never rounded to one that exists. [D96] [`2026-09-19-playgrounds-design.md`] [`system/frontend/src/playgrounds/Playground.tsx`]
6. A playground too tall for one panel spans consecutive steps as parts: `part: n` on each step and on its tag, with the count in `PLAYGROUND_PARTS`. E1, E10, E3, E4, E7, F1, F3, F6, F7 and T2 have two parts and X1 three. Each part shows the controls its own view reads, and the study page renders every part, each in its own frame, a part suffixing each knob's DOM id so every label names its own control. [D96] [D111] [contracts §2.4] [`system/frontend/src/playgrounds/mounts.tsx`]
7. Knob state lives in the query string, through `useLabParams`, namespaced by the knowledge point (`?F1.density=0.5`), so a setting is a link; the position stays in the route. [`2026-09-19-playgrounds-design.md`] [D90]
8. A knob's value from the URL is brought back to its range before use: sliders are clamped or snapped to their steps (`clamp`, `snap`, the latter at decimal precision), and two-state knobs read through `flag`, so an absurd but numeric value never selects the opposite of the default. [D90] [D97] [D120] [`system/frontend/src/playgrounds/logic.ts`]
9. Knobs are real form controls, `<input>`, `<select>` and `<button>`, which is what the lecture shell's keyboard policy reads, and nothing in the kit takes focus on mount. [`2026-09-19-playgrounds-design.md`] [D88] [`system/frontend/src/playgrounds/test/controls.test.tsx`]
10. Every displayed number stands in a `Readout` with its origin beside it, the note holding the arithmetic, and a readout's test id is its own namespaced id, never its translated label. [D90] [`system/frontend/src/playgrounds/controls.tsx`]
11. A playground's data are imported at build time from `data/`, through the link, by one loader each: `slice.ts` for the `placeholder` and `vg150-sgb` annotations, `images.ts` for the placeholder photographs, `splits.ts` for X1's release figures. Nothing is fetched, so a playground computes with no backend and no network. [`2026-09-19-playgrounds-design.md`] [D109] [`system/frontend/src/playgrounds/slice.ts`]
12. A slice's predicate vocabulary and class count are counted from the slice, not written down, so regenerating the slice moves a label rather than falsifying it. [`system/frontend/src/playgrounds/slice.ts`]
13. F6 and F7 count distinct triplets: E is a set, a frame that annotates one (s, p, o) twice holds one triplet, counted per frame after any merge, and the slice's 892 relationship rows are 684 distinct triplets. [D96] [`2026-09-26-split-and-distinct-design.md`]
14. `PlaygroundFrame` puts the controls above the visual and clips the visual at 46vh unless the playground passes `clip={false}`. Every playground but F8 passes it, since a word under the clip is beyond the step's scroll, and those that draw a photograph size it instead, F1 at most 38vh and the `PhotoMarks` playgrounds at 34vh. [D93] [D96] [D123] [`system/frontend/src/playgrounds/controls.tsx`]
15. `dense` is the opt-in tighter spacing of E3, E4, E7, E13, X2, T1 and T2, and `Playground.test.tsx` requires exactly those seven; the other nine keep the spacing their records measured. [D106] [D111] [`system/frontend/src/playgrounds/test/Playground.test.tsx`]
16. Playground text is sized in `em`, so it inherits the shell it is mounted in, and no word falls below the deck's 18 px floor; M4's list rows are 0.75em, the floor exactly. [D88] [D106]
17. F3, E1 and E10, and E3, E4 and E7 through `PairPhoto`, draw through `PhotoMarks`: the photograph in flow, stating its width and height, under an `<svg>` on the frame's own viewBox, so the marks land on their objects only with the photograph's box exactly; marks are solid or dashed over a white under-stroke and carry no SVG text, and a badge naming a box is HTML placed in percent of the frame, above its box by default. [D97] [D98] [D100] [`system/frontend/src/playgrounds/PhotoMarks.tsx`]
18. F1 draws through S9's `ImageOverlay` with its labels layer on, and F2 draws its six objects as buttons round an ellipse, with one `<svg>` beneath them, carrying no text, for the edges |E| counts. [D88] [D123]
19. `data/content/playground_golden.json` pins every playground's arithmetic: each case gives its frame or a scope, its knobs, its expected output and a `why` that writes the arithmetic out, and `golden.test.ts` requires every case to be run by exactly one block. [`2026-09-19-playgrounds-design.md`] [D95] [D106] [`system/frontend/src/playgrounds/test/golden.test.ts`]
20. Every figure X1 shows is a transcription in `vg150_splits.json` carrying the passage it was read from. X1 computes only the difference between two stated counts and where a release's validation set is drawn from, and never turns Xu et al.'s 70% of 108,077 into a count. [D93] [D95] [`system/frontend/src/playgrounds/splits.ts`]
21. The content lint holds a playground step to eight rules. (1) A `playground` step declares `kp`. (2) The `kp` is in `kp.json`. (3) This module owns it in `assignment.json` or cites it in its `knowledge_points`. (4) A component is registered for it, read from `mounts.tsx` as text, and a declared part lies within `PLAYGROUND_PARTS` while a split point names its part on every step. [contracts §2.4] [`2026-09-19-playgrounds-design.md`] [D96] [`system/tools/content_lint.mjs`]
22. (5) The step's body, which ends at its own `</Step>`, carries exactly one `<Playground>`, whose `kp` and `part` equal the step's, and no part is mounted twice in a module. (6) No `<Playground>` in a body names a point and part that no step of the module declares. (7) Both locales mark the same steps as playgrounds, with the same `kp` and `part`. (8) A point is mounted by one playground step in the whole corpus, or, when split into N parts, by N consecutive steps of one module carrying parts 1 to N in order. [`2026-09-19-playgrounds-design.md`] [D90] [D91] [D96] [`system/tools/content_lint.mjs`]
23. Over `playground_golden.json`: (9) every case has a unique `id` and carries `kp`, `knobs`, a non-empty `expect` and exactly one of `image_id` or a `scope` in {`slice`, `model`, `sources`}; (10) its `why`, at least 40 characters, writes out the arithmetic; (11) it names a `kp` with a registered component. [`2026-09-19-playgrounds-design.md`] [D92] [D93] [`system/tools/content_lint.mjs`]
24. Over `vg150_splits.json`, rule 12: every release figure and note carries `source`, `url`, `locator` and a non-empty `quote`; a count equals one whole number of its quote, named by `index` when the quote holds several; coded values lie within their sets; every release states all five figures; a measured row count equals its value; a share appears in its quote as written; every note has a numeric value, both texts and the split it explains; and every release has both labels. [D93] [D94] [D95] [`2026-09-19-playgrounds-design.md`]
25. Each of the twelve rules, and each clause added since, fails a test in `system/tools/test/content_lint.test.mjs` when disabled: the suite caught 17 of 17 mutants of rules 1 to 11 after D92, 23 of 23 mutants, one per clause of the twelve rules, at D93, 10 of 10 clauses of rule 12 at D94, 4 of 4 at D95, and 7 of 7 clauses on parts at D96, with the clause its review added to rule 6. [D92] [D93] [D94] [D95] [D96] [VERIFICATION §17]
26. The projector suite holds every playground but F2 and F8, each part of a split one, in its longest state to the panel at 1024×768, 1280×800 and 1920×1080 in 繁體中文. F2 and F8, one step each, are held only to controls inside the panel and no word clipped out of reach, since they ran 24 and 27 px past 1024×768 when D96 measured them. English is held to the panel only for E1's first part and E10's second, in three states. [D95] [D96] [D98] [D100] [D106] [D111] [`system/e2e/projector.spec.ts`]

## 5. Verification

**Records:** VERIFICATION §15, VERIFICATION §17, VERIFICATION §18, VERIFICATION §19, VERIFICATION §20, VERIFICATION §21, VERIFICATION §22, VERIFICATION §24, VERIFICATION §25, VERIFICATION §29, VERIFICATION §30, VERIFICATION §33.

**`npm run ci` steps:** 4 vitest, the `frontend` project (the tests under `system/frontend/src/playgrounds/test/`, `logic.test.ts` and `golden.test.ts` among them, and each playground's own `test/` directory) and the `tools` project (`system/tools/test/content_lint.test.mjs`, whose `content_lint playground rules` block exercises rules 1 to 12); 7 i18n, over the `playground` keys; 8 content, `system/tools/content_lint.mjs`, rules 1 to 12; 11 frontend build.

**Outside `ci`:** `npm run test:e2e` requires every playground to compute with no backend running, every knob to work from the keyboard without advancing the deck, a knob to write the address bar and to cross from one part to the next (`system/e2e/lecture.spec.ts`), and, at three panel sizes, every playground but F2 and F8 to fit in its longest state, no word to be clipped out of reach, the photographs whole and the marks on them, the 18 px floor, NFR-5's contrast, and the marks of M1's charts at 3:1 (`system/e2e/projector.spec.ts`). `npm run check:perf` times one knob of each of the sixteen against NFR-8's 100 ms (`system/e2e/perf.spec.ts`).

**What the records measure.** §15 is M0's three and the contrast instrument that could not read `oklch()`. §17 to §19 are M1's three, the lint by 23 mutants, and the overflow of every state in both locales. §20 is the split into parts and the count of distinct triplets. §21 and §22 are F3, E1 and E10. §24 and §25 are the review minors of D100 and D102. §29 and §30 are M4's five and M5's two. §33 is F2's drawn edges.

## 6. Traps

- A playground is a step kind, not a lab: it computes a count, a bound, a set membership or a value of the rule its step teaches, never a metric, since a metric is a lab's business and the boundary is the point. [D111] [contracts §2.4] [`CLAUDE.md`]
- A playground measured only in its default state says nothing about the state its step exists to show, and an acceptance of overflow inherits the same blind spot. [D95] [VERIFICATION §19]
- Moving a step's text to a step of its own cannot fit a playground whose frame alone is taller than the panel; the playground itself has to be divided, and its knobs carried across the division. [D96] [VERIFICATION §20]
- A count of relationship rows is not a count of triplets when a frame annotates one twice, and a merge can make two rows of one pair the same triplet. [D96] [`docs/INDEX.md`]
- An overlay on a photograph is right only if it has the photograph's box; in a stretched column `meet` scaling moved every mark of F3 off its object while every number beside it stayed right, and only a picture of the slide showed it. [D97] [VERIFICATION §21] [`CLAUDE.md`]
- An `overflow: hidden` box inside a scrolling step hides words no scroll can reach, and a contrast walk that asks only whether a word is painted measures them as passing. [D93] [VERIFICATION §17]
- A layout tightened in the shared control kit to fit one playground moves every playground an earlier record measured, with every test still passing; `dense` is opt-in for that reason. [D106] [VERIFICATION §29]
- A framework that sizes in rem puts its text at the document root, not at the shell the component is mounted in, so a 24 px lecture can contain 14 px type. [D88] [`docs/INDEX.md`]
- Comparing a count with every digit of its quote run together passes a figure from the wrong column, and one straddling two numbers. [D94] [`docs/INDEX.md`]
- A figure repeated across a page, a brief and a decision from one early reading is wrong everywhere at once, and only opening the source finds it. [D93] [`docs/INDEX.md`]
- A playground reads `data/` from outside vitest's root, so `system/vitest.config.ts` widens the frontend project's `server.fs.allow`; removing it fails six suites at collection with an error that names neither the configuration nor the cause. [`CLAUDE.md`]
- A playground registered without its lecture step turns the gate red, since `KnowledgeIndex.test.tsx` requires every registered playground to have a step, and rule 11 refuses a golden case for an unregistered one; so a playground is registered in the commit that inserts its steps, and its golden cases follow. [D106] [D111]

## 7. History

**Binding decisions:** none.

**Specs and plans:** `2026-09-15-scene-graph-studio-contracts.md`, `2026-09-19-playgrounds-design.md`, `2026-09-19-playgrounds-m0.md`, `2026-09-26-playgrounds-m1-design.md`, `2026-09-26-playgrounds-m1.md`, `2026-09-26-split-and-distinct-design.md`, `2026-09-27-playgrounds-m2-design.md`, `2026-09-27-playgrounds-m2.md`, `2026-09-27-playgrounds-m3-design.md`, `2026-09-27-playgrounds-m3.md`, `2026-09-28-playgrounds-m4-design.md`, `2026-09-28-playgrounds-m4.md`, `2026-09-29-playgrounds-m5-design.md`, `2026-09-29-playgrounds-m5.md`.

| Deviation | Effect | Role |
|---|---|---|
| D88 | the three M0 playgrounds, and the four things building them decided | primary |
| D90 | the eight minor findings the review deferred | secondary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D92 | the suite written to guard the lint rules missed eight of seventeen breaks | secondary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | primary |
| D94 | the final review's deferred findings, resolved | secondary |
| D95 | the review of the day's merges: F6's status under its clip, and what surrounded it | primary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | primary |
| D97 | M2's playground, F3, and three statements about IoU the sources contradict | primary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | primary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D102 | the five minors D100's review deferred, settled | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | primary |
| D109 | all of `data/` on the NAS, and none of it in git | secondary |
| D111 | M5's playgrounds, T1 and T2 | primary |
| D120 | the review of 2026-10-01 | secondary |
| D123 | the dev server serves data/ across drives, F2 draws its edges, and devdata declares data/ | secondary |

## 8. Open items

1. F2's built edges stay out of the query string, being work product rather than a knob, and `f2-notice` carries no `aria-live`; both were left for a later cycle to re-open deliberately. [D90]
2. kp F3's `knobs` field names sliders for x, y, w and h of the predicted box, where F3 has Δx, Δy and one scale λ, since M2's bound is stated in λ; recorded, not changed. [D97]
3. The `why` texts of `pg-T2-relations-w05-t5` and `pg-T2-relations-w09-t10` name the box as the object at the largest gap, where the panel ties with it; the values hold, and the text is on the NAS only. [D111]
4. The comment of `controls.tsx` says `isTextEntry` gives every key to a focused input of any type. Since D120 a checkbox, button, file or image input is not a field, so a focused `Toggle` leaves the arrows to the deck and takes Space. [D120] [`system/frontend/src/playgrounds/controls.tsx`] [`system/frontend/src/shells/lecture/useStepper.ts`]
5. No test reads a playground's source for a value import from `sgg-metrics`; rule 3 of §4 holds in the code as it stands and is stated in `CLAUDE.md`, and nothing fails the gate if it is broken. [`CLAUDE.md`] [`system/frontend/src/playgrounds/test/logic.test.ts`]
