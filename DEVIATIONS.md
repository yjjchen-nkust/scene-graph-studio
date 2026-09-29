# Deviations from plan 01

Recorded as they occur, with the reason. A deviation that is not written down becomes folklore.

## D1 — `test_health_does_not_import_torch` replaced

**Plan:** Task 3's test popped `torch` from `sys.modules` and asserted `/api/health` never
re-imports it.

**Problem:** that contradicts contracts §1.2, which requires the response to carry
`torch_version` and `cuda_available`. Neither is knowable without importing torch once. The
test also crashed rather than failed — re-importing torch after evicting it from `sys.modules`
re-runs its C++ operator registration and raises
`RuntimeError: Only a single TORCH_LIBRARY can be used to register the namespace triton`.

**Resolution:** the requirement that matters is that *importing the application* does not pay
the torch import cost. `test_importing_the_app_does_not_import_torch` asserts exactly that in a
subprocess, and `_torch_state` is `lru_cache`d so the cost is paid at most once per process.
Two further tests were added: a warm-response budget of 50 ms (NFR-8) and a check that the
probe is cached.

## D2 — `system/tools/parity.mjs` reads compiled output, not `.ts`

**Plan:** Task 13's harness imports `system/packages/sgg-metrics/src/index.ts` directly, relying on
Node's type stripping.

**Problem:** type stripping needs Node ≥ 22.6. Node was 20.16.0 when this was written (D-03 not
yet actioned), and pinning the harness to a Node feature is fragile regardless.

> **Note 2026-09-16.** Node is now 24.19.0 on both machines (D9), so type stripping would work.
> The resolution below stands anyway: the second half of the problem was never about the version.

**Resolution:** `npm run build:metrics` runs `tsc -p packages/sgg-metrics/tsconfig.build.json`
to `system/packages/sgg-metrics/dist/`, and `parity.mjs` imports the dist. `typescript` was already a
devDependency, so this adds nothing. `npm run ci` runs the build before the parity step.

## D3 — Task 15 (Vite frontend) not executed

> **Resolved 2026-09-16 — see D9.** Node is 24.19.0 on both machines and Task 15 is done.

**Blocked by D-03 at the time.** `vite@8.3.0` declares `engines: ^20.19.0 || >=22.12.0`; Node was
20.16.0 and no version manager was present. Tasks 1–14 did not need it and were completed.

## D4 — the IoU-at-threshold fixture had to be reconstructed

**Plan:** Task 6's test, and golden vector `gv-006-iou-exactly-at-threshold`, both construct the
boundary case as "two 10×10 boxes offset by 10/3 → IoU exactly 0.5".

**Problem:** it is not exactly 0.5. Measured: `0.4999999999999999`. The fixture therefore tested
the wrong side of an inclusive boundary and failed on first run, which is the fixture working as
intended — it caught itself.

**Resolution:** use containment, which is exact in binary. A 10×20 prediction box holding the
10×10 ground-truth box gives `inter = 100`, `union = 200`, `IoU = 0.5` with no rounding. The test
now asserts `ious == 0.5` exactly rather than within a tolerance, so a future change that moves the
construction off the boundary fails loudly instead of quietly testing something else. A companion
test pins the just-below case to `localization`.

**Carried forward:** golden vector `gv-006` uses the same containment construction. Plan 01
Task 10's table was corrected in place.

## D5 — the validation error handler needed sanitizing, and a dedicated dangling code

**Found by:** `test_dangling_reference_is_422_and_names_the_id` and
`test_an_unknown_k_is_rejected_rather_than_silently_accepted`, both failing with
`TypeError` from `json/encoder.py`.

**Problem:** Pydantic v2's `RequestValidationError.errors()` puts the original exception
**object** in each entry's `ctx`, which `JSONResponse` cannot encode. Every 422 raised by a
model validator therefore crashed into a 500 instead of returning the documented shape — the
exact failure NFR-1 forbids.

**Resolution:** `_clean_errors` stringifies anything that is not a JSON primitive, so the
message survives and the exception instance never leaks. Separately, contracts §1.1 defines
`dangling_reference` as its own code; `_is_dangling` detects the invariant's message and emits
it instead of the generic `schema_invalid`. The plan's Task 3 `errors.py` had neither helper.

## D6 — the five corpus adapters are deliberately not written

> **Partly resolved 2026-09-16.** `vg150-sgb` and `indoorvg` were written once their
> corpora were on disk, which is exactly the condition this entry set. `psg`, `vrd` and
> `haystack` remain unwritten for the same reason as before. See D17.

**Plan:** Task 14 Step 4 lists `adapters/{vg150_sgb,psg,vrd,indoorvg,haystack}.py`.

**Problem:** D-08 has the author downloading the corpora by hand, and none is on disk yet.
Writing five adapters against remembered field names and index conventions would mean guessing
at formats that cannot be run against anything. A guess that typechecks is worse than an
absence, because it looks finished.

**Resolution:** `adapters/__init__.py` defines the `read(root) -> Iterator[SceneGraph]` protocol,
a registry, and a `LAYOUTS` table recording the expected corpus shape per dataset.
`read_dataset` fails with that expectation named and the file to write, rather than with an
`AttributeError`. `cut_slice.py` is complete and exercised; only the format conversion is
pending. Write each adapter against the files actually on disk, with its test, when the corpus
lands.

## D7 — `system/tools/` scoped back to CommonJS

**Found by:** `npm run ci` failing on `lint:frozen` with
`ReferenceError: require is not defined in ES module scope`.

**Problem:** the new root `package.json` declares `"type": "module"`, which retroactively
reinterpreted the two pre-existing validators `system/tools/audit.js` and `system/tools/check.js` — both
CommonJS, both predating this plan — as ES modules. A regression introduced by Task 1.

**Resolution:** `system/tools/package.json` with `{"type": "commonjs"}`. This keeps the invocation the
repository README documents (`node audit.js`) working unchanged; renaming to `.cjs` would have
silently invalidated that documentation. `.mjs` files in the same directory are unaffected,
since the extension wins over the nearest `package.json`.

## D8 — `pytest.ini` not added at the workspace root

**Plan:** implied that `pytest backend/tests -q` needs the root on `sys.path`.

**Finding:** it does not. `system/backend/pyproject.toml` already sets `pythonpath = ["."]`, and pytest
resolves its rootdir to `system/backend/` because that is where the config lives. The documented
command works from the workspace root as written. A root `pytest.ini` was written, observed to
be redundant, and removed rather than left as a second configuration to keep in step.

## D9 — Node 22 prerequisite met; Task 15 unblocked

Node upgraded 20.16.0 -> **24.19.0** LTS, npm 10.8.1 -> 11.17.0, via winget. D-03 is closed
and D3 above is resolved. `package.json` already declared `"engines": { "node": ">=22.12.0" }`,
which 24.19.0 satisfies, so nothing needed editing.

Two consequences of npm 11 worth recording: install scripts are now blocked by default, so
`esbuild` needed `npm approve-scripts esbuild` before Vite would run, and the approval is
recorded in `package.json` under `allowScripts`. A fresh clone will need the same approval, or
`npm ci` in CI will run with scripts already recorded in the lockfile.

## D10 — Vite pinned to IPv4

**Found by:** the dev server answering `curl http://localhost:5173` but showing an error page in
Chrome, while `curl http://127.0.0.1:5173` returned nothing at all.

**Cause:** Node 18+ resolves `localhost` verbatim rather than preferring IPv4, so Vite's default
host bound `::1` only. Chrome resolved `localhost` to `127.0.0.1` and found nothing listening.
The dev server appears dead in the browser while the terminal says it is running -- a trap that
would cost a student the first ten minutes of a lab.

**Resolution:** `server.host: '127.0.0.1'` and `strictPort: true` in `system/frontend/vite.config.ts`,
matching the backend and the proxy target. Both `localhost:5173` and `127.0.0.1:5173` now answer.

## D11 — the frontend is verified by test, not by browser screenshot

**Plan:** Task 15 Step 4 says to open the page and confirm the locale toggle swaps every label
with no reload and survives a refresh.

**Problem:** the Chrome extension has no site permission for `127.0.0.1`, so the page could not
be screenshotted. Chasing the permission would have proved less than a test does.

**Resolution:** `system/frontend/test/App.test.tsx`, seven cases under jsdom, asserting exactly the
claims the step makes: the rendered values come from the backend rather than from constants; a
down backend states a reason with no stack trace; zh-TW is the default; the toggle swaps every
label while `fetch` is called exactly once, proving no remount and no refetch; the preference
survives a **real** reload; and the page still works when `localStorage` throws, as in a private
window. The reload case uses `vi.resetModules()` and re-imports, because the locale lives in
module scope -- unmounting alone would have proved nothing, which is a trap the first draft of
the test fell into.

Two mechanical notes: Testing Library does not auto-clean without Vitest globals, so
`system/frontend/test/setup.ts` calls `cleanup()`; and the root has no tsconfig declaring `jsx`, so the
frontend Vitest project pins `esbuild: { jsx: 'automatic' }` or every render fails with
`React is not defined`.

## D12 — `npm run ci` now ends with the frontend build

`build:frontend` (`tsc -b && vite build`) was added to the gate. A type error in the frontend
would otherwise pass CI, since Vitest transpiles without typechecking.

## D13 — the licence check ran, and PSG cannot be bundled

`data/LICENCES.md` was filled from primary sources on 2026-09-16. Two gates opened
(`vg150-sgb` both, `psg` annotations only) and three datasets stayed shut for want of any
licence statement at all.

The finding that changed the design: **PSG annotations are MIT, PSG images are COCO
photographs, and MIT does not reach through to photographs OpenPSG never owned.** D-08 assumed
one distribution path; the evidence requires two. `system/backend/scripts/fetch_images.py` downloads
by identifier from the source with SHA-256 verification, `MANIFEST.json` records
`distribution: "bundle" | "fetch"` at cut time, and `/api/datasets` reports it.

Decision D-08 carries an amendment block rather than being rewritten, so the original
assumption and the evidence that overturned it both stay readable.

## D14 — `npm start` spawns Vite's bin directly, not `npm run dev`

**Found by:** `Error: spawn EINVAL` on Node 24, and before that a `DEP0190` deprecation warning.

**Problem:** on Windows `npm` is a `.cmd` shim. Node 24 refuses to spawn one without
`shell: true`, and Node 22 deprecates passing arguments *with* `shell: true`. There is no
setting that satisfies both.

**Resolution:** `system/tools/start.mjs` spawns `node_modules/vite/bin/vite.js` with `process.execPath`
and `cwd: frontend/`. A `.js` entry point sidesteps the shim entirely, removes a process from the
tree, and behaves the same on every platform.

**Also added:** `SGS_BACKEND_PORT` and `SGS_FRONTEND_PORT`. A port collision with something
unrelated is one of the commonest ways a first run fails, and without an override a student has
no way to move ours. `system/frontend/vite.config.ts` reads `SGS_BACKEND_PORT` for its proxy target, so
the override reaches both halves; verified end to end on 8020/5190.

## D15 — the mockup rendered a blank page, and nothing caught it

**Reported by the user:** `docs/mockup/index.html` showed nothing.

**Cause:** the bilingual span-swap used `[lang]{display:none}` as its base rule. That selector
also matches `<html lang="zh-TW">`, so `display:none` landed on the root element and hid the
entire document. Toggling to English would have done the same thing a second way, because the
script stamped a bare `lang="en"` on `<html>`.

**Resolution:** scope the rule under `body`, and use `display:revert` to restore each element's
own default rather than forcing `inline` and then patching `p`, `li`, `div` and `td` back with
four more rules.

**Why nothing caught it.** The checks I ran were structural — tag balance, nav targets, bilingual
pair counts, CSS brace balance, JS syntax. Every one passed on a page that rendered nothing,
because none of them rendered it. `system/tools/test/mockup.check.mjs` now loads the file in jsdom,
runs its script, and asserts computed `display` on the root, on both languages before and after
the toggle, and on screen switching. Verified by reintroducing the original selector and
confirming it fails. It runs as `npm run lint:mockup`, inside `npm run ci`.

**The general lesson, recorded because it will recur:** a static page is not verified by parsing
it. Plan 02 builds real components with real CSS, and every one of them needs a rendered
assertion rather than a structural one.

## D16 — two content errors about the anchor paper's ablations

**Found by** reading the anchor paper in full against what we had already committed, rather than
against the specification summaries the earlier sessions worked from.

**Error 1 — the expert-count claim.** `pg.js` `DERIV.L9` and the L9 playground note both said
*N* = 5 experts is "better on both axes" than *N* = 3. True at *k* = 20 only. At *k* = 50,
*N* = 3 leads on mR (25.480 against 24.383); at *k* = 100 it leads on R (30.142 against 30.020).
*N* = 3 is not dominated, so the paper's recommendation rests on more than the token cost the
note attributed it to. Corrected in both languages at three sites.

**Error 2 — Table 3's shape.** `DERIV.L8` and plan 03 both presented the ablation as a four-row
cumulative sequence. It is a five-row factorial over (*O*, *P*, *E*&Analysis), and the omitted
row is *P* alone at 2.079. With it, the finding appears: *O* alone gives 1.787, *P* alone gives
2.079, and together they give 20.792 — superadditive by an order of magnitude. The paper does not
remark on it, and our summary had made it invisible.

**Why no check caught either.** Every number was real and correctly transcribed. Only the
sentences around them were wrong. `audit.js` validates LaTeX and tag balance; `check.js`
validates playground coverage; neither reads a claim. This is the defect class NFR-2 exists for,
and it is the argument for `source_table` on every figure in the paper corpus — a reader can then
check the claim against the table rather than only the number.

**Also fixed:** `system/web/knowledge-map/FROZEN.md` did not exist. D-13 froze the page and plan 02
Task 1 specified the notice, but the file was never written, so the freeze was a decision with no
artefact. It now carries the freeze rule, the `evaluate()` hazard, and an auditable log of
post-freeze corrections — because a frozen page that teaches something false is worse than one
that is merely out of date.

**Plan 03 now commits both tables in full**, with tests asserting five rows in Table 3 and that
`N=5` loses to `N=3` at two of the six cutoffs. A lab showing only the `@20` column would teach
the opposite of what the data says.

## D17 — `cut_slice.py` gets images from the adapter, not only from disk

**Plan:** the cutter copies each chosen image from `root/images/<id>.jpg`.

**Problem:** that assumes a corpus published as loose files. VG150 and IndoorVG are published as
COCO-format parquet with the JPEG embedded in the row, so no such directory exists. The cutter
would have found nothing, written `annotations.json` with a complete graph set and a `MANIFEST`
with zero images, and exited 0. A slice with annotations and no images passes every schema check
in the project and teaches nothing.

**Resolution:** the `Adapter` protocol gains an optional `image_bytes(root, image_id)`. The cutter
asks the adapter first and falls back to the filesystem, so a corpus published as files keeps
working untouched. It now also refuses to finish when the manifest is empty, which is the failure
that would otherwise have been silent.

## D18 — `pyarrow` enters the backend, outside the evaluation engine

**Plan:** the pinned dependency list did not include it.

**Problem:** the two corpora that exist are parquet.

**Resolution:** `pyarrow==23.0.1` added to `backend/requirements.txt`. D-11 constrains
`system/backend/app/eval/` to the standard library and that is unchanged -- the engine imports
nothing new. The adapters are the only consumer, and they are imported lazily so that a machine
without pyarrow loses those two datasets rather than failing to start.

## D19 — two slice tests encoded a state rather than a rule

**Plan:** `test_distribution_mode_is_recorded_not_guessed` asserted
`distribution_mode("vg150-sgb") == "none"`, with the comment "nothing cut yet".

**Problem:** the comment was accurate when written and false the moment a slice was cut. The test
was pinned to whichever dataset happened to be uncut that day.

**Resolution:** each of the three states is now asserted against a dataset genuinely in it --
`placeholder` bundles, `vg150-sgb` fetches, `vrd` has nothing cut.

## D20 — component tests live beside the component

**Plan:** Task 2 puts `MetricReadout.test.tsx` in `frontend/src/components/test/`.

**Problem:** the frontend vitest project included only `frontend/test/**/*.test.tsx`, so the file
was written, was never collected, and the suite stayed green. A test that does not run is worse
than no test, because it reads as coverage.

**Resolution:** the include is now `['frontend/test/**/*.test.tsx', 'frontend/src/**/*.test.tsx']`.
App-level tests stay in `frontend/test/`; component tests sit beside their component, which is
where the rest of plan 02 puts them.


## D21 — PSG annotations describe a corpus larger than the one on disk

**Plan:** the PSG adapter yields every record in `psg.json`, and `cut_slice.py` samples from
what it yields.

**Problem:** `psg.json` covers 48,749 images drawn from COCO train2017 (46,563) and val2017
(2,186). Those are separate downloads, 18 GB and 0.8 GB, and this machine has only the val half.
Sampling 50 from all 48,749 would have selected about 48 records whose photographs are absent.
`cut_slice.py` would then have written 50 graphs into `annotations.json` and about 2 entries into
`MANIFEST.json` — the D17 failure again, but partial, so the empty-manifest guard would not have
fired. The slice would have passed every schema check and taught almost nothing.

**Resolution:** the adapter drops a record whose photograph is not on disk and counts it through
`last_repairs`, the same channel `coco_parquet.py` already used. The distinction it draws is
deliberate: a missing panoptic PNG still yields the scene, without masks, because that is a scene
missing its measurements; a missing photograph yields nothing, because that is a scene missing
itself. `Repairs` moved to `adapters/_repairs.py` so both adapters report one shape.

**Also:** `_segment_masks` was rewritten to walk the pixels once and cut every segment's runs
from the same pass, rather than re-testing every pixel against every segment. Panoptic segments
are mutually exclusive, which is what makes the single pass correct. Measured on the real corpus
this is 0.060 s per image against 0.440 s, and the output was checked byte-for-byte against the
original algorithm on 49 masks across four images before the old one was removed.

## D22 — the plan's draw-mode tests could not run, and one of them passed anyway

**Plan:** Task 3 fires `pointerDown` / `pointerMove` / `pointerUp` at the overlay's `<svg>` and
asserts the box that comes back. Expected: 6 passed.

**Problem:** jsdom 26 implements no `PointerEvent`. Testing Library falls back to a plain `Event`
when the constructor is missing, and a plain `Event` carries no `clientX`, so React handed the
component `undefined` coordinates and no box was ever drawn. Three of the six tests failed.

The fourth is the instructive one. `never emits a zero-area box` **passed**, and would have
passed against an implementation with no zero-area rule at all: it does not stub
`getBoundingClientRect`, so in jsdom the element measures 0 x 0, the scale is `0 / 200`, every
mapped coordinate is infinite and every box is `NaN`. The test read as coverage of a rule it
never reached. This is D19's failure in a different costume — a test that encodes the state of
the harness rather than the rule it names.

**Resolution:** `frontend/test/setup.ts` polyfills `PointerEvent` over `MouseEvent`, which
already carries the coordinates, so the tests exercise the real path instead of the component
being bent to fit a broken harness. The zero-area test now stubs the client rect like its
neighbours, and fails if the rule is removed.

**Also:** Task 3's six tests do not reach the letterbox arithmetic, view mode, clamping, masks,
selection, an unstyled edge, or a dangling relationship, all of which its own Step 3 prose
specifies. Eight tests were added for them. `clientToImage` takes `(event, svg, width, height)`,
per the plan's code block; the two-argument form in its Interfaces header is shorthand and was
never implementable.

## D23 — the graph view cannot draw a missed verdict from the props the contract gives it

**Plan:** Task 4 builds `SceneGraphView` to the props in contracts §2.6, and exports
`buildElements(pred, gt, verdicts, layout)` from `SceneGraphView.tsx`.

**Problem:** contracts §2.6 lists `graph`, `verdicts`, `layout` and two click handlers, with no
ground-truth graph. A `missed` verdict carries `pred_index: -1` and a `gt_index` naming a triplet
in the ground truth, so the one verdict the diff exists to explain — recall — is the one edge the
component cannot draw from what it is given. The plan's own Step 3 passes `gt` to
`buildElements`, so the gap is in the contract, not in the plan.

**Resolution:** `gt?: SceneGraph` added to the props, optional, and the contract is the thing that
should move. Without verdicts the prop is unused; with them it is what makes ghost edges possible.

**Ghost node identity.** An id means the same object in both graphs under PredCls and SGCls,
where the boxes are given, and does not under SGDet, where they are the model's own. A ghost
attaches to an existing node only when the id *and* the first name agree, and otherwise gets its
own `gt<id>` node. The failure that rule avoids is hanging a ground-truth edge off a predicted
object, which would read as a scored match.

**Also:** `buildElements` moved to `graph/elements.ts`. Exporting it beside the component defeats
Fast Refresh, and the plan's reason for exporting it at all — that the construction be testable
without a mounted Cytoscape — is served better by its own module. The tests import from there.

## D24 — a test that could not fail, written the same night D22 was logged

**Problem:** `cyStyle.test.tsx` first asserted that constructing a headless Cytoscape over the
stylesheet produced no console warning. Measured against the real library, a headless instance is
silent for a misspelt property, an invalid enum value, a malformed selector and an unparseable
colour alike — the stylesheet is not parsed until a renderer asks for it, and `styleEnabled` in
headless mode starts a render loop that never settles. The assertion could not fail. It was caught
by deliberately misspelling `target-arrow-color` and watching a *different* test fail while that
one stayed green.

**Why it matters here:** an unknown property is dropped in silence, so the edge renders in the
default grey and the diff quietly loses the distinction NFR-5 requires it to carry.

**Resolution:** the check now pushes every rule through `cytoscape.stylesheet()`, which is the one
entry point that reports which properties it kept, and fails naming any that were dropped. Arrow
shapes are additionally typed `Css.ArrowShape` rather than `string`, which moves the enum values
from an untestable runtime concern to a compile error. Values other than those remain unchecked,
and the test says so rather than implying otherwise.

**Standing lesson:** a new assertion is not evidence until it has been seen to fail. Both D22 and
this were found by breaking the thing on purpose, and neither would have been found by reading.

## D25 — the image endpoint served the one slice that was synthetic

**Problem:** `/api/datasets/{ds}/images/{id}?include_image=true` read
`data/slices/<ds>/images/<id>.png`, and labelled every response `data:image/png`. `cut_slice.py`
writes `.jpg`, because it copies the bytes the corpus published and every corpus so far publishes
JPEG. The one slice that is PNG is `placeholder`, which is synthetic — and it was the only slice
the test touched. So the endpoint answered 422 for `vg150-sgb`, `indoorvg` and `psg`, which is
every real dataset, while `test_slices.py` stayed green.

Found while wiring L1, which is the first thing that needs a photograph on screen.

**Resolution:** `loader.image_file(ds, image_id)` reads MANIFEST.json, which already records the
file each annotation was cut against together with the sha256 the bundle verifier checks, and
falls back to the known extensions only when there is no manifest. The media type follows the
file rather than being assumed. The test is now parameterised over every dataset with a slice on
the machine and skips the ones absent, so it cannot again be green because it looked at one.

**The shape of this defect is worth naming:** a fixture that is synthetic in the one respect the
code branches on tests the fixture, not the code. That is D19 and D22 again, and all three were
invisible to reading.

## D26 — the plan's lab URL cannot round-trip a built graph

**Plan:** Task 5's URL is `/lab/L1?ds=vg150-sgb&img=2317469&s=1&o=2&p=on`, and contracts §2.2
requires that the query fully determine what the lab shows.

**Problem:** `s`, `o` and `p` describe one selection in progress, not a submitted graph. A student
who builds three triplets and submits has a view that no such URL can reproduce, and the two
states "triplet chosen" and "triplet chosen and scored" render differently while sharing a URL.
The professor's bookmarked diff would come back unscored.

**Resolution:** `t` carries the committed triplets as `1-on-2,3-near-4` — the predicate sits
between the two ids because an id cannot contain a hyphen and a predicate can — and `sub=1`
records that they were submitted. `s`, `o` and `p` keep their meaning as the pending selection.
A value equal to its default is written as an absent key, so a shared link carries only what was
chosen.

**Also:** `t` reaches `studentGraph` from the address bar, so it is user input. A triplet naming
an object the image does not contain is dropped rather than repaired: `SceneGraph` forbids a
dangling reference, and inventing an object to satisfy a hand-edited id would score a claim
nobody made.

**Also:** the pure part moved to `labs/L1/triplets.ts`, as in D23, and `frontend/tsconfig.app.json`
gained `@testing-library/jest-dom` in `types` — `setup.ts` had been registering the matchers at
runtime since plan 01 while the compiler was told they did not exist, so the first use of
`toHaveTextContent` was a build error.

## D27 — the engine does not read `protocol`, so the ordering invariant was untestable

**Plan:** Task 6 asserts SRS §11.2's protocol ordering, `R_SGDet ≤ R_SGCls ≤ R_PredCls`, over the
lab's own fixture, by calling `evaluate` three times with the protocol changed.

**Problem:** neither implementation of the engine branches on `protocol`. It is copied onto every
`MetricValue` as a tag and never reaches `assign()`. Three calls differing only in that field
return the same number three times, so the assertion holds by equality for every fixture, every
model and every prediction — and would go on holding if the ordering were false.

That is not a bug in the engine. In the literature the protocol governs what the model is
*handed*, upstream of scoring, and the same scoring code then runs on what comes back. An engine
that branched on the protocol would be inventing a fourth thing nobody publishes against.

**Resolution:** the protocol is applied to the *prediction*, in `labs/L2/protocol.ts`, before the
engine sees it. SGDet keeps the model's boxes and labels; SGCls hands back the ground-truth boxes;
PredCls hands back boxes and labels both. Correspondence is by `object_id` rather than by overlap,
which is the whole content of PredCls: the model is given the ground-truth object set at the
start and predicts over it. Corresponding by IoU instead would withhold the ground truth from
exactly the badly-placed object PredCls exists to relieve — the one whose box would have failed —
and invert the lesson. That mistake was made and measured first: every protocol read 0.000.

**The fixture is part of the claim.** L2's fixture is built so each step is strict — R@50 under
the graph constraint at τ = 0.5 is 0.25 / 0.50 / 0.75 across the three protocols — and each
invariant is asserted twice: once as the inequality the SRS states, once as a strict inequality
on this fixture. The second assertion is what fails if the transform is deleted. An invariant
that holds because both sides are equal for every input is the D22 and D24 failure again, and
this is the third plan task in a row where the stated assertion could not have failed.

**Also:** `WarningList` was added and wired into both L1 and L2. L1 computed the engine's
warnings and dropped them, which defeats the reason contracts §2.5 makes `gt_boxes_not_pairs`
unconditional on PredCls — that a student cannot see a PredCls number without seeing it. L1 also
counted triplets from the address bar rather than the triplets that would be scored, so a
hand-edited `t` naming a missing object was promised a submission the engine never received.

## D28 — MDX compiles a module to one component, not to a step sequence

**Contract:** §2.4 says "the MDX compiler emits `ModuleStep[]`", and the two shells consume that
array: the study shell renders every step in one column, the lecture shell renders one at a time.

**Problem:** it does not. `@mdx-js/rollup` compiles a document to a single React component plus
its frontmatter. Nothing in the pipeline knows where one step ends. The obvious repairs are both
wrong: splitting the compiled output by heading makes the lecture's step boundaries depend on how
an author happened to format prose, so a translator adding a subheading silently changes the
lecture; and handing the whole body to step 0 with `null` for the rest produces an array of the
right shape that is not a step sequence at all.

**Resolution:** the body marks its own boundaries with `<Step id="s1">`, and the ids are declared
once in the frontmatter where the lint already checks that both locales agree on them. Each
step's `node` renders the same body with a `Step` component that admits only that id, so a step
is genuinely its own React node. The declaration and the marking are checked against each other:
an id in one and not the other renders an empty step, which the registry test would catch.

**Also, the plugin is defined once.** `system/mdx.plugin.ts` is imported by both
`frontend/vite.config.ts` and `vitest.config.ts`. Two copies would be two pipelines, and the
failure that permits is the worst available: a module whose mathematics typesets under vitest and
arrives as dollar signs on the projector.

**Also, an assertion that tested the reverse of its claim.** The first version of
`registry.test.tsx` asserted that the rendered math step's `textContent` does not contain
`\qquad`. KaTeX keeps the original TeX in a MathML `<annotation>`, so that string is present in a
*correctly* typeset formula and absent only if the formula was never parsed. The test now checks
`.katex-html` and `.katex-display` on the rendered side, and that no `$$` survives in the prose.

**Also,** the four-part lint reported a part that was merely out of order as absent, because one
scan searched for each part after the last one found. Presence and order are now two passes. Both
messages were reachable, but only one of them was true.

## D29 — Task 8 Step 1 writes the syllabus into a file the build regenerates

**Plan:** "Fill the `module` field of every record in `data/content/kp.json`. All 93 must be
assigned; `content_lint.mjs` reports the unassigned count, and reaching zero is this step's exit
condition."

**Problem:** `kp.json` is harvest output. `tools/harvest.mjs` rewrites it wholesale from the
frozen page, and `npm run harvest` is the first thing `npm run ci` does. The 93 assignments were
written, the lint was clean, and the next CI run erased all of them and reported 93 unassigned.
The exit condition was reached and then undone by the build, in that order.

**Resolution:** the assignment lives in `data/content/assignment.json`, which the harvest does not
own. Two authorities, two files: the frozen page decides what the knowledge points are, the
curriculum decides who teaches them. The lint also rejects a point assigned to two modules, and an
assignment naming a point the harvest does not produce — either of which would otherwise let the
count reach 93 while being wrong.

**Also, the cluster map is short by two.** Step 1 maps ten of the twelve clusters in `kp.json`.
`P` (Panoptic SGG, 4 points) and `R` (scene graph as representation, 9 points) appear nowhere in
it; PRD §7 places them at M8 and M14, which is where they went. Following the plan literally
would have left thirteen points unassigned and the step unable to finish.

## D30 — global notation cannot survive quoting three papers verbatim

**Spec:** SRS §11.4 says notation is global across modules — a symbol means the same thing in M4
as in M11 — and the content lint rejects a module that reglosses one.

**Problem:** the rule collided with the harvest three times in one sitting, and in each case both
uses arrived inside LaTeX that must not be retyped. `\lambda` is a box-scale ratio in M2's IoU
bound and the frequency-prior mixing weight in M4's FREQ derivation. `E` is the relationship set
of a scene graph from M0 onward, and the set of worked examples in the anchor paper's equation (2).
`N` is the count of ground-truth triplets in M1 and M4, and the number of expert audits in the
anchor paper's equation (3).

None of these is a mistake in the course. They are the literature's own notation, and the modules
quote it because a student who meets the equations in the papers will meet these letters.

**Resolution:** each symbol is glossed once, in the symbol table, at its course-wide use — the
letter's meaning across the corpus. Where a module quotes a paper that spends the same letter
differently, the module states the local meaning in prose at the point of use and the symbol table
stays silent. The lint is unchanged and still rejects two glosses of one symbol, which is what
forced the convention rather than letting it drift.

**The lint earned its place here.** All three collisions were found by it, none by reading, and
the M11 one would otherwise have shipped: the anchor module quotes four equations and a reader
comparing its $N$ with M4's would have had no warning.

## D31 — the lint read the frontmatter more leniently than the build does

**Problem:** `content_lint.mjs` reads the frontmatter with a small reader rather than a YAML
dependency, on the argument that a parser accepting more than the schema allows would accept a
module the schema forbids. It then did exactly what that argument warns against, in the other
direction: it took a double-quoted scalar as its own contents, `text.slice(1, -1)`, with no view
on escapes.

`remark-mdx-frontmatter` parses the same block with a real YAML parser at build time, and there a
lone `\o` is an invalid escape. So `sym: "\omega_p"` linted clean and failed the build with
`YAMLParseError: Invalid escape sequence \o`. Every symbol in this corpus is LaTeX, so the whole
of M5 through M14 was affected the moment they were generated.

**Resolution:** the reader now rejects an escape YAML would reject, and the generator emits
double-quoted scalars with backslashes doubled. Both halves were checked: the corpus lints clean
with the doubling, and removing one backslash from `m06.en.mdx` produces
`invalid YAML escape '\o'`.

**The check was wrong the first time, in an instructive way.** It was a regex with a negative
lookahead, and it reported `\mathcal{P}` — a correctly escaped backslash — as invalid, because on
failing to match at the first backslash it advanced one character and matched at the second. An
escape has to be consumed whole, which a stateless lookahead cannot do. It is now a scan.

**What this says about the lint's design.** A hand-written reader is defensible only while it is
*stricter* than the real parser. Where it is more permissive it is worse than absent, because it
reports clean on content that cannot compile. That asymmetry is the rule to apply to the rest of
the reader if it grows.

## D32 — the tier-A list and D-21 cannot both be satisfied

**Plan:** Task 9 names twelve tier-A methods in advance — IMP, Neural Motifs, VCTree, MOTIFS-TDE,
RelTR, EGTR, SGTR, PSGFormer, PSGTR, HiLo, STTran, IndVisSGG — and asserts each carries at least
one reported number.

**Problem:** decision D-21 says a number is carried only if it was read off the table named beside
it, and that there is no unverified tier. This project has opened three tables: IndVisSGG's
Tables 1–4 through the primary-source reading, Tang et al. Table 1, and KERN's Table 1 as quoted
in the frozen page's own note. It has not opened EGTR's, SGTR's, PSGTR's, HiLo's or STTran's. The
only way to satisfy the list is to carry five numbers nobody checked, which is the thing D-21
exists to forbid.

**Resolution:** tier is a consequence, not a declaration. `tier === 'A'` exactly when
`reported.length > 0`, and the test asserts that equivalence rather than a hard-coded roster. Eleven
cards are tier A today and the rest become tier A when someone opens their table. The curriculum
coverage assertion — every method PRD §7 names has a card — is unchanged and is the one that
matters, because a tier-B card still answers PRD §4's G3 in full.

**A consequence worth stating.** Most of the tier-A numbers are read from IndVisSGG's Table 2,
where they are figures *IndVisSGG reports* for re-implementations of other methods. Every such row
carries `source: indvissgg-2025` and a note saying so, and the test refuses a row whose `source`
has no card. "MOTIFS scored this" and "this paper says MOTIFS scored this" are different claims,
and M11 §9 is about the difference.

**Also, the plan's own two lists disagree.** `TIER_A` contains `motifs-tde` and `required`
contains `tde`; satisfying both would need two cards for one paper. There is one card, `tde-2020`,
for Tang et al. 2020.

## D33 — three smaller corrections to Task 9

**Key format.** The claims written in Task 8 cite `tang-2020-unbiased`, `chen-2019-kern`,
`cong-2021-sttran` and `wang-2025-indvissgg`, in author-year-name form. Task 9's coverage assertion
strips a trailing year and compares against PRD §7's method names, which those keys cannot match.
Every key is now `method-year`, and the four claims were renamed with them.

**`id` against `key`.** `content_lint.mjs` read `papers.json` with `.map((p) => p.id)`. Contracts
§3.2 names the field `key`, and every module claim cites one. The lint reported all 26 claims as
citing a paper that does not exist, on a file where every one of them did. Fixed to `key`.

**A ninth branch.** Contracts §3.2 lists eight, all of them method lineages. The datasets —
Visual Genome, GQA, Haystack, IndoorVG — are not methods and belong on none of them, but a field
map that omits them cannot show where a method's evaluation came from, and M14 teaches three of
them by name. They sit on a ninth branch, `foundations`.

**What is not in the cards.** Contracts §3.2 also names `title` and `authors`. They are absent
rather than guessed: supplying an author list for sixty papers without opening them is exactly the
fabrication D-21 forbids one line above, and every card carries a DOI or an arXiv identifier from
which both are one click away. The test asserts the chaseable identifier instead.

## D34 — eighty-two numbers carried a protocol their source never states

**Found by:** the consistency pass that opened plan 02 Task 10, not by any test. Every assertion
in `papers.test.mjs` was green.

