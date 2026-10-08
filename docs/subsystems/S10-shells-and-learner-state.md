# S10 Shells and learner state

## 1. Purpose and boundary

S10 is the frontend application around the content: its build and dev-server configuration, the route table, the two shells that present a module's steps, the presenter window, the learner's stored state (locale, progress and review schedule), the generated checkpoint quiz, the graph export, the two locale tables with their parity check, and the test setup that fills jsdom's gaps. It decides how a step is shown and navigated, never what a step contains. It is not the modules and their registry (S6), the labs, playgrounds and demos a step mounts (S11, S12, S13), nor the reference pages it routes to (S7).

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/` | Frontend package: configuration, entry point, routes, shells, store, assessment, export, i18n, test setup |
| `system/frontend/src/pages/Home.tsx` | Module index: modules in curriculum order, progress, resume, labs, locale toggle |
| `system/frontend/src/pages/Status.tsx` | Status page: the backend's health and slice presence |
| `system/tools/i18n_parity.mjs` | Checks key and placeholder parity between the two locales |
| `system/tools/test/i18n_parity.test.mjs` | Tests that each parity rule fails when disabled |

## 3. Interfaces

**Provides:**

- `ROUTES` (`system/frontend/src/routes.tsx`), from which `system/frontend/src/main.tsx` builds the browser router; it mounts S7's `FieldMap` and `Leaderboards` and S11's `LabRoute`.
- `useLocale`, `setLocale` and the type `Locale` (`system/frontend/src/i18n/useLocale.ts`), imported by S6, S7, S9, S11, S12 and S13; S12's tests also import the two tables, `system/frontend/src/i18n/en.json` and `system/frontend/src/i18n/zh-TW.json`.
- `ExportButtons` (`system/frontend/src/export/ExportButtons.tsx`), imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`, `system/frontend/src/labs/L8/MiniISGAnnotator.tsx`).
- The stepper's carrying of the query string between the parts of one playground or one demo, on which S12's and S13's split steps rely (`system/frontend/src/shells/lecture/useStepper.ts`).
- `system/frontend/test/setup.ts`, which S14's `system/vitest.config.ts` names as the frontend project's setup file, and `system/frontend/vite.config.ts`, the build that `npm run build:frontend` runs as step 11.
- `npm run lint:i18n`, step 7 of `npm run ci`, declared in S14's `system/package.json`.

**Consumes:**

- S6 (`routes.tsx`, `Home.tsx`, `LectureShell.tsx`, `PresenterWindow.tsx` and `StudyShell.tsx` import from `system/frontend/src/content/registry.tsx`; `system/frontend/vite.config.ts` imports `mdxPlugin` from `system/mdx.plugin.ts`).
- S7 (`system/frontend/src/routes.tsx` imports `FieldMap` and `Leaderboards` from `system/frontend/src/pages/`).
- S11 (`routes.tsx` imports `LabRoute`, and `Home.tsx` imports `LAB_IDS`, from `system/frontend/src/labs/registry.tsx`; `StudyShell.tsx` imports `GT` from `system/frontend/src/labs/L2/fixture.ts`; `Status.tsx` imports `API_BASE` from `system/frontend/src/labs/api.ts`).
- S1 (`system/frontend/src/assess/perturb.ts`, `quiz.tsx` and the export modules import their types from `sgg-metrics`).
- S15 (`system/frontend/vite.config.ts` imports `dataDirectory` from `system/data.dir.ts` and `crossDriveFs` from `system/fs.plugin.ts`).

## 4. Current rules

