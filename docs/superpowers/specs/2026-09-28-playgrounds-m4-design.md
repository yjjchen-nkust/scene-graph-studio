# Playgrounds for M4: E3, E4, E7, E13 and X2 (design)

Five of the eight live knowledge points M4 owns, and the statements about constraints, blends and
VRD's per-pair count that the engine contradicts. It follows the M0 to M3 playground designs and
changes no contract rule.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and
the playground designs before this one. Where this document and those disagree, they win and this
one is wrong.

---

## 1. Context

`assignment.json` gives M4 thirteen points. Eight are `status: 'live'`: **E3** (ranking and
top-K), **E4** (graph, none, semi), **E5** (R@K), **E6** (mR@K and the weighting identity),
**E7** (ng-R@K), **E11** (the FREQ prior), **E13** (MultiMPO against SingleMPO) and **X2** (VRD's
undeclared k). M4 teaches E3 and E5 at s2, E4 at s3, E6 at s4, E7 at s5, E11 at s6, E13 at s7
and X2 at s8, all math steps; L2 and L3 at s10 are its anchor labs.

L2 scores R, mR, ngR and zR at any K under each protocol, constraint and τ, over five scored
predictions (`labs/L2/fixture.ts`). L3 scores the λ blend of a frequency prior and a visual scorer
over a synthetic Zipf corpus, and the covariance gap of the α identity (`labs/L3/freq.ts`).

### Decisions locked with the user, 2026-09-28

| Question | Answer |
|---|---|
| Scope | **E3, E4, E7, E13 and X2**, each a `playground` step directly after the math step that teaches it, with the content corrections of §3 first. **E5, E6 and E11 stay with L2 and L3**, which score them: each is a metric, and a playground computes a count, a bound or a set membership. |
| The ranked list | **One hand-built list on ph-001**, under PredCls, shared by E3, E4 and E7, its phenomena designed on paper (§4.1). Rejected: the reconstructed model predictions in `data/predictions/placeholder/`, whose ranks were not designed and which nothing in the frontend reads; and one toy list per playground. |
| The picture | **E3, E4 and E7 draw a chosen row's pair on ph-001** through `PhotoMarks`, as E1 and E10 draw theirs. |

---

## 2. What the engine says

Read on 2026-09-28, `packages/sgg-metrics/src/`; the Python engine agrees (golden vectors,
`parity.mjs`).

**The constraint filters the whole ranking, then the cut is taken.** `index.ts:51` ranks and
pairs; `:59` applies the constraint to the whole ranked list; `:60` builds the unconstrained pool
from the same list; `:75-76` assign each at K. `applyConstraint` (`constraint.ts:41-57`) keeps,
in rank order, at most one prediction per ordered object pair under `graph`,
`semi_constraint_max_per_pair` (default 2, `index.ts:58`) under `semi`, and every prediction under
`none`. So the constrained top k is the top k of a smaller pool, and it reaches predictions that
the unconstrained top k ranks below k.

**A counterexample, run on the built engine.** Three predictions, (1,2,on,.9), (1,2,near,.8) and
(3,4,on,.7), against the one ground truth (3,4,on): at K = 2, `graph` gives R@2 = 1 and
ngR@2 = 0; `semi` with a cap of 1 gives R@2 = 1, with a cap of 2 R@2 = 0.

**Mask pairing precedes both pools.** `applyPairing` (`pairing.ts:15-30`) keys on the pair of mask
run-length counts, keeps the first prediction per key under `single_mpo`, all under `multi_mpo`,
and passes a prediction through when either mask is absent. The graph constraint keys on object
ids, so d duplicate objects carrying one mask pair are d object pairs to it (gv-015, gv-016).

**No per-pair count other than the semi cap exists**, and no phrase recall.

### Five findings that follow

