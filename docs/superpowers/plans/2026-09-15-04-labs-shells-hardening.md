# Plan 04 — Remaining Labs, Shells, Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The professor teaches M0 through M14 from the application by keyboard alone, offline, with `torch` uninstalled — and a student who works through it alone is scored, scheduled and able to critique the anchor paper's evaluation section.

**Architecture:** L3, L7 and L8 complete the lab set against components that already exist. The lecture shell is a second layout over the same `ModuleStep[]`, with a presenter window driven by `BroadcastChannel`. Assessment is client-side and persisted to `localStorage`. Hardening is not a phase of polishing but nine named verification runs from the design document, each of which can fail.

**Tech Stack:** React 19 · ts-fsrs 5.4.2 · Playwright · D3

**Spec:** `../specs/2026-09-15-scene-graph-studio-PRD.md` §6.1, §6.2, §6.5, §6.6, §8, §10 · `…-SRS.md` §7 · `…-design.md` §5 Phase 7, §6
**Decisions:** D-18 (mini-ISG licence gate), D-19 (cut order)
**Contracts:** §2.3 state, §2.4 shells

## Global Constraints

See `2026-09-15-00-master.md` § Global constraints. The four that bite hardest here:

- **No industrial frame is committed before `data/mini-isg/LICENCE.md` records a redistribution finding** (D-18). The gate is before the copy, not after it.
- **Lecture mode is ≥ 24 px base type and ≥ 7:1 contrast** (NFR-5).
- **Every `localStorage` access is wrapped and returns a typed default.** A private window must still get a working application.
- **The cut order is D-19.** If the calendar binds, cut FSRS, then L8 and the mini-ISG, then L7, then the card corpus down to the curriculum's ~25, then L6. Never the lecture shell.

---

## File structure

| File | Responsibility |
|---|---|
| `system/frontend/src/labs/L3/LongTailLab.tsx` | The frequency baseline, run live in the browser |
| `system/frontend/src/labs/L3/freq.ts` | The co-occurrence predictor — no pixels consulted |
| `system/frontend/src/labs/L7/CaptionToGraph.tsx` | Sentence → nodes and edges |
| `system/frontend/src/labs/L8/MiniISGAnnotator.tsx` | VLM draft, then hand-correction |
| `system/frontend/src/shells/lecture/LectureShell.tsx` | One step at a time, keyboard-driven |
| `system/frontend/src/shells/lecture/PresenterWindow.tsx` | Notes and timer on the second screen |
| `system/frontend/src/shells/study/StudyShell.tsx` | Scrolling column, quizzes, progress |
| `system/frontend/src/assess/quiz.tsx` | Per-module quizzes |
| `system/frontend/src/assess/perturb.ts` | Graph-perturbation item generator |
| `system/frontend/src/assess/schedule.ts` | FSRS wrapper over `localStorage` |
| `system/frontend/src/store/persist.ts` | The one typed `localStorage` module |
| `data/mini-isg/` | Annotations, manifest, licence finding, README |
| `e2e/lecture.spec.ts` | The keyboard walkthrough |
| `README.md` | The two machines, the CPU caveats, and how to obtain the slice bundle |

---

### Task 1: L3 Long-Tail Lab and the frequency baseline

**Files:**
- Create: `system/frontend/src/labs/L3/freq.ts`, `system/frontend/src/labs/L3/LongTailLab.tsx`, `system/frontend/src/labs/L3/test/freq.test.ts`

**Interfaces:**
- Produces: `fitFreq(graphs: SceneGraph[]): FreqModel` and `predictFreq(model, objects, blend, visual?): SGRelationship[]`.

**The lesson, from knowledge point E11.** `R_p(λ) = (1−λ)·Pr[p | c_s, c_o] + λ·f_θ(V, s, o)`. At `λ = 0` the predictor reads no pixels, yet `Cov(n, π) ≫ 0` by construction, so `R` is high and `mR` is near zero.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { fitFreq, predictFreq } from '../freq';
import { evaluate } from 'sgg-metrics';