1. The route table is one exported `RouteObject[]`, `ROUTES`; `main.tsx` builds the browser router from it and the route test builds a memory router from it, so the tests exercise the application's own routes rather than a copy. [D52] [`system/frontend/src/routes.tsx`]
2. Every route of contracts §2.2 is mounted. Beyond the contract, the bare `/lecture/m/:moduleId` redirects to step 0, `/status` shows the backend's health and slice presence, and an unknown path or module renders a page that says so rather than an empty shell. [contracts §2.2] [D52] [D53] [`system/frontend/src/routes.tsx`]
3. The router is built once, at module scope, in data-router mode, with `basename` set from Vite's `BASE_URL` without its trailing slash; TanStack Query never refetches (`staleTime: Infinity`, no refetch on window focus). [contracts §2.2] [contracts §2.3] [D127] [`system/frontend/src/main.tsx`]
4. The build reads `SGS_BASE` as Vite's `base`, `/` when unset, and the status page prefixes its health request with `API_BASE`, the backend origin taken from `VITE_API_BASE`, empty by default so that the local run goes through Vite's proxy. [D127] [`system/frontend/vite.config.ts`] [`system/frontend/src/pages/Status.tsx`]
5. The favicon, `system/frontend/public/favicon.svg`, is three nodes joined by three edges on a dark rounded square, labelled `Scene Graph Studio`. [D127]
6. The dev server binds `127.0.0.1` on port 5173 with `strictPort`, and proxies `/api` and `/images` to the backend on `SGS_BACKEND_PORT`, 8000 by default; `vite preview`, which the end-to-end suites run against, carries the same host and proxy. [D10] [D14] [`system/frontend/vite.config.ts`]
7. The dev server's `server.fs.allow` restates the workspace root and adds the target of the `data/` link, and the `crossDriveFs` plugin serves a `/@fs/` file on another drive than the server's, so that the clip and the photographs under `data/` load under `npm start`. [D123] [`system/frontend/vite.config.ts`]
8. The frontend needs Node 22.12 or later, the floor D-03 sets and `system/package.json` declares; `vite@8.3.0` itself accepts `^20.19.0 || >=22.12.0`. [D-03] [D3] [D9] [`system/package.json`]
9. `npm run ci` ends with the frontend build, `tsc -b && vite build`, because vitest transpiles without type checking. [D12] [`system/frontend/package.json`]
10. One content base, two shells: both render the steps `getModule` returns, and neither knows what a lab is. The study shell shows every step in one scrolling column, each in its own `data-step-id` section; the lecture shell shows one step at a time. [contracts §2.4] [D53] [`system/frontend/src/shells/study/StudyShell.tsx`] [`system/frontend/src/shells/lecture/LectureShell.tsx`]
11. The lecture shell sets a 24 px base type once, on its root, and draws every colour from `LECTURE_PALETTE`. The palette test recomputes each of its five ink tokens against white with a WCAG 2.1 `contrastRatio` and fails any below 7:1, and pins the measured ratios to two decimals; the accent is `#1e40af`, at 8.72. [SRS §7] [D54] [`system/frontend/src/shells/lecture/palette.ts`]
12. The step region scrolls inside a fixed shell, so the position and the section clock stay on screen on a slide too long for the panel. Slides that run past an XGA panel are accepted by the author's judgement of 2026-09-18, given D71's measurement of 25 of 92 slides; shrinking the type below 24 px was never an option. [D71] [VERIFICATION §8]
13. A display formula wider than the slide is shrunk by font size rather than by transform, its overflow measured as the inner `.katex` element's `scrollWidth` against the block's `clientWidth`, and it is fitted again when the step changes, when the window resizes and when `document.fonts.ready` resolves. Below a scale of 0.55 it stays at that floor and scrolls. [D70] [`system/frontend/src/shells/lecture/fitMath.ts`]
14. The lecture's position lives in the route and nowhere else, and an index outside the module is clamped to it. [contracts §2.2] [`system/frontend/src/shells/lecture/useStepper.ts`]
15. `ArrowRight` and Space advance, `ArrowLeft` retreats, the deck does not wrap at its ends, and an arrow with Alt, Ctrl or Meta is left to the browser. [contracts §2.4] [`system/frontend/src/shells/lecture/useStepper.ts`]
16. Every key is yielded to a focused `textarea`, `select`, `contenteditable` region or `input`, except an input of type button, submit, reset, checkbox, file or image, which is not a field; a range, a radio group and a number field keep the arrows. [D91] [D120] [`system/frontend/src/shells/lecture/useStepper.ts`]
17. Space alone is yielded to a focused button, `summary`, `a[href]`, activatable input, `<video>` or `<audio>`, so that one press never both activates a control and advances the deck. [D58] [contracts §2.4] [`system/frontend/src/shells/lecture/useStepper.ts`]
18. The stepper computes the next step from the position it has asked for as well as the one rendered, so two presses faster than React commits move two steps; a route that moves elsewhere, by a bookmark or the Back button, wins over the pending target. [D67] [`system/frontend/src/shells/lecture/useStepper.ts`]
19. The query string, and with it the knobs, crosses from one step to the next only when both mount the same playground point or the same demo, and the pending query is the one carried when presses outrun renders; every other step opens on its defaults. [D96] [contracts §2.4] [`system/frontend/src/shells/lecture/useStepper.ts`]
20. The section clock counts the step's `seconds_budget` down and past zero, printing a negative time with the sign leading and truncating rather than rounding, and it resets whenever the step changes; a step with no budget has no clock. [D59] [D120] [`system/frontend/src/shells/lecture/timer.ts`] [`system/frontend/src/shells/lecture/useStepper.ts`]
21. The shell opens one `BroadcastChannel`, `sgs-presenter`, and keeps it: it posts `{moduleId, stepIndex, remainingSeconds}` on every change of position or clock, and answers a `{kind: 'hello'}` with its current position. [contracts §2.4] [D86] [`system/frontend/src/shells/lecture/useStepper.ts`]
22. `/lecture/notes` posts `hello` once, after subscribing, and sends nothing else: it cannot drive the deck. With no lecture running it shows a waiting pane that names the remedy. [D86] [`system/frontend/src/shells/lecture/PresenterWindow.tsx`]
23. The presenter window shows the current step's notes from its own locale's field only, never the other locale's, and says when a step has none; it also shows the next step, the section clock, in `danger` `#912018` past zero, and its own elapsed time, labelled as the time since the window opened. [D57] [D59] [`system/frontend/src/shells/lecture/PresenterWindow.tsx`]
24. The presenter button opens the window under the name `sgs-presenter` and without `noopener`, so a second press reuses it. [D120] [`system/frontend/src/shells/lecture/LectureShell.tsx`]
25. `system/frontend/src/store/persist.ts` is the one module that touches `localStorage`. Every slot is JSON under the prefix `sgs:v1:`, every read and every write is wrapped and falls back to a typed default, a stored value's version and shape are both checked, and a version bump discards rather than migrates. [contracts §2.3] [D62] [D68] [`system/frontend/src/store/persist.ts`]
26. The locale is the `lang` slot, read through `persist` at load with `zh-TW` as the default. `<html lang>` is set at load and on every change, and a window adopts a locale that another window of the origin writes, through the `storage` event. [D68] [D122] [`system/frontend/src/i18n/useLocale.ts`]
27. The locale toggle, on the module index and the status page, swaps every label with no reload and no refetch and survives a real reload, and the status page still works when `localStorage` throws. [PRD §6.1] [D11] [D53] [`system/frontend/test/Status.test.tsx`]
28. Progress is, per module, the highest step reached plus one, and it only moves forward: the lecture shell records it as it advances and the study shell records the whole module when opened. The index shows each module's count and offers the furthest module in curriculum order as resume. [D65] [`system/frontend/src/store/progress.ts`]
29. The two locale tables are flat, `zh-TW.json` and `en.json`, and there is no fallback locale: a missing key renders as `⟦key⟧` in development and throws in a production build. [contracts §2.7] [`system/frontend/src/i18n/useLocale.ts`]
30. `i18n_parity.mjs` refuses a key present in one locale only, in either direction; an empty or non-string value; a braced name other than `\w+`; a brace outside a placeholder; placeholders that differ between the locales, compared as sorted lists; and a placeholder repeated within one value, since each is filled by `String.replace`, which fills the first occurrence only. Each rule, disabled alone, fails its own test in `i18n_parity.test.mjs`. [D103] [D104] [VERIFICATION §27] [`system/tools/i18n_parity.mjs`]
31. A checkpoint item is generated, not authored: it corrupts one relation of a graph, rewriting the predicate to another the graph uses or reversing the direction, and asks which triplet is wrong. It can ask nothing about the module's prose. [D63] [PRD §6.5] [`system/frontend/src/assess/perturb.ts`]
32. One graph, L2's fixture, feeds every checkpoint, and only the study shell renders the quiz, up to three items a checkpoint. Each item is named `<module>:<step>:<i>` and seeded from that name, which is also its key in the review schedule. [D63] [D117] [`system/frontend/src/shells/study/StudyShell.tsx`] [`system/frontend/src/assess/quiz.tsx`]
33. A corruption is never one the graph would still hold: a relation whose predicate is `near`, `next to`, `beside`, `aligned with` or `and` is not reversed, a corruption equal to a triplet the graph already holds, compared by the names the reader sees, is not drawn, and a checkpoint asks about each relation at most once. [D122] [`system/frontend/src/assess/perturb.ts`] [`system/frontend/src/assess/quiz.tsx`]
34. Scheduling is FSRS through `ts-fsrs` with fuzz off, stored in the `fsrs` slot. An answer disables every option, and `gradeItem` leaves a card that is not yet due unchanged, so a remounted checkpoint shows the earlier answer and grades nothing again. [D63] [D64] [D122] [`system/frontend/src/assess/schedule.ts`]
35. A stored schedule entry whose step was renumbered stays in `localStorage`, read by nothing, and no migration is written, since carrying it to the new key would attach a review history to a different question. [D117]
36. The JSON export is the Visual Genome driver's document: an object carries the driver's keys and always `synsets`; a relationship carries `subject_id`, `object_id` and `synsets`; masks sit in a top-level `sgs_masks` keyed by object id, and the dataset, the provenance and the score under `sgs_` names. A relationship naming an absent object makes the export throw, and the import reads this form and the older one. [D66] [D122] [`system/frontend/src/export/vgJson.ts`]
37. The SVG export serialises a clone of the overlay, strips `class` and every external reference, inlines nothing from a stylesheet, and embeds the frame beneath it only as a `data:` URI. `ExportButtons` finds the overlay in an effect, not during render, and offers the SVG button only where there is an overlay. [D66] [D122] [`system/frontend/src/export/svg.ts`] [`system/frontend/src/export/ExportButtons.tsx`]
38. `system/frontend/test/setup.ts` supplies what jsdom lacks or gets wrong: a cleanup after each test, a `PointerEvent` over `MouseEvent`, a `Request` that retries without a foreign `AbortSignal`, and a same-realm `BroadcastChannel`, whose five properties `system/frontend/test/broadcastChannel.test.ts` asserts. [D22] [D55] [D81] [`system/frontend/test/setup.ts`]

