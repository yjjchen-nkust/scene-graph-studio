# S14 Checks and instruments

## 1. Purpose and boundary

S14 holds the checks the project is verified by and the instruments they run on: the npm scripts and the eleven-step gate, the vitest and Playwright configurations, the end-to-end specs, the four checks the gate does not run, the two interpreter resolvers, the server and port helpers, the dependency-pin check, the coverage test of the subsystem index and the line-ending attributes. It owns how a check runs and what it can and cannot see, not the rule each step enforces: parity is S1's, the content lint S6's, the frozen-page validators S8's, and the workflow that runs the gate on a runner is S16's.

## 2. Code and data

| Path | Role |
|---|---|
| `system/package.json` | Workspace root and the npm scripts, including npm run ci |
| `system/package-lock.json` | Lock file of the workspace |
| `system/.gitignore` | Ignore rules under system/ |
| `system/vitest.config.ts` | Vitest projects and the filesystem allow list |
| `system/playwright.config.ts` | Playwright configuration: check 8 over the production build, and the offline and perf specs when their checks name them |
| `system/e2e/` | End-to-end specs: lecture, offline, perf, projector |
| `system/tools/package.json` | Declares the tools directory as CommonJS |
| `system/tools/perf_check.mjs` | NFR-8 cold start and input-to-paint check |
| `system/tools/offline_check.mjs` | Offline check with a torch-free interpreter |
| `system/tools/servers.mjs` | Stops a started server with its process tree, and refuses a held port |
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
| `.gitattributes` | LF pins for the generated brief files, and `-text` under the CI fixture |

## 3. Interfaces

**Provides:**

- `npm run ci` and every other script of `system/package.json`, through which each subsystem's tool is run: the gate's eleven steps, `test:e2e`, `check:offline`, `check:perf`, `check:pins`, `start`, `setup`, `fixture:refresh`, `data:fetch` and `data:pack`. S16's workflow runs `npm run ci`, and so does `deploy.ps1` under `-Gate`.
- `pythonPath` and `pickPython` in `system/tools/py.mjs`, imported by S1 (`system/tools/parity.mjs`) and S16 (`system/tools/start.mjs`); the npm scripts run every Python step as `node tools/py.mjs <args>`.
- `portFree` and `stopTree` in `system/tools/servers.mjs`, imported by S16 (`system/tools/start.mjs`).
- `Resolve-ProjectPython` in `system/tools/Resolve-Python.ps1`, dot-sourced by S16 (`start.ps1`) and S15 (`fetch-data.ps1`).
- `system/backend/scripts/check_pins.py`, which S16's `start.ps1` runs on the shared environment of D121.
- Three vitest projects: `metrics` over the tests under `system/packages/`, `tools` over `system/tools/test/`, and `frontend` over `system/frontend/test/` and the tests beside the components under `system/frontend/src/`.

**Consumes:**