1. *M4 s3's Worked step derives R@k ≤ ngR@k from X_k ⊆ X_k^ng* (`m04.en.mdx:211-217`, and the
   map's derivation, `pg.js:392`). X_k is the top k of the constrained pool, not a subset of the
   unconstrained top k. What holds is the nesting of the pools, X ⊆ X^ng, and so
   R@k ≤ ngR@k once k covers the unconstrained pool; at a fixed k either side can be larger. The
   Implications line "the inequality is strict whenever a ground-truth predicate is any pair's
   runner-up" fails for the same reason.
2. *M4 s5's Worked step derives ngR(m) ≤ ngR(m′) for m′ ≥ m* (`:310-315`, `pg.js:394`), by the
   same intersection with X_k, and its Implications say "the gap keeps widening to m = 50". The
   pool grows with m; recall at a fixed k need not. The map's E7 note repeats the widening
   (`pg.js:690-691`).
3. *M4 s4* speaks of "the slider" for α (`:272`), which exists on the map only, and its Worked
   step divides by C (`:260-261`), which the symbol table glosses as the number of predicate
   classes, where the Formal line and the engine average over the classes present in the ground
   truth, |P′| (`metrics.ts:45-58`).
4. *M4 s6* says R and mR are "both affine in λ" (`:368`, `pg.js:396`). The blended score is
   affine in λ; recall over the blended ranking changes only where two blended scores cross, so it
   is piecewise constant in λ, as L3 computes it.
5. *M4 s8* uses k for VRD's predicates per pair, where the module's symbol table defines k as the
   rank cutoff (`:9-11`); cites "Proposition 4c" (`:472`, `pg.js:406`), which the course defines
   nowhere; says that at k = 70 the metric "measures pair detection" and R@k → PR@k, although the
   cut at K still ranks every candidate of every pair by score; and says R ≤ PR "holds for the same
   reason the protocol ordering holds", which M3 s3 records as observed, not implied (D98). And
   *M4 s10* says "L3 runs the frequency baseline against the learned models on the same slice"
   (`:517`); L3 runs a synthetic corpus and a hand-written visual scorer.

---

## 3. Content corrections, before the playgrounds are built

Each in both locales, with the map's matching derivation or note rebuilt from the corrected MDX
and re-harvested, and `FROZEN.md` recording it, as D98 did. The brief is searched for each claim.

- **s3.** The Worked step derives the nesting of the pools, X = {argmax per pair} ⊆ X^ng, and from
  it R@k ≤ ngR@k for k ≥ |X^ng|. A second line states that at a fixed k the constrained top k is
  the top k of a smaller pool, so either side can be larger, with the three-prediction
  counterexample of §2. The Implications state the strictness condition for the whole pool and
  keep the STTran figures and their `verified: false`.
- **s5.** The Worked step derives that the pool grows with m and saturates at the largest number
  of predicates any pair carries; at k beyond the pool, ngR is monotone in m; at a fixed k it need
  not be. The widening sentence becomes the pool's growth to m = |P|.
- **s4.** "The slider" names L3's λ and the identity's two endpoints; C becomes |P′| in the Worked
  step, with n̄ = N/|P′|, and the symbol table gains |P′|.
- **s6.** "Both are affine in λ" becomes: the blended score is affine in λ, and recall over its
  ranking is piecewise constant, changing where two blended scores cross.
- **s8.** VRD's per-pair count is written m, as in s5, with "VRD papers call it k" once; the
  "Proposition 4c" reference is removed; the k = 70 lines say that every predicate of every pair
  becomes a candidate while the cut at K still ranks them; the R ≤ PR sentence states phrase
  detection as a looser localisation test and makes no inclusion claim.
- **s10.** L3 is described as it is: a synthetic Zipf corpus, a frequency prior fitted to it, and
  a hand-written visual scorer.

---

## 4. Shared parts

### 4.1 The ranked list

`playgrounds/M4/ranking.ts`: twelve scored predictions on ph-001, PredCls, so each box is the
ground truth's and a prediction matches a ground truth exactly when subject id, object id and
predicate agree (object names in ph-001 are distinct). Scores are distinct, so no tie is broken.