describe('the frequency baseline', () => {
  it('consults no pixels', () => {
    const model = fitFreq(TRAIN);
    const a = predictFreq(model, OBJECTS, 0);
    const b = predictFreq(model, OBJECTS, 0);
    expect(a).toEqual(b);   // no image argument exists to vary
  });

  it('beats a head-biased visual model on R@50', () => {
    expect(recallOf(freqPredictions(), 'R')).toBeGreaterThan(recallOf(modelPredictions(), 'R'));
  });

  it('loses badly on mR@50', () => {
    expect(recallOf(freqPredictions(), 'mR')).toBeLessThan(recallOf(modelPredictions(), 'mR'));
  });

  it('is affine in the blend parameter', () => {
    const at = (l: number) => recallOf(predictFreq(fitFreq(TRAIN), OBJECTS, l), 'R');
    const mid = at(0.5);
    expect(Math.abs(mid - (at(0) + at(1)) / 2)).toBeLessThan(0.05);
  });
});
```

The second and third assertions are design §6 verification item 4, moved into the test suite where they run on every commit rather than once before shipping. If they ever fail, either the slice is unrepresentative or `mR@K` is wrong — investigate before changing the test.

- [ ] **Step 2: Run it and watch it fail, then implement**

`fitFreq` counts `(subject class, object class) → predicate` occurrences over the training slice and normalises. `predictFreq` emits, for every ordered object pair, the predicates ranked by that conditional, blended with an optional visual score by `λ`.

- [ ] **Step 3: Build the lab**

Controls: the `λ` slider; a Zipf exponent slider that reshapes the synthetic predicate distribution; and a side-by-side `R` versus `mR` readout for the frequency baseline and a real model. The covariance identity `R@k − mR@k = Cov(n, R)/n̄` from knowledge point E6 is displayed live, because the whole bias problem is the sign of that one covariance.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L3
git commit -m "feat(sgs): L3 — the frequency baseline that humiliated the field, run live"
```

---

### Task 2: L7 Caption to Graph

**Files:**
- Create: `system/frontend/src/labs/L7/CaptionToGraph.tsx`, `system/frontend/src/labs/L7/parse.ts`, `system/frontend/src/labs/L7/test/parse.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('turns nouns into nodes and verbs into edges', () => {
  const g = parse('the person is holding a box on the table');
  expect(g.objects.map((o) => o.names[0])).toEqual(['person', 'box', 'table']);
  expect(g.relationships.map((r) => r.predicate)).toEqual(['holding', 'on']);
});

it('marks a predicate outside P as out-of-vocabulary rather than dropping it', () => {
  const g = parse('the person is taping the panel', { P: ['knocking on', 'holding'] });
  expect(g.relationships[0]!.predicate).toBe('taping');
  expect(outOfVocabulary(g, ['knocking on', 'holding'])).toEqual(['taping']);
});

it('produces a graph that validates', () => {
  expect(isSceneGraph(parse('a robot arm is above the conveyor'))).toBe(true);
});
```

The second assertion is knowledge point L10 made interactive: an out-of-vocabulary predicate is scored as a false positive **and** leaves the true triplet missed, so the error is counted twice. Dropping it silently would hide the lesson.

- [ ] **Step 2: Run it and watch it fail, then implement**

A small rule-based parser over a closed vocabulary — determiner stripping, a noun list drawn from the slice's object classes, a verb-and-preposition list drawn from its predicate classes. No natural-language library: the lesson is the structural correspondence between a sentence and a graph, and a dependency parser would obscure it behind an import.

- [ ] **Step 3: Build the lab**

The sentence is typed; nodes and edges appear as it is typed; out-of-vocabulary predicates render in the `spurious` style from the shared palette, with the two-fold cost stated beside them.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L7
git commit -m "feat(sgs): L7 — sentence to graph, with out-of-vocabulary cost made visible"
```

---

### Task 3: The mini-ISG licence finding

**Files:**
- Create: `data/mini-isg/LICENCE.md`, `data/mini-isg/README.md`

**This task produces no code and gates Task 4.** D-18 makes it a hard gate: no frame is copied until the finding is written.

- [ ] **Step 1: Read each source's own licence statement**

For IndustReal and MECCANO: find the licence statement on the project's own page or repository, not on a survey or a mirror. Record the licence identifier, the statement's URL, and today's date.

- [ ] **Step 2: Answer one question per source, explicitly**

*Does this licence permit redistributing individual frames inside a third-party teaching repository?* Write `YES`, `NO`, or `UNCLEAR — treated as NO`. There is no fourth answer, and `UNCLEAR` is treated as `NO`.

- [ ] **Step 3: Write `LICENCE.md`**

```markdown
# mini-ISG sources

| Source | Licence | Statement URL | Checked | Frame redistribution | Consequence |
|---|---|---|---|---|---|
| IndustReal | | | 2026-__-__ | | |
| MECCANO | | | 2026-__-__ | | |

