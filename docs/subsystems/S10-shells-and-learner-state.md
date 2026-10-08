# S10 Shells and learner state

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/` | Frontend package: configuration, entry point, shells, store, assessment, export, i18n |
| `system/frontend/src/pages/Home.tsx` | Home page |
| `system/frontend/src/pages/Status.tsx` | Status page |
| `system/tools/i18n_parity.mjs` | Checks key and placeholder parity between the two locales |
| `system/tools/test/i18n_parity.test.mjs` | Tests that each parity rule fails when disabled |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §7, VERIFICATION §8, VERIFICATION §26, VERIFICATION §27, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** none.

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

DRAFT
