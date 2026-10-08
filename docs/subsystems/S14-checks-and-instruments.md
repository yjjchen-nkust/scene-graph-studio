# S14 Checks and instruments

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/package.json` | Workspace root and the npm scripts, including npm run ci |
| `system/package-lock.json` | Lock file of the workspace |
| `system/.gitignore` | Ignore rules under system/ |
| `system/vitest.config.ts` | Vitest projects and the filesystem allow list |
| `system/playwright.config.ts` | Playwright configuration for the keyboard walkthrough |
| `system/e2e/` | End-to-end specs: lecture, offline, perf, projector |
| `system/tools/package.json` | Declares the tools directory as CommonJS |
| `system/tools/perf_check.mjs` | NFR-8 cold start and input-to-paint check |
| `system/tools/offline_check.mjs` | Offline check with a torch-free interpreter |
| `system/tools/servers.mjs` | Starts and stops servers, and refuses a held port |
| `system/tools/py.mjs` | Resolves the Python interpreter for Node tools |
| `system/tools/Resolve-Python.ps1` | Resolves the Python interpreter for PowerShell |
| `system/tools/docs_index.mjs` | Coverage rules R1 to R8 of the subsystem index |
| `system/tools/test/py.test.mjs` | Tests of the interpreter resolution |
| `system/tools/test/servers.test.mjs` | Tests of server handling |
| `system/tools/test/docs_index.test.mjs` | Tests of the subsystem index rules |
| `system/backend/scripts/check_pins.py` | Compares requirement pins to the interpreter |
| `system/backend/tests/__init__.py` | Package marker of the backend tests |
| `system/backend/tests/test_pins.py` | Tests of the dependency pins |
| `system/backend/pyproject.toml` | Backend tool configuration |
| `system/backend/requirements.txt` | Pinned backend requirements |
| `.gitattributes` | Line-ending pins for generated files |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §6, VERIFICATION §8, VERIFICATION §10, VERIFICATION §11, VERIFICATION §12, VERIFICATION §13, VERIFICATION §14, VERIFICATION §15, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-03, D-04, D-15.

**Specs and plans:** `2026-09-15-00-master.md`, `2026-09-15-04-labs-shells-hardening.md`, `2026-09-15-scene-graph-studio-design.md`, `2026-10-08-subsystem-index-design.md`, `2026-10-08-subsystem-index.md`.

| Deviation | Effect | Role |
|---|---|---|
| D2 | `system/tools/parity.mjs` reads compiled output, not `.ts` | secondary |
| D3 | Task 15 (Vite frontend) not executed | secondary |
| D7 | `system/tools/` scoped back to CommonJS | primary |
| D8 | `pytest.ini` not added at the workspace root | primary |
| D9 | Node 22 prerequisite met; Task 15 unblocked | primary |
| D11 | the frontend is verified by test, not by browser screenshot | secondary |
| D12 | `npm run ci` now ends with the frontend build | primary |
| D15 | the mockup rendered a blank page, and nothing caught it | primary |
| D18 | `pyarrow` enters the backend, outside the evaluation engine | secondary |
| D20 | component tests live beside the component | primary |
| D28 | MDX compiles a module to one component, not to a step sequence | secondary |
| D43 | three of plan 04 Task 1's four assertions could not hold as written | secondary |
| D67 | the keypress the browser lost and no unit test could | secondary |
| D68 | one key, two encodings | secondary |
| D69 | check 6 is recorded as not run | primary |
| D70 | three readings of one KaTeX block, two of them wrong in opposite directions | secondary |
| D71 | 25 slides of 92 run past the bottom of an XGA panel (accepted) | secondary |
| D73 | the audit, reduced to what actually cannot be fixed | primary |
| D74 | NFR-8 was the one requirement with no enforcer, and the instrument reported itself | primary |
| D75 | a box is clickable on its outline only, and widening it has a cost | secondary |
| D77 | the offline check could not be run the way its own usage note says to run it | primary |
| D78 | the licence guard fired on a virtual environment | secondary |
| D79 | `ruff` was in the gate for half the Python in the repository | primary |
| D80 | every Python step now names its interpreter: the `py12` environment | primary |
| D81 | four tests that passed on the author's Node and failed on CI's | secondary |
| D82 | the GPU was there the whole time; the interpreter had the CPU wheel | primary |
| D83 | seven tests that passed on the author's OS and failed on CI's | primary |
| D84 | the suite was red in the configuration where the adapters are actually tested | secondary |
| D85 | a passing gate that printed an error on every run | primary |
| D86 | the presenter window waited for ever, and check 8 asserted that it should | secondary |
| D88 | the three M0 playgrounds, and the four things building them decided | secondary |
| D89 | the gate left the tree dirty on every green run | primary |
| D90 | the eight minor findings the review deferred | secondary |
| D91 | the instrument rewritten to stop skipping silently, which still did | primary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | secondary |
| D95 | the review of the day's merges: F6's status under its clip, and what surrounded it | secondary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | secondary |
| D97 | M2's playground, F3, and three statements about IoU the sources contradict | secondary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D102 | the five minors D100's review deferred, settled | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | secondary |
| D107 | the static UI mockup removed, at the author's request | primary |
| D109 | all of `data/` on the NAS, and none of it in git | secondary |
| D110 | `data/` a link to the NAS, and no data file in the checkout | secondary |
| D111 | M5's playgrounds, T1 and T2 | secondary |
| D116 | the demos draw lists, numbers and one expert at a time | secondary |
| D117 | M0's lab and checkpoint moved to s16 and s17, and what the demos' steps leave unrecorded | secondary |
| D119 | `remark-mdx-frontmatter` 6.0.0, which clears the last runtime-dependency advisory | primary |
| D121 | `start.ps1` runs on WekaExt's `.venv`, not on `py12` | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |
| D128 | data shared through Google Drive with `gdown`, beside the devdata link | secondary |

## 8. Open items

DRAFT