Frames are downloaded by the author, as every corpus is (D-08). Where distribution to the
class is permitted, the frames ride in the slice bundle. Where it is not, this directory
commits the annotations and a manifest of frame identifiers and SHA-256 hashes only, and
students work that lab on the placeholder frames. The annotations are this project's own work.
```

- [ ] **Step 4: Write `README.md`, in both languages**

It states plainly: this is **our** teaching set, built with the paper's method; it is **not** the authors' ISG; ISG remains request-only; and the unrelated `ISG-Bench` on Hugging Face is a name collision, not the same thing. Design §5 and PRD §10 both require this; putting it beside the data is what makes it hard to miss.

- [ ] **Step 5: Commit**

```bash
git add data/mini-isg/LICENCE.md data/mini-isg/README.md
git commit -m "docs(sgs): mini-ISG licence findings, recorded before any frame is copied"
```

---

### Task 4: The mini-ISG build and L8

**Files:**
- Create: `system/frontend/src/labs/L8/MiniISGAnnotator.tsx`, `data/mini-isg/annotations.json`, `data/mini-isg/MANIFEST.json`
- Modify: `system/backend/scripts/bundle_slices.py` (add `mini-isg` to the bundle when its `bundle_distribute` gate is cleared)

- [ ] **Step 1: Assemble roughly forty frames under the Task 3 finding**

Download IndustReal and MECCANO into `SGS_CORPUS_ROOT` alongside the other corpora, and cut roughly forty frames. Where the Task 3 finding permits distribution, add `mini-isg` to `bundle_slices.py`'s cleared set so the frames ride in the class bundle. Where it does not, commit the manifest only. Do not mix: a directory where some frames are present and some are not is a bug report waiting to happen, so the manifest records the disposition per frame.

- [ ] **Step 2: Draft triplets with the L5 pipeline**

Run the IndVisSGG step-1 prompt with an *O* and *P* written for the industrial domain. Keep the drafts; they are the "before" the lab shows.

- [ ] **Step 3: Build L8 and hand-correct**

The lab shows the VLM draft alongside the frame, and every correction the annotator makes is counted: deletions, additions, predicate rewrites, and box adjustments. The running count is the lab's whole point — it is the paper's own motivation reproduced at 0.4% scale, and PRD §6.2 names it as the only place a student sees what annotation costs.

- [ ] **Step 4: Commit the corrected set**

`annotations.json` carries `provenance.kind = 'user'` and a `note` naming the drafting model and the correction date. The schema round-trip test from plan 01 Task 14 covers this slice automatically once it exists.

- [ ] **Step 5: Commit**

```bash
git add data/mini-isg frontend/src/labs/L8 backend/scripts/bundle_slices.py
git commit -m "feat(sgs): mini-ISG teaching set and L8, with the correction count as the lesson"
```

---

### Task 5: The lecture shell

**Files:**
- Create: `system/frontend/src/shells/lecture/LectureShell.tsx`, `system/frontend/src/shells/lecture/useStepper.ts`, `system/frontend/src/shells/lecture/test/useStepper.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('advances on ArrowRight and Space, retreats on ArrowLeft', () => { /* … */ });

it('stops at the ends rather than wrapping', () => { /* … */ });

it('does not steal keys while a text input has focus', () => {
  // The TEC editor in L5 lives inside a lecture step. Typing 'a' must not advance the slide.
});

it('puts the step index in the URL so any step is bookmarkable', () => { /* … */ });

it('posts position and remaining time on the presenter channel', () => { /* … */ });
```

The third assertion is the one that will be found in the room rather than in review if it is not written now.

- [ ] **Step 2: Run it and watch it fail, then implement**

`useStepper` owns the keyboard policy and reads the step index from the route, per contracts §2.2. `LectureShell` renders one step at a time at ≥ 24 px base type and posts `{moduleId, stepIndex, remainingSeconds}` on a `BroadcastChannel` named `sgs-presenter`.

- [ ] **Step 3: Verify the contrast requirement**

Measure the lecture palette against NFR-5's 7:1. Measure it; do not assume it, and record the measured ratios in a comment beside the palette.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shells/lecture
git commit -m "feat(sgs): lecture shell — one step per URL, keyboard-driven, projector-legible"
```

---

### Task 6: The presenter window

**Files:**
- Create: `system/frontend/src/shells/lecture/PresenterWindow.tsx`, `system/frontend/src/shells/lecture/timer.ts`