## 5. Verification

**Records:** VERIFICATION §7, VERIFICATION §8, VERIFICATION §10, VERIFICATION §26, VERIFICATION §27, VERIFICATION §32.

**`npm run ci` steps:** 4 vitest, the `frontend` project (`system/frontend/src/test/routes.test.tsx`, the tests under `system/frontend/src/shells/lecture/test/`, `system/frontend/src/store/test/`, `system/frontend/src/assess/test/`, `system/frontend/src/export/test/` and `system/frontend/src/i18n/test/`, and `system/frontend/test/Status.test.tsx` and `broadcastChannel.test.ts`) and the `tools` project (`system/tools/test/i18n_parity.test.mjs`); 7 i18n, `system/tools/i18n_parity.mjs`; 11 frontend build, `tsc -b && vite build` under `system/frontend/vite.config.ts`.

**Outside `ci`:** `npm run test:e2e` (check 8) opens in 繁體中文 by default, walks M0 to M14 forwards on the keyboard at 24 px base type, joins a presenter window to a lecture in progress, and keeps typing and knobs from advancing the deck (`system/e2e/lecture.spec.ts`); its projector suite requires, at 1024×768, 1280×800 and 1920×1080, the 24 px base, NFR-5's contrast on every painted word, and the position and the clock on screen on a slide too long for the panel (`system/e2e/projector.spec.ts`). `npm run check:offline` (check 6) opens every module and walks M0 to M14 with the network intercepted (`system/e2e/offline.spec.ts`). `npm run check:perf` measures the cold start of `/`, `/lecture/m/m00/0` and `/m/m00` (`system/e2e/perf.spec.ts`).

