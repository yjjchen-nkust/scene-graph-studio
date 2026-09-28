# Verification — the nine checks

Design document §6 names nine checks. Each is recorded here with the date it was run and what it
produced. **A check that was not run is recorded as not run.** There is no third state, and
nothing below is inferred from a check that resembles it.

Run on **2026-09-18**, on the machine the repository `CLAUDE.md` calls the author's box: Windows
11, Node 24.19.0, Python with `torch` 2.10.0+cpu present, all four cut slices unpacked (that
interpreter is now py12 and its torch is the cu128 build — §12 and §13). Check 6
runs against a deliberately reduced environment instead; §6 says exactly what it is and how to
repeat it.

Two of the nine are scripts anyone can re-run: `npm run check:offline` (check 6) and
`npm run test:e2e` (check 8). The other seven are recorded below with what they produced.

| # | Check | Outcome |
|---|---|---|
| 1 | Evaluation engine truth | **passed** |
| 2 | Reproduce a known number | **passed as a sanity check**, never as a reproduction |
| 3 | The constraint gap is visible | **passed, with a finding** |
| 4 | The FREQ humiliation reproduces | **passed in the lab's own tests**; the ad-hoc corpus written for this check did not, and why is recorded |
| 5 | The protocol correction reproduces | **passed** |
| 6 | The offline run | **passed**, arranged rather than found: `npm run check:offline`; re-run 2026-09-19 |
| 7 | Bilingual parity | **passed** |
| 8 | Lecture rehearsal | **passed, after fixing three defects it found**; the viewport finding was reviewed and accepted |
| 9 | The source audit | **passed, after fixing a count it found** |

---

## 1. Evaluation engine truth — passed

`pytest backend/tests -q` — 251 passed, 7 skipped. `npm run test:ts` — 484 passed.
`npm run lint:parity` — 13 golden cases agree between the Python and TypeScript engines.

Then one vector hand-verified against the definitions rather than against the engine.
**`gv-004-all-tied-scores`**, chosen because it pins a tie-break and not only a number:

* Two predictions of ⟨1, `on`, 2⟩, both scoring 0.5, submitted as relationship ids 7 then 3.
* The tie-break is `(-score, relationship_id)` ascending, so id **3** — submitted *second* — ranks
  first. Computed by hand: `[7, 3]` in, `[3, 7]` ranked. The engine agrees.
* Subject IoU of `(0,0,10,10)` against `(1,1,10,10)`: intersection 81, union 119, **0.6807**.
  `81/119 = 0.6807`. Above τ = 0.5. Object IoU 1.0. Predicate equal.
* R@20 = 1/1 = **1.0**. One predicate class present, so mR@20 = **1.0**.
* The file expects `R@20 = 1.0`, `mR@20 = 1.0`. They agree.

## 2. Reproduce a known number — passed as a sanity check

Committed RelTR predictions through `/api/eval` at SGDet, graph constraint, K = 50.

**On the `placeholder` slice, not `vg150-sgb`.** The measured prediction tier is blocked on
licences (`data/predictions/PROVENANCE.md`), so no RelTR output exists for `vg150-sgb` to run.
What exists is the *reconstructed* tier, and the run is recorded as what it is.

| Model | R@50 | mR@50 | Frames |
|---|---|---|---|
| `reltr` | 0.6667 | 0.6667 | 6 |
| `motifs` | 0.6111 | 0.6111 | 6 |

The paper's 27.5 is not reproduced and was never going to be: six synthetic frames are not
26,446 photographs. The check is that the magnitude is plausible and the tags are right, and the
`params_echo` carries `protocol: sgdet` and `constraint: graph` as submitted. **This is a sanity
check and is not a reproduction of any published figure.**

## 3. The constraint gap is visible — passed, with a finding

Same predictions, `constraint` toggled from `graph` to `none`:

| Model | R@50 graph | R@50 none |
|---|---|---|
| `motifs` | 0.6111 | 0.6667 |
| `reltr` | 0.6667 | 0.6667 |

Motifs moves upward, which is the check. **RelTR does not move at all**, and that is correct
rather than a failure: RelTR is one-stage and emits one prediction per object pair, so graph
constraint — which keeps the highest-scoring prediction per pair — has nothing to remove. The
two-stage model emits several per pair and loses them.

This is the lesson L6 is built on, appearing unprompted in a verification run. It is recorded
here because a reader who checked only RelTR would conclude `ng-R@K` was broken.

## 4. The FREQ humiliation reproduces — passed in the lab's own tests

`labs/L3/test/freq.test.ts` asserts it directly, and both assertions are strict inequalities:

* *"beats the tail-aware model on R"* — `R(λ=0) > R(λ=1)`.
* *"loses badly to it on mR"* — `mR(λ=0) < mR(λ=1)`.
* `covarianceGap(per_predicate, K)` equals `R − mR` to ten decimal places, which is knowledge
  point E11 as an identity rather than as a claim.

**The ad-hoc corpus written for this check did not reproduce the gap**, and the reason is
recorded rather than the corpus quietly replaced: a 239-graph Zipf corpus over seven predicates
gave `R@50 = mR@50 = 0.4477`. `predictFreq` emits every ordered pair × every predicate, so at
K = 50 over a six-class vocabulary the cutoff never binds and every predicate is recovered
equally. The gap is a fact about a K that bites, and the parameters were mine, not the lab's.

## 5. The protocol correction reproduces — passed

`labs/L6/forensics.ts` over the L6 fixture, both mask-pairing modes:

| Prediction | `multi_mpo` | `single_mpo` |
|---|---|---|
| one-stage | 0.75 | **0.25** |
| two-stage | 0.50 | 0.50 |

One-stage numbers fall by two thirds when the pairing is corrected; two-stage numbers do not
move. That is the **direction** the ECCV 2024 table reports, and the direction is all this check
claims — the magnitudes are the fixture's, not the paper's.

## 6. The offline run — passed, 2026-09-18

`npm run check:offline` — 8 tests, all passing. Re-run it with:

```bash
python -m venv .offline-venv
.offline-venv/Scripts/python -m pip install -r backend/requirements.txt
npm run check:offline -- --python .offline-venv/Scripts/python
```

The check asks for three conditions. It was previously recorded as not run because only one of
them is a property of a machine, and the other two were arranged by hand or not at all.
`tools/offline_check.mjs` now arranges all three, so this is a check that can be repeated rather
than a thing that happened once on a laptop.

| Condition | How it was met |
|---|---|
| `torch` uninstalled | the backend runs on an interpreter where `torch` is not importable, and the script **refuses to continue** if it is. `requirements.txt` never listed `torch`, so a venv built from it is torch-free by construction. |
| slices never fetched | `SGS_DATA_DIR` points at a scratch directory holding the committed annotations, no images, and a `placeholder` slice generated on the spot. The author's `data/` is not touched. |
| the network down | Playwright aborts every request to anything but this origin and **records the attempt**, so the run fails on the attempt rather than on a timeout. |

The third is **stricter than unplugging a cable**. A disconnected machine tells you the
application survived a fetch it should never have made; interception tells you it never made
one, which is what NFR-1 states. The first test in `e2e/offline.spec.ts` provokes both kinds of
outward request a page can make — `fetch` and an `<img>` — and asserts both are recorded, so the
empty list the other seven tests assert is a fact rather than an empty implementation.

What passed, with no backend `torch` and one slice:

* `/api/health` reports PyTorch **not installed**, `live_models` **none**, and exactly one slice
  unpacked.
* All fifteen modules open in the study shell; the lecture walks M0 → M14 by keyboard.
* The mathematics renders with no font or script fetched — KaTeX is typeset at build time and its
  WOFF2 files are bundled, which is what SRS §11.3 requires and what this now demonstrates.
* All eight labs render on the placeholder slice alone. A lab that cannot show its data states a
  reason of more than ten characters and leaks no stack frame.
* `POST /api/infer/motifs` → **503 `inference_unavailable`**, with `detail.torch_present: false`
  and a sentence in both languages.
* `POST /api/vlm/indvissgg` with `provider: claude` → **503 `vlm_unavailable`**, likewise.

**What this still does not establish.** The machine had a working network; nothing was fetched
because nothing was attempted, not because nothing could be. For a hall with no wifi at all that
is the same thing, and for a laptop with a captive portal it is better than the same thing. It
remains true that this was not run on a machine that has never had the corpora on it.

## 7. Bilingual parity — passed

`npm run lint:i18n` — 198 keys, both locales complete, zero missing in either direction.

Term consistency spot-checked by reading, since the lint checks keys and not register. The
technical terms stay in English inside the Chinese strings, as PRD §6.1 requires: `predicate`,
`scene graph`, `Recall@K`, `next to`, `on`. The prose is 書面語 throughout, with no second person
and no rhetorical questions — M00's 「所缺少的並非更精細的標籤，而是被標記物件之間的關係」 is
the register the whole corpus keeps.

The e2e suite asserts the default locale is 繁體中文 on a machine with no stored preference,
because that default is what a fresh machine in the hall will get.

## 8. Lecture rehearsal — passed, after fixing three defects it found

Two suites, 26 tests, all passing: `e2e/lecture.spec.ts` walks the deck, and
`e2e/projector.spec.ts` repeats it at the three resolutions a lecture theatre actually presents
at — **XGA 1024×768, WXGA 1280×800 and 1920×1080**. The first two matter because a laptop driving
a projector reports its own panel, so the author sees 1920×1080 and the room sees something else.

**Defect 1 — the deck lost keypresses** (D67). Walking M04, the longest module, the deck advanced
one step for two presses: both were computed from the same rendered index, because the second
key arrives before React re-registers the listener. A held arrow repeats about thirty times a
second, so this is a professor's problem and not a robot's.

**Defect 2 — one key, two encodings** (D68). `useLocale` stored the language preference as a bare
string while `persist` stores JSON.