- [ ] **Step 1: Write the failing test**

Assert: the window subscribes to `sgs-presenter` and renders the notes for the received step; the section timer counts down from the step's `seconds_budget` and turns red past zero without stopping; and closing the presenter window does not disturb the lecture shell.

- [ ] **Step 2: Run it and watch it fail, then implement**

`/lecture/notes` is a route, opened with `window.open`, so it is a second browser window rather than a second application. It renders the current step's `presenter_notes_*`, the next step's title, the section timer, and the elapsed total.

- [ ] **Step 3: Rehearse with two windows on two displays**

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shells/lecture/PresenterWindow.tsx frontend/src/shells/lecture/timer.ts
git commit -m "feat(sgs): presenter window with section timing over BroadcastChannel"
```

---

### Task 7: Persistence, quizzes and spaced repetition

**Files:**
- Create: `system/frontend/src/store/persist.ts`, `system/frontend/src/assess/quiz.tsx`, `system/frontend/src/assess/perturb.ts`, `system/frontend/src/assess/schedule.ts`, plus tests for each

- [ ] **Step 1: Write the failing test for persistence first**

```typescript
it('returns the typed default when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect(loadProgress()).toEqual({ version: 1, modules: {} });
});

it('discards rather than migrates across a version bump', () => {
  localStorage.setItem('sgs:v1:progress', JSON.stringify({ version: 0, modules: { m00: 3 } }));
  expect(loadProgress().modules).toEqual({});
});

it('never throws on write in a private window', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => saveProgress({ version: 1, modules: { m00: 1 } })).not.toThrow();
});
```

- [ ] **Step 2: Write the perturbation generator's test**

```typescript
it('corrupts exactly one edge', () => {
  const { graph, corruptedIndex } = perturb(GROUND_TRUTH, seed(1));
  const diffs = GROUND_TRUTH.relationships
    .map((r, i) => JSON.stringify(r) !== JSON.stringify(graph.relationships[i]) ? i : -1)
    .filter((i) => i >= 0);
  expect(diffs).toEqual([corruptedIndex]);
});

it('produces a graph that still validates', () => {
  expect(isSceneGraph(perturb(GROUND_TRUTH, seed(2)).graph)).toBe(true);
});

it('is deterministic under a seed, so an item can be re-shown', () => {
  expect(perturb(GROUND_TRUTH, seed(3))).toEqual(perturb(GROUND_TRUTH, seed(3)));
});
```

- [ ] **Step 3: Implement all three modules**

`persist.ts` is the only module in the application that touches `localStorage`. `quiz.tsx` renders per-module items from module frontmatter plus generated perturbation items. `schedule.ts` wraps `ts-fsrs` and persists to `sgs:v1:fsrs`.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store frontend/src/assess
git commit -m "feat(sgs): typed persistence, quizzes, perturbation items, FSRS scheduling"
```

---

### Task 8: Export

**Files:**
- Create: `system/frontend/src/export/vgJson.ts`, `system/frontend/src/export/svg.ts`, tests for both

- [ ] **Step 1: Write the failing test**

```typescript
it('round-trips through the Visual Genome driver shape without loss', () => {
  const vg = toVisualGenome(GRAPH);
  expect(fromVisualGenome(vg)).toEqual(GRAPH);
});

it('exports an SVG that carries no external references', () => {
  const svg = exportSvg(node);
  expect(svg).not.toMatch(/<image[^>]+href="https?:/);
  expect(svg).not.toMatch(/@import/);
});
```

The second assertion matters because an exported figure ends up in a slide deck, and an external reference makes it break silently on the projector.

- [ ] **Step 2: Run it and watch it fail, then implement**

`toVisualGenome` maps `SceneGraph` onto the `Image` / `Object` / `Relationship` / `Attribute` shape SRS §3 names as the interoperability target. `exportSvg` serialises a live node with computed styles inlined and images embedded as data URIs.