**Problem:** every figure read from IndVisSGG's Table 2 was tagged `protocol: sgdet,
constraint: graph` — 82 numbers across 10 cards, plus the five claims of `m11.{en,zh-TW}.mdx`.
Text extraction over the PDF finds no occurrence of **SGDet**, **PredCls**, **SGCls**, "graph
constraint" or "epoch" anywhere in the paper. Worse, §5.1.3 contradicts the tag outright:

> In the VG and PSG experiments, both $O$ and $P$ are predetermined for all methods. Unlike
> IndVisSGG, other methods require additional object annotations in the images using either
> bounding boxes or panoptic segmentation.

Objects predetermined for every method is the opposite of detection. Whether the intended setting
is PredCls or SGCls the paper does not say, and for ISG it says the traditional methods cannot be
run at all for want of object annotations.

**How it got in.** The project's own primary-source reading, `2026-09-16-indvissgg-reading.md`,
transcribes all three tables faithfully and is silent about the protocol. `gen_papers.py` then
wrote `"protocol": "sgdet", "constraint": "graph"` as a literal on every row. No test could catch
it: `papers.test.mjs` asserted the fields were *truthy*, which a wrong value is.

**Resolution.** `ReportedProtocol` and `ReportedConstraint` widen the published unions by exactly
one value, `unstated`. The engine's `Protocol` and `Constraint` are untouched — there is no such
thing as evaluating under an unnamed protocol, and `EvalRequest` still refuses it. Every affected
row carries `protocol_note_en` / `_zh` quoting §5.1.3, so the tag is a citation rather than a
shrug, and `MetricReadout` translates `unstated` while leaving the three terms of art verbatim.

Three assertions now exist that would have caught it, each watched to fail first: a closed set for
both spellings; a note required wherever either is `unstated`; and one that names IndVisSGG
directly, because only a reader of the paper can know this and the corpus has nowhere to record
it.

**The same pass corrected two related over-claims.** `gemini-pro-vision-2023` carried the six ISG
figures of Table 2's row labelled **"IndVisSGG-Gemini (ours)"** — IndVisSGG running on that VLM,
not a score for the VLM as a method — with no note of any kind. They now sit on `indvissgg-2025`
with `backbone: "Gemini-Pro-Vision"` beside the GPT-4V configuration, which is what makes the two
ISG rows distinguishable at all; the Gemini card falls to tier B with a caveat saying where its
numbers went. And the comparability paragraph of M11 and of the reading said the baselines have
"different detector backbones and epoch budgets". The paper states neither, for any baseline.
"They differ" is a claim about numbers nobody read; "the paper does not state them" is what the
source supports, and it is the stronger statement.

**The shape of this defect is worth naming.** D19, D22 and D25 were tests that could not fail.
This is a test that could fail and asserted the wrong predicate: `toBeTruthy()` on a field whose
whole content is which of four values it holds. A presence check on an enum is not a check.

## D35 — a leaderboard row cannot name three things its source never states

**Plan:** Task 10's first test asserts `detector_backbone`, `codebase` and `epoch_budget` are
`toBeTruthy()` on every row, and contracts §3.3 types all three as `string`.

**Problem:** no source this project has opened states a codebase or an epoch budget for any row,
and the only backbone stated anywhere is IndVisSGG's own GPT-4V and Gemini-Pro-Vision. Satisfying
the assertion needs nineteen rows times three columns of invented text, which is what D-21 exists
to forbid. PRD §6.4's own wording is satisfiable as written — it requires *the banner* to name the
three axes, and the banner does.

**Resolution.** All three are `string | null` on the row; `null` is the statement that the source
does not state it, and the page renders it as "not stated by the source" rather than leaving the
cell blank, because a blank cell reads as nothing to say. The test asserts the column is
**present** and is either a value or `null`, and the banner assertion is strengthened to require
that `banner_en` name all three axes literally.

**A second departure from contracts §3.3: the board is keyed on the source table too.** §3.3 keys
a board on (dataset, protocol, constraint). That is one field short. This corpus holds VG-150
PredCls mR@100 for FREQ at **16.0** from Tang et al.'s Table 1 and at **15.8** from KERN's, and
for MOTIFS at 15.3 and 14.4, under identical protocol and identical constraint. Keyed the
contract's way they land in one column, which is the merged ranking §6.4 exists to forbid — and
the disagreement between the two tables is the lesson of M4 step 6. One board per (source,
source_table, dataset) gives five boards over 19 rows and 87 figures, which is every figure the
corpus carries.

**`leaderboards.json` is a view, not a copy.** It was written from `papers.json` and
`leaderboards.test.mjs` holds every figure identical to the card it came from, matching on
dataset, metric, k, value, protocol, constraint, source, source table and backbone. A number that
is on a board and on no card fails CI.

**One mechanical note.** The data module is `boards.ts`, not `leaderboards.ts`. Windows resolves
imports case-insensitively, so `../Leaderboards` from the test found `leaderboards.ts` and React
was handed `undefined` for the component. Two files in one directory differing only in case is a
defect that would not appear on Linux at all.

**Watched to fail.** All six new data assertions were broken deliberately on a copy of the JSON —
a dropped column, a banner that stops naming the epoch budget, a sunset notice that loses its day,
a figure drifted from its card, rows sorted best-first, and a board citing a source with no card —
and each was caught. The banner-position assertion was checked by moving the banner below the
table in the component.

## D36 — the pairing key is the mask pair, not the mask pair plus the class names

**Plan:** plan 03 Task 1's implementation keys `single_mpo` de-duplication on
`(subject_name, object_name, subject_mask.counts, object_mask.counts)`.

**Problem:** knowledge point E13, which the plan cites as its source, states the rule as
`|{m : π(m) = (s,o)}| = 1`, and π is defined on instances. In a mask-annotated corpus an instance
*is* its mask. Adding the class names to the key lets two predictions through whenever they agree
on the masks and disagree on what the mask depicts — ⟨man, on, table⟩ and ⟨person, on, table⟩ over
one pair of masks — which is two hypotheses about one thing, and exactly the duplicate emission
the ECCV 2024 correction exists to stop counting twice.

**Resolution.** The key is `(subject_mask.counts, object_mask.counts)`. Both engines agree, and
`test_the_pair_is_the_mask_instance_and_not_the_class_name` fails under the plan's key — watched.

**Two smaller notes on the same task.** Its Step 4 expects `parity: 11 cases agree` after adding a
vector; 11 was already the count before, so the expectation was stale on arrival. And one vector
cannot show the gap, because a request carries one `mask_pairing`: `gv-012-mask-pairing-multi-mpo`
and `gv-013-mask-pairing-single-mpo` are the same scene under the two modes, R@20 of 1 against
0.5, and each `why` names the other.

**Where the correction is visible.** `apply_constraint` keys on the ordered *class* pair, which is
coarser than a mask pair, [**Corrected 2026-09-27 (D99):** it keys on the ordered object pair now;
with one mask per object that is the mask pair, so the conclusion below still holds] so under `constraint: graph` the constrained pool cannot move and R is
identical under both modes; only `ngR`, which reads the unconstrained pool, separates them. That
is consistent with the field: the PSG figures the correction overturned are no-graph-constraint
numbers. `test_the_graph_constraint_already_caps_what_single_mpo_would_cap` pins it.

## D37 — `/api/health` advertised a model this machine cannot run

**Found by:** writing plan 03 Task 2's registry, then asking what the endpoint it was replacing
had been saying.

**Problem:** `health.py` answered "what can run here" on its own, as
`"live_models": ["reltr"] if present_torch else []`. On the development machine `import torch`
succeeds — 2.10.0+cpu — and there are no RelTR weights anywhere in the checkout, so
`GET /api/health` reported `live_models: ["reltr"]` to any client that asked. A student following
that answer would have found the live path 503 with no explanation on the page that promised it.

The defect is structural rather than a typo: two modules answered one question, and nothing made
them agree.

**Resolution.** `registry.liveness()` is the only answer, and `/api/health` calls
`registry.live_model_ids()`. Liveness now requires `torch` **and** a checkpoint under
`data/checkpoints/<model>/`, which is a directory rather than a filename because plan 03 Task 5
pins the release RelTR's loader expects and guessing it here would be a capability claim resting
on a guess. `test_health_and_models_do_not_disagree_about_what_is_live` fails if the two ever
part company again — watched, by restoring the old line.

**Two related corrections in the same task.**

*Plan 03 words EGTR's blocked reason as "Predictions are committed; live inference is not wired
up."* The first half is a claim about the repository, it was false when it was written, and it
will go false again whenever a set is removed. Whether a prediction set exists is what
`predictions_available` reports, read off the files rather than declared. A blocked reason now
says only why the live path is shut, and a test refuses any reason that claims committed
predictions while none are on disk.

*The audit rule of D-07 is a function, not a pile of assertions.* Plan 03 Task 2's last two tests
walk `data/predictions/`, which is empty until Task 4, so as written they would have passed over
nothing and proved nothing — D19, D22 and D24 one more time. `app/infer/provenance.py:audit()`
takes a directory and the text of `PROVENANCE.md`, and is exercised against three files that
violate it before being run over the real tree. It reads provenance off the raw JSON before
validating the graph, because `Provenance` already refuses a non-measured fidelity with no note
and validating first would report every such file as merely malformed, burying the one sentence
that says what to fix.

**Also:** `data/checkpoints/` and `data/predictions/.latency.json` are now excluded by the track's
own `.gitignore`. The repository-root ignore file un-ignores this whole `data/` tree — a bare
`data` pattern had already cost two tracks their data directory — so anything large or
machine-local has to be excluded here or it is committed by default.

## D38 — the transcripts cannot be recorded before the prompts exist, and were not recorded at all

**Two problems in plan 03 Task 6, one structural and one about provenance.**

**The ordering cannot work as written.** Task 6 Step 3 records transcripts; Task 7 writes the
prompt builders. The transcript player keys on a hash of the prompt, so a transcript recorded
before the prompt exists is keyed on nothing, and one recorded against a draft wording goes
unreachable the moment the wording is edited — as a miss indistinguishable from never having been
recorded at all. `app/vlm/prompts.py` therefore holds the three step builders and the three canned
Figure 2 cases, ahead of both tasks, and Task 7's pipeline will call the same functions the
transcripts were keyed with. A test recomputes every key from the exchange it labels, so a prompt
edit fails CI instead of silently emptying the corpus.

**Nothing was recorded, because this session ran offline by choice.** Step 3 says to run the three
corrections "against a live provider once". Plan 03 Tasks 3–5 were deferred rather than run, and
the same decision applies here: no key, no network. The three exchanges are therefore **authored
from Wang et al. 2025 §3.2 and Figure 2**, which name all three corrections in prose — the
hallucinated `wrench`, the missing `terminals`, `beam` and `panel`, the imprecise `taping` — and
each carries `provenance.recorded: false` with its source and a bilingual note saying no VLM
produced the text.

This is D-07's rule applied to prose rather than to graphs, and it is the whole reason the
`provenance` block exists on a transcript file: an exchange written from the paper is a legitimate
teaching artefact and an illegitimate claim about a model, and only the block distinguishes them.
`test_every_transcript_says_whether_a_model_produced_it` refuses a file that claims `recorded:
true` without naming a model and a date — watched, by flipping the flag.

**Replacing them later is additive.** Recording the same three prompts against a live provider
overwrites the completions and sets `recorded: true` with a model and a date; the keys do not
change, because the prompts do not.

**One test was passing for the wrong reason.** `test_claude_provider_without_a_key_is_never_
selected_silently` asserted only that `ProviderUnavailable` was raised. Deleting the key check
outright left it green, because `anthropic` is not installed on this machine and the *next* guard
raised the same exception. It now asserts the message names `ANTHROPIC_API_KEY`. A test that
cannot distinguish two reasons for the same refusal is a test of the refusal, not of the reason,
and the reason was the point.

## D39 — the replica's tests were written after the module, and validated by mutation instead

**What happened.** Plan 03 Task 7 was implemented in the wrong order: `indvissgg.py`, then the
transcripts, then `test_indvissgg.py`, then the endpoint. Twenty-one tests passed on their first
run, which proves nothing at all — a test written against code that already exists is shaped by
the code rather than by the requirement, and it has never been shown capable of failing.

**What was done instead.** Eight mutations were applied to the finished module and data and each
was confirmed to turn the suite red: Table 3 losing its `P`-alone row; Table 4 reduced to the @20
column; `published_reference` merged into `step1`; a replayed graph labelled `measured`; every
expert given the same prompt; a transcript miss answered with an empty graph; `n_experts` widened
from the four counts Table 4 measures to any integer; and ablation ceasing to remove a criteria
block. That is the evidence a red phase would have produced, obtained after the fact.

It is not equivalent, and the difference is worth stating: mutation testing shows that the
assertions can fail, and a red phase also shows that the assertions were *chosen* before the
implementation had a chance to suggest them. Only the first was recovered here.

**Three design points the task settled.**

*A replayed exchange is never `measured`.* The transcript player returns a recording, so every
graph built from it carries `fidelity: 'reconstructed'` with a note. Calling it measured would
make the offline default a way of manufacturing evidence about a model.

*No graph claims a box it did not measure.* The method emits triplets and no geometry — the VLM is
asked for `<subject, predicate, object>` lines and nothing else — so the boxes are placeholders
and `provenance.note` says so in both languages. Any figure computed from them is a figure about
the placeholder.

*An empty criteria list is an ablation.* `run(O=[], P=[], E=[])` and `ablate=["O","P","E"]` are the
same experiment and now produce the same prompt. Emitting an empty `TRIPLETS EXTRACTION CRITERIA`
heading would have made two spellings of one row of Table 3 that hash to two different transcripts.

**A test that would have been vacuous.** `test_a_predicate_outside_P_is_scored_as_a_false_positive`
asserts step 1 emits no out-of-vocabulary predicate when `P` is supplied. On a pipeline incapable
of emitting one under any conditions it passes and means nothing, so
`test_ablating_P_does_emit_one_so_the_lab_has_something_to_show` asserts the complement. The pair
is the claim; either one alone is half of it.

**The fourteen pipeline transcripts are authored, like the three in D38**, from §3.1-3.3 and
Figure 2: five step-1 variants spanning Table 3's factorial, five step-2 experts, and four step-3
reconciliations for N in {1, 2, 3, 5}. The step-3 prompts are built from the parsed step-2
completions exactly as `run` builds them, so the keys match at run time rather than by luck.

## D40 — L5 has no ground truth to score against, and L4 has nothing to compare

**Problem 1: the student's own R@20 cannot exist.** Plan 03 Task 8 puts the published Table 3 row
and the student's own run in two panels and implies both hold comparable numbers. `R@20` needs
ground truth; this corpus holds none for the Figure 2 frame, and the `mini-isg` slice is not on
disk. A number in that column would be invented to fill it, which is the fabrication the whole
provenance apparatus exists to stop.

**Resolution.** The student's panel shows what the run produced — the triplets — and states the
absence in both languages: *"R@20 needs ground truth, and this corpus holds none for the Figure 2
frame; a number here would be invented rather than measured."* The published panel keeps all five
rows at their cutoffs. The structural rule survives intact and is stronger for it: a `[data-figure]`
element holds figures of one fidelity or of none, and a test walks the DOM rather than trusting
the layout.

**Problem 2: L4's live button cannot follow `torch_present`.** Task 9 keys it on `/api/health`'s
torch flag. Liveness needs `torch` **and** a checkpoint (D37), and the registry already states the
reason in both languages, so the button follows `model.live` and renders
`live_blocked_reason_*`. Keying it on the torch flag would reproduce exactly the disagreement D37
records, one layer up.

**Problem 3: L4 has no columns yet.** Task 4 produces the committed predictions and was deferred,
so the lab renders "nothing is committed for this frame yet" rather than an empty comparison. The
component takes its columns as props, so the day the predictions land nothing about it changes.

**A defect my own tests missed, and the test that now catches it.** `IndVisSGGReplica` computed
the run's triplets as `result?.step3?.graph ?? result?.step1?.graph ? [] : []` — dead code that
always yields an empty array, so the run's output never reached the panel. Every test passed,
because `AblationReplay` was only ever exercised with a fixture of its own and the container's
wiring was never asserted. The narrowed `ReplicaGraph` type now carries objects as well as
relationships, `tripletsOf` derives the triplets, and two tests assert they arrive — one for the
step-3 case and one for the step-1 fallback. **A component test that never runs the real container
is a test of the fixture**, which is D19, D22 and D25 again in a fourth costume.

**L6's fixture did not demonstrate its own lesson.** The first version scored 1.00 against 0.67
for one-stage and 0.67 either way for two-stage, so the two rankings tied and nothing reordered —
the lab's entire point, and the test caught it. The fixture now puts three of four ground-truth
relations at one ordered mask pair: one-stage scores 0.75 under `multi_mpo` and 0.25 under
`single_mpo`, two-stage 0.50 under both, and the correction reverses which style leads.

**Watched to fail.** L6 had a real red phase. L4 and L5 did not for every assertion, so eight
mutations were run instead: a provenance chip losing its fidelity attribute, a reconstructed note
moved behind a disclosure, live inference enabled for everything, an unmeasured latency printing a
plausible constant, L5's two panels nested into one, Table 3 truncated to four rows, L6's two
rankings sorted the same way, and its standing note made collapsible. Each was caught.

## D41 — RelTR carries no licence, so the live path cannot contain it

**Found by** reading the licence before writing the loader, rather than after.

**Problem:** plan 01 named RelTR as the one live-capable model, and plan 03 Task 5 implements it.
The GitHub API reports `license: null` for `yrcong/RelTR`, and the repository holds no LICENSE
file. Default copyright applies: no right to copy, modify or redistribute has been granted. A
`reltr_cpu.py` that vendored the model definition, the class lists or the transform would be a
redistribution nobody authorised, and the checkpoint is published through a Google Drive link,
which is neither hashable nor redistributable from here.

This is D13 one layer up. There the assumption was that MIT on PSG's annotations reached through
to COCO's photographs; here it was that a public research repository may be built upon. Both were
made while looking at the artefact rather than at the terms.

**Resolution — a third gate, in the registry, not beside it.** Liveness already required `torch`
and a checkpoint (D37). It now also requires `SGS_RELTR_PATH` to point at a clone the operator
made, and `registry.package_present` answers that question so `reltr_cpu` can delegate rather than
answer it a second time — which is the whole lesson of D37. `/api/models` states the reason in
both languages, and it names the licence, because "set an environment variable" without the reason
invites someone to vendor the code and make the message go away.

`test_no_reltr_source_is_vendored_into_this_repository` walks every `.py` under `system/` for a
definition line that only a copy of RelTR would carry. A mention does not count: `reltr_cpu` names
the symbols it imports and the test file quotes them, and both are references.

**The decode step is deliberately unimplemented.** `reltr_cpu.to_scene_graph` is a pure function
over already-decoded output and is tested against synthetic detections, because that part needs no
weights and is where a mistake would be silent. `_decode` raises instead of guessing: RelTR's label
vocabulary and box convention live in code this project may not read into itself, and a decoder
written from memory would produce a graph that looks right and names the wrong classes.

**EGTR is Apache-2.0**, so it *could* be vendored with attribution. Nothing needs it yet, and the
asymmetry is recorded in `PROVENANCE.md` so the next person does not re-derive it.

**A security note that arrived with the loader.** `torch.load` defaults to `weights_only=False`,
which unpickles arbitrary objects. The checkpoint here is a `.pth` a human downloads from a Drive
link, so loading it unguarded is remote code execution wearing a file extension. The call pins
`weights_only=True` and a test asserts every `torch.load` in the module does.

**And the guard was broken when it was written.** The first version compiled a regex whose pattern
reached the file through a heredoc, which turned the `\b` word boundary into a literal backspace
(`\x08`). It required a control character no source file contains, so it passed with vendored
source sitting in the tree — twice, while I was checking that it could fail. The rule is now plain
string prefixes, and `test_the_licence_guard_can_actually_fail` runs it over a file that violates
it, because a guard whose only subject is a tree that is clean by construction proves nothing.
This is the fourth time in this project that a check could not fail (D19, D22, D24, D40) and the
first where the cause was the shell rather than the reasoning: **patch Python through the editor,
never through a heredoc.**

## D42 — the spike failed twice, and Task 4's "target recall profile" had to go

**Task 3.** `detectron2` does not build on this machine. Two attempts, two distinct failures, both
transcribed into `PROVENANCE.md` with their commands: the first stopped at
`error C2429: 'nested-namespace-definition' requires compiler flag '/std:c++17'` because
detectron2's `setup.py` passes no `/std:` flag while torch 2.14's headers need C++17 and in places
C++20; the second, with `CL=/std:c++20`, produced 56 errors led by
`error C2065: 'blockIdx': undeclared identifier`, which means the `.cu` sources are reaching the
host compiler. The second is a build-system fault, not a missing flag, and fixing it means
patching a third-party build.

Torch itself was fine: `2.14.0+cu126`, CUDA build 12.6, `cuda_available: True` on an RTX 3090. The
failure is about detectron2's Windows path and nothing about the hardware. Stopped well inside the
four-hour box; nothing was carried into the repository.

**Task 4.** Its Step 1 produces a measured tier by running RelTR and EGTR. Neither can be run
here — D41 for one, no checkpoint for the other — so the measured tier is empty and
`PROVENANCE.md` says so model by model rather than leaving the reader to infer it.

Its Step 2 describes `reconstruct_predictions.py` as taking "a target recall profile", which would
invite exactly the reading D-07 exists to prevent: that a reconstruction reproduces a published
number. On six placeholder frames it cannot, and a file that appeared to would be worse than no
file at all. A profile therefore states two checkable things — whether this style of model emits
several predictions at one ordered pair, and roughly how much of the ground truth it recovers —
and the note on every graph says whose output it is **not**.

Thirty files, five models over the six frames of the `placeholder` slice, which is the one slice a
bare clone has, so the labs work without the bundle. Deterministic under seed `20260918`, and
`test_the_committed_files_match_what_the_script_regenerates` fails if the files and the script ever
drift, so the sentence in `PROVENANCE.md` that says how they were made stays true of them.

Its Step 4's sanity check ran, on the reconstructed tier rather than on RelTR: R@20 between 61.1
and 77.8 across the five models, the engine running end to end on committed files, magnitudes
neither 0 nor 100, protocol and constraint tags intact. `R` equals `mR` throughout, which is an
artefact of a slice with about one relation per predicate class and is recorded as such so nobody
reads it as a finding.

## D43 — three of plan 04 Task 1's four assertions could not hold as written

**"Beats a head-biased visual model on R, loses badly on mR."** A head-biased model behaves like
the prior: it would win on R and lose on mR exactly as FREQ does, so the two assertions contradict
each other. The contrast that makes E11's point is a predictor that spends its confidence on the
tail — one that gets the rare relations right and the common ones wrong. The fixture's
`f_theta(V, s, o)` is that, and the comment says so where a reader will meet it.

**"Consults no pixels", tested by calling `predictFreq` twice and comparing.** That tests
determinism. The claim is that the visual term is never reached, so the test passes a spy and
asserts it was not called — with a companion asserting it *is* called at any positive lambda,
because a blend that never consults the visual model is not a blend.

**"Recall is affine in lambda, within 0.05."** E11 derives that `R_p(lambda)` — the per-pair
*score* — is affine, and it is, exactly. Recall is not: it is a property of a ranking, and a
ranking is a step function of the scores. The exact claim is testable to twelve decimal places, so
that is the one tested.

**Two fixture faults the tests caught, both of which would have made the lab lie.**

*The tail relations sat on pairs the training corpus had seen.* A conditional fitted on a pair
seen once with `under` gives `under` probability 1, so FREQ recovered the tail and `mR` came back
at 1.0. FREQ's bias does not live in the conditionals it has evidence for; it lives in the
**backoff**, where an unseen pair falls through to a marginal in which the head outweighs the tail
nine to one. The fixture now puts the tail on pairs training never shows, which is both the
realistic case and the one that demonstrates the mechanism.

*The Zipf slider moved the distribution without moving the metric.* Two causes, and the second was
subtle. `zipfCorpus` first concentrated each predicate on a few pairs, so every conditional was
degenerate and the exponent changed the marginal while changing no ranking; it now spreads each
predicate across all ordered pairs. That was not enough on its own: at `K = 5` the cutoff fell
*inside* the block of ties a flat conditional produces, so the same single relation was recovered
at every exponent. `K = 20` of 80 candidates reaches past the ties, and the gap now runs from
**4.4** at a flat distribution to **26.7** at a steep one — which is the lesson, that FREQ's
advantage is a property of the corpus and not of the metric.

**A `.ts` test under `frontend/src/` was collected by no project at all.** The frontend Vitest
project included `*.test.tsx` only and the metrics project only looks under `packages/`, so
`freq.test.ts` would have passed by never running. The include is now `*.test.{ts,tsx}`: a lab's
logic module is not a component and its test should not have to pretend to be one.

**And one pre-existing flake, fixed in passing.** `registry.test.tsx`'s typesetting test renders
every math step of fifteen modules in two locales and takes about ten seconds; it had been sitting
just under Vitest's five-second default and went over as the suite grew. It now carries an explicit
sixty-second budget, because a limit a test cannot plausibly reach is better than a flake that
looks like a regression in whatever was committed last.

## D44 — `/api/health` started reading thirty files, and NFR-8 caught it

**Found by** `test_health_answers_quickly_once_warm`, on the first CI run after plan 03 Task 4
committed the reconstructed tier.

`live_model_ids()` was implemented as `describe_all()` filtered by `live`. `describe_all` builds
every field of contracts §1.6, including `predictions_available`, which walks the prediction tree
and parses each file to read its fidelity. With thirty files committed, `/api/health` took 73 ms
against NFR-8's 50 ms warm budget.

The defect is one of altitude rather than of speed: health asks *what can run here*, which is three
cheap checks and does not depend on what is committed. It now calls `liveness` directly, and
`predictions_available` — which `/api/models` genuinely needs — is cached, the prediction tree
being immutable while the server runs exactly as contracts §2.3 says of the content corpora.
`registry.reload()` drops the cache for a process that has just written predictions.

`test_health_does_not_walk_the_prediction_tree` now asserts the separation directly, so the next
person to reach for `describe_all()` in a hot path finds out from a named test rather than from a
latency budget.

**Worth noting what nearly happened.** The obvious reading of a 73 ms failure is that the budget is
too tight, and raising it would have been one line. The test was right and the code was wrong.

## D45 — the mini-ISG gate: one source cleared, one shut

Plan 04 Task 3, which produces no code and gates Task 4. Two sources, one question each, asked
before any frame is copied.

**IndustReal — YES.** The repository README says *"IndustReal is released under the Apache 2.0
license."* That is a statement on a code repository, and D13 is this project's record of what
happens when a licence on one artefact is assumed to reach another. So the data record was checked
separately: the dataset lives at 4TU.ResearchData, its own licence field reads `Apache-2.0`, and it
links the canonical text. The licence reaches the frames and not merely the code, which is the only
reason the row says YES. Checking the second page is the entire lesson of D13 and it took one fetch.

**MECCANO — UNCLEAR, treated as NO.** The GitHub API reports `license: null` for
`fpv-iplab/MECCANO`, and the official University of Catania project page carries download links, a
citation request and funding acknowledgements, with no licence statement, no terms of use and no
download agreement anywhere on it. Absence of a statement is not permission. D-18 admits three
answers and two of them mean no.

That is the third project in four days to be found carrying no licence at all — RelTR in D41, and
now MECCANO. The pattern is worth naming: **a public research artefact is not a licensed one**, and
the default when nothing is said is that nothing is granted.

`data/mini-isg/README.md` states, in both languages, the three things a reader will otherwise get
wrong: this is not the authors' ISG, which is request-only and which this project does not have; it
is built with the paper's method and not with the paper's data; and `ISG-Bench` on Hugging Face is
a name collision. It also says plainly that forty frames cannot reproduce a result measured on ten
thousand, so any figure computed here is a figure about here.

**No frame has been cut from either source.** Task 4 needs the IndustReal download, which is
several gigabytes and the author's to run, so the gate is recorded open for one source and shut for
the other and the assembly waits. L8's component does not: it is built against the placeholder
frames, which is exactly the fallback `LICENCE.md` prescribes for a source that is not cleared.

## D46 — the manifest was written where the application does not look

Task 4 Step 1 shipped `MANIFEST.json` to `data/mini-isg/`, which is the path the plan names. The
application reads it from `data/slices/<dataset>/`, which is where every other slice keeps it and
where `app/datasets/loader.py` looks.

Nothing failed. `distribution_mode('mini-isg')` answered `none` although `data/LICENCES.md` had
cleared the slice for the class bundle, and `image_file` fell through to its extension-guessing
fallback, which happened to guess `.jpg` correctly, so the recorded sha256 was never consulted and
the frames were served anyway. A slice that is cleared for distribution and reports that students
cannot obtain it is a bug that only shows up when somebody builds the bundle.

The manifest moved. `cut_mini_isg.py` writes to the slice directory now, and the finding is pinned
by a test that asserts every slice with images cut reports a distribution mode, and reports
`bundle` where the licence ledger says `YES`. The plan's path was wrong and the code's was right;
`data/mini-isg/` keeps the two documents that are for a reader — `README.md` and `LICENCE.md` — and
nothing the application reads.

## D47 — D-10's tail condition cannot be met by a seven-word dictionary

D-10 selects a frame with at least four objects, at least three relationships, and **at least one
relationship whose predicate is outside the slice's ten most frequent**. The third clause assumes a
slice with more than ten predicates in it. `P_ISG` has seven.

So `selection_ok` rejected all forty mini-ISG frames, and the message it would have carried is
"badly chosen" when the fact is "small vocabulary". There is no eighth-most-frequent predicate to
find, and a condition that no frame can satisfy is not a condition — it is the same defect as a
test that cannot fail, wearing the opposite sign.

`selection_ok` now applies the tail clause only where there is a tail. The guard had to be narrow,
because widening it to every slice would delete D-10's rule while the suite stayed green: every
other test on that function asserts that a well-chosen frame passes, and none asserts that a badly
chosen one fails. A second test now builds a frame whose every predicate is a head predicate and
requires the rejection. Of the five slices on disk, four still have the clause applied to them
(vg150-sgb 36 predicates, psg 36, indoorvg 22, placeholder 16) and only mini-ISG does not.

## D48 — `bundle_slices.py` has no cleared set to add mini-ISG to

Task 4 Step 1 says to "add `mini-isg` to `bundle_slices.py`'s cleared set so the frames ride in the
class bundle". There is no such set. The script walks `DATASETS`, skips anything without a
committed `annotations.json`, and asks `gates_for(ds).bundle_distribute` — so a slice enters the
bundle when its licence clears it and its annotations exist, and a hard-coded list would be a
second place for the same fact to be wrong in.

Committing `data/slices/mini-isg/annotations.json` is therefore the whole of the step, and it was
verified rather than assumed: `bundle_distribute` is `True` for mini-isg and `placeholder`, and
`False` for vg150-sgb, psg and indoorvg, which is what D-08 requires. No line of
`bundle_slices.py` changed.

## D49 — one model drafted the mini-ISG set and the same model corrected it

Task 4 Step 2 asks for triplets drafted by the L5 pipeline and Step 3 for a lab that counts what an
annotator changes. The offline constraint that produced D38 applies here too: the transcript player
raises `TranscriptMiss` for any prompt nobody authored, and there is no API key on this machine, so
the drafts could not come from a live `ClaudeProvider`.

What was done instead, stated plainly because it is the kind of thing that becomes a false claim
the moment it is left vague: each of the forty frames and the exact `step1_prompt(O_ISG, P_ISG)`
string were given to Claude Opus 5 — this session's model — and its triplet lines were recorded
verbatim in `data/vlm/transcripts/mini-isg-step1.json`. That is a genuine VLM completion for that
prompt and that image. It did not travel through the application's provider path, so a graph
replayed from it is still `reconstructed` and `provider_used` still reads `transcript`: the
application did not call a model, and D-07 does not care which process did.

**The same model then produced the corrected reference set.** The difference between a draft and
the reference is therefore not a measurement of what a human annotator finds that a model misses.
It is what one model found on a second, slower look, and both the transcript's provenance block and
the annotations' provenance note say so in both languages. The honest reading of the 156 → 343
triplets is a lower bound on the work, not an estimate of it.

The completions carry the triplet lines and nothing else. The existing Figure 2 transcripts append
an `ANALYSIS_EN` block, which is legitimate there because the provenance says a person wrote the
whole exchange from the paper; appending this project's commentary to text presented as a model's
output would not be.

**The boxes are hand-placed.** The IndVisSGG method emits triplets and no geometry, so the reference
set's boxes were drawn by eye to roughly 3% of the frame width. That is adequate for teaching how
IoU behaves under a bad box and inadequate for reporting a detection figure, and the provenance
note says which.

## D50 — the box-adjustment category was inert until it was wired

L8 counts four kinds of correction. Three of them had controls; `box` had a code path in
`corrections.ts`, tests around it, and nothing in the component that could ever issue one, so
`count-boxes` was a number that could only ever read zero.

Found by mutation rather than by reading: swapping the overlay's `objects` prop from the working
copy to the draft left all twenty-eight tests green, which meant nothing observed the student's
geometry at all. Adjusting a box is now choosing which box and then drawing its replacement — not
dragging whichever box lies under the pointer, because a bench frame has overlapping boxes and the
ambiguity is worst exactly where the annotator is most likely to be working. The selection clears
after one adjustment so a second drag cannot silently move the same box again.

One mutant survives and is left alive deliberately: forcing the overlay to `mode="draw"` at all
times changes no counted behaviour, because `Number('')` is `0`, no object carries id `0`, and the
edit is refused as a no-op. The difference is the cursor, which is cosmetic and which no test can
see.

## D51 — what the review of D46–D50 found

Five findings, four of them mine, from auditing the commit rather than re-reading the summary of it.

**The obvious API call could not reach a single one of the forty drafts.**
`POST /api/vlm/indvissgg {"image_id": "isg-001"}` answered 503. The drafts are keyed on
`step1_prompt(O_ISG, P_ISG, EXAMPLES_ISG)` and the request defaults were the paper's Figure 2
wiring vocabulary, so only a caller who already knew to send the bench criteria could get at them.
The test that covered this sent them, which proved the drafts exist and not that anyone can reach
them — the same shape as every other test in this file's history that passed for the wrong reason.

The criteria now follow the frame. `criteria_for(image_ref)` reads the mini-ISG manifest, because
the manifest is the authoritative list of what was cut and a prefix rule on `isg-` is a guess. A
frame nobody has heard of gets the paper's vocabulary and the usual `TranscriptMiss` naming its
key. Two tests, one per frame family: the Figure 2 walkthrough must keep `O_DEFAULT`, or fixing L8
would have broken every L5 exchange in exactly the way it was fixing.

**The reference set does not score 1.0 against itself under graph constraint.** Thirteen of forty
frames give R = 0.875 to 0.9; under `none` all forty give 1.0. Thirteen relations of 350 carry a
class pair that already has a relation — in every case a `hand` pair, because one hand steadies the
assembly while the other works on it, and `<hand, holding, assembly>` and `<hand, assembling,
assembly>` are both the case.

This is the engine correct and the data true, and it was kept. Deleting a real relation so a number
reads 1.0 is the thing this project exists to refuse, and the two-hands frame is a better
illustration of what graph constraint costs than any figure in the literature, because the student
is looking at the photograph. A test pins it in both directions: a set that quietly started scoring
1.0 would mean somebody had annotated the collision away.

[**Corrected 2026-09-27 (D99):** the thirteen came from keying the graph constraint on class pairs.
Nine of them are two hands on one object, two object pairs (seven on an assembly, isg-007 on a
wheel, isg-033 on a beam), which Tang's evaluator keeps and the engine now keeps. Four frames, isg-011, isg-013, isg-025 and isg-035, carry two predicates on one
object pair, one hand both holding and assembling, and still score below 1.0 against themselves.
"This is the engine correct" did not hold.]

**Seven objects took part in no relationship.** Boxes the overlay draws, no metric can reach, and
that exist only because I gave them a box. All seven earned a relation rather than being deleted,
because they are really in the frames. Now a test.

**The README's own predicate table was wrong by one.** `attached to` read 56 against 55 in the
data. A count in prose is a claim, and an uncheckable claim in the one document that exists to stop
three misreadings is worse than no table. A test parses both language copies of the table out of
the README and compares them with the data, so the claim cannot rot.

**`docs/INDEX.md` said "Not built. Plans 03–04" and quoted 133 pytest, 132 vitest, 49 i18n keys.**
The real figures are 247, 309 and 164, plans 01–03 are executed and plan 04 is four tasks in. The
file says of itself that it is kept current; it had not been for two sessions. `CLAUDE.md` carried
the same rot — "all 35 logged deviations", "D1…D35", "Plans 01 and 02 are executed". Both corrected,
and the verification line was checked against a CI run rather than written from memory, which is
how the first draft of this entry came to claim 246 and 166.

The distribution was left alone and documented instead: `on` is 178 of 350 and `inserted into` is
7. That is what a real relation distribution looks like, it is why R and mR disagree, and balancing
it by hand would have hidden the one property the course spends a whole lab on.


## D52 — the router no task mounts, mounted here

Four plans, forty-five tasks, and not one of them mounts a frontend router. Contracts §2.2 sets
out seven routes and every lab was written against `useSearchParams`, so the omission was not
noticed for two plans: each lab is reachable from its own test, renders correctly there, and is
reachable from nowhere else. `docs/INDEX.md` recorded it at the end of plan 03 — *"No router is
mounted, and no task in any of the four plans mounts one — Task 5 has to"* — and this is Task 5
doing it.

`src/routes.tsx` exports `ROUTES` as a plain `RouteObject[]`. `main.tsx` builds a browser router
from it and the route test builds a memory router from the same array, which is the point: a test
that declared its own `<Routes>` would assert something adjacent to the application rather than
the application, and every route this project has shipped so far was verified that way.

**Mounted:** `/`, `/m/:moduleId`, `/lecture/m/:moduleId`, `/lecture/m/:moduleId/:stepIndex`,
`/map`, `/leaderboards`, `/status`, and `*`.

**Not mounted, each for a reason that is not "forgotten":**

* `/lecture/notes` is plan 04 Task 6, which owns the presenter window. Mounting an empty route
  for it now would put a blank second screen in front of the professor.
* `/lab/:labId` waits on containers. L3 and L7 take no props, and L2 and L6 have committed
  fixtures, but L1, L4, L5 and L8 take a scene graph, a slice image or a live model run as props,
  and two of them need the backend. Mounting four of eight labs behind one route would make
  `/lab/L4` a blank page with no statement of why — the failure D-1 and D46 are both about. It is
  the next piece of work after Task 6, and it is written down here rather than left to be
  rediscovered.

The bare `/lecture/m/:moduleId` redirect is not in the contract. It is there because that is what
a person types, and a lecture that 404s on a URL missing its step index fails in the only minute
that cannot be recovered.

## D53 — the study shell the plan names and no task creates, and what `App` became

Plan 04's file-structure table lists `system/frontend/src/shells/study/StudyShell.tsx`. No task
step creates it. Contracts §2.2 routes `/m/:moduleId` at it, so mounting the router without it
would have left the index linking at nothing.

It is written here, minimally: the same `ModuleStep[]` the lecture shell consumes, every step in
one scrolling column at reading size, each in its own `data-step-id` section. Task 7 adds progress
and quizzes to it; that is its task and this is not it.

`getBody()` in `content/registry.tsx` was written for exactly this shell and is now deleted. It
had no caller and no test — it rendered the whole module body with a `Step` that admits every id
— and both shells now read `getModule()`, which is what makes "one content base, two shells" true
rather than two code paths that agree today.

`src/App.tsx` became `src/pages/Status.tsx`, and its test moved with it. It was never the
application: it is the health and slice-presence panel, and it is now the `/status` page, reached
from the index by name. The router took over the position `main.tsx` used to render directly.
Nothing inside the component changed, so its seven tests moved unedited apart from the import.

## D54 — the accent colour that failed the ratio its own comment claimed

Plan 04 Task 5 Step 3: *"Measure the lecture palette against NFR-5's 7:1. Measure it; do not
assume it, and record the measured ratios in a comment beside the palette."*

The first draft of `palette.ts` did the second half. Four tokens, four ratios in a comment table,
`accent: #1d4ed8` recorded at 7.06. Measured, it is **6.70** — below the threshold, in a colour
that had already been written down as passing. The accent is now `#1e40af` at 8.72.

The comment was not a lie about a measurement; it was a number written where a measurement
belonged, which is the same defect as every "test that cannot fail" in this file. So the
measurement is code. `contrastRatio` implements WCAG 2.1 relative luminance, its test checks it
against the two extremes and against WCAG's own worked example, and the palette test recomputes
every ink token on every CI run and fails naming the token and its ratio. A colour edited without
checking now fails CI rather than the lecture.

One assertion in that test pins the measured ratios to two decimals. It is deliberately brittle:
it is the line that would have caught the comment.

## D55 — jsdom's `AbortSignal` is not the `Request` constructor's, so no navigation happened

The route test opened a memory router, dispatched `ArrowRight`, and read the same URL back. No
error surfaced in the test; the failure was an unhandled rejection reported after the run, and the
assertion simply compared the old path with the expected new one.

`react-router` in data-router mode builds a `Request` for every navigation so a loader can be
handed the abort signal. Under jsdom the signal is jsdom's `AbortSignal` and the constructor is
Node's undici `Request`, which brand-checks its `signal` against the class it was compiled against
and throws `RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`. The
throw lands in a promise nobody awaits, so the navigation never starts and the router stays where
it was. A real browser never reaches this: both classes come from one realm there.

`frontend/test/setup.ts` now subclasses `Request` to retry once without the signal when — and only
when — the construction throws a `TypeError` and a signal was supplied. Nothing in the suite aborts
a navigation. It sits beside the `PointerEvent` polyfill, which is in that file for the same
reason: a jsdom gap that makes an assertion pass, or fail, for a reason unrelated to the rule it
claims to check.

