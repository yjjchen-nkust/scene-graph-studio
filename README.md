# Scene Graph Studio

Teaching material for scene graph generation, built for 大語言模型技術與應用 (2026). Bilingual
繁體中文 ／ English, runs entirely on localhost, and works with the network down.

Anchor paper: Wang Z., Yan Z., Li S., Liu J. *IndVisSGG: VLM-based scene graph generation for
industrial spatial intelligence.* Advanced Engineering Informatics 65 (2025) 103107.
[doi:10.1016/j.aei.2024.103107](https://doi.org/10.1016/j.aei.2024.103107)

---

## Quick start

**Prerequisites:** Node ≥ 22.12 and Python 3.12. Check with `node --version` and
`node system/tools/py.mjs --version`. If Node is older, `winget install --id OpenJS.NodeJS.LTS -e`,
then reopen the terminal — Vite refuses to run on anything less.

**The Python environment is `py12`**, the global virtual environment this repository's Python
work runs in, normally at `C:\Python\pyVenv\py12`. Nothing here uses the bare name `python`
any more, because what that resolves to differs between shells and machines, and two
interpreters with different package sets is how a suite passes in one terminal and fails in
the next. Both front doors resolve the same environment in the same order — `SGS_PYTHON`, an
activated `py12`, `py12` on disk (`PY12_HOME` first), then PATH:

| From | Resolver |
| --- | --- |
| PowerShell (`start.ps1`, `fetch-data.ps1`) | `system/tools/Resolve-Python.ps1` |
| npm scripts and `system/tools/*.mjs` | `system/tools/py.mjs` |

On a machine with no `py12`, `start.ps1` says so, lists the virtual environments it can find,
and asks which to use; it does not fall through to PATH silently. Create one with
`python -m venv C:\Python\pyVenv\py12`, or point `PY12_HOME` at the one you have.

To run anything on that interpreter yourself, from `system/`:

```bash
node tools/py.mjs -m pytest backend/tests -q   # or any other arguments
node tools/py.mjs                              # prints the interpreter it resolved
```

**Windows (PowerShell)** — both machines in D-02 run Windows, so this is the default path:

```powershell
cd scene-graph-studio
.\start.ps1              # checks Node and Python, installs on first run, then launches
```

`start.ps1` is a front door for `npm start`; the orchestration itself is in `system/tools/start.mjs`.
It is safe to re-run — every step it has already done is skipped.

**Any platform:**

```bash
cd scene-graph-studio/system
npm run setup     # installs both toolchains and generates the placeholder slice
npm start         # starts the backend and the dev server together
```

Every `npm` command in this file runs from `system/`, which is where the workspace root lives.
`start.ps1` is the one exception: it sits at the track root and changes directory for you.

`npm start` prints the URL to open, what it found on this machine, and which slices are present.
Ctrl+C stops both. If a port is taken:

```powershell
.\start.ps1 -BackendPort 8010 -FrontendPort 5180
```

PowerShell has no inline environment-variable prefix, so the bash form below is not a
substitute there — this is why the script takes the ports as parameters.

```bash
SGS_BACKEND_PORT=8010 SGS_FRONTEND_PORT=5180 npm start
```

**A fresh clone works with no data of any kind.** The committed placeholder slice — six
synthetic frames — is enough to run every lab. Nothing is downloaded, and nothing needs a GPU.

### If you are a student

Your instructor will give you a slice bundle. Unzip it into `data/slices/`, then:

```bash
cd system
node tools/py.mjs backend/scripts/verify_bundle.py              # checks every file against its hash
node tools/py.mjs backend/scripts/fetch_images.py --dataset psg # only for datasets marked "fetch"
```

`/api/datasets` reports which of the two each dataset needs, and why. See
[Data](#data) below.

### If you are the instructor

You download the corpora; no script here does. Then:

```bash
export SGS_CORPUS_ROOT=/path/to/your/downloads      # defaults to data/_raw/
cd system
node tools/py.mjs backend/scripts/cut_slice.py --dataset vg150-sgb
node tools/py.mjs backend/scripts/bundle_slices.py   # writes dist/…-slices-<date>.zip
```

`bundle_slices.py` prints the zip's size and SHA-256. Quote both when you hand it out, so a
student can check what they received.

---

## What is here

```
backend/          FastAPI + Pydantic v2. app/eval/ is the authoritative evaluation engine
packages/         sgg-metrics — the same engine in TypeScript, for in-browser latency
frontend/         Vite 8 + React 19 + TypeScript + Tailwind 4
data/             golden vectors, slices, licence findings
tools/            parity harness, linters, the startup script, the frozen page's validators
system/web/knowledge-map/  a frozen static page: 93 knowledge points, 27 playgrounds, no build step
docs/superpowers/   PRD, SRS, design, decisions, contracts, three later designs, the master
                    plan and seven executable plans, and the anchor paper read from the PDF
                    (M11's source)
```

**Read `docs/superpowers/specs/…-decisions.md` before changing anything.** It records D-01
through D-22 and why each was decided, including several that are not guessable from the code.

---

## The evaluation engine

Everything else depends on it, so it is specified first, built first, and tested hardest.

It exists **twice** — Python (authoritative) and TypeScript (so a lab can score a student's graph
inside the 100 ms interaction budget without a round trip). The two are held identical by
`data/golden/vectors.json`, thirteen cases whose every expected value was computed on paper from
the definitions before the engine was run against them. `npm run lint:parity` drives both over
the same fixtures and fails on any disagreement; it has been verified by deliberately breaking
one side and confirming it catches it.

`system/backend/app/eval/` imports nothing outside the Python standard library — no numpy, no
pycocotools. Two implementations of one definition is already a risk; two sets of float
semantics on top of that is not worth the convenience.

**`system/web/knowledge-map/pg.js` contains a function called `evaluate()`. It is not this engine.**
It is a teaching instrument over fifteen hard-coded rows, with no protocol, no constraint mode
and a precomputed IoU scalar. Promoting it would produce something plausible and wrong, in a way
the cross-implementation check could not detect because both sides would be wrong together. See
decision D-14.

---

## Data

```powershell
.etch-data.ps1                          # what exists, what each dataset still needs
.etch-data.ps1 -Fetch -Dataset psg      # per-image download from source, hash-checked
.etch-data.ps1 -Unpack <bundle.zip>     # unpack a slice bundle, then verify it
```

`fetch-data.ps1` does **not** download a corpus, and neither does anything else here — D-08
struck that machinery deliberately. It reports state, runs the two sanctioned routes, and
tells you what to fetch by hand and where to put it.

Source corpora are downloaded by the instructor. **No script in this repository downloads a
dataset.**

Committed: `annotations.json` and `MANIFEST.json` per slice, plus the placeholder frames.
Not committed: `data/_raw/`, and every real slice's `images/`.

`data/LICENCES.md` carries two findings per dataset, because downloading for your own use and
handing images to a class are different acts:

| Dataset | annotations | images to students | Basis |
|---|---|---|---|
| `vg150-sgb` | ✔ | ✔ bundle | CC BY 4.0. Attribution is a licence condition, not a courtesy |
| `psg` | ✔ | ✖ fetch | OpenPSG is MIT, which covers the annotations. The images are COCO photographs from Flickr, which MIT does not reach |
| `vrd` | ✖ | ✖ | The project page states no licence, no copyright, no terms |
| `indoorvg` | ✖ | ✖ | SGG-Benchmark's code is MIT; nothing is stated for the data |
| `haystack` | ✖ | ✖ | No LICENSE file, no declaration |

An absent licence statement is not a permissive one, and `UNCLEAR` counts as `NO`. `cut_slice.py`
and `bundle_slices.py` both refuse against an uncleared row and name the cell to fill.

---

## Commands

```bash
npm start                  # backend + dev server, with preflight checks
npm run setup              # first-time install
npm run ci                 # the whole gate; this is what "green" means

npm run test:py            # pytest
npm run test:ts            # vitest (metrics package + frontend)
npm run lint:parity        # the two engines must agree on every golden vector
npm run lint:i18n          # a key exists in both locales or in neither
npm run lint:content       # golden vectors hand-checked; no uncleared slice committed
npm run lint:frozen        # the static page's own validators
```

`lint:frozen` runs `system/tools/audit.js`, which catches the failure that matters most on that page: a
`\\` line break inside display math but outside an alignment environment is a TeX error, and
MathJax renders it as a visible red message rather than failing loudly.

---

## Constraints worth knowing before you change something

**Offline-complete.** Every P0 feature must work with the network down and `torch` uninstalled.
Live inference and the live VLM are the only degradable paths, and they degrade with a stated
reason rather than a stack trace.

**Honest numbers.** Every metric crosses the wire as a `MetricValue` carrying its `k`,
`protocol`, `constraint`, `source`, `verified` and `fidelity`. There is no code path that formats
a bare number as a metric — SRS §4.5 says the interface refuses to render an untagged number, and
the type is how that refusal is enforced. A `reconstructed` figure requires a note saying what it
reproduces, and renders differently from a measured one.

**One VG150.** Several releases answer to the name "VG150". They differ in the validation
carve-out and in filtering, and one published release drew its validation set from the test pool
(D93). This project ships one, the corrected release of Neau et al.'s SGG-Benchmark, named
`vg150-sgb` after its provenance everywhere. The schema refuses the bare string `vg150` as a
dataset identifier, and prose uses VG150 only as the published benchmark's name.

**No fallback locale.** A missing i18n key renders as `⟦key⟧` in development and throws in a
production build. A silent fallback to English would let a half-translated build look finished.

**Never committed.** `.env`, `data/_raw/`, real slice images, and any API key or token in any
form — including inside teaching content, fixtures and prompt transcripts.

---

## Sharing the design brief

`system/web/brief/index.html` is the bilingual design brief — eight sections, the full metric
mathematics, and a working Metric Explorer prototype. It fetches MathJax from cdnjs and fonts
from Google, so on a machine with no connection its equations show as raw LaTeX.

**`docs/brief.standalone.html` is the one to send people.** Every equation is pre-rendered
to SVG at build time and both remote dependencies are gone, so it renders identically from a USB
stick, behind a campus firewall, or in five years when a CDN path has moved. One file,
1,066,149 bytes as built on 2026-09-26, no network requests of any kind — asserted by
`npm run lint:standalone`, not assumed.

```bash
npm run build:standalone   # regenerate after editing system/web/brief/index.html
npm run lint:standalone    # fails if the build is stale or has grown a remote reference
```

Edit `system/web/brief/index.html`, never the standalone; the check will catch you if you forget to
rebuild. For a link rather than an attachment, the file is static and drops into any web space —
your own server, or a drag-and-drop host.

## The frozen page

`system/web/knowledge-map/` is a self-contained bilingual page — 93 knowledge points across 12 clusters,
27 playgrounds, no build step, no dependency to install. Open `index.html` in a browser.

It was **frozen on 2026-09-15** and harvested into `data/content/` as the seed corpus for the MDX
modules. Do not extend it; content changes belong in `data/content/` and the module corpus. It is
kept because it is the only artefact here that runs with no toolchain at all, which makes it the
last-resort offline fallback, and `npm run ci` still validates it so it cannot rot silently.

Its playground data is **synthetic**, chosen to expose each effect cleanly. The arithmetic is
exact and matches the stated definitions, but the values measure no model. Figures quoted from
papers are attributed in place.

---

## What can actually run here

Two machines, and the ship target is the weaker one (D-02). Nothing below is aspirational: the
model registry answers it at run time through three gates — is `torch` importable, is the
checkpoint present, is the package installable — and `/api/health` reports what it found.

| | AUTHOR box | TEACH box |
|---|---|---|
| CUDA | 12.8 on an RTX 3090 (`torch` 2.10.0+cu128, opt-in) | none, ARM64 |
| Live inference | RelTR only, opt-in | RelTR only, slowly |
| Everything else | full | full |

**Live inference is RelTR and nothing else** (D-06), and it is opt-in. **Motifs, VCTree and
PSGFormer can never run live here**, and the reason is not a missing checkpoint: they depend on
`maskrcnn-benchmark`, which does not build on either machine, and no amount of downloading fixes
that (D-05). The registry says so in both languages rather than offering a button that fails.

**Predictions come in three tiers, and every figure carries its tier** (D-07):

* `measured` — produced by running the model here. Blocked on licences; see
  `data/predictions/PROVENANCE.md`.
* `reconstructed` — written to exhibit a behaviour the literature reports, by a script in this
  repository. Every committed prediction is currently this tier, and each file says so in its own
  `provenance.note`.
* `published` — a figure read off a named table in a named paper, attributed to the paper that
  printed it, which for a re-implementation is not the paper the card is about.

A number in this application without a source is a bug. `npm run lint:content` enforces it.

---

## Status

**Plans 01 through 04 are executed.** `docs/INDEX.md` is the current state of the project and is
kept up to date; `docs/VERIFICATION.md` records the nine checks of design §6 with the date each
was run and its outcome. All nine have been run and passed; check 6 was first recorded as
**not run** (D69) and passed on 2026-09-18.

`npm run ci` is green on py12: 266 Python tests (7 skipped for a corpus this machine may not
have), 785 TypeScript tests across 61 files, parity 13/13, i18n 292 keys in both locales,
content lint clean, frozen-page lints clean, and the frontend builds. `npm run test:e2e` is 62
passed and `npm run check:perf` is 21. All measured 2026-09-27; `docs/VERIFICATION.md` §21
records that run, §15 to §20 the six before it, and §14 the earlier run that reconciled
three documents carrying three different counts.

Two further checks are scripts rather than prose:

```bash
npm run test:e2e        # check 8: M0 to M14 by keyboard, at XGA, WXGA and 1920x1080
npm run check:offline -- --python .offline-venv/Scripts/python   # check 6
```

`check:offline` runs the backend on an interpreter with no `torch`, points `SGS_DATA_DIR` at a
scratch directory holding one generated slice, and has Playwright abort every request to anything
but localhost — so the run fails on the *attempt* to fetch, not on a timeout. It refuses to start
if `torch` is importable, because a run with `torch` present is not that check.

`docs/superpowers/specs/2026-09-16-indvissgg-reading.md` is a full primary-source reading of the
anchor paper — every equation with its symbols defined, both ablation tables transcribed with the
reading of each, and a section on what the paper does not establish. It is the source for module
M11, so authoring that module was transcription rather than a fresh reading.

**Open, and each with a stated reason rather than a silence:**

* The measured prediction tier, blocked on licences (`data/predictions/PROVENANCE.md`).
* Slides that run past the bottom of a 1024×768 projector. 25 of the then 92 were reviewed and
  accepted as they stand on 2026-09-18 (DEVIATIONS D71; `docs/VERIFICATION.md` §8). The five
  playgrounds too tall for one panel are split across steps (D96, D97), and every part fits 1024×768
  in 繁體中文 in every state measured (§20, §21). In English some parts still run past it, by up to
  163 px, and F2 and F8, one step each, by 24 and 27 px in 繁體中文. The step region scrolls inside
  a fixed shell, so the position and the section clock stay on screen, and no playground hides a
  word where that scroll cannot reach it (D93, D95).
* `vrd` and `haystack` state no licence, so nothing is cut from either and both gates stay shut.

`DEVIATIONS.md` records every departure from the plans, with the reason. Several were defects the
plans themselves contained — a test that contradicted its own contract, an IoU fixture that
landed at 0.4999999999999999 instead of 0.5, and an error handler that turned every 422 into a
500 — and a dozen more are tests that passed for the wrong reason, each written up with what made
it pass.

---

## The ISG dataset

The dataset described in the anchor paper has no public release — verified September 2026. No
repository matches it, the authors' own pages omit the code badge they attach to their other
work, and no Hugging Face dataset corresponds. This project teaches ISG from the published tables
and labels it request-only, and warns about the unrelated `ISG-Bench` name collision.

In its place a mini-ISG is built by the same method from openly licensed industrial frames,
labelled unambiguously as **our** teaching set and not the authors'.