- [ ] **Step 3: Verify by importing an export into the VG driver**

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/export
git commit -m "feat(sgs): VG-compatible JSON export and self-contained SVG export"
```

---

### Task 9: Hardening — the nine verification runs

**Files:**
- Create: `e2e/lecture.spec.ts`, `docs/VERIFICATION.md`
- Modify: `README.md`

Design §6 lists nine checks. They are executed here, and each one is recorded in `docs/VERIFICATION.md` with its date and its result. A check that was not run is recorded as not run; there is no third state.

- [ ] **Step 1: Run checks 1 through 5**

1. **Evaluation engine truth.** `pytest backend/tests -q` (design §6 writes this as `test_eval.py`; the suite is split across `test_metrics.py`, `test_match.py` and `test_golden.py`) and `npm run test:ts` green on the shared vectors; `npm run lint:parity` reports an empty diff. Then hand-verify one fixture on paper against `METRICS.md` and confirm the engine agrees.
2. **Reproduce a known number.** Committed RelTR predictions for the `vg150-sgb` slice through `/api/eval` at SGDet, graph constraint, K = 50. The result will not equal the paper's 27.5 — the slice is 80 images, not 26,446 — so the check is that the magnitude is plausible and the constraint and protocol tags are right. Record as a sanity check, never as a reproduction claim.
3. **The constraint gap is visible.** In L2, toggling the graph constraint off must move `R@K` substantially upward on the same predictions. If it does not, `ng-R@K` is wrong.
4. **The FREQ humiliation reproduces.** Already asserted in Task 1's tests; confirm it in the interface as well, on the real slice rather than the fixture.
5. **The protocol correction reproduces.** L6 under `multi_mpo` and `single_mpo` must show one-stage numbers falling and two-stage numbers roughly stable, matching the direction — not the magnitude — of the ECCV 2024 table.

- [ ] **Step 2: Run check 6, the offline run**

In a clean environment: disconnect the network, `pip uninstall torch`, start both servers, walk M0 → M14. Every P0 feature must work; live inference and the live VLM must show a stated reason rather than a stack trace.

This is NFR-1's only real test. It cannot be automated convincingly, and it must be done on a machine that has never had the slices fetched, so that the placeholder path is exercised too.

- [ ] **Step 3: Run checks 7 and 8**

7. **Bilingual parity.** `npm run lint:i18n` reports zero missing keys in either direction. Then spot-check three modules in 繁體中文 for term consistency — the lint checks key parity, not register.
8. **Lecture rehearsal.** Write and run `e2e/lecture.spec.ts`, a Playwright walkthrough of M0 → M14 by keyboard alone, then repeat it by hand on a projector-resolution window at 24 px base type.

- [ ] **Step 4: Run check 9, the source audit**

`npm run lint:content` confirms every numeric claim carries a source URL and a `verified` flag. Then re-check by hand that every item flagged unverified still renders in the unverified style, and that `data/LICENCES.md` and `data/mini-isg/LICENCE.md` have no `UNVERIFIED` row against committed data.

- [ ] **Step 5: Write the README and commit**

`README.md` states plainly: the two machines and what each can do; that live inference is RelTR only and opt-in; that Motifs, VCTree and PSGFormer can never run live and why; which predictions are measured and which reconstructed; that the ISG dataset is not public and what ships instead. It carries **two separate quick-starts** — one for students, who unzip the distributed slice bundle into `data/slices/`, run `verify_bundle.py`, and start both servers; and one for the author, who additionally sets `SGS_CORPUS_ROOT`, runs `cut_slice.py` per dataset and `bundle_slices.py` to produce the next bundle. A reader must not have to work out which half applies to them.

```bash
git add e2e docs/VERIFICATION.md README.md
git commit -m "test(sgs): the nine verification runs, recorded with dates and outcomes"
```

---

## Self-review

**Spec coverage.** PRD §6.1 two shells — Tasks 5, 6. §6.2 L3, L7, L8 — Tasks 1, 2, 4. §6.5 assessment — Task 7. §6.6 export — Task 8. §8 success criteria — Task 9. §10 what we will not claim — Task 3's README. SRS §7 NFR-1 — Task 9 step 2; NFR-5 — Task 5 step 3; NFR-6 — Task 9 step 3. Design §5 Phase 7's mini-ISG — Tasks 3, 4. Design §6 all nine checks — Task 9.

**Type consistency check.** `perturb` returns `{graph: SceneGraph, corruptedIndex: number}` and is consumed by `quiz.tsx` under that shape. `loadProgress`/`saveProgress` share the `Progress` type declared in `persist.ts` and used nowhere else. `ModuleStep` is the type both shells consume, declared in plan 02 Task 7 and unchanged here.

**Deliberate omission.** PRD §5 lists mobile layout as a non-goal, so no task addresses it, and `README.md` states the application targets desktop and projector.

---

## Done when

`docs/VERIFICATION.md` records all nine checks as run, with dates and outcomes — and the offline run in step 2 passed on a machine with no network, no `torch`, and no fetched slices.