**Defect 3 — three equations ran off an XGA panel** (D70). M04's steps 1 to 3 overflow 1024×768
by up to 163 px, invisible on the author's own display. `fitMath.ts` now shrinks a display block
to fit. Diagnosing it took three wrong measurements of the same geometry, each of which made an
assertion pass against a formula that was visibly cut off; the write-up is D70 and the comment in
`fitMath.ts` names all three, because the next person to measure a KaTeX block will reach for the
same wrong one.

**Contrast is now measured as painted, not as configured.** `palette.ts` asserts the tokens;
this suite reads `getComputedStyle` on every heading, paragraph, list item and table cell the
lecture renders and computes WCAG 2.1 against the nearest opaque ancestor. Every painted word
clears 7:1 at all three resolutions. That is a different statement from the palette test and the
one the room experiences.

**Reviewed and accepted by the author, 2026-09-18: 25 of 92 slides run past the bottom of an
XGA panel.**

| Panel | Slides over the fold | Worst |
|---|---|---|
| 1024×768 | 25 of 92 | M00 step 2, by 1030 px |
| 1280×800 | 24 of 92 | M00 step 2, by 749 px |
| 1920×1080 | 8 of 92 | M00 step 2, by 348 px |

The measurement was put to the author with the options — split the slides into more steps, or
leave them — and the answer was to leave them. **The item is closed on that judgement, not on a
code change**, and the numbers stay in this table so a different hall or a different term can
re-open it without re-measuring.

Shrinking the type to fit was never on the table: it would break NFR-5's 24 px floor, which is
the one thing standing between these slides and an unreadable projection.

What was fixed is the part that made a long slide worse than long. The shell scrolled the whole
page, so the position indicator and the section clock scrolled away exactly when a slide was too
long to see the end of — the two things that tell the professor where they are, gone at the
moment they are needed. The step region now scrolls inside a fixed shell.

Screenshots at all three resolutions are written to `test-results/projector/` on every run, for
the judgement no browser can make.

**The by-hand half is done.** The author reviewed the rendering across the three resolutions and
reported no problem with it on 2026-09-18. What a headless viewport still cannot report — a lit
room, a drifted lamp, the back row — is knowledge the author has and this file does not, which is
why the acceptance is recorded as a judgement rather than as a measurement.

## 9. The source audit — passed, after fixing a count it found

`npm run lint:content` — clean: 13 golden cases, 7 licence rows, 15 of 15 modules in both
locales, 93 knowledge points all assigned, 43 symbols with no redefinition.

`data/LICENCES.md`: seven rows, all `Checked` 2026-09-16 or 2026-09-18. Every dataset with
committed annotations clears `annotations_commit` — `vrd` and `haystack` state no licence and are
NO on both gates, and nothing is committed for either. `data/mini-isg/LICENCE.md` carries
IndustReal at Apache-2.0 with the 4TU data record as the statement URL, and MECCANO as **none
stated, treated as NO**, with the consequence written out: no frame is copied.

**`docs/INDEX.md` claimed eleven cards carry numbers.** The corpus has 60 cards and **ten** carry
a non-empty `reported` list — `imp-2017`, `imp-plus-2017`, `freq-2018`, `neural-motifs-2018`,
`vctree-2019`, `gps-net-2020`, `fcsgg-2021`, `psgformer-2022`, `reltr-2023`, `indvissgg-2025` —
totalling 87 figures. The 87 was right and the eleven was not. Corrected in place.

There is no unverified tier: a card either carries figures read off a named table or says plainly
that it carries none.

---

## 10. NFR-8, measured — passed, 2026-09-19

Not one of design §6's nine. It is here because `docs/INDEX.md` §3 named an enforcing artefact
for NFR-1 through NFR-7 and left NFR-8's cell blank, and nothing in 253 pytest or 487 vitest
asserted any of its three numbers. The only timing assertion in the project was `/api/health`
under 50 ms, which is a claim about a different component. A project that refuses an unsourced
figure in `content/` was carrying three unmeasured figures in its own requirements table.

`npm run check:perf` (`tools/perf_check.mjs` + `e2e/perf.spec.ts`). It starts a backend against
the repository's own `data/` — unlike check 6 and check 8, this one needs the machine at its most
complete, because four of the eight labs fetch a frame and a lab rendering its failure sentence
cannot be timed. Thirteen tests, all passing.

**Cold start — budget 10 s.** A browser context created for that one route, so the HTTP cache,
the storage and the module graph are all empty. The clock is the page's own `performance.now()`
from the navigation's time origin to the route's first meaningful element.

| Route | Measured |
|---|---|
| `/` | 242 ms |
| `/lecture/m/m00/0` | 202 ms |
| `/m/m00` | 270 ms |
| `/map` | 218 ms |
| `/leaderboards` | 227 ms |

Roughly a fortieth of the budget, with the 3.5 MB bundle unsplit. Code splitting is therefore
not an NFR-8 matter, whatever Vite's warning says.

**Lab interaction — budget 100 ms.** Input to next painted frame: the event is dispatched inside
the page and two animation frames are awaited, the first callback running before the current
frame is painted and the second after it.

| Lab | Interaction | To paint | Idle two frames | Work |
|---|---|---|---|---|
| L1 | add a triplet | 34.1 ms | 34.2 ms | 0.0 ms |
| L2 | move K to 73 | 34.1 ms | 32.6 ms | 1.5 ms |
| L3 | move λ to 1 | 33.2 ms | 33.8 ms | 0.0 ms |
| L7 | type a caption | 33.5 ms | 32.2 ms | 1.3 ms |
| L8 | delete a triplet | 35.1 ms | 33.0 ms | 2.1 ms |

These are one run. The interaction figures move by a few milliseconds between runs and the work
column with them — a later run put L1 at 6.7 ms — because the page is competing with whatever
else the machine is doing. The budget is 100 ms and the variance is single-digit, so the margin
is not in question; the table records a run rather than a constant.

**The first draft of this table reported the instrument.** Every lab came back at 33 ms, which is
two frames at 60 Hz and is what this measurement cannot go below whatever the application does.
The idle column is the same two-frame wait measured on the same page in the same frame, so the
last column is the application's own cost: under a millisecond in three labs and 2.1 ms in the
worst. Without that calibration the table would have said 33 ms five times and meant nothing.

L4, L5 and L6 are not in it, for stated reasons. L4's and L5's buttons start a request — a model
inference, a VLM turn — which is not a local interaction, and timing a fetch under a rendering
budget would be filing the wrong measurement. L6 has no control at all.

**The estimate before the inference.** NFR-8's third clause. Every column in L4 renders
`latency-<model>` before its Run button, and on this machine all five say 本機尚未量測延遲 —
the unmeasured sentence, which is the correct answer here and is not a blank line. The assertion
is that the line is non-empty and present while the button is still unpressed.

**One more test in this file, and it is not a timing claim.** `selecting an object` clicks the
centre of a bounding box with `page.mouse` and asserts a role was assigned — the real-browser half
of D75, which jsdom cannot cover because it has no hit testing at all. It lives here because this
is the only e2e file that runs with a backend, and L1 needs one. Detaching the svg click handler
in view mode fails it and nothing else.

**Mutations.** Both budgets were set to 1 ms and all eleven budget-dependent assertions went red.
The unmeasured-latency sentence was replaced with an empty string and the estimate test went red
naming `latency-reltr`. Four more assertions failed for real during development before they
passed: the change guard caught an L3 readout that does not move with its slider (`gap` is
evaluated at λ = 0 by design) and an L1 button that was disabled, the "at least three measured"
guard caught a run with one, and the L4 count caught columns that had not arrived.

**What it does not measure.** The lecture theatre's machine. These are this box's numbers, and
D-02 makes the weaker ARM64 machine the ship target. Running `npm run check:perf` there is the
remaining half, and it is the author's to run.

## 11. Dependency pins against the interpreter — passed, 2026-09-19

Also not one of the nine, and the same shape of finding. D-04 states that versions are pinned at
measured values. Nothing compared the file to the interpreter, and six of the ten pins in
`backend/requirements.txt` disagreed with the environment that had just produced a green CI:
`fastapi` 0.136.1 against 0.135.1, `uvicorn` 0.46.0 against 0.41.0, `pydantic` 2.13.3 against
2.12.5, `python-multipart` 0.0.20 against 0.0.22, `pillow` 12.2.0 against 12.0.0, `pytest` 9.0.3
against 9.0.2. `requirements-infer.txt` had drifted further: `transformers` 4.57.0 against 5.4.0
and `huggingface_hub` 0.36.0 against 1.8.0.

`pytest-cov` was pinned at 6.0.0, was not installed, and no command anywhere passes `--cov`.

`backend/tests/test_pins.py` now compares both files to the running interpreter, and
`backend/scripts/check_pins.py` prints the comparison. `requirements.txt` must match exactly;
`requirements-infer.txt` tolerates absence, because NFR-1 requires the base install to be
torch-free and an uninstalled extra there is the expected state rather than a fault. A PEP 440
local segment is ignored **where the pin does not state one**, so `torch==2.10.0` is satisfied by
the `+cpu` wheel; a pin that does state one is a claim about the build and is compared exactly
(§13).

All nine required pins now agree. Four of the five optional ones agreed and `timm` was not
installed here, which the file said in a comment rather than implying otherwise by its silence.
**Since 2026-09-19 all five agree**: the extras were installed into py12 when the interpreter
moved (§12), `timm` among them.
Watched to fail: `pytest` moved to 9.0.3 in the file, and the test reported
`pytest pinned 9.0.3, found 9.0.2`.

## 12. The interpreter every check runs on — recorded, 2026-09-19

§10 and §11 measured numbers without stating which interpreter produced them, and until this
date that question had two answers: `start.ps1` pinned the machine-wide `C:\Python\Python312`,
while the `npm` scripts and the parity harness used the bare name `python` and took whatever
PATH resolved first. The author's environment is neither of those by intent — it is the global
virtual environment `py12` (`C:\Python\pyVenv\py12`, Python 3.12.3). See DEVIATIONS D80.