**What the records measure.** §7 is `lint:i18n` at 198 keys and the e2e assertion that a fresh machine opens in 繁體中文. §8 is the lecture rehearsal at three resolutions, the three defects it found (D67, D68, D70) and the accepted overflow of D71. §10 measures the cold start of the index, the lecture and the study shell, 242, 202 and 270 ms on 2026-09-19, against the 10 s of NFR-8. §26 and §27 are `i18n_parity.mjs` by mutation, at 331 keys. §32 is the run of D122, which changed the checkpoint, the quiz's grading and the locale's propagation.

## 6. Traps

- A unit test that waits for a render between two keypresses cannot see a lost keypress; a browser does not wait. [D67] [`docs/INDEX.md`]
- One key with two encodings stays invisible until something writes it both ways. [D68] [`docs/INDEX.md`]
- A scrolling container clamps its child's bounding rectangle, so the overflow measured is zero. [D70] [`docs/INDEX.md`]
- A layout measured before the webfonts decode is a layout that is never painted. [D70] [`docs/INDEX.md`]
- A colour's contrast ratio written into a comment from memory reads as a measurement and is not one. [D54] [`docs/INDEX.md`]
- A jsdom gap can make a whole navigation silently not happen, leaving the assertion to compare the old value. [D55] [`docs/INDEX.md`]
- jsdom has no `BroadcastChannel`, and Node's own, borrowed from inside jsdom's realm, delivers nothing on Node 22.12, so the presenter tests passed on the author's Node and timed out on CI's. [D81]
- `BroadcastChannel` retains nothing, so a subscriber that arrives after the last message hears silence, and a test that arranges the favourable ordering cannot see the defect. [D86]
- Node 18 and later resolve `localhost` verbatim, so a dev server bound to `::1` looks dead to a browser that resolves `localhost` to `127.0.0.1`. [D10]
- The locale lives in module scope, so unmounting proves nothing about a reload; the reload test re-imports the module after `vi.resetModules()`. [D11]
- Two mechanisms for one rule leave one of them untested, and the untested one is whichever the test does not name. [D64]