## D56 — presenter notes are declared in three places and carried in none

Found while reading Task 6's dependencies, not while executing Task 5. No change was made.

`ModuleStep` in `content/registry.tsx` declares `presenter_notes_en` and `presenter_notes_zh`.
Contracts §2.4 declares them. Plan 04 Task 6 renders them: *"It renders the current step's
`presenter_notes_*`, the next step's title, the section timer, and the elapsed total."*

No module carries either field. The frontmatter schema in contracts §3.1 does not list them, so
`content_lint.mjs` does not check for them, and `getModule()` spreads `ModuleStepMeta` — which
does not declare them — into each step, so they are structurally unreachable even if a module
added them. The presenter window as specified would render an empty notes pane for all fifteen
modules and pass its own tests while doing it.

Task 6 has to close this before it builds the window: add the two fields to `ModuleStepMeta` and
to the frontmatter schema, decide whether the lint requires them per step kind, and author notes.
That is content work over ninety-two steps, sixty-two of them lecture-timed, in two locales, and
it is larger than the window itself. Recorded now so it is a decision rather than a discovery at
the lectern.

## D57 — presenter notes: one locale per file, and the lint that holds them parallel

D56 recorded the gap; Task 6 closed it under the decision to wire the mechanism, seed M0 and
leave the other fourteen modules to the lecturer.

**Where the fields live.** Contracts §2.4 declares `presenter_notes_en` and `presenter_notes_zh`
on one `ModuleStep`, which reads as though a step carries both. A module is two files, so
carrying both in both would be the same sentence written twice in two places and free to drift.
Each locale file now owns its own field and `content_lint.mjs` refuses the other one. Exactly one
is ever populated on a step `getModule(id, locale)` returns, and `PresenterView` reads the one
matching the locale it is displaying — never the other, because a silent fallback is what NFR-6
forbids, and the notes pane is the one surface in the room nobody can see going wrong.

Three rules, each watched to fail against the real corpus before it was kept: a file carrying the
other locale's field, a note declared with nothing in it, and the two locales disagreeing on
*which* steps carry notes. The third is the one worth having. It is the failure that survives
review, because each file is correct on its own.

The fields moved from `ModuleStep` to `ModuleStepMeta`. That was the structural half of D56:
`getModule` spreads `ModuleStepMeta` into each step, so notes declared on the interface below it
could never have arrived, and the chain type-checked end to end while carrying nothing. The route
test therefore asserts M0's seeded note through the registry and the real frontmatter rather than
through a fixture.

**M0 is seeded, and no more.** Four steps in both locales. Writing the other eighty-eight would
have meant inventing a lecturer's voice and pacing for someone else's lecture, which is the same
class of claim as a contrast ratio written from memory (D54).

## D58 — Space is two keys, and the presenter button proved it

The lecture shell grew a button that opens `/lecture/notes`. It is in the tab order, and the
first test written against it asserted the wrong rule: that a focused button keeps the keyboard
away from the deck entirely. It failed, correctly — an arrow means nothing to a button, and a
deck that stops advancing because focus is on a control is worse than one that advances.

The rule the failure produced is narrower and is the true one. Space means "next slide" to the
deck and "activate" to whatever has focus; a professor who tabs to the button and presses Space
would otherwise get a second window *and* a skipped slide, from one keypress, in front of a room.
`useStepper` now yields Space — and only Space — to a focused `button`, `summary`, `a[href]` or
activatable input, on top of yielding every key to a text field. Two tests, one per half, because
one test asserting "focus changes the keyboard" would pass for either rule.

## D59 — the presenter window times its own session, and says so

Plan 04 Task 6 asks the window to render "the elapsed total". Contracts §2.4 fixes the channel
message at `{moduleId, stepIndex, remainingSeconds}`, so the window cannot know when the lecture
started — only when it was opened, which is the same number only if it was opened first.

Widening the message was the other option and was not taken: the shape is contractual, the
presenter window is the only subscriber that would use the extra field, and a number labelled
"elapsed" that silently means "since this window opened" is the kind of small lie that is
discovered while it is being relied on. The label reads `Since this window opened` and
`本視窗開啟後經過`, and the clock is honest about what it counts.

The section clock needed a colour for a section past its budget. `#b42318` — the `spurious`
stroke in `graph/palette.ts` — measures 6.57 against white and fails NFR-5. It is correct where
it lives, because an overlay stroke on an image is not body text, and wrong for a number a room
reads off a projector. The lecture palette's `danger` is `#912018` at 8.66, and the sign leads
the number so the overrun survives greyscale and a colour-blind reader.

## D60 — `/lab/:labId`, and the endpoint a standalone lab needed

D52 left the eight labs reachable only from their tests, with the reason named: L3 and L7 take
no props, L2 and L6 have committed fixtures, and L1, L4, L5 and L8 take a scene graph, a slice
image or a model run. This is the work D52 deferred.

**The labs did not change.** A lab takes a scene graph as a prop and does not know where it came
from — which is exactly what let all eight be written and tested before any of them was
reachable, and it is why mounting them needed containers rather than edits. `labs/mounts.tsx`
holds one container per lab, `labs/api.ts` holds the fetching, and `labs/registry.tsx` maps the
id to the mount. `LAB_IDS` is derived from the mount table rather than written beside it, so a
lab cannot be listed without a mount or mounted without being listed.

**One endpoint was missing.** Nothing in the API said which frames a slice contains, so a
standalone lab could not choose one to ask for. The alternatives were an id guessed from a
naming convention and a copy of every slice manifest bundled into the frontend — both a second
statement of what was cut, kept somewhere the cutter does not maintain. `GET
/api/datasets/{ds}/images` is the first-class answer, contracts §1.4, four tests, and it returns
`200` with an empty list for a slice that was never cut because "no frames" and "no such
dataset" are different statements.

**`placeholder` is the default dataset.** D-08 ships the real slices as a bundle the class
unpacks, and `make_placeholders.py` is the one slice every clone can produce. A lab defaulting
to `vg150-sgb` would greet a fresh machine with a 422, and a student reads that as the
application being broken rather than as the bundle being absent.

**The failure states are the point of the containers.** Contracts §1.1 writes a sentence in both
languages for every refusal and NFR-1 forbids a stack trace, so `ApiFailure` carries the whole
error and `LabFrame` renders the sentence in the locale on screen. Three cases the fetch boundary
now separates rather than collapsing into a status code: a dead backend (`fetch` rejects — the
instruction is "start it"), a body that is not the error model at all (a proxy page, a dev-server
overlay), and a real refusal. Four tests cover the three, and one asserts the rendered failure
contains no stack frame.

Two assertions state NFR-1 directly: L2, L3, L6 and L7 render with `fetch` throwing on every
call, because they need no backend; L1, L4 and L8 show the backend's own sentence.

## D61 — the mutation run that raced its own restore

Six mutations were run against the lab-route assertions in one backgrounded shell loop. The sixth
— dropping L6 from the mount table — reported all tests passing, which would have meant the
registry's only structural assertion could not fail.

It could. The loop had been moved to the background on a timeout and was still alive; its
`cp` restored `mounts.tsx` while the foreground run was reading it. Re-run alone, the mutation
fails two tests, naming the missing id in both.

Recorded because the lesson is not about this mutation. A mutation run is a test of the tests,
and a mutation run sharing a working tree with anything else is not one. They belong in the
foreground, one at a time, or in a copy of the tree.

## D62 — persistence, and the one module that was already writing to `localStorage`

Plan 04 Task 7. `store/persist.ts` is the typed slot layer contracts §2.3 asks for: every read
wrapped and returning a typed default, every write wrapped, keys namespaced `sgs:v1:`, and a
version bump discarding rather than migrating.

The shape is checked as well as the version. Trusting `version` alone would let a hand-edited or
earlier-build entry through with `modules` as a string, and every reader downstream would then
fail somewhere less obvious than the read.

`i18n/useLocale.ts` already wrote `sgs:v1:lang` directly, from before this module existed, which
makes contracts §2.3's "one typed module" false as written. It is left alone and the discrepancy
is recorded here rather than papered over: `useLocale` reads its slot in module scope before React
runs, its wrapping is already correct and already tested, and rewriting it through `persist` to
make a sentence true would be a change with no behavioural content. `persist.read`/`write` are
exported and a future edit to `useLocale` should use them.

## D63 — the quiz is generated, and what that means it cannot ask

`assess/perturb.ts` corrupts exactly one relation — the predicate rewritten to another the same
graph uses, or the direction reversed — and `assess/quiz.tsx` asks which triplet is wrong.

**Generated rather than authored**, which is what makes a checkpoint exist in every module
without a lecturer writing ninety of them. It is also the limit, and the limit is stated here
because the interface cannot state it: the item asks whether a reader can adjudicate a triplet
against a scene, and it can ask nothing whatever about the module's prose. A course that mistook
this for assessment of the modules would be measuring one skill and reporting another.

Two corruptions, both adjudicable. A predicate drawn from outside the graph's own vocabulary
would often be absurd rather than wrong — `cup parked_on table` is not a question — and reversal
is an error the literature's own models make, so it is the one worth recognising.

**One graph feeds every checkpoint.** The study shell passes L2's fixture, which is three objects
and three relations. Per-module graphs are content work of the same kind as the presenter notes
of D56, and inventing fifteen of them would be inventing fifteen scenes nobody chose. The seed is
a hash of `module:step:n`, so the checkpoints differ from each other even though the scene does
not.

**Fuzz is off in the scheduler.** `ts-fsrs` jitters each interval by a few per cent by default so
a large deck does not clump on one day. Here it would make the same answer on the same day give a
different due date on each run, and a scheduler whose tests can only assert inequalities is one
whose bugs hide in the slack.

## D64 — a second mechanism for one rule, and the mutation that found it

The quiz grades an item once. That was implemented twice: the option buttons carry `disabled`
once an answer is given, and the handler also returned early on a second call.

Removing the handler's guard changed nothing — the test that claims to cover the rule still
passed, because the disabled attribute had already stopped the click. The assertion was reading
one mechanism while naming the other.

The guard is gone and the test now asserts the mechanism that is actually load-bearing: every
option is disabled after an answer, and the card's `reps` does not move. Removing `disabled` now
fails it.

Two mechanisms for one rule means one of them is untested, and the untested one is whichever the
test does not name. This is the eleventh entry in this file about a test that could not fail, and
the first found by mutating a rule that was genuinely enforced — the defect was the redundancy,
not the behaviour.

## D65 — progress is recorded by both shells, and only moves forward

`store/progress.ts`. A reader who watched the lecture has read the module, so the lecture shell
records `stepIndex + 1` as it advances and the study shell records the whole column on open.

Monotonic, deliberately. Reopening a finished module at step zero must not erase the finish:
"where I am" is the URL's job and "how far I have been" is this one's. The index shows the count
per module and offers the furthest module in curriculum order as `resume`, which is the
affordance contracts §2.2 names for `/` and which no task had built.

## D66 — the export, and the two things it refuses to do

Plan 04 Task 8.

**It does not export this project's own shape under a `.json` extension.** SRS §3 names the
Visual Genome driver as the interoperability target, and the driver puts the region on the object
as `x`/`y`/`width`/`height` rather than in a nested box, and carries a relationship as two whole
object records rather than two ids. A file in this project's shape would be one the ecosystem
cannot read, which is the single thing the export exists to avoid. Everything the driver has no
field for — the mask, the provenance, the dataset id, the score — is namespaced `sgs_`, so the
driver ignores it and NFR-2 still holds: no number leaves here without its source.

`score` is `number | null` on the wire — absent on ground truth, `null` where a source states
none — and the two are kept apart through the round trip rather than flattened to absent. The
compiler found this; the test that pins it was written afterwards and watched to fail.

A relationship naming an object the graph does not have makes the export throw. The driver would
accept the file and fail on a null subject somewhere else, and an export that breaks in someone
else's tool is worse than one that refuses here.

**The SVG export inlines nothing from a stylesheet, because nothing needs inlining.** Every
colour, stroke width and dash in `graph/ImageOverlay.tsx` is an SVG presentation attribute taken
from the palette, not a class. The plan's step says "computed styles inlined"; against this
overlay that would be a pass that found nothing to do, and the honest implementation is to strip
`class` — a class without its stylesheet is a reference to something absent — and say so.

`isSelfContained` is exported as a predicate rather than kept inside the serialiser, so the rule
the export asserts is one a caller can check, including on a file from elsewhere. It knows
`url(#arrow)` is a marker and internal, and `url(https://…)` is not. The overlay on screen is an
`<img>` with an `<svg>` over it, so the exporter takes the frame as a `data:` URI and draws it
beneath everything else; serialising the SVG alone would export the boxes and lose the
photograph.

`ExportButtons` mounts it in L1 and L8, which is the wiring no task asked for and D52, D56 and
D60 are each about. The SVG button appears only where there is an overlay to serialise, because
a disabled button with no explanation is a worse answer than no button.

Seven mutations; all seven caught.

## D67 — the keypress the browser lost and no unit test could

Check 8 of `docs/VERIFICATION.md` walks all fifteen modules on `ArrowRight` alone. On M04 —
eleven steps, the longest module — the deck advanced one step for two presses and then sat there.

`useStepper` computed the next index from the index React had rendered. Playwright presses the
next key the moment the DOM shows the new position, which is before the effect phase has
re-registered the listener, so both presses were computed from the same index and the second
navigated to where the first had already gone. A held arrow key repeats about thirty times a
second, so this is not a robot's problem: it is a professor pressing twice.

Every unit test had waited for a render between presses, which is exactly why none of them saw
it — and the one place it *had* shown, two `fireEvent` calls inside a single `act`, had been
written off in the Task 5 session as a test artefact and worked around by splitting them. That
note is now wrong and the work-around is gone: the two presses are inside one `act` again, and
they fail without the fix.

The hook now tracks the position it has *asked for* as well as the one that has rendered, both in
refs assigned during render so a handler running between commit and effect reads the fresh value.
Two reconciliations: the route arrived where we asked, or the route moved somewhere else — a
bookmark, the back button — in which case the route wins and the pending target is abandoned.

The lesson is about the instrument, not the bug. A unit test that waits for a render between two
keypresses cannot see a lost keypress, and this project's suite is otherwise almost entirely
unit tests. Check 8 exists because the lecture is the product.

## D68 — one key, two encodings

`i18n/useLocale.ts` wrote `sgs:v1:lang` as a bare string. `store/persist.ts`, added in Task 7,
writes every slot as JSON. Nothing had yet written the lang slot through `persist`, so the two
encodings never met and D62 recorded the split as a discrepancy worth leaving alone.

Check 8 made them meet. The Playwright suite seeds the preference so the assertions read as the
rules they check rather than as translations of them; it wrote `'"en"'`, the JSON form, and the
application read it, failed to match `'en'` or `'zh-TW'`, and fell back to 繁體中文. The failing
assertion said "No such page" was missing from a page that was rendering 「找不到此頁面」
perfectly.

`useLocale` now reads and writes through `persist`, so there is one encoding. A preference stored
in the old form is unparseable JSON and falls back, which costs a student one click of the toggle,
once — a migration would have been the thing the version policy forbids.

D62 said a future edit to `useLocale` should use `persist`. This is that edit, and what prompted
it is the point: a format collision between two writers of one key is invisible until something
writes it both ways, and no amount of reading either module would have shown it.

## D69 — check 6 is recorded as not run

`docs/VERIFICATION.md` records nine checks. Eight passed. The sixth — the offline run — needs a
machine with the network down, `torch` uninstalled and the slices never fetched, and this machine
is none of those: `torch` 2.10.0+cpu is importable and five slices are unpacked.

It is recorded as **not run**, and no part of it is inferred from what was run. Two weaker
observations are written down beside it and explicitly do not stand in for it: the Playwright
walkthrough ran with no backend process at all and every P0 frontend surface worked, and
`live_models` is empty here despite `torch` being present, so the registry's gates refuse rather
than crash.

The design document allows two states for a check and this file keeps it that way. A check
recorded as passing because something resembling it passed is worse than one recorded as not run,
because only the second one gets run later.

## D70 — three readings of one KaTeX block, two of them wrong in opposite directions

Check 8 at 1024×768 found M04's steps 1 to 3 running off the panel by up to 163 px — invisible on
the author's display, which reports 1920×1080 while the projector does not. `fitMath.ts` shrinks a
display block to fit, by font size rather than by transform: KaTeX's geometry is linear in its
font size, so the block reflows and its height stays right, whereas a transform leaves the
original height behind as a gap.

Getting there took three measurements of the same geometry, and the two wrong ones each made an
assertion pass against a formula that was visibly cut off.

**`inner.getBoundingClientRect().width` is clamped.** Once the block is a scroll container the
rectangle of its child is clamped to the container, so a formula 163 px too wide measures as
exactly 0 too wide. The first implementation set `overflow-x: auto` *before* measuring, read that
number, concluded every formula fitted, and scaled nothing. The check-8 assertion written to cover
it read the same number and passed. A mutation that disabled the scaling entirely changed nothing,
which is what exposed it.

**`block.scrollWidth - block.clientWidth` undercounts.** Display math is centred, and a centred
overflow spills equally both sides while `scrollWidth` reports only the right. Scaling by that
ratio converges from the wrong number and leaves 16 to 65 px clipped — small enough to look like
rounding and large enough to lose a closing bracket.

**`inner.scrollWidth - block.clientWidth` is the one that is true**, and `overflowOf` is exported
so the test measures what the implementation measures rather than forming a second opinion about
the same geometry. Forming a second opinion is precisely how the first two survived.

Then a fourth error, which looked exactly like the first: the fit ran, scaled, and still left
65 px over. **It was measuring before the KaTeX webfonts had decoded.** The fonts are bundled
rather than fetched, but they still arrive asynchronously, and M02's third block measures 986 px
against the fallback metrics and 1057 px against the real ones. The scale was correct for a
formula that was never painted. `useFitDisplayMath` now re-fits on `document.fonts.ready`.

Three mutations were run against the finished fit. Disabling the scaling and removing the
font-ready refit both fail the check. **Reducing the convergence loop from three passes to one
does not**: after the font refit this corpus converges in a single pass, so passes two and three
are unexercised headroom. They are kept, and said to be unexercised here rather than left to look
like coverage — a formula needing them would be caught by the same assertion.

## D71 — 25 slides of 92 run past the bottom of an XGA panel (accepted)

Also check 8, also invisible at 1920×1080. Measured across all fifteen modules at the three
resolutions a lecture theatre presents at:

| Panel | Slides over the fold | Worst |
|---|---|---|
| 1024×768 | 25 of 92 | M00 step 2, by 1030 px |
| 1280×800 | 24 of 92 | M00 step 2, by 749 px |
| 1920×1080 | 8 of 92 | M00 step 2, by 348 px |

**Put to the author with the options, and accepted as it stands, 2026-09-18.** The two available
moves were to split the long slides into more steps — a small edit, since a step boundary is one
line of frontmatter and a `<Step>` tag — or to leave them. The answer was to leave them, so this
is closed on a judgement rather than on a change.

Shrinking the type to fit was never one of the options: it would break NFR-5's 24 px floor, which
is the one thing standing between these slides and an unreadable projection.

The measurements stay in `docs/VERIFICATION.md` §8 rather than being deleted with the decision. A
different hall, or a term taught from a different machine, re-opens this without anybody having to
measure it again — and a reader who finds a slide running long will find the number here rather
than concluding it was never looked at.

What was fixed is the part that made it worse. The shell scrolled the whole page, so the position
indicator and the section clock scrolled away exactly when a slide was too long to see the end of
— the two things that tell the professor where they are, gone at the moment they are needed. The
step region now scrolls inside a fixed shell. A mutation back to the old layout fails three tests.

## D72 — `/api/content/*` is normative, absent, and should stay absent

Contracts §1.10 specifies `GET /api/content/{modules|papers|leaderboards|kp}`. No such route
exists. `app/api/` holds `datasets`, `eval`, `health`, `models` and `vlm`, and nothing else.

The frontend never needed it. `pages/papers.ts` and `pages/boards.ts` import
`data/content/*.json` directly, so the corpus is compiled into the bundle, and `content/registry.tsx`
reaches the modules through `import.meta.glob`. Every page that §1.10 would have served was
already served without it, which is exactly why three plans went by without anyone noticing the
contract was unimplemented.

**It is the better answer, and that is the awkward part.** A build-time import is offline-complete
in a way a fetch is not: the knowledge points render with the backend stopped, killed, or never
started, and check 6 now demonstrates precisely that. An endpoint would have added a request, a
loading state and a failure mode to deliver a few hundred kilobytes that never change within a
session. Had it been built to contract, the first thing a careful reviewer would have asked is why.

So the contract is marked superseded in place rather than the route being written to satisfy it.
The paragraph stays, with the reason, because the failure mode here is not a missing endpoint —
it is a future contributor reading a normative document, finding a specified API absent, and
dutifully building it. A specification that is silently wrong recruits people to make it true.

Found in the plan-04 consistency review, recorded here two sessions later. That gap is itself the
point: a review finding that is reported in a message and not written into the repository has been
observed, not recorded, and the next reader starts from the document.

## D73 — the audit, reduced to what actually cannot be fixed

`npm audit` reported six advisories, three of them high. After this pass it reports four, two
high, and each survivor has a reason rather than a shrug.

**Fixed.** `@xmldom/xmldom` was pinned at 0.9.10 by `speech-rule-engine`, which MathJax pulls in,
and every 0.9.x up to 0.9.11 carries the advisory. `npm audit fix` could not lift it: the pin is
exact, so there is nothing in range to move to. An `overrides` entry takes it to 0.9.12. That is
forcing a patch bump on a transitive dependency someone pinned deliberately, which is worth doing
only because the blast radius is measurable: the sole consumer is `tools/build_standalone.mjs`,
and `lint:standalone` fails CI if its output drifts by a byte. Regenerated after the override, the
standalone is **byte-identical**. `speech-rule-engine`'s own moderate advisory went with it.

**Left, with the reason.**

| Advisory | Why it stays |
|---|---|
| `toml`, high, via `remark-mdx-frontmatter` | No fix published. It parses YAML frontmatter at build time, from `.mdx` files in this repository, authored by the lecturer. The prototype-pollution path needs attacker-controlled input and there is none: a hostile frontmatter block would have to be committed here first. |
| `remark-mdx-frontmatter`, high | The same advisory, reported against the direct dependency that carries it. One problem, two rows. |
| `vitest` and `@vitest/mocker`, moderate | The fix is vitest 5, a major bump, for a moderate advisory in a test runner that never runs in front of a student. **Attempted 2026-09-19 and reverted — see below.** |

None of the four is on a runtime path. The application fetches nothing (check 6 proves the
attempt is never made), so every one of these is a build-time exposure on a machine that already
runs this repository's code.

**The vitest bump was tried on 2026-09-19 and reverted, so the reason is now evidence rather than
an estimate.** `vitest@5.0.1` runs the suite perfectly — 502 of 502 pass — and clears both
moderate advisories. Then `tsc -b` fails: vitest 5 changed the `Assertion` generic to
`Assertion<void, T>`, and `@testing-library/jest-dom`'s type augmentation no longer matches it, so
every `toBeInTheDocument`, `toHaveAttribute`, `toHaveTextContent` and `toBeDisabled` in the suite
becomes a TS2339. Bumping jest-dom to 7.0.1, its latest, does not fix it either. The ecosystem
has not caught up, and the alternatives are to drop jest-dom's matchers across the frontend tests
or to stop type-checking the tests — both of which cost more than a moderate advisory in a tool
no student runs. Reverted to `vitest@3.2.7` with a clean `npm ci`, and the gate is green.

**`toml` cannot be fixed by upgrading at all.** `remark-mdx-frontmatter@5.2.0` is the latest
published version and still depends on `toml@^3.0.0`, and every `toml` up to 4.1.2 carries the
advisory, so there is nothing in range. The only remaining route is to stop using the plugin and
emit the `meta` export from the YAML ourselves, which would replace a maintained upstream with
local code to close a path that needs a hostile frontmatter block committed to this repository
first. The `@xmldom/xmldom` override earlier in this entry was worth doing because its blast
radius was one tool and the output was byte-identical afterwards; this one is not the same trade.

## D74 — NFR-8 was the one requirement with no enforcer, and the instrument reported itself

`docs/INDEX.md` §3 lists what enforces each non-functional requirement. NFR-1 through NFR-7 each
name an artefact. NFR-8's cell was blank, and it stayed blank through four plans and nine checks
because nothing about it was ever wrong on screen — a fast application looks the same as an
unmeasured one.

Its three numbers — cold start under 10 s, lab interaction under 100 ms, a measured estimate
before a live inference — were asserted nowhere. The only timing assertion in 253 pytest and 487
vitest was `/api/health` under 50 ms, which is a claim about a different component and was being
allowed to stand in for the rest.

`npm run check:perf` measures all three. The numbers are in `docs/VERIFICATION.md` §10 and they
are comfortable: a fortieth of the cold-start budget, and under three milliseconds of work in
every lab timed. The finding is not that the application was slow. It is that nobody knew.

**The first version of the interaction table was a measurement of the instrument.** Every lab
came back at 33 ms. That is two animation frames at 60 Hz, which is the floor of an input-to-paint
measurement made by awaiting two frames, and it would have been recorded as the application's
cost. The fix is a calibration: the same idle two-frame wait, measured on the same page in the
same frame, subtracted. The work is then 0.0 to 2.1 ms and the 33 ms is the display.

This is D54's defect in a new place — a number that reads as a measurement of one thing and is a
measurement of another — and it is worth noting that it was caught by the numbers being *too*
uniform rather than by anything failing. Five different labs doing five different amounts of work
cannot all cost 33 ms.

**Three labs are not measured, each for a stated reason.** L4 and L5 start a request when their
button is pressed; that is not a local interaction and NFR-8's third clause governs it. L6 has no
control. Recording them as untimed is the same discipline as check 6 being recorded as not run
before it was arranged.

**One production change, and one reverted.** Five `data-testid` attributes were added to controls
in L1 and L2 so the spec could address them, which is the same reason `data-lab` exists on
`LabFrame`. The reverted one is D75.

## D75 — a box is clickable on its outline only, and widening it has a cost

L1's first perf case drove the lab the way a student does: click one box for the subject, another
for the object, choose a predicate, add. It timed out. `<rect fill="none">` is not a transparent
fill — SVG hit-tests the fill region only when there is one — so a click aimed at the middle of a
bounding box passes through to the image and only the 2 px stroke responds.

`pointer-events: all` fixes it in one line and was applied. Then the setup failed differently:
with interiors live, a click at the centre of one box is taken by whichever later box covers that
point, and in the placeholder frame that is sometimes the subject — which `select()` reads as
clicking the subject twice and clears the pair. The fix had made the selection ambiguous wherever
boxes overlap, which in a scene graph is most of the time.

So `pointer-events: all` is reverted, and recorded rather than quietly kept.

**Resolved 2026-09-19, by not asking the browser.** The two readings looked like a choice — an
interior that selects, which is what people expect, against an outline that selects, which is
unambiguous under nesting — and they are not. What made the first one ambiguous was delegating
the decision to paint order, not the interior being live. Deciding it explicitly gives both.

`geometry.pickObjectAt` returns **the smallest box containing the point**, with ties broken by
the lower object id so the same click gives the same answer on every machine (NFR-4). The
boundary counts as inside, so the outline goes on selecting what it outlines and nothing that
worked stops working. A click inside the hand selects the hand; anyone wanting the person has all
of the person that is not the hand. Nesting makes the rule unambiguous, which is the opposite of
what z-order does with it.

The handler moved from each `<rect>` to the `<svg>`, and a click whose target is a box is left to
that box's own handler — handling it in both places would name a subject and clear it again in one
click, which is a click that undoes itself. The pointer cursor moved with it: it was on the rects,
so it appeared over a 2 px stroke and promised nothing about the interior it sat inside. The area
that responds and the area that says it responds are now the same area.

Tested at both levels, because each proves something the other cannot. `geometry.test.ts` has
eight cases for the rule itself, and `ImageOverlay.test.tsx` five more for the wiring, in jsdom
with a stubbed client rect. Three mutations — dropping the draw-mode guard, dropping the
already-handled guard, falling back to the first object — were each caught. But jsdom has no hit
testing at all, so every one of those would pass against the original defect. The real-browser
half is one case in `perf.spec.ts`, which clicks the centre of a box with `page.mouse` and
asserts a role was assigned; detaching the svg handler in view mode fails it and nothing else.

The perf case still sets `s`, `o` and `p` through the query string — not because clicking is
unreliable any more, but because it keeps the measured act to the one click being timed.

## D76 — presenter notes existed for one module in fifteen

`de90ac9` built the presenter window and `content_lint.mjs` learned the D56 rule that both
locales must agree on which steps carry notes. Neither required that any step carry them. M00 had
four notes and the other fourteen modules had none, so the window correctly reported "no notes"
on 88 steps of 92 — an artefact reporting an absence, working exactly as built.

`docs/INDEX.md` recorded this as "the lecturer's to write", which was the right call at the time
and had the effect of parking it indefinitely.

All 92 steps now carry notes in both locales, 184 in total, written against each step's own
content: what has to land, what to put on the board before the slide does, what the room usually
gets wrong, what to compress when the clock is short, and which earlier module a step depends on.
They are procedural rather than expository — no note introduces a claim the module does not
already make, because a presenter note is not a place to teach something new.

`content_lint.mjs` now refuses a step without them. Watched to fail: one note removed from
`m09.en.mdx` produced two problems, the new rule naming the step and the D56 rule naming the
locale disagreement it also creates.

Four of the modules' notes are worth reading before the others, because they carry a dependency
the lecturer has to check in the room rather than a piece of advice: M06 s1 and M11 s1 both fail
in front of a class that has not had M04, and M11 s3 has to clear a three-way notation collision
before its equations are legible.

## D77 — the offline check could not be run the way its own usage note says to run it

`tools/offline_check.mjs` prints, in the message it shows when `torch` is importable:

    node tools/offline_check.mjs --python .offline-venv/Scripts/python

That command fails. The backend is spawned with `cwd: 'backend'`, so a relative interpreter path
is resolved against `backend/` rather than against `system/`, and Node reports a spawn ENOENT
naming the interpreter — which reads as "that venv does not exist" and not as "it exists one
directory up". Found on 2026-09-19 by following the instruction literally on a fresh venv.

It survived check 6 on 2026-09-18 because that run used a path the mistake happened not to break.
An instruction a document gives and a command anybody has actually typed are two different things,
and this is the second time in this project that the gap between them has produced a finding.

Both harnesses now resolve an interpreter to an absolute path when it contains a separator, and
leave a bare name alone so a PATH lookup still works. Verified with a forward-slash path and with
a Windows backslash path, on `check:offline` and on `check:perf`.

**The fix was written twice, and the first version was wrong in a way this project has a note
about.** Patching through a shell heredoc turned `/[\/]/` into `/[\/]/`, a character class
matching forward slash only — so the Windows spelling of the very path that produced the finding
would have gone unresolved. The repository's own guidance is to patch JavaScript and Python with
the editing tool rather than a heredoc, for exactly this. Corrected, then re-verified with a
backslash path specifically.

## D78 — the licence guard fired on a virtual environment

Building the torch-free interpreter that D77's fix made usable turned `npm run ci` red. The
failure was the RelTR vendoring guard, on `dns.py: CLASSES = [`.

`dns.py` belongs to a dependency of a dependency inside `system/.offline-venv`. It is not RelTR,
it is gitignored, and it was never going to be committed. The guard walks `system/` with
`rglob("*.py")` skipping `node_modules` and `__pycache__`, and a virtual environment is neither.

**A licence guard that fires on an ordinary developer action is worse than no guard**, because
the next red run is read as noise and waved through — and the one thing this particular guard
exists to catch is a paste nobody would notice on their own. The scan now also skips
`site-packages`, chosen over a list of venv names because it is the one directory every layout
has, whatever the environment is called or wherever it sits.

Verified both ways rather than one: the suite is clean with the venv present, and a file written
into `backend/app/` carrying `REL_CLASSES = [` still fails the guard by name.

The finding is a second-order consequence of D77. Fixing the harness so the documented command
works made somebody build a venv where the documentation says to build it, which is how a latent
assumption in an unrelated test came to the surface.

## D79 — `ruff` was in the gate for half the Python in the repository

`a58808b` put `ruff` in CI as `python -m ruff check backend`. The repository also has Python in
`system/tools/`, and that half was never looked at. Two findings sat there: an `E731` lambda
assignment in `gen_modules.py` and an unused `import json` in `gen_papers.py`.

Both are trivial. The point is the shape, which is the one `a58808b` set out to fix: a linter
that runs over part of a tree reads, from the CI log, exactly like a linter that runs over the
tree. `lint:py` is now `ruff check backend tools`.

A third finding was not a ruff finding. `python tools/gen_modules.py` printed

    SyntaxWarning: invalid escape sequence '\o'

from the docstring of `yaml_str` — the function whose docstring **explains that `\o` is an
invalid escape sequence**. It was written as a plain string literal, so Python read the example
the same way YAML would have, and the paragraph demonstrated the trap it was describing. It is now
a raw string. Python currently warns; a later version makes this an error.

Verified with a sweep: every `.py` in the tree outside `node_modules`, `__pycache__` and
`.offline-venv` compiles with no `SyntaxWarning`.

**Also verified, rather than trusted: the two driverless scaffolds really do write nothing.**
Their headers say so, and a header is not a guarantee — one of them ends in a function that writes
`.mdx` files, and those are the files that now carry 184 presenter notes. Neither has a `__main__`
block or any call site, so running either defines functions and exits. Both were run, and the
content tree was unchanged afterwards. They stay as records of how the corpus was shaped.

## D80 — every Python step now names its interpreter: the `py12` environment

`start.ps1` pinned `C:\Python\Python312\python.exe` and fell back to `python`; every other
Python step — the `npm` scripts, `tools/parity.mjs`, `tools/perf_check.mjs` — used the bare name
`python` and took whatever PATH resolved first. Two different interpreters were therefore in
play depending on which front door was used, and nothing in the repository said which one the
results belonged to. The author's environment is the global virtual environment `py12`
(`C:\Python\pyVenv\py12`, Python 3.12.3), so the machine-wide interpreter that CI had been
running on was not the one the project was being developed in.

The decision is now in two files that apply the same order — `SGS_PYTHON`, an activated `py12`,
`py12` on disk (`PY12_HOME` first, then the known locations), then PATH:

* `system/tools/py.mjs` — `pickPython()` is pure, so `tools/test/py.test.mjs` asserts the order
  rather than describing it. It is also a command: `node tools/py.mjs <args>` runs anything on
  the resolved interpreter, and `setup`, `test:py`, `lint:py` and the new `check:pins` do.
* `system/tools/Resolve-Python.ps1` — dot-sourced by `start.ps1` and `fetch-data.ps1`.

**When `py12` is absent the scripts stop and ask.** They print what is missing and how to create
it, list the virtual environments found on the machine, and let the user choose one; the choice
is honoured for that run only. A session that cannot prompt is told to pass `-Python` or set
`SGS_PYTHON`. Falling through to PATH silently is what produced this deviation, so nothing does
it any more.

**`tools/offline_check.mjs` deliberately does not use the resolver.** Check 6 requires a
torch-free interpreter, and `py12` carries torch; resolving to it would make that check refuse
every run. It keeps its own `--python` and its PATH default, and now says why.

Two defects in this change were found by running it rather than reading it, and both are fixed:
`Join-Path` throws on a path naming a drive that does not exist — precisely the unset-up machine
the fallback exists for — so path building uses `[IO.Path]::Combine`; and `-NonInteractive`
leaves `[Environment]::UserInteractive` true, so the menu reached `Read-Host` and threw instead
of printing the non-interactive message. The command line is now inspected as well, and the
prompt itself is wrapped, because a redirected stdin cannot be detected in advance. The
environment menu also deduplicates by `pyvenv.cfg` identity: `D:\Python` on this machine is a
junction to `C:\Python`, so every environment was offered twice under two paths.