Every Python step now resolves that environment through one of two files applying one order —
`system/tools/py.mjs` (npm scripts, `tools/*.mjs`) and `system/tools/Resolve-Python.ps1`
(`start.ps1`, `fetch-data.ps1`). **Check 6 is the exception and stays on its own `--python`**:
it requires a torch-free interpreter and `py12` has torch.

**What moving the gate onto `py12` exposed.** `py12` did not have `pyarrow` or `ruff`, both
pinned in `requirements.txt`, and its torch was 2.9.1 / torchvision 0.24.1 against pins of
2.10.0 / 0.25.0. The pins were kept and the environment brought up to them, so §11's table
still holds — now against the interpreter the work actually runs on. `python-pptx 1.0.2` was
installed as well, for the repository's other tracks.

**Re-run after the change:** `npm run ci` exits 0 — 263 pytest passed and 7 skipped, 510 vitest
across 44 files, parity 13/13, i18n 198 keys, content lint clean, frontend build 741 modules.
`start.ps1` was run end to end on spare ports: it resolved `py12`, exported `SGS_PYTHON`, and
`/api/health` answered with `torch_version 2.10.0+cpu` while the dev server returned HTTP 200.

`tools/test/py.test.mjs` asserts the resolution order, and was watched to fail: disabling the
`SGS_PYTHON` branch failed 1 of 8, and dropping `PY12_HOME` from the candidate list failed 3.

## 13. The CUDA build of torch — measured, 2026-09-19

The author's box has an RTX 3090, and until this date the project's interpreter did not use it:
`pip install -r requirements-infer.txt` had no index line, PyPI serves the CPU wheel on Windows,
and so py12 held `torch 2.10.0+cpu` with `torch.cuda.is_available()` returning `False` on a
machine with 24 GB of NVIDIA memory sitting idle. Nothing was wrong with the hardware and
nothing in the file said which build had been measured.

**Measured after the change**, on py12:

| | |
|---|---|
| `torch` | `2.10.0+cu128` |
| `torchvision` | `0.25.0+cu128` |
| `torch.version.cuda` | `12.8` |
| `torch.cuda.is_available()` | `True`, 1 device |
| device | NVIDIA GeForce RTX 3090, compute capability 8.6 |
| cuDNN | 9.10.2 |
| driver | 595.79 |

A 2048 × 2048 matmul was run on the device and returned a tensor on `cuda:0`, so this is an
exercised device and not a reported capability. cu126, cu128 and cu130 all publish a 2.10.0
wheel for cp312 on Windows; cu128 was chosen for an Ampere card.

**The pin file had to change twice over to make this checkable.** `requirements-infer.txt` now
carries `--extra-index-url https://download.pytorch.org/whl/cu128`, because PyPI does not hold
that build and a file that cannot install itself will be installed wrongly. `parse_pins` used to
refuse any line without `==`, so it now skips pip options. And `compare` used to ignore the local
segment on both sides, which would have made `+cu128` decoration: the file could name a GPU build
while a CPU wheel was installed and the check would pass. The rule is now asymmetric and stated
in `agrees()` — a pin with no local segment accepts any build, a pin that states one is compared
exactly.

`npm run check:pins`: 9 of 9 required and 5 of 5 optional pins agree. Watched to fail: the pin
moved to `+cu126` against the installed `+cu128` produced one failure naming both.

**NFR-1 is untouched.** `requirements.txt` still lists no torch, check 6 still requires an
interpreter without it, and no P0 feature reaches any of this. The GPU build is an opt-in extra
on one machine, and the TEACH box (ARM64, no CUDA) is unaffected.

## 14. The gate on the machine it is not run on — fixed, 2026-09-19

Every number in §§10–13 was measured on the author's Windows box, where `npm run ci` exits 0.
`main`'s GitHub Actions run had been red for **five consecutive pushes** — 2026-09-18 13:33 and
15:36, 2026-09-19 01:28, 02:41 and 02:59 — and the last two of those are the commits that
recorded §12 and §13 as passed.

The first three are D81, whose fix landed in the same commit that introduced the cause of the
next two, so the gate was never green on the runner at any point. On the runner, all seven tests
in `tools/test/py.test.mjs` failed: they spell the Windows interpreter layout into their
assertions (`…\Scripts\python.exe`, drive letters, `USERPROFILE`) while `py.mjs` read the
platform from the host. See DEVIATIONS D83.

**The rule this project keeps relearning applies to the gate itself.** A check that runs in one
environment states nothing about the other, and "green on my machine" was being read as green.

| | before | after |
|---|---|---|
| `tools/test/py.test.mjs` | 7 tests, Windows layout only, passing on one platform of two | 20 tests, **both** layouts asserted from either host |
| `py.mjs` | `process.platform` read at module scope; `join`/`basename` follow the host | `platform` is an argument; `win32` and `posix` chosen explicitly |
| POSIX candidate list | three drive-letter paths joined POSIX-style, matching nothing | empty, so the fallback is reached and the workflow's `SGS_PYTHON` is what names the interpreter |

**Watched to fail.** The new file run against the previous `py.mjs`, on Windows: 9 failed, 11
passed — every POSIX assertion, which is the coverage that did not exist before.

**A second finding, from running the suite the way the author's own machine is configured.**
`SGS_CORPUS_ROOT` is set to `C:\DataRaw` on this box (INDEX §5), and with it set
`test_data_dir_follows_its_environment_variable` fails: it asserts that `SGS_DATA_DIR` moves the
corpus root underneath it, which holds only when no corpus root is named. The four adapter tests
that exercise the real corpora are skipped without that variable, so the configuration in which
the adapters are actually tested is the configuration in which the suite was red. The test now
clears the variable, and a second test states the other half of the rule — an explicit
`SGS_CORPUS_ROOT` wins — which is the behaviour `tools/offline_check.mjs` relies on when it sets
both. See DEVIATIONS D84.

**Re-run, 2026-09-19, on `py12`:** `npm run ci` exits 0 — **266 pytest passed, 7 skipped**, and
**271 passed, 2 skipped** with `SGS_CORPUS_ROOT=C:\DataRaw`, which had been 1 failed before this
change; **527 vitest across 45 files**; parity 13/13; i18n 198 keys; content lint clean; `ruff`
clean; frontend build 741 modules. `npm run test:e2e` 26 passed [**corrected 2026-09-20: 27.**
Counted from the spec files at that commit: 9 lecture tests plus 6 projector tests over 3 panel
sizes. Left in place rather than overwritten, because this section's subject is documents
disagreeing about a count], `npm run check:perf` 13 passed,
`npm run check:offline -- --python .offline-venv/Scripts/python` 8 passed, `npm run check:pins`
9 of 9 and 5 of 5.

**Three documents carried three different counts, and none matched the run.** `docs/INDEX.md`
said 263 pytest and 502 vitest, this file's §12 said 263 and 510 in 44 files, `README.md` said
263 and 515. The measurement was 265 and 515 before today's change. §12's figures stay as
written, being the record of that day's run; the two present-tense claims are corrected.

---

## 15. The M0 playgrounds — measured, 2026-09-20

The three playgrounds that complete M0 (`plans/2026-09-19-playgrounds-m0.md`, tasks 1–13; D88).
Every number below is from the run that produced this section, not from an earlier one.

### The gate

`npm run ci`, exit 0:

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **625 passed in 55 files** (527 in 45 before this cycle) |
| ruff over `backend` and `tools` | clean |
| parity | 13 cases agree |
| i18n parity | **229 keys**, both locales complete |
| content lint | 13 golden cases, 9 playground cases, 7 licence rows, 15 of 15 modules × 2 locales, 93 points assigned, 43 symbols, clean |
| frozen-page lints | clean |
| standalone | up to date, 250 equations |
| frontend build | 756 modules |
| `npm run test:e2e` | 39 passed |
| `npm run check:perf` | 17 passed |

`npm run test:e2e`, exit 0: **39 passed**, where **27** passed at `ce31d8f`. The delta is twelve:
six new lecture tests and two new projector tests at each of the three panel sizes. §14 recorded
the earlier figure as 26; counted from the spec files at that commit it was 9 lecture tests plus
6 projector tests across 3 sizes, so 27, and neither file was touched between the subtree import
and this cycle. The 26 was wrong on the day it was written.

### The contrast check was blind, and what it was blind to was failing

The first version of this section reported that the playgrounds pass NFR-5 at 7:1 on all three
panels. That was false, and the review that found it is the reason this subsection exists.

`projector.spec.ts` resolved a computed colour by regex over `rgb()`/`rgba()` and skipped what it
could not parse. Tailwind v4.3.3 emits `oklch()`, so on the F1 step **13 of 20 text rows were
never measured**, including every readout; the mathematics step, styled from `palette.ts` in plain
`rgb()`, measured 195 of 195 and passed honestly. The floor assertion required more than 3 rows
and the 7 survivors cleared it.

Measured against the frame background `rgb(248,250,252)` once the parser was fixed:

| Ink | Ratio before | Ratio after |
|---|---|---|
| readout label and provenance note | **4.55** | 9.90 |
| F8's recorded-in-E status | **5.13** | 9.20 |
| F2's refusal notice | **4.81** | 8.66 |

The instrument now paints each colour to a 1×1 canvas and reads the pixel, reports every element
whose colour it could not resolve, and the test asserts that report is empty **before** judging
anything it did read. It walks steps 2, 1, 3 and 4, so all three playgrounds are covered. A
separate test asserts no playground text falls below the deck's 18 px floor: the playgrounds were
rendering at 14 px because Tailwind's size utilities are rem against the document root rather than
em against the 24 px shell, and they are sized in `em` now.

This is the third time in this project a measurement has been wrong in the instrument rather than
in the product — §14's `undefined` from a function passed as a string, D74's two-frame floor, and
now a parser that silently dropped three quarters of a slide. The common remedy each time was to
make the instrument state what it did **not** measure.

### NFR-8, on the three new components