## 7. History

**Binding decisions:** D-03.

**Specs and plans:** `2026-09-15-04-labs-shells-hardening.md`, `2026-09-15-scene-graph-studio-contracts.md`.

| Deviation | Effect | Role |
|---|---|---|
| D3 | Task 15 (Vite frontend) not executed | primary |
| D9 | Node 22 prerequisite met; Task 15 unblocked | secondary |
| D10 | Vite pinned to IPv4 | primary |
| D11 | the frontend is verified by test, not by browser screenshot | primary |
| D12 | `npm run ci` now ends with the frontend build | secondary |
| D14 | `npm start` spawns Vite's bin directly, not `npm run dev` | secondary |
| D22 | the plan's draw-mode tests could not run, and one of them passed anyway | secondary |
| D26 | the plan's lab URL cannot round-trip a built graph | secondary |
| D28 | MDX compiles a module to one component, not to a step sequence | secondary |
| D52 | the router no task mounts, mounted here | primary |
| D53 | the study shell the plan names and no task creates, and what `App` became | primary |
| D54 | the accent colour that failed the ratio its own comment claimed | primary |
| D55 | jsdom's `AbortSignal` is not the `Request` constructor's, so no navigation happened | primary |
| D56 | presenter notes are declared in three places and carried in none | secondary |
| D57 | presenter notes: one locale per file, and the lint that holds them parallel | secondary |
| D58 | Space is two keys, and the presenter button proved it | primary |
| D59 | the presenter window times its own session, and says so | primary |
| D62 | persistence, and the one module that was already writing to `localStorage` | primary |
| D63 | the quiz is generated, and what that means it cannot ask | primary |
| D64 | a second mechanism for one rule, and the mutation that found it | primary |
| D65 | progress is recorded by both shells, and only moves forward | primary |
| D66 | the export, and the two things it refuses to do | primary |
| D67 | the keypress the browser lost and no unit test could | primary |
| D68 | one key, two encodings | primary |
| D70 | three readings of one KaTeX block, two of them wrong in opposite directions | primary |
| D71 | 25 slides of 92 run past the bottom of an XGA panel (accepted) | primary |
| D81 | four tests that passed on the author's Node and failed on CI's | primary |
| D86 | the presenter window waited for ever, and check 8 asserted that it should | primary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | secondary |
| D103 | the checks D102 left open: every golden vector's warnings, and the locales' placeholders | secondary |
| D104 | the review of the open checks: two warnings no vector raised, and five minors | secondary |
| D117 | M0's lab and checkpoint moved to s16 and s17, and what the demos' steps leave unrecorded | secondary |
| D119 | `remark-mdx-frontmatter` 6.0.0, which clears the last runtime-dependency advisory | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D123 | the dev server serves data/ across drives, F2 draws its edges, and devdata declares data/ | secondary |
| D127 | the frontend on GitHub Pages and the backend on Render | secondary |

## 8. Open items

1. Locale sync between windows needs storage; where storage is blocked, each window keeps its own locale. [D122]
2. An answer given before its card is due is not counted, and nothing on screen says so. [D122]
3. A predicate can be rewritten into a synonym, `near` into `next to`; the checkpoint graph holds no such pair. [D122]
4. The browser's Back button restores each history entry's own query, so a knob turned on a playground's second part is not seen on Back to its first: recorded, not changed. [D96]
5. Contracts §2.3 says a version bump discards stored state and says so once in the interface. `persist` discards a value of another version without any notice, and no interface text announces it; every slot is still at version 1. [contracts §2.3] [`system/frontend/src/store/persist.ts`]
6. PRD §6.1 names a left chapter rail. The study shell renders one column with no rail, and no record states that the rail was dropped. [PRD §6.1] [`system/frontend/src/shells/study/StudyShell.tsx`]
7. PRD §6.6 names export of any figure to SVG or PNG. The export offers JSON and SVG, and no record states that PNG was dropped. [PRD §6.6] [`system/frontend/src/export/ExportButtons.tsx`]
8. The presenter button opens `/lecture/notes`, an absolute path that does not carry the base `SGS_BASE` sets for the hosted build, and no record states how the hosted presenter window is reached. [D127] [`system/frontend/src/shells/lecture/LectureShell.tsx`]
