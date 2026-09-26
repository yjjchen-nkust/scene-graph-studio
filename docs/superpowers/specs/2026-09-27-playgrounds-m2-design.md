# Playground for M2: F3 (design)

The one live knowledge point M2 owns, and the three corrections it cannot be built beside. It
follows `2026-09-19-playgrounds-design.md` (M0) and `2026-09-26-playgrounds-m1-design.md` (M1)
and changes neither contract.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and
the two playground designs before this one. Where this document and those disagree, they win and
this one is wrong.

---

## 1. Context

`assignment.json` gives M2 three points: **F3** (grounding with boxes; IoU), `status: 'live'`, and
**F4** (panoptic masks against boxes) and **X3** (PSG), both `status: 'spec'`. M2 teaches F3 at
s2, a math step whose Implications state the scale bound
IoU ≤ min(λ², λ⁻²), so λ ≥ √2 ⇒ IoU < ½ at τ = 0.5. [**Corrected 2026-09-27 (D97):** at λ = √2 the
concentric box has IoU = ½, which the rule IoU ≥ τ accepts; the implication is λ > √2 ⇒ IoU < ½,
and s2 now says so.]

### Decisions locked with the user, 2026-09-26

| Question | Answer |
|---|---|
| Scope | **F3 only**, a `playground` step after s2. F4 and X3 stay `spec`: F4 needs mask data drawn over a picture, and PSG's photographs are not licensed for distribution (M2 s4). M2 goes from 6 steps to 7. |
| Picture | **The committed placeholder photograph** `ph-001`, and one of its annotated boxes as the ground truth, as F1 draws. |
| Knobs | **Δx, Δy, λ and τ.** λ is one uniform linear scale, the λ of s2's bound, so the bound on screen is the bound in the module. |
| Corrections | **In this cycle, before F3 is built** (§3), as M1 corrected X1's premise first. |
| Where IoU is computed | **In `playgrounds/logic.ts`, as two pixel counts and their quotient**; one test holds it equal to `sgg-metrics`' `boxIou` (§6). |

### Why IoU is inside the playground boundary

A playground computes a count, a bound or a set membership, never a metric. F3's formula writes
|b ∩ b′| / |b ∪ b′|, and with integer pixel boxes both terms are counts of pixels. The acceptance
rule IoU ≥ τ is a set membership, and min(A, A′) / max(A, A′) is s2's bound. R@K, which the IoU
feeds, stays in L2.

---

## 2. What the sources say

Opened on 2026-09-26. Quotations are verbatim.

**Xu et al. 2017, *Scene Graph Generation by Iterative Message Passing*, arXiv 1701.02426v2, §4,
"Setup", item 3 (p. 5).** "The scene graph generation (SGGEN) task is to simultaneously detect a
set of objects and predict the predicate between each pair of the detected objects. An object is
considered to be correctly detected if it has at least 0.5 IoU overlap with the ground-truth box."

**`Scene-Graph-Benchmark.pytorch`, `METRICS.md`** (branch `master`). The file contains no
occurrence of "IoU". M2 s2's sentence "`METRICS.md` does not state it" holds.

**`Scene-Graph-Benchmark.pytorch`, `maskrcnn_benchmark/config/defaults.py`, line 570:**
`_C.TEST.RELATION.IOU_THRESHOLD = 0.5`. `…/evaluation/vg/sgg_eval.py` applies it as
`(sub_iou >= iou_thres) & (obj_iou >= iou_thres)` (line 524).

### Three findings that follow

1. **The frozen F3's "scale ceiling" is wrong by a square.** It computes
   `Math.min(1, 1/Math.max(s.sc, 1/s.sc))`, which is min(λ, λ⁻¹). Its `sc` scales width and height
   alike, so the area ratio is λ² and the ceiling is min(λ², λ⁻²). At λ = 1.42 it reports 0.704;
   the bound is 0.496. The frozen page contradicts the module it was harvested into.
2. **The frozen F3's note misstates the reference implementation.** "Never stated in the reference
   metric implementation" is false: `defaults.py:570` sets 0.5 and `sgg_eval.py` applies it. What
   is true is that `METRICS.md` does not state it, and that Xu et al. do.
3. **M2 s2's presenter note sends the room to the wrong place.** "That bound is what the τ slider
   in L2 is demonstrating" (zh-TW: 「此上界為 L2 中 τ 滑桿的解釋依據」). L2's two imperfect boxes are
   same-size translations of their ground truth (`man` 40×60 at (16, 16) against (10, 10); `table`
   60×40 at (96, 102) against (80, 90)), so no scale mismatch exists for its τ slider to show.

---

## 3. Content corrections, before F3 is built

Correcting is in scope; extending the frozen page is not (D-13).