**One pre-existing assertion changed state.** `requirements-infer.txt` pinned torch 2.10.0 and
torchvision 0.25.0, measured on the machine-wide interpreter. `py12` had 2.9.1 and 0.24.1, and
`test_pins.py` compares a pin against the interpreter the suite is actually running on, so
moving CI onto `py12` turned an optional-extras pin into a failure. The pins were kept and the
environment was brought up to them (the author's call), rather than the pins being rewritten
down to what happened to be installed.

## D81 — four tests that passed on the author's Node and failed on CI's

`main` had a red CI for three consecutive runs (2026-09-18 13:33, 15:36, 2026-09-19 01:28) while
`npm run ci` was green on the author's machine. Four tests failed, all of them about the
presenter channel: two in `PresenterWindow.test.tsx`, one in `useStepper.test.tsx`, one in
`routes.test.tsx`. Each timed out at its 1 s budget — the message simply never arrived.

**The variable was the Node version, not the operating system.** The workflow pins
`node-version: '22.12'`; the author's machine runs 24.19. Running the same files on Windows
under 22.12 reproduced all four failures, which removed Ubuntu from the question.

**Root cause.** jsdom 26 implements no `BroadcastChannel`, so what the suite had been using was
Node's own global, reached from inside the jsdom realm. Three probes bounded it: two Node
`BroadcastChannel`s exchange messages correctly on 22.12 on the main thread, inside a worker
thread, and with the global `MessageEvent` replaced. Delivery stops only inside the vm context
that the jsdom environment runs test code in. On 24.19 it works there too, which is the whole of
the difference between the two machines.

**This is not an application defect.** A browser implements the class itself, and the product
code is unchanged. The defect was in the test environment: a browser API the emulated
environment lacks was being borrowed from the host, and its behaviour was never asserted.

**Fix.** `frontend/test/setup.ts` now supplies a same-realm `BroadcastChannel` over jsdom's
`EventTarget` and `MessageEvent` — the third such block in that file, after `PointerEvent` and
the realm-tolerant `Request`. It implements the part of the specification the suite depends on:
delivery to every *other* open channel of the same name, on a macrotask, structured-cloned, with
a closed channel that neither receives nor sends. `frontend/test/broadcastChannel.test.ts`
asserts all five of those properties, so a future breakage names itself instead of timing out
four unrelated tests. Watched to fail: delivering to the sender, dropping the clone, and letting
a closed channel post each produced exactly one failure naming the rule broken.

**Verified on both interpreters.** Under Node 22.12 the suite goes from 4 failed / 511 passed to
515 passed in 45 files; under 24.19 `npm run ci` exits 0 with the same 515. The workflow keeps
`22.12`, since D-03 states 22.12 as the floor and a student on Node 22 must see the same result
the author does.

## D82 — the GPU was there the whole time; the interpreter had the CPU wheel

`requirements-infer.txt` pinned `torch==2.10.0`, and `pip install -r` resolved that from PyPI,
which serves the CPU wheel on Windows. The author's box has an RTX 3090 with driver 595.79, so
the project had been carrying a comment reading "measured as 2.10.0+cpu" while
`torch.cuda.is_available()` returned `False` on a machine with a 24 GB card in it.

It is pinned to the CUDA 12.8 build now: `torch==2.10.0+cu128`, `torchvision==0.25.0+cu128`,
measured at `torch.version.cuda 12.8`, one device, compute capability 8.6, cuDNN 9.10.2, with a
matmul run on the device to prove it rather than a flag read back. VERIFICATION §13 has the
table.

**Two mechanisms had to change before the tag meant anything**, and both are the same failure
this repository keeps finding — a statement nothing checks:

* `parse_pins` refused every line without `==`, so the `--extra-index-url` line the CUDA build
  requires could not be written into the file at all. Options are now skipped. Without the index
  line, `pip install -r` fetches the CPU wheel again and the file's own claim goes stale on the
  next install — which is exactly how this deviation started.
* `compare` dropped the local segment on **both** sides, so `+cu128` in the file would have been
  satisfied by a `+cpu` wheel. The rule is now asymmetric: a pin with no local segment accepts
  any build (`torch==2.10.0` is still met by `+cpu`, as D-02's ARM64 target needs), and a pin
  that states one is compared exactly. Watched to fail, the check reports
  `torch pinned 2.10.0+cu126, found 2.10.0+cu128`.

**Nothing about NFR-1 moved.** `requirements.txt` lists no torch, `npm run check:offline`
(check 6) still demands an interpreter where torch is not importable, and no P0 feature touches
the GPU. This is an opt-in extra on one of the two machines; the ship target of D-02 is ARM64
with no CUDA and is unaffected.

## D83 — seven tests that passed on the author's OS and failed on CI's

D81 ends by saying the suite was verified on both interpreters and the workflow keeps 22.12. It
was verified on both **Node versions**, on one operating system. The commit carrying that fix
(`436c6b4`) also introduced `tools/test/py.test.mjs`, and every one of its seven tests failed on
`ubuntu-latest`. `main` was therefore red for five consecutive pushes rather than three, and the
two commits that recorded checks 12 and 13 as passed were both among the red ones.

**Root cause.** `py.mjs` took the platform from the host — `const WINDOWS = process.platform ===
'win32'` at module scope, and `join`/`basename` from `node:path`, which follow the host too. The
tests spelled one host's answers into their assertions:

```
Expected: "C:\Python\pyVenv\py12\Scripts\python.exe"   Received: "python3"
Expected: "D:\envs\py12\Scripts\python.exe"            Received: "D:\envs\py12/bin/python"
```

The second line is the whole defect in one string: a Windows directory joined POSIX-style, which
is neither layout and can match no file.

**The docstring was the tell.** `pickPython` was documented as "Pure: everything it reads comes
in through `env` and `exists`, which is what lets the resolution order be asserted rather than
described." It read a third thing, `process.platform`, which is exactly the input that could not
be varied — so the assertions described the author's machine while claiming to state a rule.

**Fix.** `platform` is a third injected parameter, defaulting to `process.platform`, and
`win32`/`posix` are chosen explicitly instead of the host-flavoured `join` and `basename`. The
test file runs every case against both platforms through `describe.each`, on whichever machine
the suite is on: 20 tests where there were 7.

**One behaviour changed rather than being merely made testable.** The three machine-wide
candidates (`C:\Python\pyVenv\py12`, `C:\venvs\py12`, `D:\Python\pyVenv\py12`) are offered on
Windows only. On a POSIX host they produced three entries that could never exist and could not
be asserted; the list is now empty there, the fallback is reached, and the workflow's
`SGS_PYTHON: python` is what names the interpreter — which is what the workflow already said it
was for. A `$HOME/pyVenv/py12` candidate was added to match the `%USERPROFILE%\pyVenv\py12` that
was already there.

**Also fixed in passing:** `dirs.map(interpreterIn)` passed the array index as the function's
second argument. Harmless while the function took one parameter; a latent trap the moment it
took two, which is what this change does.

**Watched to fail.** The new test file run against the previous `py.mjs`, on Windows: 9 failed,
11 passed. The nine are every POSIX assertion, none of which existed before.

**The trap, stated generally.** A test suite that runs in one environment states nothing about
another, and this is the second time in two days that "green on my machine" was read as green.
D81's variable was the Node version; this one's is the operating system. The common shape is an
input the code reads from its surroundings and the test cannot vary — so the seam is to make the
surroundings an argument, not to add a second machine.

## D84 — the suite was red in the configuration where the adapters are actually tested

`SGS_CORPUS_ROOT` points at `C:\DataRaw` on the author's machine, which is how the four adapter
tests written against the real corpora run at all; without it they skip with "no corpus on this
machine". With it set, `test_data_dir_follows_its_environment_variable` fails:

```
assert WindowsPath('C:/DataRaw') == (WindowsPath('…/test_data_dir_follows_its_envi0') / '_raw')
```

The test sets `SGS_DATA_DIR` to a scratch directory and asserts that the corpus root defaults
underneath it. That holds only when no corpus root is named, and `settings.py` reads
`SGS_CORPUS_ROOT` first. So the test asserted the ambient environment rather than the rule, and
did it in the only configuration where the adapter tests are not skipped: 1 failed, 269 passed.

**Nothing in the application is wrong.** `tools/offline_check.mjs` sets `SGS_CORPUS_ROOT` as
well as `SGS_DATA_DIR` and never relied on the default, so check 6 was never affected.

**Fix.** The test clears `SGS_CORPUS_ROOT` before reloading, so it states the default rather
than reading the machine. A second test,
`test_an_explicit_corpus_root_is_not_moved_by_the_data_dir`, states the half that check 6 relies
on — an explicit corpus root wins — so the reason `offline_check.mjs` sets both variables is
written down where it can be broken. Watched to fail: with `CORPUS_ROOT` hard-wired to
`DATA_DIR / "_raw"`, the new test fails naming both paths.

With the corpus root set, the suite is now 271 passed and 2 skipped — the two remaining skips
being `vrd` and `haystack`, whose licence gates are shut (D-06).

## D85 — a passing gate that printed an error on every run

`npm run lint:mockup` reported 13 PASS and no failures, and printed `Error: Not implemented:
window.scrollTo` with a ten-frame jsdom stack trace in the middle of them. The mockup scrolls to
the top when a nav item is clicked; jsdom implements no `scrollTo` and announces the fact rather
than throwing.

Nothing was broken, which is the problem: an error printed by a green gate on every run teaches
the reader to skip errors in that log, and this repository has already spent time on a check
that could not be believed (D78). `window.scrollTo` is now a no-op supplied to the emulated
environment, in the manner of the `BroadcastChannel` stub of D81 — the same shape of fix, for
the same reason. The 13 checks and the 16137-character text count are unchanged.

## D86 — the presenter window waited for ever, and check 8 asserted that it should

Reported from the room: opening `http://localhost:5173/lecture/notes` shows only
`Waiting for the lecture window.` That message is correct when no lecture is running. It was also
what the window showed when a lecture *was* running, in the ordinary case.

**Root cause.** `useStepper` broadcast from an effect keyed on `[index, moduleId,
remainingSeconds]`. `remainingSeconds` is `null` unless the step declares `seconds_budget`, so:

* on a **budgeted** step the value ticks once a second, the effect re-runs, and a presenter
  window opened late catches the next tick within a second;
* on a step with **no budget** the shell posted once, on entry, and never again.

`BroadcastChannel` retains nothing, so a subscriber that arrives after the only message hears
silence. **30 of the 92 steps declare no budget, two in every module, and one of the two is
always the first** — so "open the module, then open the presenter window", which is the order a
professor works in, failed every time.

**Reproduced against the dev server before any change**, with two pages in one browser context:

| lecture shell sits on | presenter window opened second |
|---|---|
| `m00` step 0 (`s1`, prose, no budget) | idle pane, `等待講授視窗連線。` |
| `m00` step 1 (`s2`, math, 240 s) | full notes within 2 s |

**The check that should have caught it asserted it instead.** `e2e/lecture.spec.ts` opened the
notes window, expected `presenter-idle`, then pressed `ArrowRight` to escape it, under a comment
reading "The shell posts on every step change, so moving the lecture is what wakes the second
window." The workaround had been written down as the specification. This is the sharpest form of
a trap this project keeps meeting: a test that arranges the favourable ordering cannot see an
ordering defect, and one that documents the unfavourable ordering as expected behaviour actively
protects it.

**Fix: a liveness handshake.** `/lecture/notes` posts `{kind: 'hello'}` once, after subscribing;
a running shell answers with its current position, read through a ref so the answer is where the
lecture is now rather than where it started. Two alternatives were rejected. A one-second
heartbeat regardless of budget makes every step pay for a problem that exists only at
subscription. Writing the position to storage and reading it at mount keeps the window strictly
passive but can go stale — a window opened after the lecture closed would show notes for a
lecture nobody is giving, and telling that apart needs a timestamp and a threshold. Only a
running shell can answer a question, so the handshake cannot go stale.

`PresenterWindow`'s docstring said it "sends nothing back". That was about *control*, and control
is unchanged: the window still cannot drive the deck. The docstring now says which of the two it
means, and contracts §2.4 records the second message and that the position shape is untouched.

**Two further changes the report earned.** The shell's channel now lives in a ref and is opened
once, instead of being torn down and rebuilt every second on any budgeted step. And the idle pane
names the remedy (`presenter.waiting_hint`, both locales): the route is reachable by its own URL,
which is how this was reported, and a state that gives a condition with no way out of it reads as
a fault.

**Watched to fail, twice, because the first attempt did not.** The jsdom test written first
*passed* against the unfixed code: the `BroadcastChannel` shim delivers on a macrotask, so the
shell's message was still in flight when the presenter subscribed and arrived anyway. A 20 ms
wait between the two renders makes the ordering real, and the test then failed with
`Unable to find an element by: [data-testid="next-absent"]`. The browser test is the one that
matters, and with the `hello` removed it fails on `presenter-root` never becoming visible. jsdom
could mask this defect; two real windows cannot.

## D87 — the track moved out of `course-lab` and into WekaExt

**Plan:** none. This is not a deviation from a plan but a change of the ground every plan stands
on, recorded here because `DEVIATIONS.md` is where this project keeps things that would otherwise
become folklore.

**What moved.** `AI-LLM/scene-graph-studio/` in `course-lab` became `scene-graph-studio/` in
`gitea.cillab.me/CIL-Team/WekaExt.git`, on 2026-09-19, from `feat/playgrounds-m0` at the tip that
followed `13657e7`. `git subtree split` rewrote the paths and `git subtree add` grafted 79 commits
onto WekaExt's `main`; `git subtree merge` carried the further 10 of the in-flight playgrounds
branch. All 386 tracked files and all 89 commits travelled. `git blame` is unaffected.

**Why, and what the alternatives were.** Recorded as decision D-22, which supersedes D-01 and
D-20.

**What the move severed.** Two things, both restored in the same cycle. The track had no
`CLAUDE.md` and inherited `course-lab`'s; WekaExt's root has none, so it now carries its own.
And `course-lab`'s root `.gitignore` held a bare `data` rule plus two un-ignore negations naming
this track — the hazard that had already cost two tracks their data directory. WekaExt has no
rule over this tree, verified by `git check-ignore` over all 386 tracked paths, so the negations
stayed behind.

**What did not move, deliberately.** `plans/2026-09-15-01-skeleton-and-eval-engine.md` still
names `AI-LLM/scene-graph-studio/` five times, including the full text of the GitHub workflow it
specified. It is a completed plan and a record of what was decided at the time. Rewriting it
would destroy evidence and gain nothing.

**CI changed forge.** `.github/workflows/scene-graph-studio.yml` (GitHub Actions) became
`.gitea/workflows/scene-graph-studio.yml` (Gitea Actions), path-filtered on `scene-graph-studio/**`
and running the same `npm run ci`. WekaExt's own `ci.yml` and `deploy.yml` were not edited.
Deployment of this track remains out of scope, blocked by the same three reasons as before: a
private repository, third-party content, and the backend dependency.

## D88 — the three M0 playgrounds, and the four things building them decided

**Plan:** `plans/2026-09-19-playgrounds-m0.md`, tasks 1–13. **Spec:**
`specs/2026-09-19-playgrounds-design.md`.

The entry is numbered D88 and not D87. The plan's Task 13 says to append a `## D87`; D87 was
taken by the relocation on 2026-09-19, between tasks 6 and 7 of the same plan. This is the trap
`docs/INDEX.md` §6 already lists — numbering an appended entry without reading the end of the
file — arriving from the one direction it was not expected from, a plan written before the entry
it would collide with existed.

**`ImageOverlay` gained a `layers` prop rather than F1 gaining a second copy of the geometry.**
Before this cycle the component drew boxes and relationship edges and no visible object names at
all: the name was in the `<title>` a screen reader reads, and nowhere a projector shows. F1's
entire claim is that a list of labels loses the scene, which cannot be demonstrated by a component
that will not draw a label. The alternative was for F1 to draw its own overlay, which means a
second implementation of the image-coordinate transform, and two of those drift. `layers` is
additive and defaults to what every existing caller already got — `boxes` and `relationships` on,
`labels` off — so no lab changed behaviour, and that default is asserted rather than assumed.

**F2 does not reuse `SceneGraphView`, although it exists and draws exactly this diagram.**
`SceneGraphView` renders through cytoscape onto a `<canvas>`, and a node painted on a canvas is
not a DOM element, so it cannot be a `<button>`. Spec §4.2 requires every knob to be operable from
the keyboard and check 8 walks the whole lecture without a mouse, so F2 renders its six objects as
real buttons instead. The cost is a second way of drawing a graph in the codebase; the cost of the
other choice is a playground the professor cannot drive from the podium.

**Eight lint rules, each watched failing.** Task 11 Step 5 broke M0, the mount table or the golden
file in the eight ways the rules describe and recorded what `content_lint.mjs` said. The messages,
in order:

| Break | Message |
|---|---|
| `kp:` deleted from `s2` | `m00.zh-TW.mdx: step 's2' is a playground and names no kp. Contracts §2.4 requires one.` |
| `kp: F99` | `m00.zh-TW.mdx: step 's2' names kp 'F99', not in kp.json` |
| `kp: T1` | `m00.zh-TW.mdx: step 's2' has a playground for 'T1', which this module neither owns nor cites. A playground for a point the module does not teach is a misfiled widget.` |
| `F1:` commented out of `mounts.tsx` | `m00.zh-TW.mdx: no component is registered for 'F1' in frontend/src/playgrounds/mounts.tsx` |
| body tag changed to `F2` | `m00.zh-TW.mdx: step 's2' declares kp 'F1' but its body carries F2. Frontmatter and body disagreeing is the defect this catches.` |
| a second `<Playground kp="F1" />` | `m00.zh-TW.mdx: 'F1' is mounted more than once in this module` |
| `kp: F8` in the `en` file only | `m00: step 's4' is playground/F2 in zh-TW and playground/F8 in en. A playground must be the same playground in both languages.` |
| a case's `why` truncated | `pg-F1-ph001-full-slice: 'why' must write out the arithmetic a reader would check` |

Seven of the eight breaks produce more than one message, and correctly so: a kp that is not in
`kp.json` is also unowned, unregistered, and absent from the body, and a kp changed in one locale
trips the cross-locale rule as well. The plan expected exactly one problem per break. Each rule
was confirmed by finding its own message in the output rather than by counting the lines, and the
lint was verified clean before the first break and after the last.

**The keyboard assertion was watched failing with the knob rebuilt as a `div`.** `Slider`'s
`<input type="range">` was temporarily replaced by a focusable `<div role="slider">` that still
moved its own value on `ArrowLeft`, so the only property under test was whether the knob is a
form control. The test failed — not on the deck assertion the comment points at, but one line
earlier, on the readout, which by then no longer existed: `ArrowLeft` reached the lecture shell,
the shell went back a step, and the playground went with it. `useStepper.isTextEntry` keys on the
focused element being an `INPUT`, and a `div` is not one. The control kit was restored and
`git diff` confirmed it byte-for-byte unchanged.

**Two tests elsewhere were pinned to a step number that Task 10 moved.** M0 went from four steps
to seven, so `/lecture/m/m00/1` stopped being the mathematics and became F1. `projector.spec.ts`
held two tests at that URL: one asserting that the position and clock stay on screen on a slide
too long to fit, quoting a measured 1030 px of overflow, and one measuring every painted word
against NFR-5's 7:1. Both still passed, which is the problem — measured at XGA, M0's seven steps
now overflow the panel by 0, 146, 1030, 0, 0, 0 and 0 px, so the 1030 belongs to index 2 and the
first test had been left asserting something about an over-long slide against one that nearly
fits. It is repointed to index 2. The contrast test now walks index 2, 1, 3 and 4, because the
playgrounds' readouts draw from Tailwind's scale rather than from `palette.ts` and are a second
palette on the same deck. **When first repointed this reported a pass, and that pass was false**
— see the entry below.

Two of Task 4's tests in `frontend/src/content/test/registry.test.tsx` failed against the M0 this
cycle produced, and both were right to. One pinned M0's step ids to the old four. The other
rendered every step bare and asserted only that nothing threw, which was sound while no module had
a playground step and became a real render the moment one did — a playground reaches
`useSearchParams`, so it needs a router. It now renders inside `MemoryRouter` and asserts that a
playground step mounts a `playground-frame` and not the `playground-unknown` placeholder, because
an unregistered kp also does not throw.

**The contrast instrument could not see the colours this cycle added, and the readouts were
below 7:1.** Found in review, 2026-09-20. `projector.spec.ts` resolved a computed colour with
`/rgba?\((\d+),\s*(\d+),\s*(\d+)/` and skipped any element it could not parse. The frontend is
Tailwind v4.3.3, which emits `oklch()` for every colour utility, so every Tailwind-styled element
was dropped in silence: on the F1 step, 13 of 20 text rows, including all four readouts. The
`palette.ts` content the test was written against is plain `rgb()` and was measured all along —
195 of 195 rows on the mathematics step — which is why a blind instrument had gone on reporting a
pass. The floor assertion did not catch it either: it required more than 3 rows, and the 7
survivors cleared it.

Underneath the instrument was a real NFR-5 breach, on exactly the numbers a playground exists to
display. Measured at XGA against the frame's own background, `rgb(248,250,252)`:

| Ink | Where | Was | Now |
|---|---|---|---|
| `text-slate-500` → `text-slate-700` | readout label, and the NFR-2 provenance note under it | **4.55** | 9.90 |
| `text-emerald-700` → `text-emerald-900` | F8's 「此邊收錄於 E」 status | **5.13** | 9.20 |
| `text-amber-700` → `text-amber-900` | F2's refusal notices | **4.81** | 8.66 |

Three changes follow. The parser paints the colour to a 1×1 canvas and reads the pixel, which
resolves any syntax the browser accepts rather than the two this project happened to use, and
returns the alpha the backdrop walk needs. `painted()` now returns what it *failed* to read, and
the test asserts that list is empty before judging anything it did read — an instrument that
cannot say what it skipped cannot be trusted to say the rest passed, which is the same finding as
the `undefined` at §14 and D54's contrast ratio written from memory. And the walk covers steps 2,
1, 3 and 4, so all three playgrounds are measured rather than only F1.

**The playgrounds were the smallest type in the corpus.** Tailwind's `text-sm` and `text-base`
are rem against the 16 px document root, not em against `lecture-root`'s 24 px, so the readout
labels rendered at 14 px on a projector while nothing else in the deck goes below 18 px. The
playgrounds are now sized in `em`, so they inherit whichever shell they are in — 21/24/36/45 px
in the lecture, unchanged in the study column — and `projector.spec.ts` asserts no playground text
falls below the deck's 18 px floor at any of the three panel sizes.

**Two more from the same review.** F2's predicate knob was `useState` while its direction knob was
in the query string, so `?F2.predicate=near` was a parameter the control advertised by its id and
then ignored, and a shared link never restored it; spec §4.3 puts knob state in the URL, and it is
there now, with a value outside |P| falling back to the vocabulary rather than building an edge the
candidate space never counted. And the collapsed panel named only the second edge of each merged
pair, while both presenter notes promise the edges, plural — it groups by key and prints the whole
group. `Add edge` with no pair chosen also said nothing at all, which is the silent non-response
this codebase legislates against everywhere else; it now says what is missing.

## D89 — the gate left the tree dirty on every green run

**Plan:** none. An infrastructure finding, recorded here for the same reason D85 is: a gate that
reports something untrue about the working tree on every run trains the reader to stop looking.

`npm run harvest` is step 1 of the gate and rewrites `kp.json`, `math.json` and `deriv.json` from
the frozen page on every invocation, emitting bare LF. The blobs are LF, as they should be, but
`core.autocrlf=true` checks them out as CRLF — 981 carriage returns in `kp.json` alone. So the
first step of a twelve-step gate left three files reported modified by `git status` while
`git diff` printed nothing at all, on every single green run.

Nothing was ever wrong with the content, which is exactly the problem. `git status` is what
answers "did this cycle leave anything behind", and an answer that is three false positives every
time is an answer nobody reads. During this cycle the three files had to be restored by hand
before each of the eight non-merge commits, and a real uncommitted change in that directory would have been
invisible among them.

`.gitattributes` pins `data/content/*.json` to `eol=lf`, so checkout and harvest write the same
bytes. The directory rather than the three filenames, so whatever the harvest emits next is
covered without a second edit. Verified by running the full gate and reading `git status`
afterwards: clean.

This is the second instance of the same defect in this file. The existing rule above it, pinning
the two brief files, was written when `lint:standalone` compared a generated file against a fresh
rebuild with string equality and failed after any checkout. Same cause, different symptom: there
the mismatch failed a step, here it passed every step and lied about the tree.

**Not fixed, and stated rather than left to be discovered:** `data/slices/*/annotations.json` and
the manifests are written by the Python cutters and carry the same exposure. They are not part of
the gate and a slice is cut rarely (D-08), so nothing has been changed there; a re-cut will dirty
them the same way until it is.

## D90 — the eight minor findings the review deferred

**Plan:** none. The Minor list from the whole-branch review of the playgrounds cycle (D88),
deferred there because a fix pass takes only what it must and the author decides the rest.
Recorded together because six of the eight are one defect wearing six hats: a value that is legal
to parse but wrong to use, reaching a component that had no opinion about it.

**A boolean knob read `=== 1`, so every value outside {0,1} selected the opposite of its default.**
`?F2.directed=2` halved the candidate space, and `?F1.labels=7` turned off a layer that defaults
to on. `useLabParams` rejects only what will not parse as a number, so the component is where an
absurd-but-numeric value has to stop, and `clamp` was already doing exactly that for the knobs
with a range. `flag(value, fallback)` is the same rule for the knobs with two states, and all five
boolean knobs across the three playgrounds now use it.

**A readout's test id was built from its translated label.** `readout-Candidate triplets` existed
under `en` and had no equivalent under `zh-TW`, so every browser assertion that addressed a
readout was a test of the English build, passing only because the describe block around it forced
the locale — and `check:perf`, which is the one instrument that cannot force a locale, had to
match `[data-testid^="readout-"]` rather than name what it was measuring. `Readout` takes an `id`
now, namespaced by playground because the study shell renders all three in one column and two of
them count candidates.

**F8 dereferenced `relationships[0]` on a frame that has none.** No committed frame is empty, so
this was latent; regenerating the slice with one unannotated frame would have blanked the step
rather than said anything. It reports the absence and keeps the frame chooser, so the step is not
a dead end. Pinned by a fixture in its own file, since no data reaches it — the construction
`logic.test.ts` already uses for the reversed triplet no frame carries.

**`F8.rel` defaulted to the literal 1.** Relationship ids are unique across the slice, so 1 is a
relationship in `ph-001` and in none of the other five frames; changing frame reset the knob to it
and relied on the `?? relationships[0]` fallback to recover. The default is read from the data
now, and a frame change selects that frame's own first relationship. The fallback stays, but it is
no longer load-bearing for five frames out of six.

**Two knob ids did not match the query keys they write.** `id="F1.frame"` wrote `F1.img` and
`id="F8.frame"` wrote `F8.img`, while every other control's id equals its key and `perf.spec.ts`
addresses knobs by that id.

**Lint rule 7 was narrower than the spec that states it.** Spec §2.4 says no `kp` is used by two
playground steps, unqualified; the implementation counted `<Playground>` tags within one module's
body, so two modules that each cite the same point could each mount it and the gate would pass.
The corpus-wide judgement runs after every module has been walked, counting one entry per module
and step rather than per locale. Watched failing by adding `F1` to M01's `knowledge_points` and
mounting it there as well as in M00: it was then the only problem reported, which is the measure
of the gap — every per-module rule passed. The first half of that sentence matters and was missing
from this entry until 2026-09-20: without citing the point, M01 also trips the owned-or-cited rule
in both locales, so the break yields three messages and the recorded observation does not
reproduce.

**`data/slices/**/*.json` is pinned to LF**, closing the case D89 left open. The Python cutters
write LF and `core.autocrlf=true` checked the files out as CRLF — 7,189 carriage returns in one
annotations file. It never reached the gate because a slice is cut rarely (D-08), which is
precisely why it would have been met by somebody re-cutting one months from now and reading
thousands of changed lines that were not changes.

**Verification.** `npm run ci` exit 0, **607 vitest** in 54 files where 599 in 53 passed before;
`npm run test:e2e` 38; `npm run check:perf` 17; i18n 228 keys both locales.

**Not changed, and why.** The reviewer's remaining observations were judgement calls rather than
defects: F2's built-edge list stays out of the query string, because it is work product rather
than a knob and L1 does not persist its proposals either; and `f2-notice` carries no `aria-live`,
which is outside a spec addressing the projector and the keyboard. Both are noted here so that a
later cycle re-opens them deliberately rather than rediscovering them.

## D91 — the instrument rewritten to stop skipping silently, which still did

**Plan:** none. Three fresh-context reviews of the whole cycle before merge — correctness, test
quality, documentation accuracy — and what each of their findings cost.

**The contrast instrument's blind spot moved instead of closing.** D88 records replacing a regex
colour parser, which could not read `oklch()` and dropped 13 of 20 rows in silence, with a canvas
parser plus a `skipped` list asserted empty before anything measured is judged. Both halves were
still wrong, in the same direction.

The selector was a tag allowlist — `h1,h2,h3,p,li,span,td,th`. An element outside it was never
entered into the loop, so it was neither measured nor reported, and `skipped` cannot see what the
loop never reaches. Measured at XGA: 178 visible text-bearing elements passed over on the
mathematics step, 13 on F1's, 11 on F2's, 4 on F8's, with `skipped` empty on all four. Among them
were the four SRS §11.2 contract headings, rendered by `math/Parts.tsx` as `text-xs`
`text-slate-500` — **12 px at 4.76:1**, against a deck floor of 18 px and NFR-5's 7:1, on every
mathematics step in the corpus since the MDX pipeline landed.

And `parse` primed `fillStyle` with `'#000'` before assigning the candidate. Canvas leaves
`fillStyle` unchanged on an invalid assignment, so an unresolvable colour came back as pure black
— against a light slide the highest contrast obtainable, the reading most certain to pass — and
never reached `skipped`. Measured: `parse('totally-not-a-colour')` returned `[0,0,0,1]`, scoring
20.07:1. The alpha was returned in the tuple and then discarded, so an ink at 12% opacity scored
as though it were opaque.

Now: no allowlist, every descendant of the slide; two priming colours whose disagreement is what
detects an unresolvable value, so `parse` returns null and the row is reported; alpha composited
source-over for ink and backdrop both. KaTeX's MathML copy is excluded by name, being the same
text twice and not painted. Coverage went 195→203, 20→33, 13→24 and 13→17 rows. The headings are
`text-[0.75em]` `text-slate-700`, 18 px at 9.90:1. The floor assertion is a measured per-step row
count rather than `> 3` — the floor D88 kept in place while explaining why it had been inadequate.

**The type-floor test could not see the element that broke the floor**, because it scoped itself
to `[data-testid="playground-frame"]`. It walks the whole slide now, KaTeX's internals excepted,
across all seven M0 steps.

**The Python cutters do not write LF, and D90 said they did.** `Path.write_text` defaults to
`newline=None`, which translates the newline to `os.linesep` — CRLF here. Measured: running
`make_placeholders.py` without a pin put 743 carriage returns into the placeholder slice and left
two tracked files modified, with `eol=lf` already in force. `eol=lf` normalises on check-in and
does not stop a CRLF-writing generator from dirtying the tree, so D90 recorded as closed a case
that was open — and `npm run setup` runs that generator. Every `write_text` under
`system/backend/scripts/` now passes `newline=""`, and the pin covers the whole tracked data tree:
golden vectors, predictions, transcripts and mini-ISG authoring, not slices alone.

**The performance table printed a clamp as a measurement.** `Math.max(0, ms - floor)` subtracts
two samples of the same two-frame quantity; all three playground figures were in fact negative,
were printed as `0.0 ms`, and were then written into §15 under a "Work" column and glossed as
"all three do their work inside the frame that carries the input". The data support only that the
work is below the instrument's ~33 ms resolution. It reports `below the N ms two-frame floor`
now, and quotes a figure only where there is one.

**Four assertions could not fail on the regression they were named for.** The F1 clamp test,
marked `// Review Focus 1.`, passed with the clamp deleted: `slice(0, 30)` returns all six and
`slice(0, -6)` returns none, so negative-index `slice` coincidentally does what clamping does at
this frame size. A density of `-0.5` is where they part — unclamped, `Math.round(-3)` makes
`slice(0, -3)` return the **first three** edges, so a URL asking for less than nothing displays
half the graph. `toHaveTextContent` is a substring match over the whole readout, and the note
`|E| / 6` satisfied `toHaveTextContent('6')` for any value at all, so the value carries its own
test id now. `Playground.test.tsx` asserted `PLAYGROUND_IDS` equalled
`Object.keys(PLAYGROUND_MOUNTS).sort()`, which is that module's own definition restated and passes
with the table empty. And the lab-measurement floor of `>= 3` was satisfied by exactly the three
cases that can never skip.

**Two requirements had no test that would break if the behaviour did.** `isTextEntry` names
`SELECT` beside `INPUT`, and deleting that branch left the whole unit suite green — five of the
twelve knobs the playgrounds carry are `<select>`, so a professor pressing Right to change option
would have changed slide. And nothing asserted that a knob *writes* the query string: every URL
test supplied the state through the URL and checked the read side, leaving spec §4.3's operative
claim, that a setting becomes a link, untested in the direction that makes it true.

**The lint rules had no automated test at all.** Each was watched failing once by hand and its
message copied into a deviation, which satisfies the discipline and leaves nothing behind that
notices a rule being deleted: removing any one left the gate green. `tools/test/content_lint.test.mjs`
runs the lint as a subprocess against fixture corpora — eleven rules, each asserted by its own
message. Deleting the registered-component rule now fails it.

**Two further lint gaps, both reaching the projector.** A `<Playground>` tag that no frontmatter
step declares was invisible, because the body scan only ever looked for `step.kp`: inserting
`<Playground kp="F5" />` into a math step left the lint clean and would have rendered the amber
unknown panel on that slide. And `stepBody` sliced from one `<Step id="…">` to the *next* rather
than to `</Step>`, so content between a step's close and the next one's open was attributed to the
preceding step — `registry.tsx` renders the whole body for every step with `Step` filtered, so such
content appears on **every** slide of the module, and moving F1's tag outside its block left the
lint clean.

**Counts that D90's last commit left behind.** `a6ddfda` re-measured and updated README and INDEX
without touching VERIFICATION §15, CLAUDE.md's Traps, or INDEX's `check:perf` line, so five
quantities carried two values across five documents — with README pointing at §15 as "the run that
produced these" while §15 held the older pair. All corrected here. §14's `test:e2e` figure of 26 is
marked in place rather than overwritten: counted from the spec files at that commit it was 27, and
it was wrong on the day it was written. D88's "six of the eight breaks produce more than one
message" was seven of eight, counted from the recorded run. D89's "six commits" was eight non-merge
commits. D90's rule-7 reproduction omitted that `F1` must first be added to M01's
`knowledge_points`, without which the break yields three messages rather than the one recorded.

**What this entry is really about.** Three of the findings above are the same shape: an instrument
that cannot report what it did not look at. The regex could not read `oklch` and said nothing; its
replacement could not read past a tag allowlist and said nothing; the perf harness could not
resolve a sub-frame quantity and printed zero. Each time the fix was believed general and was
specific. The rule this project keeps relearning — that a measurement must carry what it excluded
— is now enforced in the one place it can be: `skipped` is asserted empty, and the set it is drawn
from is every element on the slide rather than a list written in advance.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **625 vitest in 55 files**, parity
13, i18n 229 keys both locales, content lint clean over 13 golden cases and 9 playground cases,
ruff clean, standalone current, frontend builds 756 modules. `npm run test:e2e` **39**.
`npm run check:perf` **17**.

## D92 — the suite written to guard the lint rules missed eight of seventeen breaks

**Plan:** none. A review of the track on 2026-09-26, after the M0 playgrounds cycle (D88–D91) had
merged, and what it found.

**The lint suite could not see four of the eleven rules.** D91 wrote
`tools/test/content_lint.test.mjs` so that deleting a playground rule turns the gate red, and
contracts §2.4 and design §2.4 both say it does. Measured by disabling each rule in turn and running
the suite: seventeen mutants, one per `problems.push` in the playground section, the corpus-wide
duplicate judgement, and two narrowings (rule 3 checking ownership alone, rule 7 comparing kind
alone). The suite missed eight. VERIFICATION §16 lists every mutant with both results.

- **Rule 3, owned or cited.** The test named for it asserted rule 4's message, `no component is
  registered`. The fixture's one module owned and cited every point, so no fixture could make rule
  3 speak, and a narrowing that dropped the `cited` branch was invisible too.
- **Rule 7, the same playground in both locales.** The fixture wrote one frontmatter into both
  locale files, so the two could not disagree.
- **Rule 8, both halves.** The one duplicate test put both steps in one module and accepted either
  message through a regex alternation, so each half was covered only by the other. The corpus-wide
  half, which D90 added for two modules that each cite the point, had no two-module fixture.
- **Rule 9, two clauses.** A case with no `id`, and a case whose `expect` is `{}`, which is truthy, so the
  missing-field loop passes it.

The fixture now takes a per-locale override and further modules. Seven tests are new, two are split
from one, one is renamed to the rule it tests: 18 tests where there were 11, and **17 of 17 mutants
fail at least one**. Each new test states in a comment why no other rule can catch its defect,
because that is the property the mutation run measures.

This is D91's finding one level up. D91 found instruments that could not report what they had not
looked at, and closed the lint's case by writing a suite. The suite was an instrument of the same
kind: its fixture had one module and one frontmatter, so every defect that needs two of either lay
outside what it could express, and it passed without saying so. The mutation run is the question
that makes it say what it excluded.

**A figure D91 said it had corrected was still in VERIFICATION §15.** D91 records that the NFR-8
harness printed `Math.max(0, ms - floor)` as a measurement, that all three playground figures were
negative, and that the data support only "below the two-frame floor". §15's table still printed
`0.0 ms` under **Work** and still glossed it as "all three do their work inside the frame that
carries the input". The rows' own numbers show the wall below the floor in all three. The column is
marked in place rather than overwritten, as §14's 26 was.

**The paper corpus holds 60 cards, and D-21 says 35.** D-21 (2026-09-16) keeps "35 cards — every
method the curriculum names"; plan 02 Task 9 and the master plan carry the same figure. Commit
`291f67f` (2026-09-17, in the `course-lab` history the subtree import brought in) wrote 60 across
nine branches: two-stage 8, one-stage 8, debiasing 9, panoptic 6, open-vocabulary 3, llm-vlm 10,
video 6, embodied 6, foundations 4. D33 accounts for the ninth branch and its four dataset cards.
Neither D32, D33 nor the commit message states why the method cards number 56 rather than 35, and
**this entry does not supply a reason**: it records the departure so that it is no longer silent,
and the reason is the author's to add. What D-21 exists to protect is unaffected: no card carries
an unverified number, and check 9 counted ten cards carrying 87 figures. D-21 is annotated in place,
and INDEX §2 now gives both figures.

**Searched, and closed without a reason, 2026-09-26.** The generator of that commit,
`system/tools/gen_papers.py` at `291f67f`, holds D-21's two rules in its docstring, the tier-A
figures read from IndVisSGG's Table 2, Tang et al.'s Table 1 and KERN's Table 1, and the helpers
that build rows and cards. It holds no card list and no statement of the count, so the 60 cards
were written into `papers.json` directly and the reason was never recorded anywhere. The author
closed the question on that basis: the count stays 60, and D-21's rule that no card carries an
unverified number holds.

**Counts.** CLAUDE.md and INDEX §4 said the lint holds eight playground rules; contracts §2.4 and
design §2.4 said eleven. It is eleven, and both now say so.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **632 vitest in 55 files**, parity
13, i18n 229 keys both locales, content lint clean over 13 golden cases and 9 playground cases, ruff
clean, standalone current, frontend builds 756 modules. `npm run test:e2e` and `npm run check:perf`
were not re-run: nothing under `frontend/` or `e2e/` changed.

## D93 — M1's three playgrounds, and the premise X1 could not be built on

**Plan:** `plans/2026-09-26-playgrounds-m1.md`, tasks 1–10. **Spec:**
`specs/2026-09-26-playgrounds-m1-design.md`.

**X1's premise was corrected before X1 was built.** Opening the sources for X1's figures produced
four findings, recorded in spec §2 and acted on in Task 3.

1. **M1 s4's premise was not supported.** s4 said the releases "share a name and not a test set",
   and kp X1 said "three distinct (D_train, D_val, D_test)". The `vg150-sgb` dataset card states
   that its current release's test is "the full, untouched test pool" and that its relation-bearing
   counts match "the canonical VG150 protocol exactly". Xu et al. 2017, §4, state a 70/30 split of
   108,077 images and mention no validation set. What the sources support is that releases differ
   in the validation carve-out and in filtering, and that one published release drew its
   validation set from the test pool. Corrected: s4's body and presenter notes in both locales;
   kp X1's title, knobs and statement in the frozen page, then harvested; the frozen X1; item 01
   of `web/brief/index.html`, and its standalone build; the adapter docstring. SRS §10 hazard 1
   and design §2.3 gotcha 1 are annotated in place.
2. **D-09 described a corpus the project never had.** It named `Scene-Graph-Benchmark.pytorch`'s
   `VG-SGG.h5` and a manifest carrying that file's SHA-256. The corpus is the COCO-format parquet
   release `maelic/VG150-coco-format` of Neau et al.'s SGG-Benchmark, and the manifest carries
   per-image hashes, the seed and the distribution mode only. D-09 is annotated in place; the
   decision itself stands.
3. **s4 overstated D-09's enforcement.** It said the short form was forbidden "anywhere in the
   codebase" by a lint. Enforcement is the `DatasetId` literal and
   `test_bare_vg150_is_not_a_dataset`; bare VG150 appears in the prose of M01, M02, M04, M08 and
   M09 as the published benchmark's name. s4 now says what is enforced.
   [**Corrected 2026-09-26 (D95):** "s4" in findings 1 and 3 is the step's id when the finding was
   made. Task 8 renumbered M1 when the playgrounds were mounted; the VG150 step is s6 now, and s4
   is F7's math step.]
4. **The frozen X1's figures.** "SGG-Bench" 73,538 / 27,032 / 4,844 was the withdrawn v1 release;
   "Xu et al." 75,651 / 32,422 are not in Xu et al. 2017; the note's four figures (65.3, 64.6,
   31.0, 25.1) were verified by no table in this corpus and are removed. `FROZEN.md`, 2026-09-26.

The sources were confirmed twice: once while the plan was written and again at Task 1. Issue #94,
re-read verbatim through the GitHub API, gives the v1 counts as the spec quotes them. The card's
upstream revision is `ea6fb3a56a0876eee98165ea17792fc6ec8460e6` and its README is byte-identical
to the copy on disk. The local val parquet has 5,000 rows, so the corpus is the corrected release
and the `vg150-sgb` slice was not cut from leaked test images.

**The metric boundary held.** F6 shows class counts, the merged class's triplet count written out
as its sum, and membership in E or E′; it shows no mR, which s2's inequality carries. F7 shows the
head share H_k^(s) / H_C^(s), the tail ratio C^(−s) and the slice's measured head share; it shows
no γ, R or mR, because L3 already scores R against mR under a Zipf control and a second scorer
would repeat the F2/L1 collision M0 settled. X1 computes only the difference between two stated
counts and whether a release's validation set can overlap its test set. It never turns Xu's
70% of 108,077 into a count, and a golden case pins that difference as `null`.

**X1's arithmetic reconciles the sources.** Every operand is a quoted figure, and every result
equals a figure or a sentence the same sources state independently:

| Difference | Arithmetic | Equals |
|---|---|---|
| v2 train − canonical train | 68,538 − 57,723 = 10,815 | v2's zero-relation training images, kept |
| v2 test − canonical test | 31,876 − 26,446 = 5,430 | v2's zero-relation test images, kept |
| v1 train − v2 train | 73,538 − 68,538 = 5,000 | the canonical validation set, folded into v1's train |
| v1 test − v2 test | 27,032 − 31,876 = −4,844 | v1's validation images, drawn from the test pool |

**Rule 9 amended, rule 12 added.** Rule 9 required an `image_id`, and F7's model and X1's sources
have no frame; a case now carries exactly one of `image_id` or `scope` ∈ {`slice`, `model`,
`sources`}. Rule 12 refuses a release figure without its source, url, locator and quote, and a
count whose digits are not among its quote's digits. Three breaks of the real file were watched
failing, each by its own message: `sgb-v2.train: value 68583 does not appear in its quote`,
`canonical.test: no 'locator'`, `sgb-v2.val: measured 4844 rows but carries 5000`.

**The mutation run.** 23 mutants, one per clause of the twelve rules, each applied alone to
`content_lint.mjs` with the suite run after it: 23 caught, none missed. The harness addresses each
rule by a fragment of its message rather than by line number, which is what D92's version could
not do. VERIFICATION §17 lists them.

**M1 at three panels, after the final review.** Overflow past the panel, per M1 step:

| Panel | 0 | 1 | 2 (F6) | 3 | 4 (F7) | 5 | 6 (X1) | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| 1024×768 | 0 | 192 | 214 | 410 | 306 | 0 | 514 | 0 | 0 |
| 1280×800 | 0 | 220 | 148 | 334 | 183 | 0 | 326 | 0 | 0 |
| 1920×1080 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |

Every word of every playground is reachable by scrolling the step, and every playground's
controls sit inside the panel at all three sizes; the projector test asserts both. **Whether to
split the long steps is a decision for the author, not a fix made here**, in the same form as
D71's. The first version of this paragraph reported X1 at 146 px: that was the step's overflow
while the frame hid another 368 px of X1 where no scroll reached it (below).

**Rulings taken during execution.** Task 2: the plan's predicted test counts were miscounted
(9 failing and 18 passing before the rules existed, not 7 and 14; 27 after, not 25). Task 3: the
brief's item 01 carried the same premise and was not in the plan's list of expected hits; it was
corrected by the same rule. Task 9: the M1 row counts for the contrast floors were read from one
run with the floor assertion soft, then the hard assertion was restored with floors of 20, 25 and
39, three quarters of the 27, 34 and 52 rows measured at every panel size.

**Not done, and why.** mR in F6, and R, mR and γ in F7: the metric stays in the lab. The frozen
F7 note's "s ≈ 1.1": not examined. A fourth option or any new control on the frozen X1: that
would extend the frozen page. Re-cutting the `vg150-sgb` slice or adding a source-file hash to its
manifest: D-09 is annotated, not implemented after the fact. Opening Tang's or Neural Motifs' code
for the canonical protocol's own statement of its counts: the canonical row is attributed to the
card, which is where the figures were read. The other 22 live points.

**The final review, and what it changed.** A fresh-context review of the whole branch found one
defect it graded critical, and it was right. X1's explanations, its disjointness lines and its
list of sources sat below the frame's `max-h-[46vh] overflow-hidden` at every panel size, and so
did F7's legend: rendered, legible, and out of sight, inside a step whose own scroll could not
reach them. The contrast walk measured them anyway, because it asks whether a word is painted and
not whether anyone can see it. Measuring the same thing on M0 found the defect older than this
branch: F1's candidate count and ratio, the two numbers F1 exists to show, sat under the clip at
every panel size from the day F1 landed. The frame now clips only when told to (`clip`, default
on); F1 clips its photograph and not its readouts, and F7 and X1 clip nothing. Two instruments
were added and each was watched failing first: `clipped()` reports every word outside a picture
that an `overflow: hidden` ancestor has cut off, over all six playground steps, and `graphics()`
measures every chart mark against its backdrop at WCAG 1.4.11's 3:1, which F7's measured bars
failed at 2.51:1 in `slate-400`; they are `slate-600` now, and F7's legend stands above its
chart. The review also found that the canonical row's `val_from` quote described v1's bug
rather than the canonical protocol; it now cites the card's direct sentence about the canonical
validation set. s7 promised "the passage" each figure was read from and showed only the source and
the locator; it now says what it shows. INDEX §4 still counted nine golden cases. And the frozen
X1's "SGG-Bench" row now carries the current release's figures, where spec §3 said to label the
v1 figures as v1: a departure from the spec, recorded here, taken because the option's label
names the release the card publishes, while the v1 figures stay quoted in `FROZEN.md` and in X1.
Twelve minor findings were deferred; the author has the list.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **699 vitest in 59 files** (632
in 55 before), parity 13, **i18n 275 keys** both locales, content lint clean over 13 golden cases,
**22 playground cases** and **25 release figures**, ruff clean, standalone current at 250
equations, frontend builds 763 modules. `npm run test:e2e` **48** (39 before). `npm run
check:perf` **20** (17 before).

## D94 — the final review's deferred findings, resolved

**Plan:** none. The minor findings D93's final review deferred, resolved at the author's request
on 2026-09-26, together with a trim of M1's long playground steps. Branch `fix/sgs-m1-minors`.

**The long steps, trimmed rather than split.** The text above each M1 playground is one sentence
now; what it had said at length is in the presenter notes, and the no-hierarchy point of F6 is
kept in its one sentence. Overflow past the panel, before and after:

| Step | 1024×768 | 1280×800 | 1920×1080 |
|---|---|---|---|
| s3, F6 | 214 → **56** | 148 → **29** | 0 → 0 |
| s5, F7 | 306 → **188** | 183 → **105** | 0 → 0 |
| s7, X1 | 514 → **475** | 326 → **326** | 0 → 0 |

X1 is mostly its table and its sources, which do not shorten. What remains was put to the author
in D71's form, split the steps or leave them, and **accepted as it stands on 2026-09-26**; every
word is reachable by the step's scroll, and the numbers stay in VERIFICATION §18 so a different
hall can re-open the question without re-measuring.

**Rule 12 compared a count with every digit of its quote run together, and so passed two kinds of
wrong figure.** A number straddling two others passed: 3857 against "68 538 | 57 723". And a figure
read from the wrong column passed: 57,723 carried as issue #94's COCO count, which is its H5 count,
because both are in the row. A count must now equal one whole number of its quote, thousands
separated by a comma or a single space, and a quote holding several numbers must say by `index`
which one the figure is; twelve figures in `vg150_splits.json` gained an index, each naming the
column the figure is read from. Coded values are checked against their sets (`trainval`,
`test`; `kept`, `dropped`; or null), and a release that leaves a figure out is refused, since a
missing key rendered "not stated by the source" with no source behind it. Six tests were written
first and five failed; the sixth, for the straddling number, passed the old rule, because its
first value, 3853, is not a substring of the joined digits. A test that passes before the fix
proves nothing about the fix, so it carries 3857 now, which the old rule accepted and the new one
refuses. On the real file every multi-number figure failed until indexed, and a wrong index was
watched failing: `sgb-v1.train: index 2 names 57723, not 73538`. Disabled clause by clause, the
suite catches 10 of 10.

**X1's wording.** A negative difference is matched to its note by magnitude, so it now reads "Its
magnitude equals:" (「其絕對值等於：」) instead of claiming that −4,844 equals a count of 4,844
images. And the Chinese build had carried the English separators: an ASCII colon after the split
name (「訓練集: 68,538」), a space after 「此值等於：」, and an ASCII colon in both disjointness
lines. It takes full-width colons with no space now, and a test states it.

**v1's label** read "withdrawn" (「已撤回」). The card says "A previous version of this dataset
had a bug … This has been fixed"; it does not say the version was withdrawn. The label now reads
"earlier version, since fixed" (「先前版本，已修正」). The spec, D93 and `FROZEN.md` keep the
word as they wrote it on the day.

**F6 from the podium.** The edge chooser's options carry object ids, because frame 2008 offered
five indistinguishable "pillow on bed" options between different pillows and beds. The presenter
notes start on the frame F6 opens with, 1039, "light above woman", where they had sent the
lecturer to find frame 228 among 66 bare ids.

**Code.** The unused `VG150_PREDICATES` export is removed; the i18n string carries the cited 50.
A comment in `logic.ts` named M1's s3 where the step is now s4.

**Tests.** Eleven component tests: the 繁體中文 readouts of F6, F7 and X1; no focus on mount for
each; F6 given a frame that exists but carries no group edge (1139), and which frame it falls back
to; X1 given an unknown comparison release; F7 given a head larger than its class count. They
cover behaviour that already existed and passed on first run; the F6 fallback test was confirmed
to fail with the group-edge condition removed.

**README.** Two open items were stale: the overflow count, which predated the playgrounds, and
"presenter notes exist for M0 only", closed by D76 on 2026-09-19.

**Kept, and why.** The `sources` array of `vg150_splits.json`, which no code reads, records the
card's revision and hash that spec §10 required; it is for the reader who checks whether the card
has changed.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **716 vitest in 59 files**, parity
13, **i18n 276 keys** both locales, content lint clean over 13 golden cases, 22 playground cases and
25 release figures, ruff clean, standalone current at 250 equations, frontend builds 763 modules.
`npm run test:e2e` **48**. `npm run check:perf` **20**.

## D95 — the review of the day's merges: F6's status under its clip, and what surrounded it

**Plan:** none. A review of `66281fb..677c801` on 2026-09-26, the day's four merges, by two
reviewers: one over code, tests and data, one over the documents against the repository. Every
figure below was re-measured here before it was acted on. Branch `fix/sgs-m1-review`.

**F6's status line sat under the frame's clip in the state its step exists to show.** F6 renders
words and figures only, yet it kept the frame's default `clip`. Ticking a merge writes the class
count out as a sum, the readout row wraps, and the visual grows past the 46vh clip: at 1024×768
and 1280×800 the line 「此邊收錄於 E′」 was rendered, legible and beyond every scroll. D93's
`clipped()` test measured F6 in its default state only, the one state in which that line cleared
the clip, although its comment said "each at its longest configuration". The entry is now
`m01/2?F6.mp=1&F6.mo=1`. Watched to fail before the fix at XGA and WXGA, passing at 1920×1080;
passing at all three after it. F6 passes `clip={false}`, as F1, F7 and X1 do.

**D94's acceptance was measured at one configuration.** Its 56 / 188 / 475 px at XGA are each
step's default state in 繁體中文, and the method of VERIFICATION §17 reproduces them exactly. The
same method over every configuration and both locales, in px past the panel:

| Step | State | 1024×768 zh-TW / en | 1280×800 zh-TW / en | 1920×1080 zh-TW / en |
|---|---|---|---|---|
| s3, F6 | default | 56 / 336 | 29 / 31 | 0 / 0 |
| s3, F6 | both merges | 334 / 475 | 168 / 170 | 0 / 0 |
| s5, F7 | default | 188 / 271 | 105 / 156 | 0 / 0 |
| s5, F7 | overlay on | 188 / 410 | 105 / 156 | 0 / 0 |
| s7, X1 | default, v2 against canonical | 475 / 714 | 326 / 443 | 0 / 0 |
| s7, X1 | longest of the 16 ordered pairs | 619 / 880 | 531 / 587 | 39 / 78 |

The longest X1 pair differs by cell; VERIFICATION §19 names each. M0's three, never re-measured
after D93 took F1's readouts out from under the clip, in their default states:

| Step | 1024×768 zh-TW / en | 1280×800 zh-TW / en | 1920×1080 zh-TW / en |
|---|---|---|---|
| s2, F1 | 387 / 470 | 355 / 355 | 0 / 0 |
| s4, F2 | 24 / 107 | 0 / 0 | 0 / 0 |
| s5, F8 | 27 / 161 | 0 / 0 | 0 / 0 |

D88 recorded F1 at 146 px before that change. Every word in these states is now within the step's
scroll, so they are D71's kind of item rather than defects. D94's acceptance stands for the
states it measured; the rest are recorded for the author. The projector suite seeds 繁體中文, so
English was measured only here.

**The brief kept "withdrawn".** D94 relabelled v1 because the card says a previous version "had a
bug" that "has been fixed", and kept the word only in dated records. Item 01 of the brief is not a
record; it read "its withdrawn first release" and 「其已撤回之首版」, and "first" is not in the
source either. It reads "an earlier release, since fixed" and 「其先前版本（已修正）」, as v1's label
does, and the standalone build is regenerated.

**X1's explanations were bound to a magnitude alone.** `explain` returned any note of either
release whose value equalled the difference, on whatever split the difference was. Every current
pair was right, but a release added later with a train difference of 4,844 would have been told it
was v1's validation images. Each note now names its split, `explain` matches on it, rule 12
refuses a note without one, and a test walks every note and requires some ordered pair of releases
to reach it on its own split, so a note tagged with the wrong split fails.

**`valDisjointFromTest(sgb-v1)` returned false, a claim no source makes.** v1's validation was
drawn from the test pool, and its validation and test partition that pool: 27,032 + 4,844 =
31,876. The rendered line, "validation drawn from the test pool", was accurate; the function's
name, its test and spec §5.3 were not. It is `valPool` now and returns the pool the card names;
spec §5.3 is amended.

**Rule 12 checked counts and not shares.** Xu's "70%" and "30%" are shown to students, and "75%"
passed. A string value outside the coded sets must now appear in its quote as written. Two
clauses had no failing test, the missing file and the schema version, because the fixture always
wrote a valid file; `corpus({ splits: null })` now writes none. Disabled one at a time, the four
new or newly tested clauses are caught 4 of 4.

**The golden test could skip a case.** Rule 9 accepts an F6 case with a model scope and an F7 case
with a frame, and no block would have run either. A test now requires every case to be run by
exactly one block; with one block's selector broken it fails.

**Locale.** F6 wrote 「標註: 」 with an ASCII colon and a space, the defect D94 fixed in X1; it
takes 「：」 now, and the 繁體中文 test states it. X1 joined each source to its locator with ", "
in 繁體中文; the comma is the locale's now, while source names and headings stay verbatim.

**F7's presenter note quoted 42.8% while the screen showed 57.06%.** The overlay opens at k = 3.
The note now says to set k to 1 and quotes what the screen shows there, 42.83%, which a test pins.

**Documents.** README still taught the three incompatible splits D93 retracted; corrected, as are
PLAYBOOK and INDEX's D-09 row, and the PRD is annotated. D93's "s4" is annotated with the step's
id after Task 8's renumbering, as are the M1 spec's step ids. Stale counts are corrected in README
(the plans, the decisions, the golden vectors, the brief's size, check 6) and INDEX (the presenter
notes, the lint suite, §5's date); dated records keep their figures, with the correction beside
them. The M1 spec's rule 12 and golden table now say what was built.

**Left for the author.**

1. The overflow figures above beyond the default states D94 accepted, M0's F1 at 387 px included:
   split the steps or leave them.
2. "Triplets" counts annotated edges. Measured on the slice: 208 of its 892 edges repeat another
   (s, p, o) in the same frame. Counted as distinct triplets, 684 in all, `on` is 248 rather than
   382, the top-1 share 36.3% rather than 42.8%, and the top-3 share 51.6% rather than 57.1%, with
   `near` and `has` as the next two. The count follows the field's convention for annotation
   statistics, and F6's membership panel treats E as a set, so the step uses the word in two
   senses. Relabel the figures as annotated edges, or count distinct triplets and re-derive the
   golden cases.
3. The gate on the Gitea runner. The commit statuses read through the API show
   `scene-graph-studio / ci` failed on run 2 (2026-09-21, `a93eebb`), and runs 5 and 7, triggered
   by the pushes of 2026-09-26, still "Waiting to run": no runner has taken them. The platform's
   `CI` runs 1 and 3 failed as well. The logs need a signed-in session, which this review did not
   have. The gate has not been green on the Gitea runner since the track moved into WekaExt.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **724 vitest in 59 files** (716
before), parity 13, i18n 276 keys both locales, content lint clean over 13 golden cases, 22
playground cases and 25 release figures, ruff clean, standalone current at 250 equations,
frontend builds 763 modules. `npm run test:e2e` **48**. `npm run check:perf` **20**.

## D96 — the long playgrounds split across steps, and triplets counted as a set

**Plan:** `specs/2026-09-26-split-and-distinct-design.md`. **Decisions:** the author's, on
2026-09-26, on D95's open items: split the long playground steps across steps with shared knobs;
count distinct triplets; read the runner's logs once signed in to Gitea. Branch
`feat/sgs-split-distinct`, from `fix/sgs-m1-review`.

**A step split alone could not end the overflow.** At 1024×768 a step shows 561 px in 繁體中文 and
517 px in English, and in its longest state each long playground's frame alone was taller: F1 705,
F6 730, F7 577, X1 998 px in 繁體中文. [F1's 705 was its readouts column: the photograph beside it
had no width at all, as the branch review below found.] Moving each step's sentence into a step of its own, which is
what D71 meant by a split, would have left every one past the panel. The playground itself is
divided.

**Parts.** A playground may span consecutive steps: each declares `part: n` beside its `kp`, its
tag carries `part="n"`, and `PLAYGROUND_PARTS` in `mounts.tsx` gives each split point its count.
The stepper carries the query string, and with it the knobs, from one step to the next only when
both mount the same point, so the release chosen on X1's first part is the one its second and
third explain; every other step change still opens on defaults. A part shows the controls its own
view reads. `<Playground>` names a part the table does not give on the slide, as it names an
unknown point. The study page renders every part, one frame each. Contracts §2.4 and rules 4, 5,
7 and 8 are amended; eight fixture tests were written first and failed, and the seven clauses they
guard, disabled one at a time, are caught 7 of 7.

| kp | Part 1 | Part 2 | Part 3 |
|---|---|---|---|
| F1 | the picture and its three layers, every annotated edge drawn | the density, the vocabulary, the four readouts | |
| F6 | the two merges and the three class readouts | the predicate merge and one edge's membership | |
| F7 | s, C and k; the model's readouts and bars | the slice's measured share and bars against the model | |
| X1 | the counts of both releases, their differences, Xu's pool | the sentences the differences equal | where validation is drawn from, and images with no relation |

**X1 took three parts, where the decision was two.** Its second part as first built carried the
sentences, the provenance rows, two disjointness lines and their sources, and ran 387 px past the
panel in 繁體中文 with v1 against v2; no layout within the 18 px floor brought that under 561 px.
The provenance became a third part, one line a release, which also removed the table row that
said a second time where validation is drawn from. The mechanism is the same, parts 1 to N.

**F7's second part shows the slice without a toggle.** It is the comparison, so the overlay is
simply on there, and the first part shows the model alone. The toggle, and the line sending the
room to L3, exist only when the playground is mounted without a part, as its unit tests mount it:
no step does, since rule 4 refuses a split point's step that names no part, and the study page
renders the parts as the lecture does.

**Layout, within the 18 px floor.** F6's readouts stand in three columns from 1024 px; F7's
sliders are 96 px wide and share a row, its note on s shares the key's line, and its line sending
the room to L3 is left off the parts, where the first part's sentence and the second part's notes
say it; X1's release choices share a row, each capped at 20rem, its figures and differences do not
wrap, its header is 0.875em, its cells lose 2 px of padding, its "not stated" cells are set in the
text face, its sources run as one line, and `not both counts` / 「非皆為張數」 replaces a label
that wrapped to three lines.

**Result, px past the panel at 1024×768, longest state, 繁體中文 / English:**

| Playground | Before (D95) | Part 1 | Part 2 | Part 3 |
|---|---|---|---|---|
| F1 | 387 / 470 | 0 / 73 | 0 / 0 | |
| F6 | 334 / 475 | 0 / 28 | 0 / 0 | |
| F7 | 188 / 410 | 0 / 81 | 0 / 74 | |
| X1 | 619 / 880 | 0 / 163 | 0 / 69 | 0 / 46 |

At 1280×800 every part is 0 in 繁體中文, and in English only F7's first part, 5 px. At 1920×1080
every part is 0 in both. The projector suite now asserts, at all three sizes, that each part fits
in its longest state. F2 and F8 stay one step each: 24 and 27 px in 繁體中文, 107 and 161 in
English. VERIFICATION §20 has every state measured.

**Content.** M0 went from 7 steps to 8 and M1 from 9 to 13; the corpus holds 103 steps a locale
and 206 presenter notes. Budgets are kept: F1, F6 and F7 were 180 s each and are 90 + 90; X1 was
180 and is 60 + 60 + 60. Each part carries its own notes in both locales, saying that the knobs
carry over from the previous step. The steps after each split were renumbered, and F7's note now
names s5 as the step that proved R = mR.

**Triplets are counted as a set.** E is a set, and F6's membership panel treats it as one, but F6
and F7 counted relationship rows: 208 of the slice's 892 repeat another (s, p, o) in the same
frame. `predicateLabels` now yields one label per distinct triplet of a frame, after any merge,
because a merge can make two rows of one pair the same triplet of E′. Two pairs do: frame 150289,
clock #1 above and on pole #11; frame 2008, pillow #27 on and sitting on bed #1. F6 writes the
merged count as `on 248 + above 11 + over 5 + sitting on 10 − 2 = 272` and says in a sentence what
the 2 are; the object names are counted per object and do not change.

| Figure | Before (rows) | After (distinct triplets) |
|---|---|---|
| Triplets | 892 | 684 |
| `on` | 382 | 248 |
| Merged `on` group | 408 | 272 |
| Top three | on 382, has 68, near 59 = 509 | on 248, near 54, has 51 = 353 |
| Top-1 share | 42.83% | 36.26% |
| Top-3 share | 57.06% | 51.61% |

Three golden cases are re-derived, with their arithmetic written out, and the presenter notes of
F6 and F7 quote the new figures. Nine tests were written first and failed.

**The branch review found F1's photograph missing.** The overlay's children are all absolutely
positioned, so its box has no width of its own, and in the row F1 lays out at 1024 px and wider
nothing gave it one: measured at `736a34f` and at this branch, the photograph rendered 0×0 on
every projector size, in both shells. The step "fit" the panel because the picture was not there.
The same row, with the overlay given no width, is in F1 from its first commit on 2026-09-19, so
D88's 146 px and D95's 387 very likely measured the readouts alone; no earlier build was
measured. The photograph is now sized rather than clipped, at most 38vh tall and never
wider than the frame, so it is whole: 389×292 at 1024×768, where part 1 fits in 繁體中文 and runs
73 px past in English. The projector suite asserts that it has a size and lies within the panel,
at all three sizes; it failed at all three before the fix.

**Four further findings of that review.** A tag is its point and its part, and rule 6 compared the
point alone, so a whole `<Playground kp="F1" />` pasted onto another step, or a part F1 does not
have, linted clean; it compares both now, and the new clause was watched failing and caught when
disabled. The study page renders every part, so a knob's DOM id repeated on one page and each
later label named the first part's control; a part now suffixes the DOM id, the test id stays the
knob's name, and a test asserts every id unique and every label its own control. Two presses
faster than the renders carried the rendered step's query rather than the pending one's; the
stepper keeps the pending query, and a test presses twice before a render. And the whole view
this entry first said the study page shows is reachable from unit tests only, since rule 4 refuses
a split point's step without a part; the claim is corrected here and in the code. Minor: F6's
sentence counts pairs (`pairsWithSeveral`), where it had counted rows a merge removes, which
differ once a pair carries three members; X1 says whether no split is a count in both releases or
the counts agree, where one sentence had read as agreement for Xu; its inline sources list keeps
its list role; two comments named steps by their old ids. The browser's Back button restores each
history entry's own query, so a knob turned on part 2 is not seen on Back to part 1: recorded, not
changed.

**The runner's logs.** At the time of writing the browser this session drives was not signed in to
Gitea, so runs 1 to 3 remain unread; D95 item 3 stays open.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **751 vitest in 60 files** (724
before), parity 13, **i18n 277 keys** both locales, content lint clean over 13 golden cases, 22
playground cases and 25 release figures, ruff clean, standalone current at 250 equations, frontend
builds 763 modules. `npm run test:e2e` **52** (48 before). `npm run check:perf` **20**. After the
branch review: see VERIFICATION §20.

## D97 — M2's playground, F3, and three statements about IoU the sources contradict

**Plan:** `specs/2026-09-27-playgrounds-m2-design.md`, `plans/2026-09-27-playgrounds-m2.md`.
**Decisions:** the author's, on 2026-09-26: F3 only, since F4 and X3 are `spec` and F4 needs masks
over a picture PSG does not license; the committed placeholder photograph; Δx, Δy, λ and τ as the
knobs; the corrections before the playground. Branch `feat/playgrounds-m2`, from `main` at
`443abcb`.

**Three findings, from sources opened on 2026-09-26.** Xu et al. 2017 (arXiv 1701.02426v2, §4,
"Setup", item 3, p. 5) state the threshold: "An object is considered to be correctly detected if it
has at least 0.5 IoU overlap with the ground-truth box." `Scene-Graph-Benchmark.pytorch`'s
`METRICS.md` contains no occurrence of "IoU", so M2 s2's sentence that it does not state the
threshold holds; its `maskrcnn_benchmark/config/defaults.py` line 570 sets
`_C.TEST.RELATION.IOU_THRESHOLD = 0.5`, and `sgg_eval.py` applies it at line 524.

1. **The frozen F3's "scale ceiling" was wrong by a square.** It printed min(λ, λ⁻¹) for a box
   scaled by λ in both directions, whose area ratio is λ²: at λ = 1.42 it read 0.704 where the bound
   is 0.496, contradicting M2 s2, the module it was harvested into. Corrected; read at 1.42 in
   Chromium after the change, 0.496.
2. **The frozen F3's note said the threshold was "never stated in the reference metric
   implementation".** The configuration states it. The clause now names what states it and what
   does not, in both locales; the rest of each note is unchanged. `FROZEN.md` records both.
3. **M2 s2's presenter notes said L2's τ slider demonstrates the bound.** L2's two imperfect boxes
   are same-size translations of their ground truth, so it has no scale mismatch to show. The notes
   now send the room to s3.

`npm run harvest` leaves `kp.json` unchanged: it extracts only `MATH` and `DERIV` from `pg.js`.

**F3.** Object 3 of `ph-001`, `box`, 90 × 70 at (250, 240), is the annotation; λ in steps of 0.1
gives whole-pixel sizes for 90 and 70, and the prediction stays inside the photograph at every
knob extreme, which a test asserts. `playgrounds/logic.ts` computes the prediction, the pixels the
two boxes share (half-open, so boxes whose edges touch share none, as the engine's `boxIou` and
`backend/app/eval/iou.py` hold), the union, and s2's bound min(A, A′) / max(A, A′) from the two
whole-pixel areas. IoU is the quotient of two counts, and membership, IoU ≥ τ, reads 「IoU ≥ τ：視為
同一物件」 or 「IoU < τ：不視為同一物件」, as F8 words its own, since s2 says a rejected box may sit at a
defensible place. One test imports `boxIou` and holds F3's quotient to it on every golden case; it
is the only value import from `sgg-metrics` under `playgrounds/`. Eight golden cases pin the
arithmetic, two of them at a boundary: Δx = 30 gives 4,200 / 8,400 = 0.5, which meets τ = 0.5, and
λ = 2 gives a bound of exactly 0.25, which at τ = 0.25 is reached and so not called unreachable.

**Knobs snap as well as clamp.** A range input moves its thumb to the nearest step whatever value
it is handed, so `?F3.lambda=1.45` would have shown the thumb at 1.5 while the readouts computed
1.45. `snap` puts each knob on its step, counting steps at decimal precision because
(1.45 − 0.5) / 0.1 is 9.4999…98 in binary and the browser rounds 1.45 up, and lands τ exactly on
its decimal, because a τ one ulp above 0.5 would reject an IoU of exactly 0.5.

**The overlay sat 122 px below the objects it outlined.** The marks are an `<svg>` over the
photograph on the frame's own 640 × 480 viewBox, and it filled the column the flex row stretched
to 505 px rather than the 261 px photograph, so `meet` scaling centred every mark below its
object at 1024 × 768 with every readout correct. No jsdom test could see it; a screenshot did. A
projector test now asserts that the overlay and the photograph have the same box, at all three
sizes; it failed at all three first. [**Clarified 2026-09-27 (D100):** 505 px and 122 px are F3's
longest state, λ 2, τ 0.95, shifted (120, 100); at Δx = 18, the state the failing test used, the
column was 454 px against the 261 px photograph, so the offset was (454 − 261)/2 = 96.5 px.]

**F3 spans two parts** (D96). As one step, in its longest state, it ran 171 px past a 1024 × 768
panel in 繁體中文 and 105 px past at 1280 × 800. Part 1 is the box moved and counted: Δx, Δy and λ,
the photograph, the four readouts and the legend. Part 2 is the threshold: τ with its origin, the
IoU and the bound it is compared against, the membership, and the sentence that no placement
reaches τ when the bound is below it. The legend first stood under the photograph and part 1 ran
33 px past; beside the readouts it is one line in 繁體中文 and the part fits. Measured over the
production build, the largest over each part's states, 繁體中文 / English: part 1, 0 / 9 at
1024 × 768 and 0 / 0 at the other two; part 2, 0 / 0 at all three.

**Copy.** A readout's label is set in capitals, which would print b as B and IoU as IOU, so the
labels are words (交集（像素）、聯集（像素）、重疊比值、上界) and the notes carry the arithmetic:
`72 × 70`, `6,300 + 6,300 − 5,040`, `IoU = 5,040 / 7,560`, `6,300 / 6,300`. The object's name
and id are an HTML caption under the photograph, not SVG text, which the viewBox would scale below
the 18 px floor while its computed size read 24 px.

**Content.** M2 went from 6 steps to 8, s3 and s4 at 90 s each with notes in both locales; the
corpus holds 105 steps a locale and 210 presenter notes. F1's placeholder image lookup moved to
`playgrounds/images.ts`, which F3 shares.

**Not changed, recorded.** kp F3's `knobs` field names "sliders: x, y, w, h of the predicted box";
F3 has Δx, Δy and one scale λ because s2's bound is stated in λ, and the frozen F3 had the same
three. The field makes no claim about a source, so it is not a correction's business.

**The branch review** found three things that a person at the projector would meet, and each was
fixed with a test that failed first.
- *The prediction's outline almost vanished on the photograph.* Its amber measured 1.22:1 on the
  table and 1.29:1 on the person, where half of it lies at λ = 1.4, and no one colour clears 3:1 on
  both those and the light ground. Both outlines are now drawn over a white under-stroke 10 units
  wide, the prediction's dashed like the line it carries; on white the amber is 5:1.
- *The IoU readout could print τ beside "IoU < τ".* Rounded to three places, 3,800 / 7,603 = 0.49980
  printed 0.500 at τ = 0.5, and 972 settings did the like. The IoU and the bound are now cut to
  three places, not rounded (`truncatedRatio`), so the printed value is at least τ exactly when the
  quotient is, and a share above zero that cuts to zero reads "< 0.001". A test walks 16 λ,
  25 Δx, 101 Δy and all 19 τ and finds no disagreement.
- *M2 s2 said "λ ≥ √2 ⇒ IoU < ½".* At λ = √2 the concentric box has IoU = ½ exactly, which s2's own
  rule accepts, and which F3's case `pg-F3-bound-equals-tau` shows reached. The implication is
  strict now, in both locales and in the frozen derivation, re-harvested into `deriv.json` and
  `kp.json`; `FROZEN.md` records it. The spec had repeated the statement.

Seven minor findings are deferred to the author.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **791 vitest in 61 files** (755
before), parity 13, **i18n 292 keys** both locales (278 before), content lint clean over 13 golden
cases, **30 playground cases** and 25 release figures, ruff clean, standalone current at 250
equations, frontend builds 766 modules. `npm run test:e2e` **62** (55 before). `npm run
check:perf` **21** (20 before); F3 33.4 ms, within its 33.6 ms two-frame floor. See
VERIFICATION §21.

## D98 — M3's playgrounds, E1 and E10, and four statements about matching and protocols

**Plan:** `specs/2026-09-27-playgrounds-m3-design.md`, `plans/2026-09-27-playgrounds-m3.md`.
**Decisions:** the author's, on 2026-09-27: E1 and E10, each after the math step that teaches it;
M3 s3 to say what is forced apart from what is observed; E10 to count the hypothesis spaces and
show what each protocol hands over, with no recall; E1 to inject one defect per toggle into a real
triplet; F3's overlay to become a shared component. Branch `feat/playgrounds-m3`, from `main` at
`9a3b644`.

**Four findings, read on 2026-09-27.**
1. *M3 s3 claimed more than its argument proves.* Its Formal line stated
   R_SGDet@k ≤ R_SGCls@k ≤ R_PredCls@k "for every model, every fixture"; the argument, that a
   model can ignore the extra input, is about what the protocols allow. Even "for every model given
   less input some model given more does at least as well" fails without qualification: two ground
   truths with near-identical boxes and different labels leave an SGCls model unable, within the
   same K, to place a label an SGDet model places. [**Corrected 2026-09-27 (D99):** this argument does not prove its claim: it shows only that
   one SGCls model, the one copying an SGDet model's output, does worse. The counterexample both
   engines now assert is D99's: two annotated triplets on one object pair, where a model handed the
   boxes keeps one predicate for the pair under the graph constraint (R 0.5) and a model with two box
   pairs of its own recalls both (R 1.0).] What is forced is the inclusion
   ℋ_PredCls ⊆ ℋ_SGCls ⊆ ℋ_SGDet. The ordering is observed: `Scene-Graph-Benchmark.pytorch`'s
   `METRICS.md` at commit `d05be9f9e52e9b2722dc6dc2f0b8b05b47da38f7`, table "Recall@K", shows it in
   every row at every K (MOTIFS at R@50: 32.78 SGGen, 38.92 SGCls, 65.18 PredCls). s3 now says so,
   in all four parts and both locales.
2. *The frozen E10's note said the engine asserts the ordering on every fixture.* The only
   monotonicity test in the engine is `test_recall_is_monotone_in_k`, about K. The frozen E10
   obtains its ordering from invented IoU scale factors, 0.88 and 0.74, passed to `pg.js
   evaluate()`; its note is corrected and its bars stay, as the frozen page's own.
3. *s3 counted |V|² pairs and wrote "|H_SGDet| ⊇ |H_SGCls|".* The first counts an object paired
   with itself, where M0 and F1 count |V|(|V| − 1); the second relates two numbers with a set
   symbol. The brief repeated |V|². All three places now read |V|(|V| − 1), and the brief is
   rebuilt.
4. *M3 s2 wrote "two independent failure modes ⇒ four diff colours".* The engine's `classify` gives
   the four combinations of Φ_cls and Φ_loc three verdicts, `match`, `localization`, and `spurious`
   for both combinations with a wrong name; `missed` belongs to the ground truth. s2 now carries
   that table.

The frozen page's E1 and E10 formulas are rebuilt from the corrected MDX, so the two cannot differ,
and re-harvested: still 26 formulas and 23 derivations. kp E10's `knobs`, "monotonicity invariant
asserted live", now reads "3-way knob · the hypothesis space counted per protocol". `FROZEN.md`
records all of it.

**`PhotoMarks`.** F3's overlay became `playgrounds/PhotoMarks.tsx`, used by F3, E1 and E10: the
photograph in flow inside a box only it sizes, stating its width and height so the box has its
proportions before it loads (M2's deferred minor), an SVG on the frame's viewBox, and marks drawn
solid or dashed over white under-strokes. F3's tests and its projector checks passed unchanged.

**E1.** `ph-001` relationship 1, box#3 on table#1, and five toggles: subject class box → glove,
object class table → panel, predicate on → near, subject box moved 45 px (IoU 3,150 / 9,450), object
box moved 55 px (IoU 23,100 / 69,300). Each falsifies exactly one conjunct. `logic.ts` restates the
engine's rule for one prediction; one test holds it to `classify` over all 32 toggle states, and
another shows that of the eight name triples the toggles produce only (box, on, table) is
annotated in ph-001. It is the second value import from `sgg-metrics` under `playgrounds/`, beside
F3's `boxIou`.

**E10.** A protocol and a vocabulary, this slice's 10 classes and 16 predicates, counted from the
slice, or VG-150's 150 and 50 (Xu et al. 2017 §4). Per triplet: 480, 48,000 and
897,116,066,370,414,059,520,000 on the slice; 1,500, 33,750,000 and
630,784,734,166,697,385,600,000,000 on VG-150; SGDet with B = C(641, 2) · C(481, 2) =
23,679,052,800 whole-pixel boxes, computed as `bigint`. The labels carry no count, so regenerating
the slice cannot make them lie.

**Both span two parts** (D96). As one step, longest state, 1024 × 768, 繁體中文: E1 229 px past the
panel (2 px at 1280 × 800), E10 96 px. E1's first part is the defects on the photograph and the five
conjuncts, its second Φ_cls, Φ_loc, the relation, the failure mode and the verdict; both show the
five toggles, since both read them. E10's first part is what the protocol hands over, its second
the vocabulary and the three counts, the chosen one marked. Every part now fits at all three sizes
in 繁體中文. English, which the suite does not hold to the panel, runs 43 px past on E1's first part
and 15 px on E10's second at 1024 × 768, and fits at the other two sizes.
[**Corrected 2026-09-27 (D100):** 15 px was measured before `ca8b276` added the inclusion's
condition; measured during D100's commit `19291d4`, before its layout change, the part ran 71 px
past. Both parts now fit in English at all three sizes.] M3 went from 7 steps to 11, each part 90 s with its notes in both
locales; the corpus holds 109 steps a locale and 218 presenter notes.

**The branch review** found three statements still wrong or unqualified, each fixed with a test
that failed first.
- *s2's verdict table left out a condition the engine keeps.* `classify` gives `localization` to a
  prediction that meets all five conjuncts against a ground truth already matched (the engine's
  own vector `gv-005-duplicate-predictions`). The table is now captioned "against a ground truth no
  earlier prediction has matched", in both locales and the frozen derivation, and the prose says
  that a repeat of a triplet already matched is still `localization`.
- *The ordering survived as a law in three places.* The brief's §6 said each protocol "strictly
  enlarges the search space, which yields an invariant the test suite asserts on every fixture";
  it now states the inclusion with its condition and the ordering as observed, and the standalone
  is rebuilt. SRS §11.2's "holds for any model and any fixture" is marked superseded in place.
  L2's test comment, which quoted it, now says the ordering holds on that fixture.
- *The inclusion was stated without its definition or assumptions.* ℋ is the set of single-triplet
  hypotheses ⟨(b_s, c_s), p, (b_o, c_o)⟩, and the inclusion holds only when what a protocol hands
  over is itself a hypothesis of the next: the given boxes distinct whole-pixel boxes inside the
  image, the given labels in 𝒞. Three boxes of the committed `vg150-sgb` slice cross their image's
  border, so the condition is not idle. s5 now says so in both locales, and E10 prints the
  condition beside the inclusion; its second part then ran 17 px past 1024 × 768 and fits again
  with tighter spacing.

Nine minor findings are deferred to the author.

**Verification.** `npm run ci` exit 0: 266 pytest and 7 skipped, **845 vitest in 64 files** (791
before), parity 13, **i18n 322 keys** (292 before), content lint clean over 13 golden cases, **42
playground cases** and 25 release figures with 44 symbols, standalone current at 254 equations,
frontend builds 771 modules. `npm run test:e2e` **66** (62 before). `npm run check:perf` **23** (21
before); E1 33.3 ms and E10 32.9 ms, each within its two-frame floor. See VERIFICATION §22.

## D99 — the graph constraint was keyed on class pairs; the reference keys it on object pairs

**Plan:** `specs/2026-09-27-graph-constraint-key-design.md`, `plans/2026-09-27-graph-constraint-key.md`.
**Found by:** checking a review finding of the M3 branch (D98): a counterexample that should have
given SGDet recall 1.0 against SGCls 0.5 gave 0.5 for both. **Decisions:** the author's, on
2026-09-27: the engine before the review minors; the graph constraint keyed on object pairs; the
semi constraint re-keyed and described as the cap it is. Branch `fix/sgs-graph-constraint-key`,
from `main` at `df93d63`.

**Problem.** `apply_constraint` in both engines keyed the graph and semi constraints on the ordered
pair of class names; its docstring said so, and the key entered in plan 01 with no stated reason.
Tang's `sgg_eval.py` (commit `fca98604916f9fb2fbeca4fbf430c5b515b42a91`, line 66) keeps one
predicate for each pair of predicted object indices, M4's E4 writes π(⟨s,p,o⟩) = (s,o) on objects,
and SRS §4.5 says "per ordered subject-object pair". Two object pairs with the same class names
kept one predicate between them. In the committed slices, relations sitting on a class pair that
spans two or more object pairs of the same frame:

| Slice | Frames | Frames affected | Relations on such class pairs |
|---|---|---|---|
| placeholder | 6 | 0 | 0 of 36 |
| vg150-sgb | 80 | 55 | 463 of 892 |
| indoorvg | 20 | 12 | 88 of 212 |
| mini-isg | 40 | 9 | 18 of 350 |
| psg | 50 | 26 | 99 of 349 |

**Resolution.** `Triplet` carries `subject_id` and `object_id` in both engines, and both
constraints key on the ordered object pair. `none` and mask pairing are unchanged; mask pairing
already keyed on mask instances (D36). Unit tests in both languages were written first:
two object pairs of one class pair each keep their top predicate; one object pair keeps one;
duplicate detections are two pairs; `semi` caps per object pair; a self-pair is a pair. The first,
the third and the `semi` cap failed under the class-pair key; the one-pair and self-pair tests pass
under either key and pin what the two share.

**The fourteenth vector.** `gv-014-graph-constraint-per-object-pair`: two hands on one assembly,
one predicate each, R 1.0 under the graph constraint where the class-pair key gave 0.5, failing in
both engines before the change. Writing it found that `build_golden.py` built eleven of the
thirteen committed vectors: D36's `gv-012` and `gv-013` had been written into `vectors.json` by
hand, and re-running the builder deleted them. Both are now in the builder, value for value, and
the regenerated file differs from the committed one only by `gv-014`. Parity: 14 cases agree.

**The ordering is not forced, now by the engine's own account.** Ground truths (man#1, on,
table#2) and (man#1, near, table#2): on the given boxes the graph constraint keeps one predicate for
the pair and R@50 is 0.5; with two box pairs of its own, each at IoU 9,604 / 10,396 = 0.924, R@50 is
1.0. Both engines assert it. This is the sound form of D98's finding 1, whose argument from
near-identical boxes did not prove its claim.

**D51 corrected.** Its thirteen frames below 1.0 were the class-pair key. Nine are two hands on one
object (seven on an assembly, isg-007 on a wheel, isg-033 on a beam), two object pairs, which the
engine now keeps. Four remain, one hand both holding and
assembling one object: isg-011 (hand#1, assembly#2), isg-013 (hand#1, assembly#4), isg-025
(hand#2, wheel#4) and isg-035 (hand#2, assembly#3). Counted from the annotations before the change,
and the re-keyed engine finds exactly those four.

**`semi` described as the cap it is.** STTran's `lib/evaluation_recall.py` (commit
`bcc72cf691015fc5a435ceb95975418b1becdeb4`) evaluates the Semi Constraint its authors proposed
for Action Genome (Cong et al. 2021, arXiv 2107.12309, section 3) as the top
attention predicate plus every spatial or contacting predicate above 0.9 per object pair. The
application's `semi` caps predicates per object pair at 2. M4 s5 and M12 s2 and s4, both locales,
body and notes, now say so; M12's "the mode that matches the data" is gone. SRS §4.5 and the
contracts are annotated.

**What moved.** No committed lab fixture: none of their predictions spreads one class pair over two
object pairs. Figures computed at run time on vg150-sgb, indoorvg or psg predictions, where they
exist, move wherever a frame does.

**The branch review** found four statements false and three records inexact; each was fixed with
a test that failed first.
- *Mask pairing under the graph constraint.* D36 concluded that `graph` already caps what
  `single_mpo` caps, because the class pair is coarser than the mask pair. Keyed on object pairs,
  that holds only while no two predicted objects share a mask: where objects 3 and 4 repeat the
  masks of 1 and 2, `graph` keeps both predictions and `single_mpo` one. `gv-015` (single_mpo,
  R 0.5) and `gv-016` (multi_mpo, R 1.0) pin it; under the class-pair key `gv-016` fails in both
  engines. D36's note, `test_pairing`'s docstring and L6's comment now say so.
- *`gv-007`'s why* said the graph constraint would collapse its nine predictions to one; they are
  nine object pairs, which it keeps.
- *The mini-ISG README* still gave thirteen frames, 3.7%, and "the engine behaving correctly", in
  both locales; each is annotated in place with the four frames and 1.1%.
- *The Semi Constraint is STTran's own proposal* ("we propose a new strategy named Semi
  Constraint", Cong et al. 2021, arXiv 2107.12309, section 3), evaluated on Action Genome. The
  course, both engines' docstrings, the SRS and design notes and this record called it Action
  Genome's; all now name STTran.
- Inexact: "nine hands on one assembly" (two of the nine hold a wheel and a beam); "watched
  failing" for all five unit tests (two pass under either key); the golden counts and section
  pointers in INDEX and README that Task 3 had to update.

**Verification.** `npm run ci` exit 0: 275 pytest and 7 skipped (266 before), **857 vitest in 64
files** (845 before), parity **16** (13 before), i18n 322 keys, content lint clean over **16 golden
cases**. `npm run test:e2e` 66. `npm run check:perf` 23, on the engine before the review's text
changes, which touched no code path. See VERIFICATION §23.

## D100 — the review minors of M2, M3 and D99, settled

**Plan:** none; a bounded list of nineteen items. **Found by:** the branch reviews of M2's
playground (D97) and M3's playgrounds (D98), which deferred fourteen minors between them, and of
the graph-constraint key (D99), which deferred five. **Decisions:** the author's, on 2026-09-27:
all nineteen, after the engine fix of D99. Branch `fix/sgs-review-minors`, from `main` at
`cffed70`.

**In the text** (commit `f3390f0`).
- D98's argument that near-identical boxes leave an SGCls model unable to place a label did not
  prove its claim. D98 and the M3 spec now point to D99's counterexample, which both engines
  assert, and that test now evaluates its own-boxes case under SGDet, the protocol it stands for.
- The frozen E10 printed "invariant: holds / VIOLATED" for an ordering computed from invented IoU
  scale factors. It now reads "ordering on this toy: holds / reversed"; FROZEN.md records it.
- D97's overlay offset is named with the state it belongs to: 122 px in F3's longest state,
  96.5 px at Δx = 18, each half the difference between the measured column and the 261 px
  photograph. D97, CLAUDE.md and INDEX say so.
- F3's comment no longer says the study shell mounts it whole, and the M2 spec's scope row carries
  an as-built note: 8 steps, F3 at s3 and s4, PSG at s6.
- E1 and E10 write M3's notation with subscripts, as s2 and s5 write it, where they had used
  underscores. M3's notes say that SGDet hands over neither boxes nor labels, and 兩部分皆錯.
- M12 s4 asked L2 for a pair carrying an attention and a contacting relation, which L2's fixture
  does not have. It now points to the man–table pair, to which the fixture's prediction gives two
  predicates, `under` and `on`.
- `test_mini_isg.py` gained the blank line its last function lacked.

**On the photograph** (commit `19291d4`). `PhotoMarks` takes badges, HTML over the photograph at
each box's corner in percent of the frame, so the lecture's 18 px floor measures them. E10 numbers
its boxes #1 to #6; PredCls lists "#1 table, #2 person, …", SGCls "boxes #1 to #6; no labels", and
SGDet no longer prints |V|, which it is not given. The chosen protocol's row carries ► (U+25BA) and
a left rule besides its weight. U+25B6 was used first; Windows draws it as a coloured emoji, which
defeats a marker meant not to rely on colour.

**English within the panel.** D98 recorded English 43 px past a 1024 × 768 panel on E1's first part
and 15 px on E10's second. The 15 px predates `ca8b276`, which added the inclusion's condition;
measured during commit `19291d4`, before its layout change, E10's second part ran 71 px past. E1's
legend now sits beside the conjuncts, and its English toggles read "Subject box Δx 45 px" and
"Object box Δy 55 px" where they read "Subject box moved 45 px" and "Object box moved 55 px".
E10's inclusion and its condition read as one sentence, and the L2 pointer shares the vocabulary
line. Both parts fit in English at all three sizes, E10's second in its SGDet and SGCls states,
which the projector suite now asserts; D98's figure is annotated in place.

**In the code** (commit `1829206`).
- E10's note is built from the frame and prints B: C(641, 2) · C(481, 2) = 205,120 × 115,440 =
  23,679,052,800 whole-pixel boxes. The string had fixed the two binomials while B was computed.
  E10 names its frame in `E10/setup.ts`.
- `withDefects(t, d, table)` takes the defect table, so `logic.ts` imports no playground.
- The projector suite also checks E1's second part with only the subject box shifted, its
  wordiest state. F3's IoU is compared with `boxIou` at all 121 × 101 × 16 = 195,536 settings of
  Δx, Δy and λ, not only at the eight golden cases, and F3's out-of-range test reads the bound,
  0.250 at the clamped λ = 2.
- A graph that repeats an `object_id` is refused by both engines. Python's lookup resolved the
  first object with that id and TypeScript's map the last, and the constraint key is the id pair
  (D99). Python raises in the schema, beside the dangling-reference check, and the API answers 422
  `schema_invalid`, the code contracts §1.1 gives every validation failure other than a dangling
  reference. TypeScript's `toTriplets` throws the same message.
- `gv-017-semi-constraint-per-object-pair`: hand#1 on assembly#3 carries holding, assembling and
  touching, hand#2 on assembly#3 carries holding. `semi`, a cap of 2 per ordered object pair, keeps
  three, and R@20 is 3/4 = 0.75; a cap of 2 per class pair keeps two, as `graph` does, and R@20
  would be 0.5. Its values were computed by hand before either engine ran it. Parity: 17 cases
  agree.

**Watched failing first.** The two records tests; E10's mapping,
badges, SGCls wording, SGDet's |V| and its marker, against the code before commit `19291d4`; the
English fit, at 71 px; the marker's glyph; E10's note and frame id; `withDefects`' table and
`logic.ts`'s import; the repeated id in both engines. The full-grid sweep, the bound readout and
`gv-017` pin behaviour that was already correct and passed when first run.

**The branch review** found the badges hiding two boxes, a longest state no longer the longest,
records stale or inexact, and a comparative without its complement. Each was fixed with a test
that failed first, except the SGCls state, which fit when first measured.
- *Badges.* At a box's top-left corner a badge covered 59 % to 100 % of the glove's box and 52 % to
  73 % of the wrench's at the three sizes, and #5 overlapped #1. A badge now sits above its box's
  corner by default; E10 sets the table's inside its box and the wrench's above and to the left. A
  projector test requires, at all three sizes and under PredCls and SGCls, that no badge cover more
  than half of any box, that no two badges overlap, and that each lie on the photograph.
- *E10's second part with |V|.* SGCls prints |V| on the line the L2 pointer shares; the 繁體中文
  fit test and the English one now also measure that state. It fits.
- *Records.* README still gave sixteen golden cases; CLAUDE.md listed VERIFICATION to §23, 99
  deviations, 66 e2e tests and two tests importing values from `sgg-metrics`, which the full-grid
  sweep makes three; INDEX's VERIFICATION row ended at §23. The offset at Δx = 18 had been rounded
  from (454 − 261)/2 = 96.5 px, and two comments still gave 122 px for the Δx = 18 state. The 71 px had been dated to
  the branch's start. VERIFICATION §24 counted commit `1829206`'s boxes-note test among commit
  `19291d4`'s, and its timings came from an earlier perf run than the rest of its table. E1's
  label change was not recorded. Each now says what was measured, and when.
- *M12.* The comparative this branch wrote in s4, "closer than either end", had lost what it is
  closer to; both locales say the data again.

**Verification.** `npm run ci` exit 0: 277 pytest and 7 skipped (275 before), **870 vitest in 64
files** (857 before), parity **17** (16 before), i18n 322 keys, content lint clean over **17 golden
cases**. `npm run test:e2e` 72 (66 before; the English fit test and the badge test each run at
three sizes). `npm run check:perf` 23. See VERIFICATION §24.

## D101 — the map indexes the knowledge points, and the knowledge-map freeze is released (D-23)

**Plan:** none; a request. **Decisions:** the author's, on 2026-09-27: the index is a second view
of `/map`, rather than a new route or a section of the home page, and the freeze of D-13 is
released, recorded as D-23. Branch `feat/sgs-kp-index`, from `main` at `2783ab6`.

**The index.** `/map?view=kp` lists the 93 knowledge points under the twelve clusters of
`kp.json`, with a cluster filter and a search over the id and both titles, each held in the URL.
Every point links to the module that owns it, and a point with a playground also links to the
lecture step that mounts it, the first part when the playground is split. The papers stay the
default view, so every earlier link to `/map` lands where it did, and the paper filters survive a
round trip through the other view. Contracts §2.2's `/map` row is amended. Eight i18n keys were
added in both locales; the view is named 知識點 in 繁體中文.

**The owner is the assignment, not the frontmatter.** The first version read each module's
`knowledge_points` and sent F5 to M0. M0 lists F5 because it draws on it; `assignment.json` gives
it to M1. `content_lint.mjs` checks that a module lists every point it owns, not that it lists no
other, so the frontmatter names the owner and every module that mentions a point, in no order that
tells them apart. The test that caught it compares every point's link with the assignment, and
pins F5.

**D-23.** Recorded in the decisions register, with a banner on D-13 in place. `FROZEN.md` opens
with the release and keeps its correction log as written. CLAUDE.md, README and INDEX no longer
say the page may not be extended, and `harvest.mjs`'s header says the page was frozen and
released. What stands is stated in D-23: D-14, the harvest from the page, the two validators, and
a page that opens from disk with no build step. `lint:frozen` keeps its name; D-23 says why.
Nothing on the page itself changed.

**The records test.** Two assertions written for D100 pinned the deviation count at 100, so any
later deviation turned them red. They now require at least 100, and a new test pins D101 and
D-23.

**Verification.** `npm run ci` exit 0: 273 pytest and 11 skipped on this machine, where
`SGS_CORPUS_ROOT` is unset and the four adapter tests skip; **880 vitest in 65 files** (870 in 64
before: nine in `pages/test/KnowledgeIndex.test.tsx` and the new records test); parity 17; i18n
**330 keys** (322 before); content lint clean; frozen-page lints clean; standalone current;
frontend builds. `npm run test:e2e` 72 passed, the view unchanged at every earlier route.
**Watched failing first:** the owner test, against the frontmatter version, sent
F5 to `/m/m00`.
## D102 — the five minors D100's review deferred, settled

**Plan:** none; a bounded list of five items. **Found by:** the branch review of D100, which
deferred five minors. **Decisions:** the author's, on 2026-09-27: all five. Branch
`fix/sgs-d100-deferred`, from `main` at `2783ab6`.

**In the engine** (commit `f7b6102`).
- *A dangling reference beside a repeated id.* D100's repeated-id validator ran before the
  dangling-reference check, and on a graph with both its error was the only one raised, so the API
  answered 422 `schema_invalid`, where contracts §1.1 gives `dangling_reference`. One validator, `_ids_resolve`, now reports both problems in one message;
  the API answers `dangling_reference`, and its detail names the relationship and the repeated id.
  The TypeScript engine is unchanged: `toTriplets` refuses a repeated id and, as before, does not
  check references.
- *gv-017's warnings.* It listed none, and both harnesses check only the warnings a vector lists,
  so the two the engine emits for it went unchecked; parity compares the engines with each other,
  not with a hand-computed value. It now lists `gt_boxes_not_pairs`, since PredCls hands over
  boxes, and `zero_shot_unavailable`, since no training split is supplied; its why derives both
  and rules out the other four, which no harness checks, since both test inclusion only. The
  regenerated `vectors.json` differs from the committed one by gv-017 alone. Eight vectors,
  gv-005 to gv-011 and gv-014, still list no warnings, and gv-002 to gv-004 list one of three;
  D100's review named gv-017 only, and this branch leaves the others.

**On the playgrounds** (commit `680dc35`).
- *E10's box ids.* SGCls wrote "boxes #1 to #{n}" with n the count of objects, which is true only
  when the ids run 1 to n. `idRun` in `logic.ts` gives the first and last id when the ids run
  without a gap, and E10 lists the ids where they do not; ph-001 still reads "boxes #1 to #6; no
  labels".
- *The frame in the strings.* `playground.e10.picture` named ph-001, and so did F3's and E1's
  picture strings, which the review did not list; each now takes `{frame}` from its playground's
  setup, and E1's also takes `{triplet}` from the annotated relationship. E10's doc comment names
  `E10_FRAME`.
- *E1's toggles.* 繁體中文 read 「主詞框位移 45 px」 and 「受詞框位移 55 px」, without the axis
  English gives, and both locales wrote 45, 55 and the three defect names as literals. The five
  labels are filled from `E1_DEFECTS` and the annotated triplet, a shift written as its nonzero
  axes, so 繁體中文 reads 「主詞框位移 Δx 45 px」. English reads as it did.
- *E10's columns.* The ► sign and the 4 px rule were drawn in the chosen row alone. Measured,
  that moved the formula column's left edge by 18.7 to 40.0 px and the count column's by 11.6 to
  24.1 px as the protocol changed, over both vocabularies at the three projector sizes; the name
  column stayed at 67 px. Every row now carries the sign and the rule, invisible and transparent
  outside the chosen row, and a projector test holds the three column edges equal under all three
  protocols. Each part was needed: with the sign alone reserved, SGCls chosen against PredCls
  still moved the formula column 2.0, 2.6 and 4.2 px at the three sizes, which fits a collapsed
  4 px border (Tailwind's preflight collapses a table's borders) widening the first column by
  half its width and the table's layout spreading that over the wider panels; with the rule alone,
  19.9 px at 1024 × 768. The chosen row's weight moved nothing: a bold copy of each name,
  reserving its width in every row, was tried, the test passed without it at all three sizes, and
  it was removed.

**Watched failing first.** The Python schema test and the API test, before `_ids_resolve`. gv-017,
under a mutant of both engines that drops `gt_boxes_not_pairs` under `semi`: both harnesses passed
it on the committed vectors and fail it on the new ones; parity passes the mutant, since the
engines agree. Ten unit tests of commit `680dc35`: `idRun`'s three, before it existed; E10's three
on renumbered ids, which printed "boxes #1 to #6" whatever the ids were; the three picture-string
tests, on the literal frame id; and E1's label test, on 繁體中文's missing axis. The column test
failed at all three sizes. This record's own test failed on its missing heading.

**The branch review** found no Critical issue, two Important ones and nine minors; both
Important ones and seven minors were acted on.
- *The sign's visibility had no test.* jsdom applies no Tailwind, and the column test measured
  edges only, so no test said which rows show the sign. E10's unit test now requires `invisible` on the two unchosen rows' signs, and the projector test
  the computed visibility under each protocol. Both failed on both mutants, the projector test at
  all three sizes.
- *§25's first table* was said to be the gate run after the records were written; `test:e2e` and
  `check:perf` had run on commit `680dc35`'s code. §25 now says which run each row is from.
- *Minors acted on.* E1's label test renders all five labels in 繁體中文, and the three picture
  tests their 繁體中文 alt text. A single box reads "boxes #5", held by a test that fails when the
  condition is `run` alone. A test pins each E1 shift to one axis, on which the label's English
  join depends. This record says that no harness checks a warning's absence, and gives the 2.0 px
  with the sizes it varies over. §25 counts tests where it said suites. INDEX's "ten newest"
  requirement tests are twelve and not the newest; the phrase is gone.
- *Commit messages.* `680dc35` gives 18.7 to 40.0 px for both columns; the count column moved
  11.6 to 24.1 px. `f6e642c` says its records test holds the counts in INDEX and README; it held
  two of README's and none of INDEX's, and now also holds their pytest and vitest counts.
- *Set aside.* A rule in `i18n_parity.mjs` comparing placeholders between locales, since every
  new placeholder is now rendered in both; and the column measurements' raw output, since this
  repository keeps no run's log.

**Verification.** `npm run ci` exit 0: 279 pytest and 7 skipped (277 before), **883
vitest in 65 files** (870 in 64 before), parity 17, i18n **323 keys** (322 before), content lint
clean over 17 golden cases. `npm run test:e2e` **75** (72 before; the column test runs at three
sizes). `npm run check:perf` 23. See VERIFICATION §25.

**At the merge.** `feat/sgs-kp-index` reached `main` first (commit `7754926`) and took D101, so
this record, written as D101 on its branch, is D102, and every reference to it in the code and the
tests was renumbered. The two records tests were joined: D101's now requires at least 101
deviations, as it had made D100's require at least 100, and this record's pins 102. The records
files conflicted and nothing else did. On the merged result `npm run ci` exited 0 with 279 pytest
and 7 skipped, **893 vitest in 66 files**, parity 17 and i18n **331 keys**; `npm run test:e2e`
75 passed.

## D103 — the checks D102 left open: every golden vector's warnings, and the locales' placeholders

**Plan:** none; the two checks D102 left open, and the performance check its merge did not run.
**Found by:** D102, which says that eight vectors list no warnings and three list one of three,
that both harnesses test inclusion only, and that a rule in `i18n_parity.mjs` comparing
placeholders between locales was set aside. **Decisions:** the author's, on 2026-09-28: "resume,
fix problems". Branch `fix/sgs-d102-open`, from `main` at `9b678af`.

**The golden vectors** (commit `8f3bb3a`).
- *The warnings each vector lists.* The engine raises six warnings, each on one condition in
  `engine.py`: `gt_boxes_not_pairs` under PredCls or SGCls, `empty_ground_truth` and
  `empty_prediction` when a side has no relationship, `ties_broken_by_index` when two scores are
  equal, `masks_ignored` when one graph carries masks and the other does not, and
  `zero_shot_unavailable` when no training split is supplied. [**Corrected 2026-09-28 (D104):**
  `ties_broken_by_index` compares non-null scores only, and `zero_shot_unavailable` is raised as
  well when the split supplied is empty; the two engines agree on both.] Eleven vectors listed fewer than the
  engine raises for them: gv-005 to gv-011 and gv-014 none, gv-002 to gv-004 one of three. Each
  case's `why` now derives its complete set from the six conditions and says why the others do not
  apply. Thirteen vectors are PredCls, so thirteen list `gt_boxes_not_pairs`; gv-011 is the only
  one with a training split, so it lists that warning alone; gv-009 carries masks in both graphs,
  so it does not list `masks_ignored`.
- *The harnesses.* Both required only that each listed warning be raised, so a warning raised in
  error passed. Both now require every case to list its warnings, pytest in a test of its own, and
  compare the list with the engine's as a sorted list, so a missing and an extra warning fail
  alike and the order is not pinned. [**Corrected 2026-09-28 (D104):** alike for a warning some
  case raises. No case ran SGCls or raised `masks_ignored`, so either engine could drop either
  condition and every harness passed; gv-018 and gv-019 now raise them.] The regenerated `vectors.json` differs from the committed one
  in those eleven cases' `why` and `warnings` alone, compared case by case.
- *Watched failing first.* Before the vectors changed, pytest's golden file failed 12 tests and
  passed 9, the eleven cases and the new listing test, and vitest's engine file failed the same
  eleven cases. A mutant of both engines raising `masks_ignored` whenever either graph carries
  masks fails gv-009, gv-012, gv-013, gv-015 and gv-016 in each harness on this branch, and passes
  the committed harnesses and vectors: 20 pytest, 30 vitest. Parity was not run under it.

**The locales' placeholders** (commit `4899911`).
- 13 of the 331 keys carry a `{placeholder}`, and every caller fills one with `String.replace`,
  which fills the first occurrence only. A translation that dropped or repeated a placeholder
  passed `i18n_parity.mjs` and printed wrong in that locale alone. D102 set the rule aside because
  every placeholder it added was rendered in both locales; that covers those strings, and not the
  next translation. The check now compares each key's placeholders between en and zh-TW as a
  sorted list, so each must appear in both, and as often, and refuses a placeholder that one value
  repeats. All 13 keys agree and none repeats one; no string changed. The script now prints how
  many keys carry a placeholder.
- *The script had no test.* `tools/test/i18n_parity.test.mjs` runs it over two-locale fixtures, as
  `content_lint.test.mjs` runs its lint: seven tests, two accepting and five refusing. The
  placeholder tests failed before their rules existed, and each of the four rules, disabled alone,
  fails its own tests and no other.

**Performance on the merge.** D102's `npm run check:perf` ran on its branch only. On `main` at
`9b678af`, on 2026-09-28, 23 passed; F3 33.8 ms, E1 34.4 ms, E10 31.8 ms.

**Continuous integration, not changed.** The three commit statuses of `9b678af` read "Waiting to
run" on 2026-09-28 at 02:38, queued since 00:27, as runs 4 to 7 did in §19. Gitea 1.21 answers 404
on both runner-listing routes, so the runner's state cannot be read through the API. Registering a
runner is `scripts/deploy/setup_cicd.sh` on a Docker host, with a token from the repository's
settings; this branch does not do it.

**The records tests.** D102's test held `D1…D102`, 102 deviations and the gate's counts as
literals, so the next record had to rewrite it. It now requires each count to be at least D102's,
through `atLeast` in `registry.test.tsx`, and this record's test bounds its own counts the same
way. The new test failed on its missing heading before this record was written.

**The branch review** found no Critical issue, one Important one and three minors; all four were
acted on.
- *Five cases derived no warnings in their `why`.* gv-001, gv-012, gv-013, gv-015 and gv-016
  listed the right warnings, and `data/golden/README.md` and INDEX said every case derives its
  set in its `why`, but these five wrote no derivation, and nothing said why the four SGDet cases
  raise neither `gt_boxes_not_pairs` nor `masks_ignored`. Each now does, and
  `test_every_case_derives_its_warnings_in_why` requires a "Warnings:" sentence naming every
  warning a case lists; it failed on those five first. The regenerated `vectors.json` differs from
  commit `6679f21`'s in their `why` alone.
- *A placeholder both locales repeat.* The comparison passed `{n}` written twice in en and twice
  in zh-TW, and both would print the second as written. The rule refusing a repeated placeholder
  is above; its test failed before it.
- *13 keys* was counted by a script of the session, not by the run §26 files it under; the check
  now prints the figure, and its test failed before it did.
- README's line for `lint:i18n` named one of its rules; it now names the four.

**Verification.** `npm run ci` exit 0: **281 pytest** and 7 skipped (279 before), **901 vitest in
67 files** (893 in 66 before), parity 17, i18n 331 keys, content lint clean over 17 golden cases.
No frontend production code changed, so `npm run test:e2e` was not run on the branch. See VERIFICATION §26.

## D104 — the review of the open checks: two warnings no vector raised, and five minors

**Plan:** none. A review of `7754926..5eabab6` on 2026-09-28, the day's two merges (D102 and
D103), by one reviewer over the code, the tests, the data and the records. Every figure below was
re-measured here before it was acted on. **Decisions:** the author's, on 2026-09-28: "resume,
review, fix problems". Branch `fix/sgs-d103-review`, from `main` at `5eabab6`.

**What the review confirmed.** `build_golden.py` reproduces the committed `vectors.json` byte for
byte. Both engines raise the six warnings on the same conditions, line for line, and each of the
17 vectors lists the set those conditions give its inputs, checked by a script of the reviewer's
that applies the conditions without running either engine. D103's counts (281 pytest, 901 vitest
in 67 files, 13 keys with a placeholder) and both of its mutation tables reproduce. The review
found no Critical issue, one Important issue and six minors. Five minors are acted on: D103's
wording of two conditions, corrected in place under the Important finding, and the four below.
One is declined.

**Two warnings no vector raised** (Important).
- D103 made both harnesses compare each case's warnings exactly, and `data/golden/README.md`
  said that a missing warning and an extra one fail alike. That holds only for a warning some
  case raises. No vector ran SGCls, so nothing held the half of `gt_boxes_not_pairs` that SGCls
  raises. No vector carried masks in one graph only, so no vector raised `masks_ignored`.
  `parity.mjs` runs only the vectors, so it could not see the two engines disagree on either.
- *Measured.* The committed vectors and harness were tested against four mutants: each engine
  with `masks_ignored` never raised, and each engine with `gt_boxes_not_pairs` under PredCls
  alone. All four passed: pytest 281, and vitest's metrics project 39.
- *Two coverage tests.* `test_some_case_raises_every_warning` requires the warnings the cases list
  to cover the engine's `WARNINGS`. `test_some_case_runs_every_protocol` requires the cases'
  protocols to cover `Protocol`. Without these tests, removing gv-018 or gv-019 later would
  reopen the gap in silence. Both tests failed first, on `masks_ignored` and on `sgcls`.
- *Two vectors.* In **gv-018-sgcls-label-error**, SGCls labels a cup a bowl on the ground
  truth's own box. Both IoUs are 1.0, yet the prediction is `spurious`, not `localization`: that
  verdict requires the three classes to agree, so under SGCls a wrong label costs the triplet,
  never the box. R@20 = mR@20 = ngR@20 = 0.5. **gv-019-masks-in-one-graph-only** puts masks on
  the ground truth and none on the prediction, under SGDet. The subject box is shifted by 2 px,
  so box IoU is 2/3 and the pair matches. A build that read the absent masks as empty would score
  the pair 0. Each `why` derives its warnings, and the expectations were computed on paper before
  the engine ran. `vectors.json` gains the two cases and changes no other.
- *Watched to fail.* On the branch, each of the four mutants fails one test in its own harness:
  gv-019 for `masks_ignored`, gv-018 for SGCls. pytest has 1 failed and 284 passed; vitest has 1
  failed and 40 passed. With the TypeScript engine mutated, `parity.mjs` names the same vector.
- *In place.* D103's two sentences are corrected in brackets: the one about a warning missing or
  extra, and the one on the six conditions. On the conditions, `ties_broken_by_index` compares
  non-null scores only, and `zero_shot_unavailable` is raised as well for an empty split. The
  golden README now lists gv-012 to gv-020 in its table of what each case pins; its rows had
  stopped at gv-011.

**Four minors acted on.**
- *The missing-key check had a test in one direction only.* With the check reduced to
  `for (const a of ['en'])`, all seven tests passed. A key present in 繁體中文 only now has its
  own test, which that mutant fails.
- *A braced name outside `\w+` escaped the comparison.* `{kp-id}` in English with nothing in
  繁體中文 exited 0, and the script printed that no key carried a placeholder; `{幀}` and
  `{ frame }` did the same. Every `{…}` token whose name is not `\w+` is now refused as "not a
  placeholder name" in its locale. No current string carries one; the test failed before the
  rule existed.
- *The records tests read each record to the end of the file.* `slice(indexOf('## D102 — '))`
  included D103 and every later record, so an item named only in a later record satisfied an
  earlier record's check; D104 names three of D103's five items. `record(deviations, id)` in
  `registry.test.tsx` now ends at the next heading, and D102's and D103's tests use it.
- *The date of `test:e2e`.* README and INDEX dated it 2026-09-27, §25's heading date. §25's run
  at the merge was on 2026-09-28, since it ran on a tree holding `761b571`, committed that day at
  00:04. `npm run test:e2e` and `npm run check:perf` were run again on `main` at `5eabab6` on
  2026-09-28, and both documents now cite those runs.

**D100's records tests pinned the vectors' count.** They required "The 17 golden vectors" in INDEX,
and "parity 17/17" and "seventeen cases" in README, so this branch's two vectors turned both red:
2 failed of 906. They were first bounded from below, as D103 bounded D102's; the branch review
showed that a bound passes a count left stale, and the count is now taken from the file (below).

**The branch review** found no Critical issue, one Important one and five minors. Four minors and
the Important finding are acted on, the latter in part; one minor is accepted as it stands.
- *Two conditions this record writes were held by no vector* (Important). No vector carried a
  prediction without a score, and none supplied an empty training split. Each engine could count
  a null score toward a tie, or treat `[]` as a split, and every harness passed.
  **gv-020-unscored-predictions-do-not-tie** gives three of four predictions no score. An unscored
  prediction ranks after every scored one and keeps its input order, and none of them ties. Its
  expectations were computed on paper, and both engines agree with them.
  - *Watched to fail.* Each of five mutants fails gv-020 in its own harness: a null score counted
    toward a tie, in each engine; unscored predictions ordered by `relationship_id`, in each
    engine; and unscored predictions ranked first, in Python.
  - *Caught by gv-020 alone.* Ordering by `relationship_id` failed nothing else. Only the last
    mutant also fails `test_missing_scores_sort_last_and_keep_input_order`.
- *The empty split, left open.* Both engines treat `zero_shot_train_triplets: []` as a split not
  supplied: zR is null and `zero_shot_unavailable` is raised, whose text reads "No training split
  was supplied". SRS §4.3 defines zR on ground truth "absent from the training split"; an empty
  split leaves every triplet absent, which gives zR = R. Contracts §1.5 makes the field optional
  and says nothing of an empty one. A vector's expectation is computed from the definitions, and
  here the definitions and both engines disagree. No vector is written until the author decides
  which is intended, and the golden README names it as the one condition without a case.
- *The count of minors.* The first review's six minors were counted as five acted on without
  naming the fifth; the sentence above now names it.
- *Braces outside an innermost pair.* `{{n}}` in English beside `{n}` in 繁體中文 exited 0,
  and English would print `{5}`; so did `A {x {n} y}` and a lone `{kp`. A brace left once the
  innermost pairs are removed is now refused as "a brace outside a placeholder". No current string
  carries one; the test failed before the rule existed.
- *§25 was not corrected in place.* Its heading dates the run at the merge 2026-09-27; a bracketed
  correction now says it ran on 2026-09-28.
- *The count of golden vectors, stale under a bound.* A lower bound would pass INDEX's 19 once a
  twentieth vector exists. One records test now takes the count from `vectors.json` and compares
  the six places INDEX and README state it, the README's in words. D100's and this record's
  tests no longer state it. The test failed on INDEX's 19 when gv-020 made twenty.
- *Accepted as it stands: gv-019's IoU of 2/3 is held by no test.* Neither harness compares a
  verdict's IoUs, so gv-019's shifted box is illustrative. The verdict, `match` where a mask read
  as empty would give `localization`, is what the harnesses hold.
- *Recorded, as the reviewer measured and as re-measured here.* A `classify` that ignores the
  subject class fails gv-018 alone and passes all 17 of `5eabab6`'s vectors: gv-018 is the only
  vector that needs the subject class to agree.
- *Set aside by the reviewer.* INDEX called `gt_boxes_not_pairs` unconditional, which contracts
  §1.5 limits to `predcls` and `sgcls`; the row now says so. The harness finds a verdict row by
  its first matching `pred_index`, so a `-1` row matches any missed one and an extra row is never
  refused; this predates the range and is left.

**Declined.**
- *A `why` may name a warning it does not list.* `test_every_case_derives_its_warnings_in_why`
  requires each listed warning to be named. It does not refuse a warning that is named and not
  listed. The prose must name a warning in order to say why it does not apply: gv-009 names
  `masks_ignored` for that purpose, and gv-019 names `gt_boxes_not_pairs`. A mention therefore
  cannot be read as a claim. The exact engine comparison holds the list itself. The agreement
  between prose and list is a reader's check, like the rest of the arithmetic in a `why`.
- *Set aside by the reviewer, and left so.* All three predate the range. The TypeScript
  `toTriplets` does not check dangling references (D102 says so). `String.replace` reads `$`
  patterns in a fill value, and every current fill value is a number or a constant. `parity.mjs`
  and `engine.test.ts` would pass over zero cases; the two coverage tests now fail on zero cases
  in pytest.

**Continuous integration, not changed.** The three commit statuses of `5eabab6` read "Waiting to
run" on 2026-09-28 at 10:13, queued since 09:08. Registering a runner remains
`scripts/deploy/setup_cicd.sh` on a Docker host, with a token from the repository's settings.

**Verification.** `npm run ci` exit 0: **286 pytest** and 7 skipped (281 before), **909 vitest in
67 files** (901 before), parity 20, i18n 331 keys, content lint clean over 20 golden cases. No
frontend production code changed on the branch. See VERIFICATION §27.

## D105 — an empty training split is no split: the author's ruling, pinned

**Plan:** none. D104 left one condition without a vector: a request supplying
`zero_shot_train_triplets: []`. **Decisions:** the author's, on 2026-09-28. The question offered
three choices: "Treat as none", "Follow SRS: zR = R" and "Reject with 422". The author chose
"Treat as none". Branch `fix/sgs-empty-split`, from `main` at `ba87229`.

**The disagreement.** Both engines read an empty split as a split not supplied. zR is null at
every K, and `zero_shot_unavailable` is raised; its text reads "No training split was supplied".
SRS §4.3 defines zR@K on the ground truth "absent from the training split". Read literally, an
empty split leaves every triplet absent, which gives zR = R. Contracts §1.5 said only "Omitted →
every zR MetricValue has value null". The ruling adopts what both engines already do, so no
engine code changes.

**The ruling, where each reader meets it.**
- SRS §4.3 and contracts §1.5 each carry a bracketed amendment.
- The contract's amendment also states D104's rule on unscored predictions, which it had not
  stated: a prediction without a score shares no score, ranks after every scored one in input
  order, and raises no tie.
- In the golden README, gv-021's row replaces the sentence that named the empty split as the one
  condition without a case.

**gv-021-empty-training-split.** This is gv-001's scene with the split supplied as `[]`.
- *Expectation.* R, mR and ngR at 20 are 1 and zR is null. The warnings are
  `gt_boxes_not_pairs` and `zero_shot_unavailable`. The literal reading would give zR@20 = 1, and
  a build that returned 0 would also fail.
- *Provenance.* The expectation was computed on paper from the amended definition, and both
  engines agree with it. `vectors.json` gains this case and changes no other.
- *Watched to fail.* Each engine was mutated to read `[]` as a split: zR computed, and the warning
  raised only when the field is absent. Each mutant fails gv-021 alone:
  - pytest: 1 failed, 286 passed;
  - vitest's metrics project: 1 failed, 42 passed;
  - with the TypeScript mutant built, `parity.mjs` reports "zR@20: python=null typescript=1" and
    the warnings differing.
- *Nothing held this before.* At `ba87229`, no vector supplied an empty split. gv-011, the only
  vector with a split, supplies two triplets.

**The records tests.** This record's test failed on its missing heading first. The test that
takes the count of golden vectors from the file failed on INDEX's 20 once gv-021 was written,
before INDEX and README were brought to 21.

**The branch review** found no Critical issue, one Important issue and four minors. All five were
acted on.
- *design.md §4.3 kept the literal definition* (Important). INDEX names it as the home of zR@K,
  so a reader who followed INDEX met the reading the author rejected. It now carries the same
  bracketed amendment, as D99 amended it beside the SRS.
- *The records test checked each amendment's bracket, not its content.* Two record mutations
  passed it: deleting the contract's sentence on `[]`, and rewriting the SRS note to say zR@K =
  R@K. The test now requires what each amendment says, and both mutations fail it. It failed
  first on design.md, before that note existed.
- *The branch's first commit failed its own suite.* The vector count rose to 21 there, while
  INDEX and README still stated 20 until the second commit. The two commits are squashed into one
  before the merge.
- *The contract's field comment read "Omitted →".* It reads "Omitted or `[]` (D105) →" now, so a
  reader of the interface does not have to find the note 45 lines further down.
- *INDEX's D104 paragraph still stated the question as open.* It now ends "[Settled by D105.]".

**Continuous integration, not changed.** The three commit statuses of `ba87229` read "Waiting to
run" on 2026-09-28 at 11:14, queued since its push at 11:11.

**Verification.** `npm run ci` exit 0: **287 pytest** and 7 skipped (286 before), **911 vitest
in 67 files** (909 before), parity 21, i18n 331 keys, content lint clean over 21 golden cases. No
engine or frontend production code changed. See VERIFICATION §28.

## D106 — M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted

**Plan:** `specs/2026-09-28-playgrounds-m4-design.md`, `plans/2026-09-28-playgrounds-m4.md`.
**Decisions:** the author's, on 2026-09-28: the scope "Five count/set", E3, E4, E7, E13 and X2,
each a playground step directly after the math step that teaches it, with E5, E6 and E11 left to
L2 and L3, which score them; approach A, one hand-built ranked list on `ph-001` shared by E3, E4
and E7, with the chosen row's pair drawn on the photograph; and "subagent" execution. Branch
`feat/playgrounds-m4`, from `main` at `992287e`.

**Five findings, read on 2026-09-28** in `packages/sgg-metrics/src/`, with which the Python engine
agrees. The findings and the corrections name M4's steps by their ids before the renumbering
below; from the five playgrounds on, this record uses the ids since. The constraint filters the whole ranking before the cut is taken (`index.ts:59`), so the
constrained top k is the top k of a smaller pool and can hold predictions that the unconstrained
top k ranks below k. On the built engine, three predictions (1,2,on,.9), (1,2,near,.8) and
(3,4,on,.7) against the one ground truth (3,4,on) give, at K = 2, `R@2=1, ngR@2=0` under `graph`;
`semi` gives R@2 = 1 with a cap of 1 and R@2 = 0 with a cap of 2.
1. *M4 s3 derived R@k ≤ ngR@k from X_k ⊆ X_k^ng*, and the map's E4 derivation repeated it. X_k is
   the top k of the constrained pool, not a subset of the unconstrained top k. What holds is the
   nesting of the pools, X ⊆ X^ng, so R@k ≤ ngR@k once k covers the unconstrained pool; at a fixed
   k either side can be larger. Its line on when the inequality is strict failed for the same
   reason.
2. *M4 s5 derived ngR(m) ≤ ngR(m′) for m′ ≥ m* by the same intersection with X_k, and said "the
   gap keeps widening to m = 50", as the map's E7 note did. The pool grows with m; recall at a
   fixed k need not.
3. *M4 s4 spoke of "the slider" for α*, which exists on the map only, and divided by C, glossed as
   the number of predicate classes, where the Formal line and the engine average over the classes
   present in the ground truth, |P′|.
4. *M4 s6 called R and mR "both affine in λ".* The blended score is affine in λ; recall over the
   blended ranking changes only where two blended scores cross, so it is piecewise constant in λ,
   as L3 computes it.
5. *M4 s8 wrote k for VRD's predicates per pair*, where the module defines k as the rank cutoff;
   cited "Proposition 4c", which the course defines nowhere; said that at k = 70 the metric
   measures pair detection, although the cut at K still ranks every candidate of every pair; and
   said that R ≤ PR holds for the reason the protocol ordering holds, which M3 s5 records as
   observed, not implied (D98). *M4 s10* said that L3 runs the frequency baseline against the
   learned models on the same slice; L3 fits a frequency prior to a synthetic long-tailed corpus
   and blends it with a hand-written visual scorer.

**The corrections**, in both locales, before any playground was built (`ce699e3`). s3's Worked
step derives the nesting of the pools and, from it, R@k ≤ ngR@k for k ≥ |X^ng|, states that at a
smaller k either side can be larger, and carries the counterexample; its STTran figures keep
`verified: false`. s5's derives that the pool grows with m and stops at the most predicates any
pair carries, and the widening sentence became the pool's growth to m = 50. s4 divides by |P′| in
four places and says that as α moves from 1 to 0 the weighted mean moves from R to mR. |P′|
replaces C in M4's symbol table, while M1 keeps C with its own gloss, so the corpus has 45 symbols
(44 before). s6 says that the blended score is affine in λ and recall over its ranking piecewise
constant. s8 writes m, says once that VRD papers call it k, drops "Proposition 4c", and states only
what the cut at K does. s10 describes L3 as it is. The map's MATH.X2 and DERIV.E4, E6, E7, E11 and
X2 are rebuilt from the corrected MDX, the E7 note and kp X2's knobs are corrected, and the harvest
still gives 26 formulas and 23 derivations; `FROZEN.md` records the five findings. The brief,
searched for `ngR`, `affine`, `Proposition 4` and `same slice`, states none of the claims and is
unchanged. kp X2's title, "VRD and the undeclared k", is left as it is: it is the frozen page's
title, and its knobs and M4's VRD step now write m.
- *The test.* It reads both M4 files and the harvested derivations, requires the five corrected
  statements, refuses the defects, and renders every M4 math step in both locales with no KaTeX
  error. It failed first, on s3's inequality.
- *One refusal narrowed.* `\cap X_k` also occurs in s2's correct R@k = |G ∩ X_k| / |G|, so a
  refusal of it could never pass. The test refuses `\bigr\}\cap X_k`, the construct s5 carried. An
  intersection with X_k reintroduced in another form would pass it.
- *A plan error.* The plan ran `node --test tools/test/harvest.test.mjs`; the file is a vitest
  suite, and `npm run ci`'s vitest step runs it (8 tests).

**The ranked list and its arithmetic** (`f077c18`). `playgrounds/M4/ranking.ts` holds spec §4.1's
twelve predictions on `ph-001` under PredCls, scored 0.95 down to 0.40, over seven ordered pairs
carrying 3, 2, 2, 1, 2, 1 and 1 predictions; g6, wrench resting against table, is never predicted.
`logic.ts` gains `byScore`, `capPerPair`, `topK`, `matchedTruths`, `matchedRanks`, `admitByMask`
and `matchedByMask`; X2 uses the existing `candidateSpace`. The pools are 7, 11 and 12 under caps
1, 2 and 3 or more, and the counts |G ∩ X_k| are spec §4.1's table at every k. Four tests hold them
to the engine:
- `applyConstraint` keeps the rows `capPerPair` keeps, in order, at every cap from 1 to 10 and
  under `none`;
- `evaluate`'s R@k × 6 equals the count at every k from 1 to 12 under caps 1, 2 and 3 and under
  `none`, which covers every pool the list has;
- `applyPairing` admits as many copies as `admitByMask` at d = 1 to 5 under both pairings;
- `evaluate`'s `matched_count` equals `matchedByMask`'s under the graph constraint, for the same
  cases.

Every count agreed with the table and with the engine on the first run. Two departures from the
plan:
- *`matchedByMask` takes a structural `{ masks; predicate }[]`* where the plan named `MaskRow[]`,
  since an existing test forbids `logic.ts` to import a playground module.
- *`matchedRanks` was added in E3's review.* E3 had restated `matchedTruths`'s rule inline to mark
  the list, so the ranks and the relationship ids came from two copies of one test. Both now call
  one predicate, and a test requires E3's list to mark ranks 1, 3 and 5 at the default k and no
  other.

**Shared parts** (`991ebb9`, `2db3f6f`). `RankedList` draws the twelve rows as a table of text. A
dropped row is struck through, a matched row in the top k carries ✓, the chosen row is outlined
and carries `aria-current`, and the cut is a row after the k-th kept row, or after the last kept
row when k passes the pool. A row is marked matched only when it is kept, in the top k and in
`matched`, whatever the caller passes. `PairPhoto` draws the chosen row's subject and object on
`ph-001` through `PhotoMarks`, with E10's badge placements. The note listing the matched ground
truths, g1, g4 … by locale or "none", became one helper, `M4/truths.ts`, before E7 would have made
a third copy of it.

**The five playgrounds**, each counting and none scoring.
- *E3*, at s3 and s4, after s2: k from 1 to 12 under the graph constraint. At k = 4 it holds four
  predictions and three ground truths, g1, g4 and g5. The count reads 1, 2, 2, 3 and then 3 to
  k = 12, and the predictions stop at 7 from k = 7 (`8185305`, `2b04221`).
- *E4*, at s6 and s7, after the graph-constraint step s5: graph, semi or none, and k. At k = 2
  graph finds two and none one; at k = 6 semi finds four where both others find three; at k = 12
  the counts are 3, 5 and 5, with the cut after the seventh kept row under graph (`a277beb`).
- *E7*, at s10 and s11, after the ng-R@k step s9: m from 1 to 10, and k. The pool is 7, 11, then 12
  from m = 3; at k = 2 the count falls from 2 to 1 as m goes from 1 to 2, and at k = 12 it rises
  from 3 to 5 (`f987375`).
- *E13*, at s14, after the mask-pairing step s13: SingleMPO or MultiMPO, and d from 1 to 5 copies of
  the person–wrench mask pair. SingleMPO admits one, the copy saying next to; MultiMPO admits d;
  the graph constraint keeps every admitted copy, each on its own object ids; g4 is matched under
  MultiMPO from d = 2 and never under SingleMPO. It matches the copies the graph constraint keeps
  after the pairing, in the engine's order, and strikes through the copies not admitted. Its
  review found the matched readout's note, "g4", carrying no arithmetic; the note now names the
  predicates the constraint kept (`cce1268`, `5e7ae5a`).
- *X2*, at s16, after the VRD step s15: m ∈ {1, 10, 70} over `ph-001`'s six objects. It shows 30
  ordered pairs, a pool of 30, 300 or 2,100, at most 1, 10 or 70 of the top 100 for any one pair,
  and whether the cut at 100 selects, which it does not at m = 1. The copy table gave the
  cut's readout no note; it carried `pool > 100` in both locales, written in the component
  (`b97bd0a`). It was not the one note outside the locale tables, as this record first said:
  E13's `note="d"` is another, a symbol shown the same in both locales. The final review below
  moved the cut's note into the tables.

E3, E4 and E7 span two parts each, the photograph and then the list, as the spec expected; E13 and
X2 are one step each. Twenty-two golden cases on `ph-001` pin the five, 64 playground cases in all
(42 before). The golden test failed first on "every case is run by exactly one block", at
`pg-E3-k1` (`2976fdb`).

**M4's steps, and the order of registration** (`f7bb931`). M4 went from 11 steps to 19: the old s3
to s11 became s5, s8, s9, s12, s13, s15, s17, s18 and s19. Each new step is 90 s, a noun-phrase
heading and the tag, with presenter notes in both locales naming the setting to show and the
number it gives. The lab's note now cites s12 and the checkpoint's s17; their pre-existing em
dashes stay, since only the ids in those two notes were to change. The corpus holds 117 steps a
locale and 234 presenter notes (109 and 218 before). The projector suite's widest-mathematics loop
on M4 reads steps 0, 1, 4 and 7, the old s1 to s4.
- *Registration moved.* The plan registered each playground in its own task. `KnowledgeIndex.test`
  requires every registered playground to have a lecture step, so E3 registered alone turned
  `npm run ci` red, 1 failed of 943. All five were registered in the commit that inserts their
  steps, and Tasks 4 to 8 tested their components by direct mount.
- *The golden cases followed it.* Content-lint rule 11 refuses a golden case for an unregistered
  playground, so the golden cases were written after the steps.

**The fit.** Each part is held to 1024 × 768 in 繁體中文 in its longest state: E3, E4 and E7 at
k = 12, with E4 under `none` and E7 at m = 10; E13 at d = 5 under MultiMPO; X2 at m = 70.
- *Measured before any layout change,* during the branch: E3's second part ran 411 px past the
  panel, E4's 543, E7's 411, E13 386 and X2 74. The three second parts ran about 411 to 416 px past
  at their default settings too, since the list always shows its twelve rows.
- *Tightened within the parts, not split further.* M4's list rows went from 0.875em to 0.75em,
  18 px on the lecture's 24 px base, which is the floor. `Readout`'s labels and notes went to
  0.75em, and the frame's padding and gaps were reduced.
- *The first version tightened `controls.tsx` for every playground.* Every test still passed. The
  review found that it moved the nine playgrounds whose layout D95 to D102 measured. The
  tightening is now `PlaygroundFrame`'s opt-in `dense`, carried to `Readout` by context and passed
  by M4's five alone. The nine render `2976fdb`'s classes, compared in the source and read from the
  running build at one step of each.
- *After,* by the step's content against the panel at 1024 × 768, measured during the branch: E3's,
  E4's and E7's second parts leave 27.0, 22.0 and 27.0 px, their first parts 145.9, 140.9 and
  145.9 px, E13 90.8 px and X2 135.0 px; every margin is larger at 1280 × 800 and 1920 × 1080
  (VERIFICATION §29).
- *English,* which the suite does not hold to the panel, measured on `9b5fd86` for this record: at
  1024 × 768 E3's and E7's second parts run 16 px past, E4's second 102 px and E13 37 px, and the
  other four of the eight longest states measured fit; at 1280 × 800 and 1920 × 1080 all eight fit
  in English. M4's other steps were not measured in English.

**The browser** (`d207b1f`, `9b5fd86`). `lecture.spec.ts` gains four tests: M4's playgrounds compute
with no backend, a knob set on a first part reaches the second, every knob works from the keyboard
without advancing the deck, and a knob writes the address bar. `projector.spec.ts` holds the eight
longest states to the panel at all three sizes. It adds M4's eight playground steps to the contrast
walk, with floors below the rows measured, and to the check that a playground step fits with its
controls reachable. All nineteen M4 steps join the 18 px floor. E3's, E4's and E7's pairs join
`F3, E1, E10, E3, E4 and E7 draw their marks on their photographs, not beside them`, and their
photographs join `F1, F3, E3, E4 and E7 show their photographs, whole and on the screen`; the
review found the photographs missing from the second. `perf.spec.ts` times one knob of each of the
five and requires fourteen playgrounds measured.

**Found while writing this record.**
- *X2's pool note cited the VRD step by its old id.* It read "30 × min(m, 70); 70 predicates,
  M4 s8" and 「30 × min(m, 70)；70 個 predicate，見 M4 s8」, as the plan's constraints required.
  The plan wrote that label before Task 10's renumbering, which made the VRD step s15 and gave s8
  to the step on mR and its weighting identity, so the note sent the room to the wrong step. On
  the controller's ruling it reads "M4 s15" and 「見 M4 s15」 now, as do the comments of
  `E13/setup.ts` and `X2/VrdPerPair.tsx` and X2's two tests of the note. No other file under
  `frontend/src` cited "M4 s8".
- *`FROZEN.md`'s 2026-09-28 entry* said that the count is written m "as in s5 (the ids Task 10
  gives after renumbering)". s5 was the ng-R@k step when the entry was written, and the
  renumbering made it s9. A bracketed correction in the entry now says so.

**Eighteen minor findings of the reviews are deferred to the author.**
- `logic.test.ts` and E4 shadow the imported `ranked` with a local of the same name.
- `RankedList` has no column headers, and its ✓ has no accessible name beyond the legend.
- E3's test does not pin `E3.row`'s presence in each part, and its truths note's "none" branch
  cannot be reached.
- E4's tests assert neither the semi and none pools, 11 and 12, at the component nor, as E3's
  do, that no recall is shown.
- E7's three locale keys landed in the refactor commit `2db3f6f` rather than in `f987375`;
  `PerPairCap.tsx`'s comment on `M_MAX` reads ambiguously; and the pair of calls to
  `matchedTruths` and `matchedRanks` repeats in E3, E4 and E7.
- E13 caps with a bare `1` where E3 and E4 use `M4_CAPS.graph`.
- M4's registry test renders every playground step, more than M2's and M3's do.
- M4's dense text sits at 18 px exactly, with no margin above the floor; two classes, `gap-0` and
  `py-0`, change nothing; E13's closing line is 0.875em where E3's, E4's and E7's are 0.75em; and
  the address-bar test does not reload the URL it reads.
- The photograph-size test's name omits E1 and E10, whose steps its list also holds.

Two further minors are settled by this record: CLAUDE.md named the marks test by its old title,
and a projector comment cited D106 before it existed.

**The records tests.** This record's test failed first on its missing heading. A second test takes
the number of playgrounds, of live points without one and of steps from the mount table, the
harvest and the modules, and compares them with CLAUDE.md, INDEX and README; it failed first on
CLAUDE.md's 9 playgrounds against 14.

**Verification.** `npm run ci` exit 0: 287 pytest and 7 skipped, **1009 vitest in 74 files** (911
in 67 before), parity 21, **i18n 376 keys** (331 before), 19 of them with a placeholder (13
before), content lint clean over 21 golden cases, **64 playground cases** and 25 release figures
with 45 symbols, standalone current at 254 equations, frontend builds 785 modules.
`npm run test:e2e` **79** (75 before). `npm run check:perf` **28** (23 before); E3 32.4 ms, E4
34.6 ms, E7 33.6 ms, E13 33.2 ms and X2 33.1 ms. E3, E7 and X2 fall below their two-frame
floors, and none is more than 1 ms above its floor: E4 is 0.9 ms above and E13 0.6 ms. See
VERIFICATION §29.

**The final review** (`f082e1b`, `b57328b`). A review of the whole branch, `992287e..480bd1e`,
found five items and triaged the deferred minors; each is settled here except M7, which is open.
- *I1, notes describing what the first parts did not show.* s6's and s10's notes read the pool
  and a struck-through row off E4's and E7's first parts, which showed neither, and s9's sent the
  room to "the next step", s10, for the fall at k = 2 that s11 shows. Part 1 of E3, E4 and E7 now
  carries, beside the photograph, a line naming the chosen row as a triplet of `ph-001`'s object
  ids and class names and saying whether the pool keeps it (`playground.m4.row_line`, `row_kept`,
  `row_dropped`, test ids `e3-row-line`, `e4-row-line`, `e7-row-line`); E4's and E7's first parts
  carry the `E4.pool` and `E7.pool` readouts too. s9's note names s11, and s6's and s10's describe
  the line and the pool. The first parts' margins at 1024 × 768 in 繁體中文 are unchanged, 145.9,
  140.9 and 145.9 px, in every row state measured, since the column beside the photograph is
  shorter than the photograph. The projector suite's first-part states are now dropped rows, whose
  line is the longest.
- *I2, other modules citing M4's steps by their old ids.* M8 cited "M04 s7" twice for mask
  pairing, M11 "M04 s4" for the covariance identity and M12 "M04 s9" for the calibration item;
  they now cite s13, s8 and s17, in both locales. A registry test lists every citation of an M4
  step in the modules and the locale tables, twelve, and holds each to its step's kind and
  content; before the change it failed on the eight citations of the old ids.
- *I3, s12 still derived recall as affine in λ.* The Formal line named the blend `R_p(λ)`, and the
  Worked step summed it into `R(λ)` and `mR(λ)`, both affine. The blend is now `σ_p(λ)`, the score
  of the symbol table; the Worked step says that `R(λ)` is `R@k` of the ranking by `σ(λ)`, and
  likewise `mR(λ)`, constant in λ except where two blended scores cross; `R_p` stays s8's
  per-predicate recall. MATH.E11 and DERIV.E11 are rebuilt and harvested, and L3's two comments
  naming the blend write `sigma_p`. The corrections test now refuses `R(\lambda) &= \sum_p` and
  `R_p(\lambda)=(1-\lambda)` in both M4 files and `deriv.E11`; it failed first on the missing σ.
- *I4, the map's X2 note* said that at k = 70 the number is close to pair recall. It now writes m
  for VRD's k and says that at m = 70 every predicate of every pair is a candidate while the cut at
  K still ranks them. The corrections test refuses "pair recall" in the note, and failed first on
  "close to pair recall". `FROZEN.md` records I3 and I4 as items 6 and 7 of its 2026-09-28 entry.
- *I5, right numbers, wrong causes.* s7's note credited semi's fourth match at k = 6 to "a second
  slot on that same pair"; it is person–table's runner-up, rank 7 (near, g2), which graph drops,
  while under none person–wrench's third row, rank 6, takes the sixth place. s11's credited the
  rise from 3 to 5 at k = 12 to "room for both"; the two it adds are the runner-ups graph drops,
  rank 7 (g2) and rank 10 (g3), g1 being counted at m = 1 already.
- *The minors.* s6's note now defines semi where it is first used, pointing at s9 (M4); s4's says
  that the plateau is 3, the ground truths inside the seven-row pool (M8); M4's symbol table gains
  X, X^ng and m, 48 symbols in the corpus (M9); X2's cut note is `playground.x2.cut_note`,
  "candidates > 100" and 「候選數 > 100」 (T8), which also corrects this record's "the one note not in
  a locale table" and spec §5.5's (M2); RankedList's ✓ test asserts that the matched row's sign is
  visible and an unmatched kept row's is not, where `toHaveTextContent('✓')` held for every row
  (M1); a test renders all fourteen playgrounds and requires the dense frame of exactly E3, E4,
  E7, E13 and X2 and the measured frame of every other (M3); E13's table names each copy's object
  ids, #2 → #5 to #15 → #25, at an unchanged margin of 90.8 px (M5); INDEX's M4 paragraph marks its
  ids as those before the renumbering (T12b). The ✓ test failed under a mutation showing every
  sign, which the old test passed; the dense test failed with E13's `dense` removed, with F2's
  added, and with the dense padding changed.
- *Open, M7.* The brief (`web/brief/index.html:577`) defines pair recall,
  PR@k = |π(G) ∩ π(X_k)| / |π(G)|, and states R@k ≤ PR@k with no condition on the constraint. The
  bound holds under the graph constraint, where X_k carries one triplet a pair, and fails without
  it when two ground truths share a pair. A counterexample run for this record: ground truths
  (1,2,on), (1,2,near) and (3,4,on) against the predictions (1,2,on,.9), (1,2,near,.8) and
  (3,4,on,.7) give, on the built engine under `none`, R@2 = 2/3 (it prints 0.6666666666666666),
  while X_2 covers 1 of the 2 annotated pairs, so PR@2 = 1/2; under `graph` X_2 covers both. The engine computes no pair
  recall, and the pair count is read off the example. M4 s15 now writes PR@K for phrase
  detection, while the brief writes PR@k for pair recall and M8 speaks of pair recall. Left for its
  own cycle.
- *Found and left open.* The symbol table's new m, predicates per ordered pair, is the letter
  s13's Formal and Worked lines use for a mask, |{m : π(m) = (s,o)}|; and s12's prior π_p shares
  its letter with the pair map π of the symbol table.
- *Verification.* `npm run ci` exit 0: 287 pytest and 7 skipped, **1016 vitest in 74 files**
  (1009 before), parity 21, **i18n 380 keys** (376 before), 20 of them with a placeholder (19
  before), content lint clean over 21 golden cases, 64 playground cases and 25 release figures
  with **48 symbols** (45 before), standalone current at 254 equations, frontend builds 786
  modules (785 before). `npm run test:e2e` 79, 1.4 min. `npm run check:perf` 28; E3 32.8 ms, E4
  32.9 ms, E7 34.5 ms, E13 33.9 ms and X2 31.3 ms, where E7 is 1.3 ms above its 33.2 ms
  two-frame floor and the other four are below theirs. See VERIFICATION §29.

## D107 — the static UI mockup removed, at the author's request

**Plan:** none. **Decisions:** the author's, on 2026-09-29: "remove the mockup in this project".
Branch `chore/sgs-remove-mockup`, from `main` at `420cb57`.

**What was removed.** `docs/mockup/index.html`, the static UI mockup of plan 01 (58,263 bytes, a
page with no toolchain), and `system/tools/test/mockup.check.mjs`, the jsdom check D15 wrote after
the page rendered blank; with it the `lint:mockup` script and its step in `npm run ci`, which now
runs eleven steps: harvest, pytest, the metrics build, vitest, ruff, parity, i18n, content, frozen,
standalone, frontend build. `jsdom` stays a dependency: vitest's frontend project runs on it.

**What was not.** The dated records that name the mockup keep their text, since each describes
the tree as it was: D15, D85's scroll-stub finding and INDEX's lesson row about `lint:mockup`
printing a jsdom stack trace, and the relocation plan's step list. The design document's layout
tree carries a bracketed note at its `mockup/` line. Nothing in the application, the brief, the
map or the tests read the page; the only reader was its own check.

**Verification.** `npm run ci` exit 0 in eleven steps: 287 pytest and 7 skipped, 1017 vitest in 74 files (1016 before; the one added is this record's test), parity 21, i18n 380 keys, content lint clean, 786 modules built. The new records test failed on the missing
heading before this record was written, and requires that `lint:mockup` is gone from the scripts
and from `ci`, that CLAUDE.md names eleven steps, and that neither file exists.

## D108 — the data git does not carry moves through the NAS, by `sync-data.ps1`

**Plan:** none. **Decisions:** the author's, on 2026-09-29: "for scene-graph-studio, the data
should not go to github. Please use NAS: C:\DataRaw\scene-graph to sync the untracked data."
Branch `chore/sgs-data-nas-sync`, from `main` at `eb68d64`.

[**Retired 2026-09-29 (D110):** `sync-data.ps1` is gone; `data/` is a link to the NAS, and there
is no second copy to keep in step.]

[**Superseded 2026-09-29 (D109):** the author then moved all of `data/` to the NAS; the committed
part this paragraph keeps in git is no longer committed.]

**How the request was read.** The remote is Gitea (`gitea.cillab.me`), not GitHub, so "github" is
read as the git remote. What git carries stays in git: the slice annotations and manifests,
`data/content/`, the golden vectors, the predictions, `data/vlm/` and the placeholder frames, 65
files and 2.5 MB that the licence gates cleared and the gate reads. What git ignores under
`data/` moves through the NAS: on this machine `data/_raw/industreal/` (2 files, 4.619 GB) and the
images of four slices, `indoorvg`, `mini-isg`, `psg` and `vg150-sgb` (190 files, 25.3 MB). None of
it had reached the remote; `.gitignore` already excluded all of it. The corpora at
`C:\DataRaw\psg`, `C:\DataRaw\vg150-sgb` and `C:\DataRaw\indoorvg`, which `SGS_CORPUS_ROOT` names,
were already on that drive and were not touched.

**What was added.** `sync-data.ps1` at the track root, beside `fetch-data.ps1`. `-Status`, the
default, compares this checkout with the NAS group by group and names the direction each group
needs; `-Push` and `-Pull` copy with robocopy; `-DryRun` lists and copies nothing. The NAS
directory stands for `data/` and defaults to `C:\DataRaw\scene-graph`; `SGS_DATA_NAS` or `-Nas`
overrides it. The copied set is what `git ls-files --others --ignored --exclude-standard` reports
under `data/`, so a new ignore rule extends it with no edit to the script.
`data/predictions/.latency.json` is left out, because each machine reports its own timings in
`PROVENANCE.md`. A pull refuses to start when any file on the NAS maps to a path that
`git check-ignore` does not report ignored; that covers a committed file the pull would overwrite
and a new file the next `git add` would commit. Copies are additive: `/XO` never overwrites a
newer file, and no deletion travels in either direction.

**What it is not.** The NAS copy is the author's storage between the author's machines. It is not
a route to students: `bundle_distribute` in `data/LICENCES.md` still governs that, and it is NO for
`psg`, `vg150-sgb` and `indoorvg`. It downloads nothing from a source, so D-08 stands, and it does
not replace `fetch-data.ps1`.

**A fault found before the first pull.** Fed one path per line from PowerShell,
`git check-ignore --stdin` reported no path ignored: PowerShell ends each piped line with CRLF, and
git kept the CR as part of the path, so the guard refused every file. The script now passes the
paths NUL-separated in both directions (`-z`). Against a scratch NAS holding one committed path
(`slices/psg/annotations.json`), the machine-local timings file, a stray file at the root and two
ignored files, the corrected guard refused exactly the first three.

**Also corrected.** README's Data commands read `.` followed by a form feed and `etch-data.ps1` on
three lines: the `\f` of `.\fetch-data.ps1` had been written as the control character, the
backslash collapse recorded for Git Bash heredocs. The three lines read `.\fetch-data.ps1` again,
and the records test refuses a form feed anywhere in README.

**Verification.** The first push copied 192 files, 4.619 GB, with 0 failed. The NAS copy of
`all_rgb_videos.zip` matches its `.md5` file (`c5b8901dba179d2eb10e9348f8163c79`), and all 190
slice images match their local copies by SHA-256. A second push copied 0 and skipped 192, and
`-Status` reports every group in step. A pull into a fresh worktree of this branch, which stands
for a second machine, copied the same 192 files, left `git status` empty, reproduced the `.md5`,
and `fetch-data.ps1 -Verify` exited 0 against the committed manifests. `npm run ci` exit 0 in eleven steps: 287 pytest and 7
skipped, 1018 vitest in 74 files (1017 before; the one added is this record's test), parity 21,
i18n 380 keys, 786 modules built. The new records test failed on the missing heading before this
record was written. The gate runs no PowerShell, so the script's behaviour rests on the runs
above; the test holds its text: the NAS path, the two git calls, `/XO`, and no deleting switch.

## D109 — all of `data/` on the NAS, and none of it in git

**Plan:** none. **Decisions:** the author's, on 2026-09-29, after D108: "move all data into NAS
for the sync mechanism. Also gitignore all data in the remote." Branch `chore/sgs-data-nas-sync`,
continued from `85ea580`, D108's last commit.

[**Superseded in part 2026-09-29 (D110):** no data file lives in the checkout any longer;
`data/` is a link to the NAS, `start.ps1` makes it, and `sync-data.ps1` is retired.]

**What changed in git.** The 65 files D108 left committed under `data/` (the slices' annotations
and manifests, the six placeholder frames, `data/content/`, the golden vectors and their README,
`data/mini-isg/`, the predictions and `PROVENANCE.md`, `data/vlm/` and `data/LICENCES.md`) were
removed from the index with `git rm -r --cached`, so each machine's working copy keeps them.
`.gitignore` replaces its five `data/` rules, the `!data/slices/placeholder/images/` negation
among them, with one: `/data/`, anchored because in course-lab a bare `data` rule caught other
directories of that name. `.gitattributes` loses the six `data/` rules of D89 and D91, which
governed files git no longer tracks, and with them a stray line reading `" to`: the backslash-n of
that block's comment had been written as a line break, and git read the fragment as a pattern.

**What changed on the NAS.** `sync-data.ps1` needed two changes for a directory git ignores whole.
`git ls-files --directory` now answers with the single entry `data/`, which the script read as
the empty path and dropped; it now stands for `data/` itself. And the machine-local
`data/predictions/.latency.json`, which `.gitignore` no longer names on its own, is excluded by
robocopy `/XF` by full path on both sides. With a probe timings file in place, a push listed
65 new files and not the probe, and the NAS did not receive it. The NAS now holds all 257 files
of `data/`, 4.646 GB, and every one matches its local copy by SHA-256. A third change came from
the first gate run after the push: the harvest rewrites `deriv.json`, `kp.json` and `math.json`
unchanged on every run, and `-Status`, which compared times alone, reported them to push. It now
compares the bytes when only the times differ; the three read in step, and a one-byte probe in
`data/golden/README.md` read "1 to push" until the NAS copy was put back.

**What a fresh clone needs now.** `start.ps1` stops before any install when `data/LICENCES.md`
is absent and names `.\sync-data.ps1 -Pull`. README, CLAUDE.md and INDEX say so;
`fetch-data.ps1`, `cut_slice.py`, `fetch_images.py`, `make_placeholders.py`, `verify_bundle.py`
and `playgrounds/slice.ts` no longer call a file under `data/` committed. Test names and
docstrings that say "committed" (`test_every_committed_annotation_validates` and others) and the
dated records keep their text, and now read "present in `data/`".

**What this costs, stated for the author's review before the merge.**

- **NFR-1.** "A fresh clone works with no data of any kind" no longer holds: a clone without the
  NAS has no placeholder slice, no content and no golden vectors, and neither the application
  nor the gate runs. Once `data/` is pulled, NFR-1's offline requirement holds as before.
- **CI.** `.gitea/workflows/scene-graph-studio.yml` checks out the repository and runs
  `npm run ci`; with no `data/` the gate fails at its first read of it, and a runner in Docker
  cannot reach `C:\DataRaw`. The workflow has no runner yet, so nothing is red today. It is left
  as it was: whether CI gets its data another way or is retired is the author's decision.
- **The other machine.** A `git pull` that brings this commit deletes the 65 files from that
  working tree, because git removes what a merged commit removes; `.\sync-data.ps1 -Pull`
  restores them, if that machine reaches the NAS.
- **History.** The 65 files remain in the remote's history, in every commit before this one.
  Removing them from history needs a rewrite and a force push, which was not done.
- **Versioning.** From here the content, the golden vectors and the licence gates change without
  a diff or a review, and the NAS copy keeps no earlier version and propagates no deletion.
- **Students.** README's student route begins from a clone; a student without the NAS has no
  `data/`.

**The ruling.** The author accepted the six, CI and the student route included, on 2026-09-29:
"yes. proceed." The branch was merged to `main` and pushed; the history was not rewritten.

**Verification.** `git ls-files data` is empty at `cef5bf4`. A fresh worktree of that commit had
no `data/`; `start.ps1 -SkipInstall` exited 1 naming `.\sync-data.ps1 -Pull`, before any install;
the pull copied 257 files, 4.646 GB, every one identical by SHA-256 to this checkout's, with
`git status` empty; and pytest there gave 287 passed and 7 skipped. `npm run ci` here exit 0 in
eleven steps: 287 pytest and 7 skipped, 1019 vitest in 74 files (1018 before; the one added is
this record's test), parity 21, i18n 380 keys, 786 modules built. The new records test failed on
the missing heading before this record was written, and requires the `/data/` rule with no
negation, no `data/` attribute rule and no attribute line that is not a rule, and the pull
named in `start.ps1` before its first install.

## D110 — `data/` a link to the NAS, and no data file in the checkout

**Plan:** none. **Decisions:** the author's, on 2026-09-29, after D109's merge at `5d010e5`:
"remove the files under scene-graph-studio\data and point all data access to
C:\DataRaw\scene-graph". Branch `chore/sgs-data-link-nas`, from `main` at `5d010e5`.

**How the request was met, and why this way.** Before the removal all 257 files under `data/`
were compared with the NAS copy by SHA-256, with no difference; the directory was then deleted
and `data/` made a directory junction to `C:\DataRaw\scene-graph`. Every reader keeps its
`data/` path and reaches the one copy: the backend's `DATA_DIR`, the Node tools, the PowerShell
scripts, the tests and the frontend's build-time imports. Rewriting each reader to a configured
absolute path founders on the last: fourteen static JSON imports and one `import.meta.glob` take
their types from a path `tsc` must follow, and a `paths` entry in `tsconfig` would fix the NAS
location in a file with no override. The link is therefore the one place the location is
decided. `system/tools/Connect-DataDirectory.ps1` makes it, to `SGS_DATA_DIR` when that is set
and to `C:\DataRaw\scene-graph` otherwise, as a junction, or as a symbolic link for a
`\\server\share` target, which a junction cannot reach. It creates and never deletes or moves:
a real `data/` directory, a link to another target and an unreachable target each return a
sentence instead. `start.ps1` calls it before any install and `fetch-data.ps1` before any read;
`tools/start.mjs` stops with the same instruction when `data/LICENCES.md` does not resolve.

**Vite checks real paths.** With the link in place, the frontend suites that import from `data/`
failed to collect on `Denied ID D:/Data/DataRaw/scene-graph/slices/placeholder/images/ph-001.png?url`:
`C:\DataRaw` is itself a link to `D:\Data\DataRaw`, and the guard compares the resolved path with
`server.fs.allow`. `system/data.dir.ts` resolves the link, and `vitest.config.ts` allows its
target beside `..`; the suites then passed, 1019 tests in 74 files, and `tsc -b` over the
frontend was clean. The production build does not apply the guard.

**The dev server, found on the way and left as it was.** Before this change the dev server
answered 403 for the playgrounds' photographs at `/@fs/C:/dev/WekaExt/scene-graph-studio/data/…`,
because `data/` lay outside its workspace root; nothing had measured it, since check 8 runs over
the build. Allowing the link's target in `vite.config.ts` turned the 403 into a 200 that carried
`index.html` (641 bytes, `text/html`) instead of the image: Vite did not serve an `/@fs/` path on
drive D: from a server started on drive C:. The edit was reverted, so the dev server still cannot
show those photographs, and the build can.

**What deletes the NAS copy.** The NAS copy is now the only copy, so each way of removing `data/`
was tried on a scratch junction over a scratch target. `git clean -fdX`, `Remove-Item -Recurse`
in PowerShell 7.6.6 and in Windows PowerShell 5.1, and Git Bash `rm -rf data` removed the link and
kept the target's file. Git Bash `rm -rf data/`, with the trailing slash, deleted the file through
the link and left the link. CLAUDE.md states it as a trap, and README where it describes the link.

**Retired.** `sync-data.ps1` (D108): with no second copy there is nothing to keep in step. D108's
records test no longer reads it, D109's asserts the link rather than the pull in `start.ps1`, and
this record's test requires the script gone and `data/` a link.

**Verification.** `npm run ci` exit 0 in eleven steps, every read of `data/` going through the
link: 287 pytest and 7 skipped, 1020 vitest in 74 files (1019 before; the one added is this
record's test), parity 21, i18n 380 keys, 786 modules built. `npm run test:e2e`, check 8 over
the production build: 79 passed, among them "F1, F3, E3, E4 and E7 show their photographs, whole
and on the screen" at all three resolutions, so the build takes the photographs from the NAS. A
fresh worktree of this branch had no `data/`; `fetch-data.ps1` made the junction, read all seven
datasets through it and left `git status` empty, and the helper then refused another target
rather than moving the link. Removing that link left all 257 files on the NAS. The new records
test failed on the missing heading before this record was written.

## D111 — M5's playgrounds, T1 and T2, and the pair and averaging statements the corpus and the derivation contradicted

**Plan:** `specs/2026-09-29-playgrounds-m5-design.md`, `plans/2026-09-29-playgrounds-m5.md`.
**Decisions:** the assistant's, on 2026-09-29, taken without a design session on the author's
instruction ("review the current progress and go for implementing the next task") and set out in
the spec's §1 table, each with the alternative it rejects, for the author's review before the
merge: the scope T1 and T2, each a playground step directly after the math step that teaches it,
with T3 to T6 left `spec`; T1 over the 80 VG150 frames of the vg150-sgb slice with |P| = 50; T2
over `ph-001`'s six objects, with a choice between the annotated relations and every pair; and
T2's rule the course's linear averaging rule, corrected and presented as a model of repeated
averaging, not as IMP's update, which is learned. Execution by subagents under a controller.
Branch `feat/playgrounds-m5`, from `main` at `dfe4dc4`; the spec is its first commit, `57e678b`,
and the plan with the spec's amendments is `45e283e`.

**The controller's rulings, 2026-09-29.** The ledger records eleven, each with its cost.
- *R1, the averaging matrix is S.* The spec and the plan's first draft wrote A, which M2's symbol
  table defines as area, A(·) (`m02.en.mdx:15`). Every displayed string writes S: the MDX, the symbol table, the
  map's notes, `FROZEN.md`, the golden `why` texts and this record. Code identifiers that are not
  displayed, such as the parameter `a`, stay.
- *R2, the rule sentence widened.* T2 shows values of the course's own averaging rule: the beliefs
  b⁽ᵗ⁾, their spread, the distance to the fixed point and the limit. Only the bound beside the
  distance is a bound; the others are neither counts nor set memberships. CLAUDE.md's "It computes
  a count, a bound or a set membership, never a metric" now reads "It computes a count, a bound, a
  set membership or a value of the rule its step teaches, never a metric". The M0 playground
  design's §1 allows "a quantity its own definition contains", and each of T2's values is a
  quantity T2's definition contains; no recall, mean recall or score is shown, and neither T1 nor
  T2 imports anything from `sgg-metrics`. Contracts §2.4, which CLAUDE.md calls normative, said
  only "a count, a bound or a set membership that its own knowledge point's definition contains";
  on the final review's ruling (R11) §2.4 was amended in place and awaits the author's review.
- *R3, the spec amended before the build* (`45e283e`): the complete-graph case of s3's
  Implications names the node itself (below); the limit is written Σⱼ dⱼ b⁽⁰⁾ⱼ / Σⱼ dⱼ, not with
  π, which M4's table defines as the map from a triplet to its pair; M7 is corrected with M5
  (below); and T1's toy readout on the map is kept and attributed by its note (below).
- *R4, the main checkout.* The branch was worked in the main checkout, not in a separate worktree,
  since the checkout holds `node_modules` and the `data/` junction, which a worktree would lack.
- *R5 and R6, the scope of Task 1's review round.* Both Important findings and Minors 1, 2, 3, 4, 7
  and 9 were fixed in one round, since each changes mathematical truth or precision in the same
  text; spec §2 was corrected for 310 in the same commit.
- *R7, `{d0Again}` kept* (below).
- *R8, the scope of T2's review round.* Minors 3 to 6 were fixed with the two Important findings,
  being small and in the same files.
- *R9, CLAUDE.md's dense-frame sentence.* T1's and T2's registration made it stale; the plan gave it
  to this record's commit and no test reads it, so it stayed stale for three branch commits and is
  updated here.
- *R10, a measured timeout for two M4 tests.* Given when this record's gate failed six times on
  vitest's default timeout under contention (below).
- *R11, contracts §2.4 amended in place* (the final review, below). The review found CLAUDE.md,
  after R2, and §2.4 disagreeing on what a playground computes, with T2 conforming to the one that
  does not govern. §2.4 now carries an amendment in the form D105 used: [**Amended 2026-09-29
  (D111), accepted by the author the same day:** a playground may also show a value of the rule its step
  teaches, as T2 shows the course's own averaging rule on six beliefs; the playground design's §1
  allows "a quantity its own definition contains". It still computes no metric.] The alternative,
  rejecting R2 and reducing T2 to its bound, was the larger change. The cost: the contract carries a sentence
  the assistant wrote, which the author accepted on 2026-09-29.

**Spec §2's findings, read on 2026-09-29.**
- *T1.* s2 and the map (`pg.js`, DERIV.T1 and the T1 note) set N = 80 and |P| = 310, "GQA's 310
  predicates", for "≈ 20 relations", a positive rate near 10⁻⁵. The course's anchor dataset is
  VG150, whose card states 50 predicate categories and, for its validation split, 5,000 images,
  62,754 object annotations and 33,203 relations: 12.6 objects and 6.6 relations per image. "≈ 20"
  is near the original Visual Genome's 22 relationships per image (Xu et al. 2017, §4, quoted in
  `vg150_splits.json`), not VG150's. The 80 frames the course bundles hold 1,348 objects, 26,282
  ordered pairs, 892 relationship rows and 651 ordered pairs carrying at least one relation, 2.5
  per cent of the pairs, with 4 to 39 objects a frame, median 16.
- *310 is sourced.* The spec said that no source in the repository states 310. Task 1's review
  found that one does: the anchor paper's Table 1, reproduced in the map
  (`web/knowledge-map/index.html:293`), gives GQA 310 predicates and 50.6 relations per image, and
  Visual Genome 21.4. The old line set GQA's predicates against Visual Genome's relation rate. The
  correction to VG150's figures stands for that reason, not for a missing source. Spec §2 carries
  the correction in place (`b6c3d8a`), `FROZEN.md` and the corrections test's comment say the same,
  and spec §1's decisions table, which still gave the missing source as the reason, carries an
  as-built note from this record. The map's Proposition 6 (§2.10) carried the same figures and was
  corrected in both languages with them.
- *T2.* Three statements disagreed with one another. The Formal line wrote the neighbourhood mean
  and claimed b⁽ᵗ⁾ → mean(b⁽⁰⁾) for every w > 0, "consensus; information destroyed". The Worked
  step replaced it by the whole-graph mean with the node included, under which the mean is
  invariant and the first round is already the fixed point. The Implications wrote "b⁽ᵗ⁾ =
  (1 − wᵗ)[…]·…", which is not an expression, and "spread contracts by (1 − w) per step", which the
  checkpoint and the s3 presenter note repeated. What holds, with S the row-normalised
  neighbourhood: for 0 ≤ w < 1 the map b ↦ (1 − w)b⁽⁰⁾ + wSb is a contraction in the max norm with
  factor w; the beliefs converge to b* = (1 − w)(I − wS)⁻¹b⁽⁰⁾, a mixture of k-hop averages that
  keeps a (1 − w) share of each node's own evidence; and ‖b⁽ᵗ⁾ − b*‖∞ ≤ wᵗ‖b⁽⁰⁾ − b*‖∞. At w = 1,
  on a connected graph with an odd cycle, the beliefs converge to one value, the degree-weighted
  mean Σⱼ dⱼ b⁽⁰⁾ⱼ / Σⱼ dⱼ, which is the plain mean on a regular graph. The (1 − w)b⁽⁰⁾ term
  therefore prevents the collapse. On `ph-001` with spec §4.2's beliefs, under the annotated
  relations, w = 0.5 settles at a spread of 0.3924 and w = 0.9 at 0.1105, and w = 1 converges to
  0.5083, where the plain mean is 0.4833.

**The corrections**, in both locales, before any playground was built (`114a8c8`, and Task 1's
review round, `b6c3d8a`). The step ids are those before the insertion below.
- *s2.* The Implications use |P| = 50: twelve objects, near the validation mean, give 132 ordered
  pairs and 6,600 decisions for about seven relations, a positive rate near 1.1 × 10⁻³; 80 boxes
  kept, a setting rather than a figure from a paper, give 6,320 pairs and 316,000 decisions for
  the same seven, near 2.2 × 10⁻⁵; and the 80 bundled frames give 651 of 26,282. The presenter
  note keeps its N = 80 exercise with |P| = 50.
- *s3.* The Intuition says that averaging alone drives every node to one belief and that keeping a
  share of each node's own evidence stops it. The Formal line states the rule with S, its limit for
  w < 1 and its consensus at w = 1. The Worked step derives the fixed point, ‖wS‖∞ ≤ w, the
  contraction bound, dᵀS = dᵀ at w = 1 and the degree-weighted mean. The Implications state the
  complete-graph case with the node included, say where w = 1 converges, can oscillate or settles
  per component with an odd cycle, and say that IMP's update is learned and this rule models
  averaging. The presenter note loses "per step".
- *s6*, the checkpoint, asks about the collapse at w = 1; its presenter note keeps its acceptable
  answers. *s5* says that L4 runs these models' predictions, stored in `data/predictions/`, where it
  said "the committed predictions": nothing under `data/` is committed since D109.
- *The symbol table* gains S and 𝒩(i): 50 symbols in the corpus (48 before).
- *The map.* MATH.T2, DERIV.T1 and DERIV.T2 are rebuilt from the corrected MDX and MATH.T1 is
  unchanged; the harvest still gives 26 formulas and 23 derivations. The T1 and T2 notes are
  rewritten, and Proposition 6 carries VG150's figures in both languages. `FROZEN.md`'s 2026-09-29
  entry records four items. The brief (`web/brief/index.html`), searched for `310`, `consensus`,
  `message passing` and `per step`, states none of them and is unchanged.
- *The review round* (R5, R6). Besides Proposition 6 and the premise about 310, the w = 1
  statements now carry their hypothesis wherever they are made, a connected graph with an odd
  cycle: a tree is bipartite and can oscillate, and VCTree's tree is among the checkpoint's
  acceptable answers. The mixture of k-hop averages carries every dᵢ ≥ 1. "Distance" became "the
  largest gap", naming the max norm in which the bound is proved. The complete-graph line writes the
  map b ↦ (1 − w)b⁽⁰⁾ + w b̄ 𝟏 rather than giving a second matrix the letter S. The paragraph on
  IMP's own update moved before the list of later methods, and s5's sentence on L4 was reworded.
- *The test.* It reads both M5 files, the harvested `math.json` and `deriv.json`, the map's notes
  and Proposition 6, and M7 in both locales; requires the corrected statements; refuses the defects
  and the letters A and π in M5's averaging mathematics; and renders every M5 math step in both
  locales with no KaTeX error. It failed first on its first required string,
  `\lvert\mathcal{P}\rvert=50\ (\text{VG150})`.

**The complete-graph case names the node itself.** The spec first said that the Implications state
the complete-graph case, "where the fixed point is reached in one round". That holds only when each
node averages over itself too, which was the old Worked rule. With 𝒩(i) excluding i, as the Formal
line and T2's every pair do, b* is not reached in one round: on every pair at w = 0.5 the distance
after one round is 0.0227. The plan review amended the spec before the build (R3), s3's
Implications say "i included", and a test holds both sides: the rule with the node included
reaches b* in one round with its spread at 0.5 × 0.8, and every pair stands 0.0227 from b* after
one round.

**M7, corrected beyond spec §3's list.** M7's s1 body and presenter note, in both locales, quoted
M5's rate, "about one candidate pair in a hundred thousand" and 約每十萬組候選配對僅一組. Once s2
was corrected no module stated that rate, and M7 would have cited M5 for a figure M5 no longer
gives. M7 now states the corrected rate: at VG150's 50 predicates about one decision in a thousand
is positive for an image of twelve objects, and about one in forty-five thousand once a detector
keeps 80 boxes (316,000 / 7 ≈ 45,143); 約每一千次 and 約每四萬五千次 in 繁體中文. The plan
review found the quotation and added M7 to spec §3 before the build. Nothing else in M7 changed.

**The map's toy readouts are left as they are** (spec §8, D-14). T1's toy still reads "real
relations ~20, per image, VG150", and its |P| slider still runs to 310; its corrected note
attributes the 20 to the original Visual Genome, so the card disagrees with itself and the note
says so. T2's toy still averages over the whole graph, and its corrected note says that its
iteration slider changes nothing after the first round.

**The slice ordered, the six beliefs and their arithmetic** (`c220b62`). `playgrounds/M5/pairs.ts`
orders the 80 frames of `VG_FRAMES` by object count and then by image id as a number; as strings
`1246` sorts before `547`, and as numbers `547` is rank 40, the median place.
`playgrounds/M5/beliefs.ts` reads `ph-001`'s six objects and six relationships and gives them spec
§4.2's b⁽⁰⁾ = (0.9, 0.2, 0.7, 0.4, 0.1, 0.6) for table, person, box, glove, wrench and panel; the
relation degrees are (4, 3, 1, 1, 2, 1), and every pair gives each object five neighbours.
`logic.ts` gains eleven functions: `relatedPairs`, `neighbours`, `rowNormalised`,
`averagingRound`, `averagingRounds`, `fixedPoint`, `maxDistance`, `spread`, `mean`,
`degreeWeightedMean` and `decimals`. `fixedPoint` solves (I − wS)b* = (1 − w)b⁽⁰⁾ by Gaussian
elimination with partial pivoting, which meets no zero pivot for w < 1 since every row of I − wS
is strictly diagonally dominant, and returns null at w = 1, where I − S is singular. T2's review
added `sum` and `degreeWeightedParts`, so that the limit and its note read one computation (R8).
None of the thirteen imports anything from `sgg-metrics`.
- *The slice's ranks, as tested:* rank 1 is frame 2045 (4 objects, 12 ordered pairs, 4 rows, 2
  related pairs), rank 2 frame 4176 (4, 12, 18, 7), rank 40 frame 547 (16, 240, 5, 5), rank 41
  frame 1246 (16, 240, 8, 8) and rank 80 frame 3182 (39, 1,482, 45, 29); the totals are 80 frames,
  1,348 objects, 26,282 ordered pairs, 892 rows and 651 related pairs.
- *Spec §2's values, as the tests hold them to four decimals:* the spread at b* is 0.3924
  (relations, w = 0.5), 0.1105 (relations, w = 0.9) and 0.0678 (every pair, w = 0.9);
  ‖b⁽⁰⁾ − b*‖∞ is 0.3659 (relations, w = 0.9); the spread at w = 1 is 0.0094 after 20 rounds and
  0.0002 after 40; the degree-weighted mean is 0.5083 and the plain mean 0.4833; and every pair
  at w = 0.5 stands 0.0227 from b* after one round. The fixed point agrees with 2,000 rounds of
  the rule to within 10⁻¹² at every w on the knob below 1, on both graphs, and the distance stays
  within its bound at every t from 0 to 40, at every such w, on both graphs. Every value agreed
  with the spec on its first run. The logic suite went from 86 tests at `dfe4dc4` to 105 at the
  branch's tip, 19 added: 18 in Task 2 and one in T2's review.

**The two playgrounds**, each computing and neither scoring.
- *T1*, "Pairs against relations" / 「配對數與關係數之對照」, at s3, after s2 (`36d47d5`).
  `PairsAgainstRelations`: `T1.frame`, a slider over the ranks 1 to 80, default 40; six readouts,
  N, N(N − 1) ordered pairs, N(N − 1) · 50 decisions through `candidateSpace` and E10's
  `VG150_PREDICATES`, the frame's relationship rows, its related ordered pairs as a ratio of counts,
  and the slice's 651 / 26,282, which no knob moves; and a line naming the source. It draws no
  photograph, since the slice's photographs are not licensed for distribution (`data/LICENCES.md`),
  and no SVG. At rank 2 it shows 7 / 12, never 18 / 12.
- *T2*, "Beliefs under averaging", at s5 and s6, after s4 (`41259b0`, `4ee8c89`, `c8ff2aa`).
  `BeliefsUnderAveraging`: `T2.graph`, a choice of the relations or every pair; `T2.w`, a slider
  from 0 to 1 in steps of 0.05, default 0.5; `T2.t`, a slider from 0 to 40, default 0. A regime
  line; a table of the six objects with their neighbours, b⁽⁰⁾ and b⁽ᵗ⁾ to two decimals; the
  spread; for w < 1 the distance ‖b⁽ᵗ⁾ − b*‖∞ beside its bound wᵗ‖b⁽⁰⁾ − b*‖∞, and for w = 1 the
  limit Σⱼ dⱼ b⁽⁰⁾ⱼ / Σⱼ dⱼ beside the plain mean, each to four decimals; and a line saying that
  the rule models averaging and is not IMP's learned update. `fixedPoint` runs once a render and
  never at w = 1. T2's review found the table's cells unpadded, so that adjacent values ran
  together ("0.900.90"), and the bound note's second fill untested; the cells are padded, both fills
  are tested in both locales, every knob the URL invents is tested to show no `NaN` and no unfilled
  placeholder, and three comments were made exact.
- *`{d0Again}`* (R7). The plan's copy table wrote T2's bound note with one placeholder twice,
  "wᵗ × {d0}; {d0} is the distance at t = 0", filled by `replaceAll`. `tools/i18n_parity.mjs`
  refuses a placeholder repeated within one value, since `String.replace` fills only the first
  occurrence. The second occurrence is `{d0Again}` in both locale tables and the component fills
  both with one value, so the text displayed is the plan's. The plan's copy table and the locale
  tables differ in that one name, and this record is where the difference is stated.
- The locale tables went from 380 keys to 418, 14 for T1 and 24 for T2, and the keys carrying a
  placeholder from 20 to 27.

**M5's steps, and the order of registration** (`cf4eab0`). The old s3 to s6 became s4, s6, s7 and
s8, renamed from the last so that no two steps shared an id at any point, and s3 (T1) and s5 (T2)
were inserted, each 90 s with a noun-phrase heading, the tag and presenter notes in both locales
naming the setting to show and the number it gives. T2's split (below) gave M5 nine steps: s1
prose, s2 math, s3 T1, s4 math, s5 and s6 T2's two parts, s7 prose, s8 lab and s9 checkpoint. The
corpus holds 120 steps a locale and 240 presenter notes (117 and 234 before). No module or locale
table cites an M5 step by id, and the notes Task 1 wrote, which name the next step by what it
shows, read true after the insertion.
- *The order of the tasks.* As M4 found (D106), registration moved to the task that inserts the
  steps (Task 5), and the golden cases followed it (Task 6), for two reasons:
  `KnowledgeIndex.test.tsx:75-90` fails for a registered playground with no lecture step, and
  `content_lint.mjs:271-273` refuses a golden case for an unregistered playground. Tasks 3 and 4
  tested their components by direct mount.
- *The counts* that the records test reads at every `npm run ci` (16 playgrounds, 12 live points
  without one, the steps and notes, sixteen playgrounds timed and eleven in parts) were written in
  the commits that changed them, Task 5's and Task 7's.

**`dense` for T1 and T2.** Both frames are `clip={false}`, since neither draws a picture (D93),
and `dense`. `dense` was M4's opt-in (D106), so that the nine earlier playgrounds keep the spacing
their records measured. T1 and T2 have no earlier measurement to move, and at the base spacing X2's
four readouts ran 74 px past 1024 × 768 (D106), where T1 carries six readouts and T2 a six-row
table beside three. `Playground.test.tsx` requires the dense frame of exactly E3, E4, E7, E13, X2,
T1 and T2, and `controls.tsx`'s comments name M5's two beside M4's five.

**The golden cases** (`269ed88`). Eleven cases in `data/content/playground_golden.json`, each `why`
writing out its arithmetic: T1 at ranks 1, 40 and 80 and the slice's totals; T2 at (relations,
0.5, t = 0, 1 and 5), (relations, 0.9, 10), (relations, 1, 40), (every pair, 0.9, 1) and (every
pair, 1, 5). Content lint counts 75 playground cases (64 before). With the cases written and no
block to run them, the golden test failed 1 of 68, on "every case is run by exactly one block",
first at `pg-T1-rank1`; with the three blocks and a test pinning four T1 cases and seven T2 cases
it passed 80. Each expected value was computed from the functions over the slice before it was
written, and none disagreed with the plan.

**The fit** (`b3013b9`). Task 7 measured `step.scrollHeight − step.clientHeight`, in px, on the
production build at 1024 × 768 with the webfonts decoded, T2 still one step at `m05/4`:

| State | 繁體中文 | English |
|---|---|---|
| `m05/2?T1.frame=80` | 0 | 0 |
| `m05/2?T1.frame=1` | 0 | 0 |
| `m05/4` | 44 | 91 |
| `m05/4?T2.w=0.95&T2.t=40` | 44 | 91 |
| `m05/4?T2.w=1&T2.t=40` | 44 | 91 |
| `m05/4?T2.graph=every&T2.w=1&T2.t=5` | 67 | 114 |
| `m05/4?T2.w=0&T2.t=40` | 44 | 91 |

- *The parts (D96).* T1 fits in both locales at ranks 1 and 80 and stays one step. T2 ran 44 to 67
  px past in 繁體中文 and was split in two by the plan's recipe: part 1, s5, "Six beliefs, round by
  round" / 「六個信念之逐輪變化」, the regime line and the table; part 2, s6, "Where the beliefs
  settle" / 「信念之收斂位置」, the regime line, the readouts and the model line; the three knobs on
  both. `PLAYGROUND_PARTS` gives T2 two parts, and eleven playgrounds span parts. s5 carries a new
  note on the table, and s6 T2's earlier note from "Open on the annotated relations" onward.
  `perf.spec.ts`'s T2 case moved to step 5, where the readouts are.
- *After the split,* the same measure with the five states repeated at `m05/5` gave 0 for every
  state of both parts in both locales, English included.

**The browser** (`b3013b9`). `lecture.spec.ts` gains four tests: M5's playgrounds compute with no
backend (`m05/2` reads 240, 5 and 651 / 26,282; `m05/4` reads 0.90 for the table's b⁽ᵗ⁾; `m05/5`
reads the spread 0.8000 and the bound 0.2065); every knob works from the keyboard without advancing
the deck (the rows 5 to 8 on `T1.frame`, 0.90 to 0.65 on `T2.t`, 0.65 to 0.63 on `T2.w` at t = 1,
and `T2.graph`); a knob writes the address bar (`T2.graph=every`, which, opened cold, reads "the
other five"); and a knob set on T2's first part reaches its second (`m05/4?T2.w=1`, ArrowRight, the
limit 0.5083). The test that no playground takes focus gains M5's steps 2, 4 and 5.
`projector.spec.ts` holds seven longest states to the panel at all three sizes, T1 at rank 80 and
each of T2's parts at w = 0.95 and t = 40, at w = 1 and t = 40, and on every pair at w = 1 and
t = 5; adds `m05/2`, `m05/4` and `m05/5` to the check that a playground step fits with its controls
reachable and to the 18 px floor; and adds the three steps to the contrast walk, where they read
27, 41 and 22 rows at 1024 × 768, with floors 21, 32 and 17, four fifths rounded down.
`perf.spec.ts` times `T1.frame` to 80 and `T2.t` to 5 and requires sixteen playgrounds measured.
Task 7's runs: `npm run test:e2e` 83 passed in 2.2 min; `npm run check:perf` 30 passed in 38.7 s,
T1 at 34.9 ms, 2.0 ms above its 32.9 ms two-frame floor, and T2 at 33.1 ms, 0.2 ms above its
32.9 ms floor.

**Data no commit carries.** `data/` is not in git (D109) and is a directory junction to the NAS
(D110), so two of this branch's changes appear in no commit and no diff.
- *The harvest* (Task 1). `npm run harvest` after `114a8c8` changed six entries under
  `data/content/`: `math.json` T2; `deriv.json` T1 and T2; and `kp.json` T1.deriv, T2.math and
  T2.deriv. The re-harvest after the review round, `b6c3d8a`, changed `deriv.json` T2 and `kp.json`
  T2.deriv again and `math.json` not at all. Each value is what the harvest reads from the committed
  `pg.js`, and `npm run ci` runs the harvest first, so their text follows from this branch's
  commits; the before and after of each value is recorded verbatim in Task 1's report.
- *The golden cases* (Task 6). Eleven cases were appended to `data/content/playground_golden.json`,
  64 cases to 75: `pg-T1-rank1`, `pg-T1-rank40`, `pg-T1-rank80`, `pg-T1-slice`,
  `pg-T2-relations-w05-t0`, `pg-T2-relations-w05-t1`, `pg-T2-relations-w05-t5`,
  `pg-T2-relations-w09-t10`, `pg-T2-relations-w1-t40`, `pg-T2-every-w09-t1` and
  `pg-T2-every-w1-t5`. Their full text is the plan's Task 6 Step 1, which the eleven cases on the
  NAS equal as parsed JSON, compared for this record; Task 6's report carries them verbatim too.
  The file stays LF.
- *One copy for every branch* (the final review). `data/` is one copy on the NAS, read by every
  branch and every checkout. This branch's golden cases, the eleven above, and its harvest are
  already there, so `main` before the merge fails `npm run ci` against the NAS: content lint
  refuses each of the eleven with "golden case for 'T1', which has no registered component", or
  'T2' (`content_lint.mjs:271-273` at `dfe4dc4`, where `mounts.tsx` registers neither), and the
  golden test fails "every case is run by exactly one block" at `pg-T1-rank1`. Running `main`'s harvest rewrites `kp.json`,
  `math.json` and `deriv.json` on the NAS with M5's old text, after which this branch's corrections
  test fails until its own harvest runs again. A revert after the merge needs the eleven cases
  deleted from `data/content/playground_golden.json` by hand and `npm run harvest` run on the
  reverted tree. As far as the records show, this is the first branch since D109 to change
  `data/content/`, and so the first whose data breaks another branch's gate. The rule it leaves,
  stated in CLAUDE.md's traps: a branch that changes `data/` changes it for every branch at once;
  merge it promptly, and do not run another branch's gate or harvest in between. Versioning
  `data/content/` would remove the hazard, and is the author's decision under D109.
- The implementers' reports are under `.superpowers/sdd/2026-09-29-playgrounds-m5/` at the
  WekaExt root, which git ignores; the plan and the spec are committed.

**vitest's 5000 ms timeout, observed during the build and given a measured bound.** `npm run ci`
hit vitest's default timeout in two M4 tests of `registry.test.tsx` whose content this branch does
not change, "M4 carries E3, E4, E7, E13 and X2 directly after the steps that teach them" and "M4
derives only what the engine and the definitions force". In Task 1 three runs failed on the first,
which ran in 290 and 571 ms alone and passed at `--testTimeout=20000`, and the fourth passed. In
Task 6 one run failed on both, and the re-run passed. In Task 7 it recurred once in a vitest run
outside the gate, the test then passing alone in 854 ms, and the gate passed on its first run. On
this record's tree, before the change below, it failed six runs in a row: the first on both tests
(8,941 and 8,009 ms), the next five on one of them (5,555, 6,201, 6,278, 5,767 and 5,917 ms), while
another session's Python jobs held the machine's processors. Run alone, the two take 639 and
1,299 ms, and within their file alone 4 to 8 s. The failure reproduced on `b3013b9` with this
record's changes stashed (5,696 ms), so the records did not cause it. With `--testTimeout=20000` on
the command line vitest passed 1079 of 1079, the two at 187 and 2,077 ms.
- *The change* (`62c76d2`), on the controller's ruling (R10). Each of the two tests carries an
  explicit timeout of 20,000 ms, vitest's third argument to `it`, and a one-line comment stating
  its measurement: about 0.6 s and 1.3 s alone, 5.6 to 8.9 s under contention, against vitest's
  5000 ms default. The global timeout and every other test are unchanged. One test renders M4's
  playground steps in jsdom and the other its math steps in both locales, work that contention
  stretches; the bound is more than twice the slowest time measured, 8,941 ms, and a test that
  hangs still fails.
- *After it,* `npm run ci` exited 0 at its first run on `62c76d2`'s own tree, 1078 tests, the two
  at 6,050 and 3,064 ms, and at its first run on this record's tree, 1079 tests, the two at 5,991
  and 5,173 ms. Three of those four times exceed the default. It passed again on this commit's
  final text.

**The final review** (`dfe4dc4..ddc495e`, 3 Important and 9 Minor findings, all fixed in one
commit on the controller's rulings).
- *§2.4* amended in place (R11, above), and the records test requires the amendment's text.
- *The shared NAS data* recorded above, in INDEX's M5 paragraph and in CLAUDE.md's traps.
- *Two displayed w = 1 sentences made exact,* in s4's Implications in both locales: the
  degree-weighted mean "can differ from the plain mean when nodes have unequal numbers of
  neighbours" (若各節點之鄰居數不等，則可能與算術平均相異), where it said "differs", since equal
  degrees are sufficient and not necessary; and on a disconnected graph "each component with an
  odd cycle settles on its own value" (各含奇數長度迴路之連通分量各自收斂至其自身之數值), since a
  bipartite component can oscillate. The same sufficiency, stated as necessity, was corrected in
  `logic.ts`'s comment on `degreeWeightedMean` (which also claimed convergence "on any graph
  without isolated nodes"), in `M5/beliefs.ts`'s comment on `M5_B0`, in the `logic.test.ts` title
  "only on the regular graph", which now carries a counterexample with unequal degrees, and in spec
  §2 by a dated note. The two `logic.test.ts` titles that kept the old letter now read
  "(I − wS) b*" and "I − S is singular". `M5/pairs.ts` no longer says that 547 carries fewer
  objects than 1246: both carry 16, and the tie is broken by image id as a number. The display
  math, `pg.js` and the harvest are unchanged.
- *The notes and the copy.* s5's note says the table falls to 0.65 at t = 1 and settles near 0.70;
  s6's English note says the distance never exceeds its bound and equals it at t = 0, and its
  繁體中文 note gains the same equality; s3's 繁體中文 note reads 依序呈現. s8 says that L4 shows
  reconstructions of Neural Motifs' and VCTree's published behaviour: `data/predictions/placeholder/`
  holds reconstructed files for motifs and vctree among five models and no measured file, and
  `data/predictions/PROVENANCE.md` states that a reconstructed file "is never described as a
  model's output". T1's source line says that its photographs are not
  licensed for distribution (`data/LICENCES.md`), where it said that none ships, and `slice.ts` and
  spec §5.1 say the same; T2's option reads "relations annotated on ph-001, either direction"
  (ph-001 標註之關係（不分方向）), since `beliefGraph` joins subject and object both ways.
- *This record* gives the logic suite's count from `dfe4dc4`, and the records test holds README's
  e2e figure at 83.

**Two minor findings of the reviews are deferred to the author.**
- The `why` texts of `pg-T2-relations-w05-t5` and `pg-T2-relations-w09-t10` name the box as the
  object at the largest gap, where the panel ties with it; the values hold, and
  `pg-T2-relations-w05-t1` names its tie. The text is the plan's, and it is on the NAS only.
- The new files under `playgrounds/M5/`, `T1/` and `T2/` were LF in the working tree, where their
  neighbours are CRLF. Git stores LF and a checkout writes CRLF, and nothing compares working-tree
  bytes. They are CRLF since the final fix wave.

Not checked: how MATH.T2's three lines lay out in the map's formula card, where every other formula
is one line; `lint:frozen` passes over it, and no look at it in a browser is recorded. The VG150
card's figures are external to the repository and were not re-read for this record.

**The records test.** This record's test failed first on its missing heading.

**Verification.** `npm run ci` exit 0 in eleven steps on this commit's tree, after `62c76d2`: 287
pytest and 7 skipped, **1079 vitest in 76 files** (1020 in 74 before), parity 21, **i18n 418 keys** (380 before), 27 of them
with a placeholder (20 before), content lint clean over 21 golden cases, **75 playground cases**
(64 before) and 25 release figures with **50 symbols** (48 before), standalone current at 254
equations, frontend builds 790 modules (786 before). `npm run test:e2e` **83** (79 before),
2.0 min. `npm run check:perf` **30** (28 before), 36.3 s; T1 33.7 ms, 1.8 ms above its 31.9 ms
two-frame floor, and T2 33.6 ms, 0.3 ms above its 33.3 ms floor. See VERIFICATION §30.

**The author's review, 2026-09-29.** The author accepted R2 with contracts §2.4's amendment, S for
the averaging matrix (R1), and the correction of the three items the final review left open
(R13 to R15). A follow-up commit made them: M5 s8 and its presenter note no longer speak of four
years of architecture, since s8 names two methods, Neural Motifs (2018) and VCTree (2019); the
bipartite statement here reads "can oscillate"; and the note on the new files' line endings is
in the past tense.

## D112 — the live VLM provider sent no frame

**Plan:** `plans/2026-09-29-m0-demos.md`, Task 1. **Decisions:** none new. Branch `feat/m0-demos`.

**The defect.** `ClaudeProvider.complete` sent the prompt text alone (`claude.py:39-43` before this
commit): `image_ref` was accepted and never read. Every exchange recorded through the live path
therefore described an image the model never saw, and the answer read as a description of it. L5's
live answers change with the fix, since the model now receives the frame; recorded transcripts are
unchanged, because none was produced by this path.

**A live L5 run on the paper's Figure 2 now fails, by intent.** A live L5 run (provider `claude`) on
`isg-fig2-t1`, `isg-fig2-t2` or `isg-fig2-t3` now answers 503 `vlm_unavailable`, because no frame for
those ids exists under either directory of `FRAME_DIRS`. The endpoint's default `image_id` is
`isg-fig2-t1` (`app/api/vlm.py:48`), so the default live request fails. This is intended: a live
answer about an image the model never saw is the defect this record fixes. The offline transcript
replay of those ids is unaffected: it reads no frame, and the default provider is still the replay.

**What the fix does, and what the tests pin.**
- *The frame is sent, before the prompt.* The request carries a base64 `image/jpeg` block and then
  the text block. The model is `ClaudeProvider(model=...)`, default `claude-sonnet-5`, so L5's live
  default is unchanged; the request states `max_tokens=16000` and `output_config={"effort":
  "high"}`, and carries neither `fallbacks` nor `thinking`. A server-side fallback would put text
  under a model's name that another model produced, which `get_provider` forbids.
- *A frame that cannot be found is an error.* `app/vlm/frames.py` resolves an id in the mini-ISG
  slice's images and then in `data/demos/m0/frames`; an id found in neither raises
  `ProviderUnavailable` naming the id, and no request is made.
- *The id is validated.* `image_ref` reaches `frame_path` from the request body of
  `POST /api/vlm/indvissgg`, so `frame_path` looks up only an id that fully matches
  `[A-Za-z0-9_-]+` (every real id does: `isg-001`, `m0-demo-088`, `isg-fig2-t1`) and skips a
  candidate whose resolved path is not inside its directory's resolved path. `../x`, `..\x`,
  `a/b`, the empty string and an absolute path return None, with a real `x.jpg` one level above
  the frame directory so that the refusal is not a mere absence; the provider then raises the
  error above.
- *A refusal is raised.* `stop_reason == "refusal"` raises `ModelRefused`, which carries
  `stop_details.category` when present.
- *A truncation is raised.* `stop_reason == "max_tokens"` raises `ProviderUnavailable` naming it.

**Not checked.** The request shape follows the Claude API reference and is exercised against a
fake `anthropic` module; the package is not installed on py12 and no live call was made.

## D113 — the demonstrations' graphs carry `dataset: "mini-isg"`, and no `DatasetId` of their own

**Plan:** `plans/2026-09-29-m0-demos.md`, Task 3. **Decisions:** none new. Branch `feat/m0-demos`.

**What was done.** Every `SceneGraph` the M0 demonstrations record, the ten of D-T under
`data/demos/m0/traditional/` and the drafts of D-V, carries `dataset: "mini-isg"`, though their frames
`m0-demo-088` to `m0-demo-106` are not among the mini-ISG slice's own frames: they are other frames of an
IndustReal recording, cut under the same licence finding (Apache-2.0, verified on the 4TU data record).

**Why not a new `DatasetId`.** The literal is declared twice, in `app/schema.py` and in the TypeScript engine's
types, and a new member would change both engines' schema and every exhaustive switch over it for graphs that no
API serves: the datasets API serves the slices under `data/slices/`, and the demonstration frames are not a slice. The
field states the domain (IndustReal assembly footage, the `O_ISG` vocabulary), which is what the other graphs of
that value share. It does not state that the frame belongs to the 40-frame slice; `image_id` and the manifest
of `data/demos/m0/` say which frames these are.

**Consequence.** A reader that joins on `dataset == "mini-isg"` and then looks the `image_id` up in the slice's
manifest will find no row for these ten. Nothing in the tree does that today; the demonstrations read their own
manifest.