`npm run check:perf`, exit 0, **17 tests** where 13 ran before. The lab cases measured
`/lab/*` only, so until this run the three newest interactive components in the product — the
ones a professor turns in front of a room — were outside the only instrument that bounds
input-to-paint. A `playground interaction` block now measures one characteristic knob on each,
on its own lecture step, with no backend behind it:

| | Wall | Idle floor | Work | Budget |
|---|---|---|---|---|
| F1, the density slider | 33.0 ms | 34.1 ms | ~~0.0 ms~~ below the floor | 100 ms |
| F2, discarding direction | 32.6 ms | 34.1 ms | ~~0.0 ms~~ below the floor | 100 ms |
| F8, swapping subject and object | 32.6 ms | 33.6 ms | ~~0.0 ms~~ below the floor | 100 ms |

The floor is two animation frames at the display's cadence, subtracted as D74 established; all
three do their work inside the frame that carries the input. Cold start on the five routes was
214–419 ms against a ten-second budget.

**Marked in place, 2026-09-26 (D92).** The `0.0 ms` figures were `Math.max(0, wall - floor)`, and
in every row the wall is below the floor, so each difference was negative and clamped. D91 found
this and changed the harness, but the table and the sentence above were left standing. The data
show only that the work is below the harness's resolution of about 33 ms. They do not show that
the work fits inside the frame that carries the input.

Three details the cases had to get right, each of which would otherwise have measured nothing.
F8's only `Readout` is |E| for the frame, which a swap does not move, so its change guard watches
the sentence and the status instead. The controls carry `data-testid` as well as `id`, because
the harness addresses elements by test id and the accessible name of a knob is the translated
string — a measurement keyed on it would read differently in each locale. And no `lab-pending`
wait is needed: a playground imports its slice at build time, which is the same property
`e2e/lecture.spec.ts` asserts by driving one against a preview server with nothing behind it.

### What was watched failing

Eight lint rules and one browser assertion, listed with their messages in D88. In summary: each
of `content_lint.mjs`'s eight playground rules was broken deliberately and its own message read
out of the output, with the lint verified clean before the first break and after the last; and
the keyboard assertion was re-run with `Slider` rebuilt as a focusable `div` that still moved its
value, where it failed because `ArrowLeft` reached the lecture shell and took the step away.

### What this section does not claim

The playgrounds are measured on this machine, which is the development machine of D-02's pair and
not the ship target. Nothing here re-measures the ARM64 side. The contrast figures are the
browser's computed values at three panel sizes, which is what `projector.spec.ts` asserts and is
not a statement about a real projector in a lit room — §8 already records that boundary.

## 16. The lint suite by mutation — measured, 2026-09-26

`tools/test/content_lint.test.mjs` exists so that deleting a playground rule from
`content_lint.mjs` turns the gate red (D91). This section measures whether it does (D92).

**Method.** Each mutant below was applied alone to `content_lint.mjs`, the suite was run with
`npx vitest run tools/test/content_lint.test.mjs`, and the file was restored before the next
mutant. A mutant is either a rule's `problems.push(` replaced by a no-op call, or a condition
narrowed. The same seventeen mutants were run against the suite at `66281fb` (11 tests) and against
the suite this section records (18 tests). The harness is not committed: it addresses the rules by
line number, which holds for one revision only. The method is what repeats.

| Mutant | Rule (design §2.4) | Before, 11 tests | After, 18 tests |
|---|---|---|---|
| step names no kp | 1 | caught | caught |
| kp not in `kp.json` | 2 | caught | caught |
| neither owned nor cited | 3 | **missed** | caught |
| rule 3 checks ownership only | 3 | **missed** | caught |
| no registered component | 4 | caught | caught |
| body disagrees with frontmatter | 5 | caught | caught |
| undeclared `<Playground>` tag | 6 | caught | caught |
| locales disagree on the playground | 7 | **missed** | caught |
| rule 7 compares kind only | 7 | **missed** | caught |
| duplicate within one module | 8 | **missed** | caught |
| duplicate across modules | 8 | **missed** | caught |
| golden case with no `id` | 9 | **missed** | caught |
| duplicate golden case `id` | 9 | caught | caught |
| golden case missing a field | 9 | caught | caught |
| golden case with empty `expect` | 9 | **missed** | caught |
| `why` too short | 10 | caught | caught |
| golden case for an unregistered kp | 11 | caught | caught |

Eight of seventeen missed before, none after. Every "after" mutant failed exactly one test, except
rule 5, which fails two: the body carrying a different kp, and the tag sitting outside its step.

**The gate after the change.** `npm run ci`, exit 0: 266 pytest and 7 skipped, **632 vitest in 55
files** (625 before), parity 13 cases agree, i18n 229 keys both locales, content lint clean over 13
golden cases and 9 playground cases, ruff clean, standalone up to date at 250 equations, frontend
build 756 modules. `npm run test:e2e` and `npm run check:perf` were not re-run, because nothing
under `frontend/` or `e2e/` changed; §15's 39 and 17 stand.

**What this section does not claim.** A caught mutant shows that deleting or narrowing that one
rule fails a test. It does not show that the rules are the right rules. Only the playground
section was mutated; the lint's older sections (the engine's golden vectors, the licence gates,
the four-part contract, the presenter notes) were not, and nothing here says whether any test
notices their deletion.

## 17. The M1 playgrounds — measured, 2026-09-26

The three playgrounds M1 owns (`plans/2026-09-26-playgrounds-m1.md`, tasks 1–10; D93). Every
number below is from the runs that produced this section.

### The gate

`npm run ci`, exit 0:

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **699 passed in 59 files** (632 in 55 before this cycle) |
| ruff over `backend` and `tools` | clean |
| parity | 13 cases agree |
| i18n parity | **275 keys**, both locales complete (229 before) |
| content lint | 13 golden cases, **22 playground cases**, **25 release figures**, 7 licence rows, 15 of 15 modules × 2 locales, 93 points assigned, 43 symbols, clean |
| frozen-page lints | clean |
| standalone | up to date, 250 equations |
| frontend build | 763 modules |
| `npm run test:e2e` | **48 passed** |
| `npm run check:perf` | **20 passed** |

`npm run test:e2e`: 48 where 39 passed before. Three are new lecture tests: M1's playgrounds
computing with no backend, M1's knobs working from the keyboard without advancing the deck, and
M1's knobs writing the address bar. Six are two new projector tests at three panel sizes, added
after the final review: no word of any playground clipped out of reach, and every chart mark at
3:1. The three existing projector tests that concern playgrounds now walk M1's steps as well.

### Contrast and type at three panels

The contrast walk reads **27, 34 and 52 rows** on F6, F7 and X1 at XGA, WXGA and 1920×1080 alike,
with `skipped` empty and no row below 7:1. The floors are set at 20, 25 and 39, three quarters of
those counts. The 18 px type floor holds on all nine M1 steps at all three sizes, and every
playground step's controls sit inside the panel.

**The walk could not see clipping, and clipping was hiding the citations.** `painted()` asks
whether a word is rendered; a word under an `overflow: hidden` ancestor is rendered and invisible.
The final review measured X1's sources, its explanations and its disjointness lines, and F7's
legend, below the frame's clip at every panel size, and the same measurement on M0 found F1's
candidate count and ratio there too. `clipped()` now reports every word outside a picture that an
ancestor has cut off; it failed on F1, F7 and X1 before the fix and passes on all six playground
steps after it. `graphics()` measures chart marks at 3:1: F7's measured bars read **2.51:1** in
`slate-400` and pass in `slate-600`.

### Overflow at three panels

| M1 step | 0 | 1 | 2 (F6) | 3 | 4 (F7) | 5 | 6 (X1) | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| px past 1024×768 | 0 | 192 | 214 | 410 | 306 | 0 | 514 | 0 | 0 |
| px past 1280×800 | 0 | 220 | 148 | 334 | 183 | 0 | 326 | 0 | 0 |
| px past 1920×1080 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |

Measured as the step container's scroll height less its client height, after the webfonts decode
(D70), after the final review's fix: F7 and X1 grew by the words that had been hidden inside the
frame, which the step's scroll now reaches. The long steps are recorded here for the author's
decision, as D71's list was; none is split in this cycle.

### NFR-8, on the three new components

`npm run check:perf`, exit 0, 20 tests where 17 ran before. Printed as measured:

| | Wall | Work |
|---|---|---|
| F6, merging the four predicates | 33.2 ms | below the 33.5 ms two-frame floor |
| F7, moving s | 33.3 ms | below the 34.4 ms two-frame floor |
| X1, choosing another release | 32.4 ms | below the 34.1 ms two-frame floor |

The work figures are at the instrument's resolution, which is about one frame; they show only
that each interaction finishes inside the two frames the harness waits, not how much of a frame
it used (D91). Cold start on the five routes was 207–330 ms against a ten-second budget. The figures are from the
run after the final review's fix.

### The lint rules by mutation

23 mutants, one per clause of the twelve playground rules, each applied alone to
`content_lint.mjs`, with `tools/test/content_lint.test.mjs` run after it:

| Rules | Mutants | Caught |
|---|---|---|
| 1–8, the step and its body | 9 (rule 8 has a per-module and a corpus-wide clause) | 9 |
| 9–11, the golden file | 8 (rule 9: id, duplicate, missing field, unknown scope, frame-or-scope, empty `expect`) | 8 |
| 12, the release figures | 6 (uncited, digits, measured, note value, labels, no releases) | 6 |

The harness addresses each rule by a fragment of its message and, where a fragment occurs twice,
by its occurrence, so it survives edits that move line numbers. It is not committed; the method is
what repeats.

### What this section does not claim

The measurements are from this machine, the development machine of D-02's pair, not the ARM64
ship target. The contrast figures are the browser's computed values at three panel sizes, not a
statement about a projector in a lit room. X1's figures are as the sources state them on
2026-09-26; the card's revision is recorded in `data/content/vg150_splits.json` so a later change
to it can be detected.