**The frozen F3, `system/web/knowledge-map/pg.js`.** The ceiling becomes
`Math.min(s.sc * s.sc, 1 / (s.sc * s.sc))`. In `note_en`, "never stated in the reference metric
implementation" becomes "stated by Xu et al. (2017, §4) and set in the reference implementation's
configuration, though not in its `METRICS.md`"; `note_zh` changes the same clause and nothing else.
No control and no output is added. A `FROZEN.md` entry records both. `npm run harvest` is run to
establish whether `kp.json` moves; `audit.js` and `check.js` run over the page.

**M2 s2's presenter notes, both locales.** The sentence naming L2 becomes: the bound is shown at
s3, where F3 moves λ past √2; L2's τ slider moves the threshold over boxes of the right size. The
body sentence "L2's τ slider exists to make that parameter visible rather than assumed" is true and
stays.

**Out of scope, recorded.** kp F3's `knobs` field reads "sliders: x, y, w, h of the predicted box";
the frozen F3 itself used Δx, Δy and a scale. The field is not a false statement about a source, so
it is not corrected; D97 records that F3 implements Δx, Δy and λ and why.

---

## 4. The playground

Common to all, inherited from M0, M1 and D91: real form controls only; knob state in the query
string, namespaced by kp; controls above the visual; type in `em`; ink at `slate-700` or darker;
no focus on mount; nothing computed is a metric.

### 4.1 Placement

M2 gains **`s3 · playground · F3`** directly after the math step s2. The later steps renumber:
s3 → s4, s4 → s5, s5 → s6 (lab L1), s6 → s7 (checkpoint). Cross-references to step ids in both
locales' bodies and notes are updated with them.
[**As built, 2026-09-27 (D97):** F3 spans two parts, s3 and s4 at 90 s each, so the later steps
are s5 to s8 and M2 has 8 steps; see §4.6.]

### 4.2 Data

`ph-001` from the committed placeholder slice, through the existing `playgrounds/slice.ts`.
The ground truth is **object 3, `box`, at (250, 240), 90 × 70, A = 6 300**, measured from
`data/slices/placeholder/annotations.json`. Its centre is (295, 275). Object 3 is chosen because
λ in steps of 0.1 gives integer sizes for 90 and 70, and because the box stays inside the
640 × 480 frame at every knob setting (at λ = 2, Δx = 120, Δy = 100 it spans x 325–505,
y 305–445).

### 4.3 Knobs

| Knob | Range | Step | Start | Key |
|---|---|---|---|---|
| Δx | −120 … 120 px | 2 | 0 | `F3.dx` |
| Δy | −100 … 100 px | 2 | 0 | `F3.dy` |
| λ | 0.5 … 2.0 | 0.1 | 1.0 | `F3.lambda` |
| τ | 0.05 … 0.95 | 0.05 | 0.5 | `F3.tau` |

τ's range is L2's. The starting 0.5 is labelled on screen with its origin, "Xu et al. 2017, §4,
p. 5", which is the one literal F3 carries, as F1's two |𝒫| presets are M0's. A query value
outside a range is clamped, as F1's are.
[**As built (D97):** clamped and snapped to the step, since a range input moves its thumb to the
nearest step and would otherwise show a setting the readouts did not compute.]

### 4.4 Computes

With w = 90, h = 70, (c_x, c_y) = (295, 275):

* w′ = round(λw), h′ = round(λh); x′ = round(c_x + Δx − w′/2), y′ = round(c_y + Δy − h′/2).
  `round` is `Math.round`. λ = 1.4 gives 126 × 98; λ = 1.5 gives 135 × 105.
* |b ∩ b′| and |b ∪ b′| as integer pixel counts, over half-open boxes, so boxes whose edges touch
  share no pixel, as `sgg-metrics`' `boxIou` and `backend/app/eval/iou.py` treat them.
* IoU = |b ∩ b′| / |b ∪ b′|.
* The bound min(A, A′) / max(A, A′), from the two integer areas.
* Membership: IoU ≥ τ.

### 4.5 On screen

* The photograph, with three marks that differ in shape, not colour alone (NFR-5): the ground
  truth as a solid outline, the prediction as a dashed outline, the intersection as a hatched fill.
  F3 draws its own `<svg>` over the `<img>`, both on the frame's `viewBox`, because `ImageOverlay`
  draws a scene graph's boxes and has no intersection mark. Its container is given an explicit
  width, since an overlay of absolutely positioned children otherwise renders 0 × 0 (the
  `ImageOverlay` trap in CLAUDE.md, D96).
* Readouts: |b ∩ b′|, |b ∪ b′|, IoU to three places, the bound to three places.
  [**As built (D97):** a readout's label is set in capitals, so the labels are words and the notes
  carry the arithmetic; the object's name is an HTML caption, not SVG text; the overlay sits in a
  box the photograph alone sizes, after a stretched column put every mark 122 px below its object.]