| Rank | Pair | Predicate | Score | Matches |
|---|---|---|---|---|
| 1 | person#2 → wrench#5 | holding | 0.95 | g4 |
| 2 | person#2 → wrench#5 | next to | 0.90 | |
| 3 | box#3 → table#1 | on | 0.85 | g1 |
| 4 | person#2 → table#1 | in front of | 0.80 | |
| 5 | panel#6 → table#1 | above | 0.75 | g5 |
| 6 | person#2 → wrench#5 | near | 0.70 | |
| 7 | person#2 → table#1 | near | 0.65 | g2 |
| 8 | person#2 → glove#4 | holding | 0.60 | |
| 9 | box#3 → table#1 | near | 0.55 | |
| 10 | person#2 → glove#4 | wearing | 0.50 | g3 |
| 11 | wrench#5 → table#1 | on | 0.45 | |
| 12 | table#1 → person#2 | behind | 0.40 | |

ph-001's six ground truths are g1 box on table, g2 person near table, g3 person wearing glove, g4
person holding wrench, g5 panel above table and g6 wrench resting against table; g6 is never
predicted. Seven ordered pairs carry 3, 2, 2, 1, 2, 1 and 1 predictions.

|G ∩ X_k| by cap per pair, computed on paper; `graph` is cap 1, the engine's `semi` cap 2, and
`none` any cap from 3:

| k | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cap 1 (pool 7) | 1 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| cap 2 (pool 11) | 1 | 1 | 2 | 2 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | 5 |
| cap ≥ 3 (pool 12) | 1 | 1 | 2 | 2 | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 |

At k = 2 the graph constraint finds two ground truths and the unconstrained list one; at k = 6
cap 2 finds four and both other modes three; from k = 12 the order is 3 ≤ 5 ≤ 5. Each count is
non-decreasing in k within a row. The table agrees with `evaluate` at every k and cap, checked on
2026-09-28 after it was written.

### 4.2 `RankedList`

`playgrounds/M4/RankedList.tsx`: the twelve rows in rank order, each naming its pair and predicate
and its score. The cut at k is a rule across the list; a row the constraint drops is struck
through; a row in X_k that matches a ground truth carries a mark that differs in shape as well as
colour (NFR-5). The chosen row is outlined. Rows are text, so the 18 px floor measures them.

### 4.3 The photograph

For E3, E4 and E7, `PhotoMarks` draws the chosen row's subject and object boxes on ph-001, solid,
with the badges `#s` and `#o`; a `Slider` chooses the row, 1 to 12, default 1.

### 4.4 Logic

`logic.ts` gains pure functions, each unit-tested: the rank of a list by score, the cap per ordered
pair, the top k, the ground truths a top k matches under PredCls, the predictions admitted per mask
pair under each pairing, and VRD's pool size. Nothing in `playgrounds/` outside `test/` imports a
value from `sgg-metrics`; tests hold the cap to `applyConstraint`, the admission to
`applyPairing`, and the matched count to `evaluate`'s R@k × |G|, at every k from 1 to 12 and every
cap from 1 to 10.

---

## 5. The playgrounds

Parts follow D96: a playground spans consecutive steps where one panel cannot hold it at
1024 × 768 in 繁體中文 in its longest state, the count set in `PLAYGROUND_PARTS` by measurement.
E3, E4 and E7 are expected to take two parts each, the photograph and the list.

### 5.1 E3, after s2: the top k of one ranked list

A `Slider` for k, 1 to 12, under the graph constraint. Readouts: |X_k| = min(k, 7) and
|G ∩ X_k| of |G| = 6, as counts, with the matched ground truths named. The count never falls as k
rises. The kp's log-scale toggle is not built: the list has twelve rows.

### 5.2 E4, after s3: what each mode keeps, and what reaches the top k

A three-way `Choice`, graph, semi or none, and a `Slider` for k. Readouts: the pool the mode keeps
(7, 11 or 12), |G ∩ X_k| under the chosen mode, and |G ∩ X_k| under none at the same k, so that
k = 2 shows the constrained count above the unconstrained one and k = 12 shows the order of the
pools.