## 18. The M1 minors — measured, 2026-09-26

D93's deferred findings, resolved (D94). Every number below is from the run that produced it.

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **716 passed in 59 files** (699 before) |
| parity | 13 cases agree |
| i18n parity | **276 keys**, both locales complete |
| content lint | 13 golden cases, 22 playground cases, 25 release figures, clean |
| standalone | up to date, 250 equations |
| frontend build | 763 modules |
| `npm run test:e2e` | 48 passed |
| `npm run check:perf` | 20 passed |

### M1's overflow after the trim

| M1 step | 0 | 1 | 2 (F6) | 3 | 4 (F7) | 5 | 6 (X1) | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| px past 1024×768 | 0 | 192 | 56 | 410 | 188 | 0 | 475 | 0 | 0 |
| px past 1280×800 | 0 | 220 | 29 | 334 | 105 | 0 | 326 | 0 | 0 |
| px past 1920×1080 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |

Measured as §17's table was. Before the trim the three playground steps read 214, 306 and 514 at
XGA. **Reviewed and accepted by the author, 2026-09-26**, as D71's list was on 2026-09-18: the
options were to split the steps or leave them, and the answer was to leave them. The item is
closed on that judgement, not on a code change.

### Rule 12 by mutation

| Clause | Caught |
|---|---|
| figure without source, url, locator or quote | yes |
| count not a whole number of its quote | yes |
| quote of several numbers without `index` | yes |
| `index` naming another number | yes |
| coded value outside its set | yes |
| `measured` rows disagreeing | yes |
| release leaving a figure out | yes |
| note without a numeric value | yes |
| release without both labels | yes |
| file with no releases | yes |

10 of 10, by the fragment-addressed method of §17.

### NFR-8

| | Wall | Work |
|---|---|---|
| F6 | 33.2 ms | 0.1 ms above the 33.1 ms two-frame floor |
| F7 | 33.7 ms | 0.2 ms above the 33.5 ms two-frame floor |
| X1 | 33.5 ms | 0.6 ms above the 32.9 ms two-frame floor |

Within the instrument's resolution of about one frame, as §17 says.


## 19. The review of the day's merges — measured, 2026-09-26

D95. Every number below is from the run that produced it, on branch `fix/sgs-m1-review`.

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **724 passed in 59 files** (716 before) |
| parity | 13 cases agree |
| i18n parity | 276 keys, both locales complete |
| content lint | 13 golden cases, 22 playground cases, 25 release figures, clean |
| standalone | up to date, 250 equations |
| frontend build | 763 modules |
| `npm run test:e2e` | 48 passed |
| `npm run check:perf` | 20 passed |

### F6 under its clip

`clipped()` over `m01/2?F6.mp=1&F6.mo=1`, before the fix: failed at 1024×768 and 1280×800,
passed at 1920×1080. After `clip={false}`: 3 of 3.

### Overflow, every state

Measured as §17's table was, the step container's scroll height less its client height after the
webfonts decode, over the production build, with the locale seeded in `localStorage` as the
projector suite seeds it. Pixels past the panel, zh-TW / en.

| Step | State | 1024×768 | 1280×800 | 1920×1080 |
|---|---|---|---|---|
| s3, F6 | default | 56 / 336 | 29 / 31 | 0 / 0 |
| s3, F6 | predicates merged | 195 / 336 | 168 / 170 | 0 / 0 |
| s3, F6 | object names merged | 195 / 336 | 29 / 170 | 0 / 0 |
| s3, F6 | both merged | 334 / 475 | 168 / 170 | 0 / 0 |
| s5, F7 | default | 188 / 271 | 105 / 156 | 0 / 0 |
| s5, F7 | overlay on, k = 3 | 188 / 410 | 105 / 156 | 0 / 0 |
| s5, F7 | overlay on, k = 1 | 188 / 410 | 105 / 156 | 0 / 0 |
| s7, X1 | default, `sgb-v2` against `canonical` | 475 / 714 | 326 / 443 | 0 / 0 |
| s2, F1 | default | 387 / 470 | 355 / 355 | 0 / 0 |
| s4, F2 | default | 24 / 107 | 0 / 0 | 0 / 0 |
| s5, F8 | default | 27 / 161 | 0 / 0 | 0 / 0 |

X1's longest of its 16 ordered pairs, per cell:

| Panel | zh-TW | en |
|---|---|---|
| 1024×768 | 619, `xu-2017` against `sgb-v1` | 880, `sgb-v1` against `sgb-v2` |
| 1280×800 | 531, `sgb-v1` against `sgb-v2` | 587, `xu-2017` against `canonical` |
| 1920×1080 | 39, `canonical` against `sgb-v1` | 78, `canonical` against `sgb-v1` |

The default zh-TW column reproduces §18's 56, 188 and 475 exactly. §18's acceptance covers those
states; the others are recorded for the author (D95).

### Rule 12 by mutation, the new clauses

| Clause | Caught |
|---|---|
| share not in its quote as written | yes |
| file missing | yes |
| unknown schema version | yes |
| note without its split | yes |

4 of 4: each clause replaced by `false` or removed, the suite run, the file restored. The middle
two existed before and had no failing test.

### NFR-8

| | Wall | Work |
|---|---|---|
| F6 | 32.9 ms | 0.3 ms above the 32.6 ms two-frame floor |
| F7 | 33.1 ms | 0.4 ms above the 32.7 ms two-frame floor |
| X1 | 33.1 ms | below the 33.5 ms two-frame floor |

### The runner

Commit statuses read through the Gitea API on 2026-09-26. The logs need a signed-in session.

| Run | Workflow | Commit | Status |
|---|---|---|---|
| 1 | CI | `a93eebb`, 2026-09-21 | failure |
| 2 | scene-graph-studio | `a93eebb`, 2026-09-21 | failure |
| 3 | CI | `66281fb`, 2026-09-23 | failure |
| 4, 5 | CI, scene-graph-studio | `b57a02e`, 2026-09-26 | waiting to run |
| 6, 7 | CI, scene-graph-studio | `677c801`, 2026-09-26 | waiting to run |

§14 made the gate pass on a POSIX runner; this track's workflow has not yet passed on this one.

## 20. The split playgrounds and distinct triplets — measured, 2026-09-26

D96. Every number below is from the run that produced it, on branch `feat/sgs-split-distinct`.

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **751 passed in 60 files** (724 before) |
| parity | 13 cases agree |
| i18n parity | **277 keys**, both locales complete |
| content lint | 13 golden cases, 22 playground cases, 25 release figures, clean; 103 steps a locale |
| standalone | up to date, 250 equations |
| frontend build | 763 modules |
| `npm run test:e2e` | **52 passed** (48 before) |
| `npm run check:perf` | 20 passed |

After the branch review's fixes (D96), the same gates: `npm run ci` exit 0 with **755 vitest in 60
files** and **278 i18n keys**, 266 pytest and 7 skipped, content lint clean; `npm run test:e2e`
**55 passed**, the three new being F1's photograph at each panel size; `npm run check:perf` 20
passed. The lint suite holds 45 tests.

### Every part, every state

Measured as §17's table was, over the production build. Pixels past the panel, the largest over
the states listed, 繁體中文 / English.

| Step | States measured | 1024×768 | 1280×800 | 1920×1080 |
|---|---|---|---|---|
| M0 s2, F1 part 1 | default; every layer off; frame ph-003 | 0 / 73 | 0 / 0 | 0 / 0 |
| M0 s3, F1 part 2 | default; \|P\| 50 | 0 / 0 | 0 / 0 | 0 / 0 |
| M0 s5, F2 | default | 24 / 107 | 0 / 0 | 0 / 0 |
| M0 s6, F8 | default | 27 / 161 | 0 / 0 | 0 / 0 |
| M1 s3, F6 part 1 | each merge, both, neither | 0 / 28 | 0 / 0 | 0 / 0 |
| M1 s4, F6 part 2 | default; merged; frame 2008 merged | 0 / 0 | 0 / 0 | 0 / 0 |
| M1 s6, F7 part 1 | default; 50 classes, k 50 | 0 / 81 | 0 / 5 | 0 / 0 |
| M1 s7, F7 part 2 | default; 50 classes, k 50 | 0 / 74 | 0 / 0 | 0 / 0 |
| M1 s9, X1 part 1 | all 16 ordered release pairs | 0 / 163 | 0 / 0 | 0 / 0 |
| M1 s10, X1 part 2 | all 16 ordered release pairs | 0 / 69 | 0 / 0 | 0 / 0 |
| M1 s11, X1 part 3 | all 16 ordered release pairs | 0 / 46 | 0 / 0 | 0 / 0 |

F1's first part is measured with its photograph, 389×292 at 1024×768, 405×304 at 1280×800 and
547×410 at 1920×1080. Before the branch review it rendered 0×0 at all three, and the part measured
0 / 0 because the picture was missing (D96).

English's largest figures at 1024×768 are F6 with the predicate merge, F7 at its default, X1 part 1
with Xu against v1, part 2 with v1 against v2, and part 3 with Xu against the canonical protocol.
The lecture header wraps to two lines in English at that width, which is why its step is 517 px.
§19's figures, which this table replaces for the playground steps, stay as they were measured.

### The part rules by mutation

| Clause | Caught |
|---|---|
| rule 4: a part named for a playground not split | yes |
| rule 4: a part beyond those registered | yes |
| rule 4: a split playground's step naming no part | yes |
| rule 5: the tag's part equal to the step's | yes |
| rule 5: one tag a part in a module | yes |
| rule 7: the part the same in both locales | yes |
| rule 8: parts consecutive, in order, in one module | yes |
| rule 6: a tag's point and part both declared by a step, after the branch review | yes |

8 of 8, by the method of §19.

### NFR-8

`npm run check:perf`, exit 0, 20 tests. The six playground cases, each on the part that carries
its knob: F1 33.0 ms, F2 32.0, F8 33.0, F6 31.8, F7 32.2, X1 32.8, every one within a frame of its
two-frame floor.