* Membership, worded as F8's is: 「IoU ≥ τ：視為同一物件」 against 「IoU < τ：不視為同一物件」;
  English "IoU ≥ τ: counted as the same object" against "IoU < τ: not counted as the same object".
  Never correct against wrong: s2 says a rejected box may sit at "a different, defensible place".
* When the bound is below τ, a sentence states that no placement at this λ reaches τ. The √2
  threshold shows as λ = 1.4 (bound 0.510, accepted when concentric) against λ = 1.5 (bound 0.444,
  accepted nowhere).

### 4.6 Fit

F3 is one step if it fits 1024 × 768 in 繁體中文 in its longest state. If it does not, it spans two
parts under D96, the picture and its three placement knobs, then τ and the membership, and the
measurement that forced the split is recorded in D97.
[**As built (D97):** split. As one step it ran 171 px past at 1024 × 768 and 105 px at
1280 × 800. Part 2 also shows the IoU and the bound, the two numbers τ is compared with, and the
legend stays with the picture in part 1, beside the readouts.]

---

## 5. Contract

No rule changes. The step satisfies rules 1 to 8 as written: F3 is owned by M2, registered in
`mounts.tsx`, mounted once in the corpus. Its golden cases carry `image_id: "ph-001"` (rule 9),
a `why` with the arithmetic (rule 10), and a registered kp (rule 11).

---

## 6. Testing

**Arithmetic.** `logic.ts` gains pure functions for the predicted box, the two counts, the quotient
and the bound. Each has unit tests.

**Golden cases**, `data/content/playground_golden.json`, each `why` writing out its arithmetic:

| Case | Knobs | Expect | Arithmetic |
|---|---|---|---|
| identical | λ 1, Δ 0 | IoU 1 | 6 300 / 6 300 |
| just past | λ 1.4, Δ 0 | IoU 0.510, member at τ 0.5 | 126 × 98 = 12 348; 6 300 / 12 348 |
| beyond √2 | λ 1.5, Δ 0 | IoU 0.444, bound < τ | 135 × 105 = 14 175; 6 300 / 14 175 |
| shifted | λ 1, Δx 18 | IoU 0.667 | (90 − 18) × 70 = 5 040; 5 040 / (12 600 − 5 040) |
| touching | λ 1, Δx 90 | IoU 0 | x′ = 340, the ground truth's right edge; half-open boxes share no pixel |
| inside | λ 0.5, Δ 0 | IoU 0.25 | 45 × 35 = 1 575; 1 575 / 6 300 |

**The cross-check.** A test in `playgrounds/test/logic.test.ts` imports `boxIou` from
`sgg-metrics` and asserts that `logic.ts`'s quotient equals it on every golden case. The source
rule stands: nothing in `playgrounds/` outside `test/` imports a value from `sgg-metrics`.
CLAUDE.md's sentence is amended to name the one test.

**Structure, in jsdom.** F3 renders its readouts in both locales and takes no focus on mount.
`registry.test.tsx` pins M2's new step ids.

**Interaction, in Chromium** (M0 design §6.2 holds):

* `lecture.spec.ts`: the step shows its computed numbers with no backend running; each of the four
  knobs moves a quantity from the keyboard; the deck does not advance.
* `projector.spec.ts`: the step joins the contrast walk and the 18 px type floor at XGA, WXGA and
  1920 × 1080, with `skipped` asserted empty; the photograph has a non-zero size inside the panel;
  every part fits 1024 × 768 in 繁體中文 in its longest state.
* `perf.spec.ts`: one knob, reported against the two-frame floor and never as a clamped zero (D91).

---

## 7. Records and the gate

Deviation **D97** for the cycle, with §2's three findings and §3's out-of-scope note. VERIFICATION
**§21**. A `FROZEN.md` entry. CLAUDE.md, INDEX, README and the brief updated in the same commit as
the run they quote: 7 playgrounds, 21 live points remaining, the step and presenter-note counts, and
the new test counts.

Branch `feat/playgrounds-m2`, from `main` at `443abcb`. Before merge: `npm run ci`,
`npm run test:e2e` and `npm run check:perf`, all exit 0, then a review pass. The branch is merged by
the user, not by the cycle.

---

## 8. Out of scope

* F4 and X3, and any mask rendering.
* An object chooser: one ground-truth box carries the lesson, and a second would need its own
  integer-size argument.
* x, y, w, h as separate knobs, and any aspect-ratio change.
* R@K, or any metric the IoU feeds. L2 scores.
* New controls or outputs on the frozen F3.
* The other 21 live points.

## 9. Open items

None.