- S1 (`lint:parity` runs `system/tools/parity.mjs`; `build:metrics` compiles `system/packages/sgg-metrics/`).
- S2 (`system/tools/offline_check.mjs` and `system/tools/perf_check.mjs` start `uvicorn app.main:app` in `system/backend/` and poll `/api/health`).
- S3 (`system/tools/offline_check.mjs` and the `setup` script run `system/backend/scripts/make_placeholders.py`).
- S4 (`system/backend/scripts/check_pins.py` and `system/backend/tests/test_pins.py` read `system/backend/requirements-infer.txt`).
- S6 (`system/vitest.config.ts` imports `mdxPlugin` from `system/mdx.plugin.ts`; `harvest` and `lint:content` run `system/tools/harvest.mjs` and `system/tools/content_lint.mjs`).
- S8 (`lint:frozen`, `build:standalone` and `lint:standalone` run `system/tools/audit.js`, `system/tools/check.js`, `system/tools/build_standalone.mjs` and `system/tools/test/standalone.check.mjs`).
- S10 (`system/vitest.config.ts` names `system/frontend/test/setup.ts` as the frontend project's setup file; `system/playwright.config.ts` builds the frontend and serves it with `vite preview`; `lint:i18n` runs `system/tools/i18n_parity.mjs`).
- S15 (`system/vitest.config.ts` imports `dataDirectory` from `system/data.dir.ts`; `system/tools/offline_check.mjs` seeds its scratch directory from `data/`; `system/e2e/lecture.spec.ts` and `system/e2e/projector.spec.ts` read `data/demos/m0/` through the link; `fixture:refresh`, `data:fetch` and `data:pack` run `system/tools/fixture.mjs` and `system/backend/scripts/data_bundles.py`).
- S16 (the `start` script runs `system/tools/start.mjs`).

## 4. Current rules

1. One command defines green: `npm run ci`, run from `system/`. [D-15] [`system/package.json`]
2. The gate runs eleven steps, in this order: 1 `harvest`, 2 `test:py`, 3 `build:metrics`, 4 `test:ts`, 5 `lint:py`, 6 `lint:parity`, 7 `lint:i18n`, 8 `lint:content`, 9 `lint:frozen`, 10 `lint:standalone`, 11 `build:frontend`. D107 removed `lint:mockup` and made it eleven; D-15's note of 2026-09-19 counts twelve, before that removal. [D107] [D-15] [`system/package.json`]
3. The metrics build runs before parity, because `system/tools/parity.mjs` imports the compiled engine and not its TypeScript source. [D2] [`system/package.json`]
4. The gate ends with the frontend build, `tsc -b` and `vite build`, because vitest transpiles without type-checking and a type error would otherwise pass. [D12] [`system/package.json`]
5. Step 5 runs ruff over `backend` and `tools`, all the Python in the repository, not over `backend` alone. [D79] [`system/package.json`]
6. Step 2 runs pytest on the resolved interpreter, `node tools/py.mjs -m pytest backend/tests -q`; `system/backend/pyproject.toml` sets `pythonpath = ["."]` and `testpaths = ["tests"]`, and the workspace root has no `pytest.ini`. [D8] [`system/backend/pyproject.toml`] [`system/package.json`]
7. Four checks run outside the gate: `npm run test:e2e` (check 8), `npm run check:offline` (check 6), `npm run check:perf` (NFR-8) and `npm run check:pins`. [VERIFICATION §6] [VERIFICATION §8] [VERIFICATION §10] [VERIFICATION §32] [`system/package.json`] [`CLAUDE.md`]
8. A check that was not run is recorded as not run, never as passed because something resembling it passed. [D69] [`2026-09-15-04-labs-shells-hardening.md`]
9. Node 22.12 or later is a hard prerequisite, declared in `system/package.json`'s `engines`; the author's Node is 24.19.0. [D-03] [D9] [`system/package.json`]
10. The gate must pass on Node 22.12 as well as on the author's Node: the workflow keeps 22.12 because D-03 states it as the floor, and four presenter tests once passed on 24.19 and failed on 22.12. [D81] [D126]
11. `system/tools/package.json` declares `"type": "commonjs"`, so the CommonJS validators there run under a workspace root that declares `"type": "module"`; a `.mjs` file in the same directory is an ES module by its extension. [D7] [`system/tools/package.json`] [`system/package.json`]
12. npm 11 blocks install scripts, so `system/package.json` records esbuild's approval under `allowScripts`. [D9] [`system/package.json`]
13. `system/package.json` overrides `@xmldom/xmldom` to 0.9.12; its one consumer is `system/tools/build_standalone.mjs`, and the standalone regenerated after the override was byte-identical. [D73] [`system/package.json`]
14. vitest stays on major 3: vitest 5 passed the suite but broke `@testing-library/jest-dom`'s type augmentation under `tsc -b`, and was reverted. [D73] [`system/package.json`]
15. The frontend depends on `remark-mdx-frontmatter` 6.0.0, which parses TOML with `smol-toml` in place of `toml`; with it, `npm audit --omit=dev` reported no vulnerability. [D119]
16. `system/vitest.config.ts` defines three projects, whose include patterns are relative to `system/`: `metrics`, node, over `packages/**/test/**/*.test.ts`; `tools`, node, over `tools/test/**/*.test.mjs`; and `frontend`, jsdom, over `frontend/test/**/*.test.{ts,tsx}` and `frontend/src/**/*.test.{ts,tsx}`, with `system/frontend/test/setup.ts` as its setup file. A component's test lives beside the component, and a `.ts` test under `system/frontend/src/` is collected. [D20] [D43] [`system/vitest.config.ts`]
17. The `frontend` project uses the build's own MDX plugin, `system/mdx.plugin.ts`, so a module cannot typeset under vitest and fail in the build, and pins esbuild's `jsx: 'automatic'`, since the root has no tsconfig declaring `jsx`. [D28] [D11] [`system/vitest.config.ts`]
18. The `frontend` project's `server.fs.allow` lists `..` and the real path of `data/` that `dataDirectory()` returns: a list replaces Vite's defaults, `..` covers the root those defaults allowed, and Vite's guard checks real paths, so the link alone would be denied. [D110] [`system/vitest.config.ts`] [`CLAUDE.md`]
19. Every Python step names its interpreter through `system/tools/py.mjs` (the npm scripts and the Node tools) or `system/tools/Resolve-Python.ps1` (the PowerShell scripts), which apply one order: `SGS_PYTHON`, an activated environment named `py12`, `py12` on disk (`PY12_HOME` first, then `WORKON_HOME`, the per-user locations and, on Windows, three machine-wide ones), and only then the interpreter on PATH. [D80] [D83] [`system/tools/py.mjs`] [`system/tools/Resolve-Python.ps1`]
20. Where no `py12` is found, `system/tools/py.mjs` falls back to `python` on Windows and `python3` elsewhere, with a warning, while `system/tools/Resolve-Python.ps1` lists the environments it finds and lets the user choose one, and in a session that cannot prompt chooses none and asks for `-Python` or `SGS_PYTHON`. [D80] [`system/tools/py.mjs`] [`system/tools/Resolve-Python.ps1`]
21. `pickPython` takes the platform as an argument and offers the machine-wide candidates on Windows only, so on a POSIX runner the fallback is reached and `SGS_PYTHON` names the interpreter; `system/tools/test/py.test.mjs` runs its cases against both platforms from either host. [D83] [VERIFICATION §14] [`system/tools/py.mjs`]
22. `npm run check:offline` does not use the resolver: it needs an interpreter where `torch` is not importable, takes it from `--python` (`python` on PATH by default) and refuses to continue when `torch` is importable from it. [D80] [VERIFICATION §12] [`system/tools/offline_check.mjs`]
23. Both `check:offline` and `check:perf` resolve an interpreter given as a path to an absolute path, since the backend is spawned with `cwd: 'backend'`, and leave a bare name to PATH. [D77] [`system/tools/offline_check.mjs`] [`system/tools/perf_check.mjs`]
24. `check:offline` arranges check 6's three conditions: the backend runs on the torch-free interpreter; `SGS_DATA_DIR` and `SGS_CORPUS_ROOT` point into a scratch directory seeded from `data/` with the golden vectors, the content, the VLM transcripts, the predictions, the mini-ISG files, `data/LICENCES.md` and the slices' JSON files over empty image directories, and a placeholder slice generated there; and Playwright aborts every request to another origin and records the attempt, so the run fails on the attempt. [VERIFICATION §6] [D84] [`system/tools/offline_check.mjs`]
25. `check:perf` starts a backend on the project interpreter against the repository's own `data/`, on port 8112 unless `--port` moves it, and runs `system/e2e/perf.spec.ts`, which the default Playwright run excludes. [VERIFICATION §10] [`system/tools/perf_check.mjs`] [`system/playwright.config.ts`]
26. It measures cold start against a 10 s budget on five routes, each in a fresh browser context, and input-to-paint against a 100 ms budget on five labs, sixteen playgrounds and two demos. L4, L5 and L6 are not timed: two of them start a request, and L6 has no control. [D74] [D111] [VERIFICATION §10] [`system/e2e/perf.spec.ts`]
27. Input-to-paint is calibrated by an idle two-frame wait measured on the same page, and a figure at or below that floor is reported as below the floor, never clamped to zero. [D74] [D91] [VERIFICATION §15] [`system/e2e/perf.spec.ts`]
28. The perf spec also holds the real-browser half of D75: a click at the centre of a box selects it. [D75] [VERIFICATION §10]
29. `system/playwright.config.ts` runs the specs in Chromium, one worker, over the production build served by `vite preview` on 127.0.0.1:4173, and starts no backend; `system/e2e/offline.spec.ts` runs only under `SGS_OFFLINE` and `system/e2e/perf.spec.ts` only under `SGS_PERF`, which the two checks set. [VERIFICATION §8] [`system/playwright.config.ts`] [`system/tools/offline_check.mjs`] [`system/tools/perf_check.mjs`]
30. `system/e2e/projector.spec.ts` repeats the lecture at 1024×768, 1280×800 and 1920×1080 and writes screenshots at each, under Playwright's test-results directory, which `system/.gitignore` ignores. [VERIFICATION §8] [`system/e2e/projector.spec.ts`] [`system/.gitignore`]
31. The projector suite seeds 繁體中文, so English is held to the panel only where a test names it. [D95] [D96] [D117] [`system/e2e/projector.spec.ts`]
32. Its contrast instrument resolves each colour by painting it to a 1×1 canvas after two different priming colours, so a value that fails to parse is reported rather than read as black; it composites alpha, walks every descendant of the slide except KaTeX's MathML copy, and asserts that the list of elements it could not read is empty before it judges a ratio. [D88] [D91] [`system/e2e/projector.spec.ts`]
33. Its row-count floors are set per step, below the rows measured, and not as one fixed minimum. [D91] [D111] [`system/e2e/projector.spec.ts`]
34. `check:offline` and `check:perf` refuse a held backend port, 8111 and 8112 by default, or the preview port 4173, before they start anything; a port is free only when a bind on 127.0.0.1 succeeds and a connection there is refused. [D122] [`system/tools/servers.mjs`]
35. A started backend is stopped with its whole process tree, by `taskkill /pid <pid> /T /F` on Windows and `kill()` elsewhere, because on Windows the backend is three processes and ending the launcher left the server on its port. [D122] [`system/tools/servers.mjs`]
36. `system/backend/requirements.txt` pins every requirement with `==` at the version installed in the interpreter the suite runs on, and lists no `torch`. [VERIFICATION §11] [D82] [`system/backend/requirements.txt`]
37. `system/backend/scripts/check_pins.py` refuses a requirement line without `==`, skips pip options, requires every pin of `system/backend/requirements.txt` to be installed and equal, and tolerates absence in `system/backend/requirements-infer.txt` but not a different version. [VERIFICATION §11] [VERIFICATION §13] [`system/backend/scripts/check_pins.py`]
38. A pin without a local version segment accepts any build; a pin that states one, such as `+cu128`, is compared exactly. [D82] [VERIFICATION §13] [`system/backend/scripts/check_pins.py`]
39. `system/backend/tests/test_pins.py` makes the same comparisons inside step 2, so a drift fails the gate; `npm run check:pins` prints them. [VERIFICATION §11] [`system/backend/tests/test_pins.py`]
40. `.gitattributes` pins `docs/brief.standalone.html` and `system/web/brief/index.html` to LF and unsets `text` under `fixtures/data`, whose bytes are compared and hashed. Why generated files are pinned to LF is a cross-cutting rule, stated on the map. [D125] [`.gitattributes`] [`docs/subsystems/README.md`]
41. `system/tools/docs_index.mjs` holds the subsystem index to eight rules, each a function of the documents' text, which it normalises from CRLF to LF first. [`2026-10-08-subsystem-index-design.md`] [`system/tools/docs_index.mjs`]
    - R1: every `## D<n>` heading of `DEVIATIONS.md` is cited by some page. A deviation citation is `D` and one to three digits, neither preceded by a letter, digit, underscore, colon or hyphen nor followed by a letter, digit, underscore or hyphen, so `kp:D1`, D-T and `3D` are not citations.
    - R2: every `## <n>. ` heading of `docs/VERIFICATION.md` is cited by some page as `VERIFICATION §` and its number.
    - R3: every `.md` file under `docs/superpowers/specs/` and `docs/superpowers/plans/` is cited by some page, as a backticked token whose last segment is the dated file name.
    - R4: every `## D-<nn> ` heading of the decisions document is cited by some page or by the map.
    - R5: every citation on a page resolves: each deviation, decision, verification section, spec or plan name, and each `contracts`, `SRS`, `design` or `PRD` section, whose id must head a section of level 2 to 4 in that document of 2026-09-15.
    - R6: every backticked token that begins `system/`, `fixtures/`, `docs/`, `.github/`, `.claude/` or `data/` names a path that exists, once a trailing slash and a `:n` or `:n-m` suffix are stripped; paths under `data/` and tokens holding `*`, `…`, `<` or a space are exempt, and a path outside those six prefixes is not checked.
    - R7: every file `git ls-files -z` lists, outside `docs/`, `CLAUDE.md`, `README.md` and `DEVIATIONS.md`, begins with some prefix of the map's ownership table; a prefix that is empty or the root, is listed twice, or matches no tracked file is refused.
    - R8: each page's first non-empty line begins `# S<n> `, with n read from its file name, and the page carries the eight section headings, each a line of its own, in order.
42. The coverage test runs in vitest's `tools` project, step 4 of the gate, as `system/tools/test/docs_index.test.mjs`: one fixture case per rule, the parser cases, and a last block that runs all eight rules over the repository. Run as `node tools/docs_index.mjs` from `system/`, it prints each problem and the count, and exits 1 on any. [`2026-10-08-subsystem-index-design.md`] [`system/tools/test/docs_index.test.mjs`] [`system/tools/docs_index.mjs`]

## 5. Verification

**Records:** VERIFICATION §6, VERIFICATION §8, VERIFICATION §10, VERIFICATION §11, VERIFICATION §12, VERIFICATION §13, VERIFICATION §14, VERIFICATION §15, VERIFICATION §32.

**`npm run ci` steps:** all eleven are S14's definition in `system/package.json`. Of S14's own tests, 2 pytest runs `system/backend/tests/test_pins.py`; 4 vitest's `tools` project runs `system/tools/test/py.test.mjs`, `system/tools/test/servers.test.mjs` and `system/tools/test/docs_index.test.mjs`; 5 ruff lints the Python under `system/backend/` and `system/tools/`.

**Outside `ci`:** S14 owns all four. `npm run test:e2e` runs `system/e2e/lecture.spec.ts` and `system/e2e/projector.spec.ts`; `npm run check:offline` runs `system/e2e/offline.spec.ts`; `npm run check:perf` runs `system/e2e/perf.spec.ts`; `npm run check:pins` runs `system/backend/scripts/check_pins.py`. Their last recorded run together, on 2026-10-01, gave 107 passed, 9 passed, 33 passed, and 9 of 9 required and 5 of 5 optional pins in agreement. [VERIFICATION §32]

**What the records measure.** §6 is check 6 as `system/tools/offline_check.mjs` arranges it. §8 is the lecture rehearsal at three resolutions, the three defects it found and the contrast measured as painted. §10 is NFR-8's first measurement, with the calibration of the two-frame floor. §11 compares the pins with the interpreter, §12 records the interpreter every check runs on, and §13 the CUDA build of `torch` and the asymmetric comparison of a local segment. §14 is the gate red on the runner for five pushes while green on the author's machine, and its fix (D83, D84). §15 is the contrast instrument's blind spot and NFR-8 on the M0 playgrounds. §32 is the last recorded run of the gate and all four checks.

## 6. Traps

- A contrast instrument that parses one colour syntax silently skips every element written in another, and reports a pass over the quarter of the slide it could read. [D88] [`docs/INDEX.md`]
- An instrument's skip list can only report what its loop reaches, so a tag allowlist is a second silent skip hiding behind the report that was added to end the first. [D91] [`docs/INDEX.md`]
- A canvas keeps its previous `fillStyle` when handed a colour it cannot parse, so priming with black scores every unresolvable colour as the highest contrast on the slide. [D91] [`docs/INDEX.md`]
- Clamping a difference between two noisy samples at zero turns "below the resolution" into an apparent measurement of none. [D91] [VERIFICATION §15]
- A pin that no longer matches the interpreter still reads as a version somebody tested. [VERIFICATION §11] [`system/backend/tests/test_pins.py`]
- A module that reads `process.platform` at its top, and `node:path`'s host-flavoured `join`, can only be asserted on the host the test runs on, so the surroundings are made an argument rather than a second machine added. [D83] [VERIFICATION §14]
- Three documents quoting the same measurement give three different numbers unless something compares them to a run. [VERIFICATION §14]
- An error printed by a green gate on every run teaches the reader to skip errors in that log, and a guard that fires on an ordinary developer action has its next red run read as noise and waved through. [D85] [D78]
- The line-ending traps, a generated file that leaves `git status` dirty after a green run with `git diff` empty, and a Python generator that writes CRLF whatever `.gitattributes` says, are cross-cutting and stated on the map. [D89] [D91] [`docs/subsystems/README.md`]
- `server.fs.allow` in vitest's `frontend` project replaces Vite's defaults rather than adding to them, and removing it fails six suites at collection with an error that names neither the configuration nor the cause. [`CLAUDE.md`] [`system/vitest.config.ts`]
- The design document's ARM64/Snapdragon hardware table describes the teaching machine, not the development machine; it is marked superseded in place, and D-04 pins the versions the build targets. [D-04] [`CLAUDE.md`] [`2026-09-15-scene-graph-studio-design.md`]
- Numbering an appended entry without reading the end of the file collides with what is there: D88 was planned as D87, and D102 was written as D101 on its branch. [D88] [D102] [`docs/INDEX.md`]

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

1. `.gitattributes` calls `build_standalone.mjs --check` step 11 of the gate; in `system/package.json`'s `ci` script, `lint:standalone`, which runs it, is step 10 of eleven since D107. [`.gitattributes`] [`system/package.json`] [D107]
2. D-04 lists `fastapi 0.136.1`, `uvicorn 0.46.0`, `pydantic 2.13.3`, `pillow 12.2.0` and `pytest 9.0.3` as the pinned versions. `system/backend/requirements.txt` pins 0.135.1, 0.41.0, 2.12.5, 12.0.0 and 9.0.2, the interpreter's versions to which VERIFICATION §11 moved the file, and D-04 carries no note of it. [D-04] [VERIFICATION §11] [`system/backend/requirements.txt`]
3. The master plan's global constraints give Python 3.12.10, AMD64; D80 records `py12` as Python 3.12.3, and no record reconciles the two. [`2026-09-15-00-master.md`] [D80] [VERIFICATION §12]
4. A comment in `system/tools/offline_check.mjs` says that `py12` carries `torch` 2.9.1+cpu; VERIFICATION §13 records `py12` at 2.10.0+cu128. [VERIFICATION §13] [`system/tools/offline_check.mjs`]
5. NFR-8 has been measured on the author's machine only. D-02 makes the ARM64 machine the ship target, and running `npm run check:perf` there is left to the author. [VERIFICATION §10] [D-02]
6. Check 6 has not been run on a machine that never held the corpora; on the machine it ran on, the network was up and nothing was fetched because nothing was attempted. [VERIFICATION §6]
7. The preview port 4173 is fixed in `system/playwright.config.ts` and cannot be moved. Left open by D122. [D122] [`system/playwright.config.ts`]
8. D73 left the moderate advisories in `vitest` and `@vitest/mocker`, whose fix is vitest 5; D119 measured `npm audit --omit=dev` only, and no record states them closed. [D73] [D119]
9. D-24 leaves open whether D-15's path filter and its sentence "The workflow is a second opinion, not the gate" still hold; S16's open items carry the question. [D-24] [D-15]