## 21. The M2 playground — measured, 2026-09-27

D97. Every number below is from the run that produced it, on branch `feat/playgrounds-m2`.

| Step | Result |
|---|---|
| pytest | 266 passed, 7 skipped |
| vitest | **791 passed in 61 files** (755 before) |
| parity | 13 cases agree |
| i18n parity | **292 keys**, both locales complete (278 before) |
| content lint | 13 golden cases, **30 playground cases**, 25 release figures, clean; 105 steps a locale |
| standalone | up to date, 250 equations |
| frontend build | 766 modules |
| `npm run test:e2e` | **62 passed** (55 before) |
| `npm run check:perf` | **21 passed** (20 before) |

### The corrections

The frozen page, opened in headless Chromium after the change with F3's scale set to 1.42, reads
"scale ceiling 0.496", which is 1 / 1.42² to three places; it read 0.704 before. `npm run harvest`
leaves `data/content/kp.json` unchanged, and `lint:frozen` reports no problems.

### The arithmetic

Eight golden cases, all on `ph-001` object 3 (90 × 70 at (250, 240)):

| Case | Δx, Δy, λ, τ | \|b ∩ b′\| | \|b ∪ b′\| | IoU | bound | member | unreachable |
|---|---|---|---|---|---|---|---|
| identical | 0, 0, 1, 0.5 | 6,300 | 6,300 | 1 | 1 | yes | no |
| λ 1.4 | 0, 0, 1.4, 0.5 | 6,300 | 12,348 | 0.510 | 0.510 | yes | no |
| λ 1.5 | 0, 0, 1.5, 0.5 | 6,300 | 14,175 | 0.444 | 0.444 | no | yes |
| shifted | 18, 0, 1, 0.5 | 5,040 | 7,560 | 0.667 | 1 | yes | no |
| at τ | 30, 0, 1, 0.5 | 4,200 | 8,400 | 0.5 | 1 | yes | no |
| touching | 90, 0, 1, 0.5 | 0 | 12,600 | 0 | 1 | no | no |
| inside | 0, 0, 0.5, 0.5 | 1,575 | 6,300 | 0.25 | 0.25 | no | yes |
| bound at τ | 0, 0, 2, 0.25 | 6,300 | 25,200 | 0.25 | 0.25 | yes | no |

F3's quotient equals `sgg-metrics`' `boxIou` on all eight to twelve places. Over λ ∈ {0.5, 0.73, 1,
1.4, 1.45, 1.5, 2}, Δx ∈ {−120, −30, 0, 30, 120} and Δy ∈ {−100, 0, 100}, IoU never exceeds the
bound, and at λ = 2 the prediction stays inside the 640 × 480 photograph at all four corners of Δx
and Δy.

### Fit

Pixels past the panel over the production build, the largest over each part's states, 繁體中文 /
English. Part 1 was measured at its default, at λ 2 shifted (120, 100), at λ 0.5 shifted
(−120, −100), and touching; part 2 at its default, at λ 2 with τ 0.95, at λ 1.5, and at Δx 30 with
τ 0.55.

| Step | 1024×768 | 1280×800 | 1920×1080 |
|---|---|---|---|
| F3 as one step, before the split | 171 / — | 105 / — | 0 / — |
| M2 s3, F3 part 1 | 0 / 9 | 0 / 0 | 0 / 0 |
| M2 s4, F3 part 2 | 0 / 0 | 0 / 0 | 0 / 0 |

English was not measured before the split; the one-step figures are the projector suite's, in its
longest state, λ 2 with τ 0.95 shifted (120, 100).

The contrast walk reads 26 rows on part 1 and 16 on part 2, at every panel size, with none skipped
and none below 7:1; the floors are 19 and 12. The overlay's box equals the photograph's to within
1 px at all three sizes; before the fix it was 454 px tall against a 261 px photograph at
1024 × 768.

### NFR-8

`npm run check:perf`, exit 0, 21 tests. F3, moving λ to 1.5 on part 1: 33.4 ms, within its
33.6 ms two-frame floor. The other six: F1 33.1, F2 33.6, F8 33.5, F6 33.5, F7 32.2, X1 33.7.

### After the branch review

Three findings fixed, each with a test that failed first (D97): white under-strokes beneath both
outlines; the IoU and the bound cut to three places rather than rounded, with a walk over 16 λ,
25 Δx, 101 Δy and 19 τ that finds no printed value disagreeing with the membership, and which
fails when the cut is changed back to rounding; M2 s2's implication made strict at λ > √2, in
both locales and in the frozen derivation. The gates were run again after the fixes, and every
figure in the table above and in this section is from that run: `npm run ci` exit 0 with 791
vitest, `npm run test:e2e` 62 passed, `npm run check:perf` 21 passed.

## 22. The M3 playgrounds — measured, 2026-09-27

D98. Every number below is from the run that produced it, on branch `feat/playgrounds-m3`.

| Step | Result |
|---|---|
| harvest | 26 formulas, 23 derivations, unchanged in number after E1's and E10's were corrected |
| pytest | 266 passed, 7 skipped |
| vitest | **845 passed in 64 files** (791 before) |
| parity | 13 cases agree |
| i18n parity | **322 keys**, both locales complete (292 before) |
| content lint | 13 golden cases, **42 playground cases**, 25 release figures, 44 symbols, clean; 109 steps a locale |
| standalone | up to date, 254 equations |
| frontend build | 771 modules |
| `npm run test:e2e` | **66 passed** (62 before) |
| `npm run check:perf` | **23 passed** (21 before) |

### The corrections

A test reads both M3 locale files and the harvested `math.json` and `deriv.json`: each carries the
inclusion ℋ_PredCls ⊆ ℋ_SGCls ⊆ ℋ_SGDet and the verdict table, and none carries "for every model",
|V|² or "four diff colours". It failed before the change and passes after. The same test renders
every M3 math step in both locales and finds no KaTeX error.

### The engine

E1's verdict equals `classify` on all 32 settings of its toggles; the test fails when E1's rule is
made to answer `spurious` throughout. Of the eight name triples the toggles produce, only
(box, on, table) is annotated in `ph-001`.

### The arithmetic

Twelve golden cases on `ph-001`.

| Case | Defects | Subject IoU | Object IoU | t̂ ≃ t | Mode | Verdict |
|---|---|---|---|---|---|---|
| none | | 6,300 / 6,300 | 46,200 / 46,200 | holds | none | match |
| subject class | box → glove | 6,300 / 6,300 | 46,200 / 46,200 | fails | name | spurious |
| predicate | on → near | 6,300 / 6,300 | 46,200 / 46,200 | fails | name | spurious |
| subject box | 45 px | 3,150 / 9,450 | 46,200 / 46,200 | fails | place | localization |
| both boxes | 45 px, 55 px | 3,150 / 9,450 | 23,100 / 69,300 | fails | place | localization |
| name and place | on → near, 45 px | 3,150 / 9,450 | 46,200 / 46,200 | fails | both | spurious |

| Protocol | This slice (10, 16) | VG-150 (150, 50) |
|---|---|---|
| PredCls | 480 | 1,500 |
| SGCls | 48,000 | 33,750,000 |
| SGDet | 897,116,066,370,414,059,520,000 | 630,784,734,166,697,385,600,000,000 |

B = C(641, 2) · C(481, 2) = 205,120 × 115,440 = 23,679,052,800.

### Fit

Pixels past the panel over the production build, the largest over each part's states, 繁體中文 /
English. E1's parts were measured with no defect, with every defect, and with a single one; E10's
at PredCls, SGCls and SGDet, and on both vocabularies.

| Step | 1024×768 | 1280×800 | 1920×1080 |
|---|---|---|---|
| E1 as one step, before the split | 229 / — | 2 / — | 0 / — |
| E10 as one step, before the split | 96 / — | — | — |
| M3 s3, E1 part 1 | 0 / 43 | 0 / 0 | 0 / 0 |
| M3 s4, E1 part 2 | 0 / 0 | 0 / 0 | 0 / 0 |
| M3 s6, E10 part 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| M3 s7, E10 part 2 | 0 / 15 | 0 / 0 | 0 / 0 |

The one-step figures are the projector suite's, in the longest state it measures; English was not
measured before the split, and E10 at the larger sizes not at all. The contrast walk reads 25 and 19
rows on E1's parts and 10 and 22 on E10's, at every size, with none skipped and none below 7:1; the
floors are 19, 14, 7 and 16. On E1's and E10's first parts the overlay's box equals the
photograph's to within 1 px at all three sizes.

### NFR-8

`npm run check:perf`, exit 0, 23 tests. E1, one defect toggled on its second part: 33.3 ms, within
its 33.6 ms floor. E10, SGCls chosen on its first part: 32.9 ms, within its 33.6 ms floor.

### After the branch review

The three fixes of D98's review paragraph, each a test that failed first: the verdict table's
condition, the ordering no longer stated as a law in the brief, the SRS or L2's comment, and the
inclusion's definition and condition in s5 and on E10. The gates were run again: `npm run ci` exit
0 with 845 vitest in 64 files, 322 i18n keys and the standalone at 254 equations; `npm run
test:e2e` 66 passed, E10's second part fitting 1024 × 768 again after its spacing was tightened;
`npm run check:perf` 23 passed twice. Timings moved with the machine's load between the two runs:
E1 53.7 ms and then 33.3 ms, E10 32.3 ms and then 37.8 ms, while playgrounds this branch did not
touch reached 64.9 to 78.5 ms (F1, F8, X1) in the second.

## 23. The graph constraint's key — measured, 2026-09-27

D99. Every number below is from the run that produced it, on branch `fix/sgs-graph-constraint-key`.

| Step | Result |
|---|---|
| pytest | **275 passed**, 7 skipped (266 before) |
| vitest | **857 passed in 64 files** (845 before) |
| parity | **16 cases agree** (13 before) |
| i18n parity | 322 keys, both locales complete |
| content lint | **16 golden cases**, 42 playground cases, 25 release figures, clean |
| standalone | up to date, 254 equations |
| frontend build | 771 modules |
| `npm run test:e2e` | 66 passed |
| `npm run check:perf` | 23 passed |