### 5.3 E7, after s5: predicates admitted per pair

A `Slider` for m, 1 to 10, and a `Slider` for k. Readouts: the pool (7, 11, then 12 from m = 3,
where it stops growing), and |G ∩ X_k|. At k = 2 the count falls from 2 to 1 as m rises from 1 to
2; at k = 12 it rises from 3 to 5.

### 5.4 E13, after s7: predictions admitted at one mask pair

A `Toggle` between SingleMPO and MultiMPO and a `Slider` for d, 1 to 5: d copies of the
person–wrench mask pair, each on its own pair of object ids and each with its own predicate,
scored next to 0.90, holding 0.88, near 0.70, attached to 0.60 and in front of 0.50. Readouts: the
predictions emitted (d), those the pairing admits (1 under SingleMPO, d under MultiMPO), those
the graph constraint then keeps (every admitted copy, since the copies are distinct object pairs),
and whether g4 is matched (under MultiMPO
from d = 2; never under SingleMPO, which keeps next to). Masks are identities, not pixels: each
duplicate carries its original's mask. No photograph: ph-001 carries no masks.

### 5.5 X2, after s8: VRD's per-pair count

A three-way `Choice` for m ∈ {1, 10, 70}. Counts for an image with ph-001's six objects: 30
ordered pairs; with VRD's 70 predicates the pool is 30 · m = 30, 300 or 2,100; the most of the top
K = 100 one pair can take is min(m, 100) = 1, 10 or 70; and whether the cut at 100 selects at all
(not at m = 1, where the pool of 30 is below 100). No fixture and no photograph.

---

## 6. Testing

**Arithmetic.** Unit tests for each new function in `logic.ts`.

**Golden cases**, each `why` writing out its arithmetic, in `data/content/playground_golden.json`:
E3 at k = 1, 2, 4, 7 and 12; E4 at (graph, 2), (none, 2), (semi, 6), (graph, 12) and (none, 12);
E7 at (m, k) = (1, 2), (2, 2), (1, 12), (2, 12) and (10, 12); E13 at (SingleMPO, 3), (MultiMPO, 1),
(MultiMPO, 2) and (MultiMPO, 5); X2 at m = 1, 10 and 70.

**The engine.** The three tests of §4.4. The source rule stands.

**Structure, in jsdom.** Each component in both locales; no focus on mount; `registry.test.tsx`
pins M4's new step ids.

**Chromium.** `lecture.spec.ts`: each step shows its numbers with no backend; every knob works from
the keyboard and the deck does not advance; the knobs write the address bar. `projector.spec.ts`:
the new steps join the contrast walk and the 18 px floor at all three sizes; each part fits
1024 × 768 in 繁體中文 in its longest state; the photograph has a size and the overlay coincides
with it. `perf.spec.ts`: one knob each, fourteen playgrounds measured.

---

## 7. Records and the gate

One deviation, with §2's findings and the corrections; one VERIFICATION section; `FROZEN.md`
entries; CLAUDE.md, INDEX and README updated in the same commit as the run they quote: 14
playgrounds, 14 live points remaining, the step and note counts, the test counts.

Branch `feat/playgrounds-m4`, from `main` at `992287e`. Before merge: `npm run ci`,
`npm run test:e2e` and `npm run check:perf`, all exit 0, then a review pass.

---

## 8. Out of scope

* E5, E6 and E11, which L2 and L3 score; L2 and L3 are unchanged.
* Recall, mean recall or any score in a playground.
* The map's toy playgrounds and `pg.js evaluate()` (D-14); only its derivations and notes are
  corrected.
* Claim `c-m04-mpo`, which stays `verified: false`. The map's E13 bars put two-stage methods at
  9.57 and 21.83 in its two columns while its note says they are unaffected; the source table is
  not located, so neither is settled here.
* The other 14 live points.

## 9. Open items

None.