### Watched failing first

Before the re-keying, the new tests failed in both engines: Python at collection, since `Triplet`
had no `subject_id`; TypeScript on five tests, among them `gv-014` at R 0.5 where 1.0 was expected
and the ordering counterexample at 0.5 where 1.0 was expected. After it, all pass.

### gv-014

Two hands, one assembly: (hand#1, holding, assembly#3) and (hand#2, assembling, assembly#3). Keyed
on object pairs both survive the graph constraint and match: R = 2/2 = 1.0, mR = (1/1 + 1/1)/2 = 1.0,
ngR = 1.0. Keyed on class pairs, R would be 1/2 = 0.5. The regenerated `vectors.json` differs from
the committed one by this case alone (165 lines added, none removed).

### The mini-ISG reference set against itself

Under the graph constraint at K = 100, four of forty frames score below 1.0: isg-011 (9 of 10),
isg-013 (8 of 9), isg-025 (8 of 9) and isg-035 (9 of 10), each with one hand holding and assembling
one object. D51 recorded thirteen under the class-pair key. Under `none`, all forty score 1.0.

### After the branch review

`gv-015` and `gv-016` put two predicted objects on one pair of masks under the graph constraint:
R 0.5 with `single_mpo`, which keeps one prediction per mask pair, and 1.0 with `multi_mpo`, since
the graph constraint now keeps one per object pair. With both engines put back on the class-pair
key, `gv-014` and `gv-016` fail in both; restored, all sixteen pass and agree. The records test
added with them failed on the course's "Action Genome's semi constraint" before the text changed.
The gate was run again: `npm run ci` exit 0 with 275 pytest, 857 vitest and parity 16;
`npm run test:e2e` 66 passed.

## 24. The review minors — measured, 2026-09-27

D100. Every number below is from the run that produced it, on branch `fix/sgs-review-minors`; the
table is the gate run after the branch review's fixes.

| Step | Result |
|---|---|
| pytest | **277 passed**, 7 skipped (275 before) |
| vitest | **870 passed in 64 files** (857 before) |
| parity | **17 cases agree** (16 before) |
| i18n parity | 322 keys, both locales complete |
| content lint | **17 golden cases**, 42 playground cases, 25 release figures, clean |
| standalone | up to date, 254 equations |
| frontend build | 771 modules |
| `npm run test:e2e` | 72 passed (66 before) |
| `npm run check:perf` | 23 passed; F3 34.1 ms, E1 33.7 ms, E10 34.0 ms |

### Watched failing first

With `ProtocolSpaces.tsx`, `PhotoMarks.tsx` and both locale files put back as they stood before
commit `19291d4`, five of that commit's tests fail: the badge test of `PhotoMarks`, and E10's opening
mapping, SGCls wording, SGDet's |V| and chosen-row marker. Commit `1829206`'s boxes-note test fails
in the same run, since its test id came with that commit. Measured during commit `19291d4`,
before its layout change, the English fit test failed at 71 px on E10's second part; the marker test failed on U+25B6 before U+25BA replaced it.
Before commit `1829206`'s changes: E10's note and frame id, `withDefects` given a table of its
own, `logic.ts`'s import of `E1/setup`, and the repeated `object_id` in Python (no error raised)
and TypeScript (no error thrown). This record's own test failed on the missing `## D100`.

### English at 1024 × 768

E1's first part fits after its legend moved beside the conjuncts. E10's second part ran 71 px past
the panel; with its inclusion and condition as one sentence and the L2 pointer beside the boxes
note, it fit. Printing B's value then lengthened the note, and the
pointer, pushed to its own line, took it 28 px past; beside the vocabulary line it fits again.

### gv-017

hand#1 → assembly#3 carries holding 0.9, assembling 0.8 and touching 0.7; hand#2 → assembly#3
carries holding 0.6; all four are annotated on the same boxes. `semi` with a cap of 2 keeps three:
R@20 = 3/4 = 0.75, mR@20 = (2/2 + 1/1 + 0/1)/3 = 2/3, ngR@20 = 4/4 = 1.0. The regenerated
`vectors.json` differs from the committed one by this case alone (200 lines added, none removed).

### F3 over its whole grid

F3's pixel-count IoU equals the engine's `boxIou` within 10⁻¹² at all 195,536 settings of Δx
(−120 to 120, step 2), Δy (−100 to 100, step 2) and λ (0.5 to 2, step 0.1).

### After the branch review

The badge test failed at all three sizes before the change: badge #4 covered 59 % to 100 % of the
glove's box, #5 covered 52 % to 73 % of the wrench's, and #5 overlapped #1. At 1024 × 768 the badges
measured 28 × 23 px, the glove's box 24 × 22 px and the wrench's 38 × 13 px. After it the projector
suite passed, 45 tests. The SGCls state of E10's second part fit in both locales when first
measured. The records test failed on README's sixteen cases, and the PhotoMarks unit test on the
missing placement, before their changes. The overlay's offset at Δx = 18 is (454 − 261)/2 = 96.5 px,
from §21's measured column and photograph; it was not measured directly.

## 25. The deferred minors — measured, 2026-09-27

D102. Every number below is from the run that produced it, on branch `fix/sgs-d100-deferred`. In
the table, `npm run ci` and `npm run test:e2e` ran after the branch review's fixes, and
`npm run check:perf` on commit `680dc35`'s code, which no later commit changes outside tests and
records. [**Corrected 2026-09-28 (D104):** the run at the merge, the last subsection below, was
on 2026-09-28, not on the date in the heading: it ran on a tree holding `761b571`, committed at
00:04 that day.]

| Step | Result |
|---|---|
| pytest | **279 passed**, 7 skipped (277 before) |
| vitest | **883 passed in 65 files** (870 in 64 before) |
| parity | 17 cases agree |
| i18n parity | **323 keys**, both locales complete (322 before) |
| content lint | 17 golden cases, 42 playground cases, 25 release figures, clean |
| standalone | up to date, 254 equations |
| frontend build | 771 modules |
| `npm run test:e2e` | **75 passed** (72 before) |
| `npm run check:perf` | 23 passed; F3 33.9 ms, E1 33.9 ms, E10 33.4 ms |

### Watched failing first

Before `_ids_resolve`, the schema test found no dangling-reference message beside the repeated id,
and the API test received `schema_invalid`. Before commit `680dc35`'s changes, nine unit tests
failed and 263 playground tests passed: `idRun`'s three, E10's three on renumbered ids,
each of which received "boxes #1 to #6; no labels" or 「框 #1 至 #6；無標籤」, and the picture-string
tests of F3, E1 and E10. E1's label test, written after them, failed on 繁體中文's
「主詞框位移 45 px」. The column test failed at all three sizes. The records test failed on the
missing heading of its deviation, then numbered D101.

### gv-017 under a mutant

Both engines were changed to omit `gt_boxes_not_pairs` under `semi`, and restored afterwards.
Parity compares the engines with each other, so it passes the mutant on either set of vectors.

| Vectors | pytest golden | vitest engine | parity |
|---|---|---|---|
| committed (`2783ab6`) | 20 passed | 30 passed | 17 cases agree |
| this branch | gv-017 failed, 19 passed | gv-017 failed, 29 passed | 17 cases agree |

### E10's columns

Left edge of each column in px, in the PredCls row, with PredCls, SGCls and SGDet chosen in turn,
on the code before commit `680dc35`. The name column began at 67 px in every state.

| Size | Vocabulary | Formula column | Count column |
|---|---|---|---|
| 1024 × 768 | this slice | 220.9 / 201.0 / 208.2 | 513.7 / 501.7 / 506.0 |
| 1280 × 800 | this slice | 265.1 / 239.5 / 248.8 | 641.9 / 626.5 / 632.1 |
| 1920 × 1080 | this slice | 375.6 / 335.6 / 350.1 | 962.5 / 938.4 / 947.1 |
| 1024 × 768 | VG-150 | 209.5 / 190.8 / 197.5 | 493.7 / 482.1 / 486.3 |
| 1280 × 800 | VG-150 | 250.4 / 226.3 / 235.0 | 616.2 / 601.3 / 606.7 |
| 1920 × 1080 | VG-150 | 352.6 / 315.1 / 328.7 | 922.4 / 899.2 / 907.5 |

With the sign reserved in every row and the rule not, SGCls chosen against PredCls chosen still
moved the formula column 2.0, 2.6 and 4.2 px at the three sizes over this slice. With the rule
reserved and the sign not, 19.9 px at 1024 × 768. With both, every edge agreed to 0.1 px in all
twelve comparisons. A bold copy of each name, reserving the chosen weight's width in every row,
was then removed, and the test still passed at all three sizes.

### After the branch review

With `invisible` dropped from the sign, and with it on every row, E10's unit test failed, 1 of 15,
and the projector column test failed at all three sizes on "slice, predcls chosen: the sign shows
in its own row only"; on the code both pass. With the condition `run` alone, the single-box test
failed, 1 of 16. The records test failed on README's 881 before the counts were brought up to
date. No production code changed after commit `680dc35`.

### At the merge

With `feat/sgs-kp-index` (D101) already on `main`, the merged result: `npm run ci` exit 0, 279
pytest and 7 skipped, **893 vitest in 66 files**, parity 17 cases, i18n **331 keys**, content
lint clean over 17 golden cases, 775 modules built; `npm run test:e2e` 75 passed.

## 26. The open checks — measured, 2026-09-28

D103. Every number below is from the run that produced it. `npm run check:perf` ran on `main` at
`9b678af`, before the branch; the rest on branch `fix/sgs-d102-open`.

| Step | Result |
|---|---|
| pytest | **281 passed**, 7 skipped (279 before) |
| vitest | **901 passed in 67 files** (893 in 66 before) |
| parity | 17 cases agree |
| i18n parity | 331 keys, both locales complete; 13 carry a placeholder, all agreeing |
| content lint | 17 golden cases, 42 playground cases, 25 release figures, clean |
| `npm run check:perf`, `main` | 23 passed; F3 33.8 ms, E1 34.4 ms, E10 31.8 ms |

`npm run test:e2e` was not run: the branch changes no frontend production code.

### The golden vectors' warnings

The warnings each case lists, before and after. The engine raises each on one condition in
`engine.py`; P is `gt_boxes_not_pairs`, Z `zero_shot_unavailable`, G `empty_ground_truth`, E
`empty_prediction`, T `ties_broken_by_index`.

| Cases | Before | After |
|---|---|---|
| gv-001, gv-017 | P Z | P Z (unchanged) |
| gv-002 | G | P G Z |
| gv-003 | E | P E Z |
| gv-004 | T | P T Z |
| gv-005 to gv-010, gv-014 | none | P Z |
| gv-011 | none | P |
| gv-012, gv-013, gv-015, gv-016 | Z | Z (unchanged) |

Before the vectors changed, with the exact comparison in place: pytest's golden file 12 failed, 9
passed; vitest's engine file failed gv-002 to gv-011 and gv-014.

A mutant of both engines raising `masks_ignored` whenever either graph carries masks, restored
afterwards:

| Harness and vectors | pytest golden | vitest engine |
|---|---|---|
| committed (`9b678af`) | 20 passed | 30 passed |
| this branch | 5 failed, 16 passed | 5 failed, 25 passed |

The five are gv-009, gv-012, gv-013, gv-015 and gv-016, the cases whose graphs both carry masks.

### i18n parity by mutation

Each rule of `i18n_parity.mjs` disabled alone, against `tools/test/i18n_parity.test.mjs`'s seven
tests, after the branch review:

| Rule disabled | Result |
|---|---|
| a key in one locale only | 1 failed: the missing-key test |
| an empty value | 1 failed: the empty-value test |
| the placeholders compared between locales | 2 failed: a placeholder dropped, and one repeated in one locale |
| a placeholder repeated in one value | 1 failed: the repeat in both locales |

### After the branch review

`test_every_case_derives_its_warnings_in_why` failed on gv-001, gv-012, gv-013, gv-015 and gv-016
before their `why` sentences were written, and passed after; pytest's golden file then passed 22.
The regenerated `vectors.json` differs from commit `6679f21`'s in those five cases' `why` alone.
The repeat test and the count test of `i18n_parity.test.mjs` failed, 2 of 7, before the rule and
the count were added.

### The runner

The commit statuses of `9b678af`, read through the Gitea API (1.21.2) on 2026-09-28 at 02:38:
`CI / backend`, `CI / frontend` and `scene-graph-studio / ci`, each "Waiting to run" since 00:27.
`/repos/CIL-Team/WekaExt/actions/runners` and `/admin/runners` both answer 404.

## 27. The review of the open checks — measured, 2026-09-28

D104. Every number below is from the run that produced it. The three rows marked `main` ran on
`main` at `5eabab6`, before the branch; the rest on branch `fix/sgs-d103-review`.

| Step | Result |
|---|---|
| `npm run ci`, `main` | exit 0: 281 pytest and 7 skipped, 901 vitest in 67 files, parity 17, i18n 331 keys |
| `npm run test:e2e`, `main` | **75 passed** |
| `npm run check:perf`, `main` | 23 passed; F3 32.7 ms, E1 33.1 ms, E10 33.2 ms |
| pytest | **286 passed**, 7 skipped (281 before) |
| vitest | **909 passed in 67 files** (901 before) |
| parity | **20 cases agree** (17 before) |
| i18n parity | 331 keys, both locales complete; 13 carry a placeholder, all agreeing |
| content lint | 20 golden cases, 42 playground cases, 25 release figures, clean |

The tree was clean after the three runs on `main`. `npm run test:e2e` was not run on the branch:
it changes no frontend production code.

### The two warnings no vector raised

Four mutants, each applied alone to one engine and restored afterwards, against the committed
vectors and harness and against the branch's:

| Mutant | `5eabab6` | This branch, at 19 vectors |
|---|---|---|
| Python, `masks_ignored` never raised | pytest 281 passed | 1 failed (gv-019), 284 passed |
| Python, `gt_boxes_not_pairs` under PredCls alone | pytest 281 passed | 1 failed (gv-018), 284 passed |
| TypeScript, `masks_ignored` never raised | metrics 39 passed | 1 failed (gv-019), 40 passed |
| TypeScript, `gt_boxes_not_pairs` under PredCls alone | metrics 39 passed | 1 failed (gv-018), 40 passed |

With either TypeScript mutant built into `dist`, `parity.mjs` reported one disagreement, on the
vector the harness failed: gv-019's warnings `masks_ignored,zero_shot_unavailable` against
`zero_shot_unavailable`, and gv-018's `gt_boxes_not_pairs,zero_shot_unavailable` against
`zero_shot_unavailable`. Built back from the source, 19 agree.

Before the two vectors were written, `test_some_case_raises_every_warning` and
`test_some_case_runs_every_protocol` both failed, the second as `['predcls', 'sgcls', 'sgdet'] ==
['predcls', 'sgdet']`; pytest's golden file had 2 failures and 22 passes. With the vectors added,
it passed all 26 tests.

### i18n parity by mutation

Each rule of `i18n_parity.mjs` disabled alone, against the ten tests in
`tools/test/i18n_parity.test.mjs`, after the branch review:

| Rule disabled | Result |
|---|---|
| a key in one locale only | 2 failed: the missing-key tests, one in each direction |
| the missing-key check, run from en only | 1 failed: the key in 繁體中文 only |
| an empty value | 1 failed: the empty-value test |
| a braced name that is not a placeholder | 1 failed: the braced-name test |
| a brace outside a placeholder | 1 failed: the stray-brace test |
| the placeholders compared between locales | 2 failed: a placeholder dropped, and one repeated in one locale |
| a placeholder repeated in one value | 1 failed: the repeat in both locales |

The braced-name test failed, 1 of 9, before its rule existed, and the stray-brace test, 1 of
10, before its own. The committed script, run over
`{kp-id}` in en with no placeholder in zh-TW, exited 0 and printed "1 keys, both locales complete;
0 carry a placeholder".

### The records tests

With "Waiting to run" removed from D103's record alone and restored afterwards, the D103 records
test failed, 1 of 27, on that item. Sliced from D103's heading to the end of the file, the
record still contained the phrase, in D104. After the two vectors, D100's two records tests
failed, 2 of 906, on their pinned counts. With gv-020 written and the records still at 19, the
test that takes the count from `vectors.json` failed on INDEX's NFR-3 row, 19 against 20.

### After the branch review

gv-020's five mutants, each applied alone and restored afterwards, on the branch:

| Mutant | Result |
|---|---|
| Python, a null score counted toward a tie | pytest 1 failed (gv-020), 285 passed |
| Python, unscored predictions ordered by `relationship_id` | pytest 1 failed (gv-020), 285 passed |
| Python, unscored predictions ranked first | pytest 2 failed (gv-020, `test_missing_scores_sort_last_and_keep_input_order`), 284 passed |
| TypeScript, a null score counted toward a tie | metrics 1 failed (gv-020), 41 passed |
| TypeScript, unscored predictions ordered by `relationship_id` | metrics 1 failed (gv-020), 41 passed |

Built back from the source, parity: 20 cases agree. A `classify` that compares the predicate and
object class alone, restored afterwards, failed gv-018 alone on the branch (1 failed, 285
passed) and passed all 17 golden cases of `5eabab6`.

Both engines, called on gv-001 with `zero_shot_train_triplets: []`, return R, mR and ngR 1, zR
null, and the warnings `gt_boxes_not_pairs` and `zero_shot_unavailable`. SRS §4.3's definition
gives zR = R for that input; no vector pins either reading (D104).

### The runner

The commit statuses of `5eabab6`, read through the Gitea API on 2026-09-28 at 10:13: `CI /
backend`, `CI / frontend` and `scene-graph-studio / ci`, each "Waiting to run" since 09:08.
`9b678af`'s three, read at 09:46, were still waiting after being queued at 00:27.

## 28. The empty training split — measured, 2026-09-28

D105. Every number below is from the run that produced it, on branch `fix/sgs-empty-split`, from
`main` at `ba87229`. No engine or frontend production code changed, so `npm run test:e2e` and
`npm run check:perf` were not run; §27 records both on `5eabab6`.

| Step | Result |
|---|---|
| pytest | **287 passed**, 7 skipped (286 before) |
| vitest | **911 passed in 67 files** (909 before) |
| parity | **21 cases agree** (20 before) |
| i18n parity | 331 keys, both locales complete; 13 carry a placeholder, all agreeing |
| content lint | 21 golden cases, 42 playground cases, 25 release figures, clean |

### The ruling by mutation

Each engine mutated to read `zero_shot_train_triplets: []` as a split, computing zR and raising
`zero_shot_unavailable` only when the field is absent, restored afterwards:

| Mutant | Result |
|---|---|
| Python | pytest 1 failed (gv-021), 286 passed |
| TypeScript | metrics 1 failed (gv-021), 42 passed |
| TypeScript, built into `dist` | `parity.mjs`: gv-021 "zR@20: python=null typescript=1", and the warnings differ |

Built back from the source, 21 agree. gv-021's expectation is the amended definition's; both
engines met it with no change to either.

### The records tests

The D105 records test failed on its missing heading first. With gv-021 written and the records
still at 20, the test that takes the count of golden vectors from `vectors.json` failed on INDEX's
NFR-3 row, 20 against 21.

### The runner

The commit statuses of `ba87229`, read through the Gitea API on 2026-09-28 at 11:14: `CI /
backend`, `CI / frontend` and `scene-graph-studio / ci`, each "Waiting to run" since its push at
11:11.
