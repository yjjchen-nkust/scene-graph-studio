# Playgrounds for M5: T1 and T2 (design)

The two live knowledge points M5 owns, and the statements about pair counts and message passing that
the corpus and M5's own derivation contradict. It follows the M0 to M4 playground designs and changes
no contract rule.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and the
playground designs before this one. Where this document and those disagree, they win and this one is
wrong.

---

## 1. Context

`assignment.json` gives M5 six points, T1 to T6. Two are `status: 'live'`: **T1** (detect, enumerate
pairs, classify) and **T2** (IMP, iterative message passing); T3 to T6 are `spec`. M5 teaches T1 at s2
and T2 at s3, both math steps; s4 surveys Neural Motifs, VCTree, GPS-Net, KERN and BGNN; L4 at s5 is
its anchor lab; s6 is the checkpoint.

### Decisions taken on the author's instruction, 2026-09-29

The author asked for the next task to be implemented without a design session ("review the current
progress and go for implementing the next task"). The choices below are therefore the assistant's,
each with the alternative it rejects, and stand for the author's review before the merge.

| Question | Answer |
|---|---|
| Scope | **T1 and T2**, each a `playground` step directly after the math step that teaches it, with the corrections of §3 first. T3 to T6 are `spec` and stay so. |
| T1's data | **The vg150-sgb slice**, 80 VG150 frames already bundled for F6 and F7, ordered by object count; \|P\| = 50 from the VG150 card. Rejected: GQA's 310 predicates, which no source in this repository states, and a free N slider alone, which has no true relation count to set against the pairs. |
| T2's graph | **ph-001's six objects**, with a two-way choice of neighbourhood: the annotated relations, or every other object, as IMP connects every pair. Rejected: the map's eight invented objects and its whole-graph mean, under which its iteration slider changes nothing after the first round (§2). |
| T2's rule | **The course's linear rule, corrected** (§3), and stated as a model of repeated averaging, not as IMP's update, which is learned. |

---

## 2. What the sources say

Read on 2026-09-29.

**T1.** `m05.en.mdx:88` and the map (`pg.js:398`, and the T1 note at `pg.js:777`) set N = 80 and
\|P\| = 310, "GQA's 310 predicates", for "≈ 20 relations". No source in the repository states 310,
and the course's anchor dataset is VG150, whose card states **50 predicate categories** and, for its
validation split, **5,000 images, 62,754 object annotations and 33,203 relations**: 12.6 objects and
6.6 relations per image. "≈ 20" is close to the *original* Visual Genome's 22 relationships per image
(Xu et al. 2017, §4, quoted in `vg150_splits.json`), not to VG150's. The slice this course bundles,
80 VG150 frames, holds **1,348 objects, 26,282 ordered pairs, 892 relationship rows and 651 ordered
pairs carrying at least one relation**: 2.5 per cent of pairs. Its frames carry 4 to 39 objects,
median 16; the largest, `3182`, has 39 objects, 1,482 ordered pairs, 45 relationship rows and 29
related pairs. Computed from `data/slices/vg150-sgb/annotations.json` on 2026-09-29.

**T2.** Three statements disagree with one another.

1. *The Formal line* (`m05.en.mdx:117`, `pg.js:369`, `kp.json` T2 `math`) writes the neighbourhood
   mean and claims b⁽ᵗ⁾ → mean(b⁽⁰⁾) for every w > 0, "consensus; information destroyed".
2. *The Worked step* (`:124-129`, `pg.js:399`) replaces the neighbourhood mean by the whole-graph mean
   including the node itself. Under that rule the mean is invariant and
   b⁽¹⁾ᵢ = (1 − w) b⁽⁰⁾ᵢ + w · mean(b⁽⁰⁾), which is already the fixed point: the iteration stops after
   one round.
3. *The Implications* (`:135-141`) write "b⁽ᵗ⁾ = (1 − wᵗ)[…]·…", which is not an expression, and "spread
   contracts by (1 − w) per step". Under the Worked rule it contracts once, by (1 − w), and then holds.
   The checkpoint (s6, `:196`) and the s3 presenter note repeat "per step".

What holds, for the Formal rule with A the row-normalised neighbourhood (Aᵢⱼ = 1/dᵢ for j ∈ 𝒩(i)):

- For 0 ≤ w < 1 the map b ↦ (1 − w) b⁽⁰⁾ + w A b is a contraction in the max norm with factor w,
  since ‖A‖∞ = 1. The beliefs converge, at rate w, to b* = (1 − w)(I − wA)⁻¹ b⁽⁰⁾, and
  ‖b⁽ᵗ⁾ − b*‖∞ ≤ wᵗ ‖b⁽⁰⁾ − b*‖∞. b* is not a consensus: b* = (1 − w) Σₖ wᵏ Aᵏ b⁽⁰⁾, a mixture of
  k-hop averages that keeps a (1 − w) share of each node's own evidence.
- At w = 1 the (1 − w) b⁽⁰⁾ term vanishes and b⁽ᵗ⁾ = Aᵗ b⁽⁰⁾. On a connected graph with an odd cycle
  this converges to one value, Σⱼ πⱼ b⁽⁰⁾ⱼ with πⱼ = dⱼ / Σ d: the *degree-weighted* mean, which is the
  plain mean only on a regular graph. This is the consensus s3 describes, and it needs w = 1.
- The (1 − w) b⁽⁰⁾ term is therefore what prevents the collapse, not what causes it.

On ph-001 with the starting beliefs of §4.2: under the annotated relations, w = 0.5 settles at a
spread of 0.3924 and w = 0.9 at 0.1105; w = 1 converges to 0.5083, the degree-weighted mean, where the
plain mean is 0.4833. Every value was computed on 2026-09-29, the fixed point by solving
(I − wA) b* = (1 − w) b⁽⁰⁾; the bound held at every t tried.

**IMP itself** (Xu et al. 2017, `imp-2017`) updates GRU hidden states on a node graph and an edge
graph with learned message pooling. The linear rule is a model of what repeated averaging does, and
M5 presents it as that.

---

## 3. Content corrections, before the playgrounds are built

Each in both locales, with the map's matching formula, derivation and note rebuilt from the corrected
MDX and re-harvested, and `FROZEN.md` recording it, as D98 and D106 did. The brief does not carry
these claims (searched 2026-09-29).

- **s2 Implications.** The N = 80, \|P\| = 310 line becomes VG150's figures: \|P\| = 50; an image of
  twelve objects, near the validation mean, gives 132 ordered pairs and 6,600 decisions for about seven
  relations, one decision in a thousand; a detector keeping 80 boxes, a setting rather than a figure
  from a paper, gives 6,320 pairs and 316,000 decisions for the same seven. The slice's 651 of 26,282
  follows. The paragraph's argument stands; "one decision in a hundred thousand" becomes the rate the
  new figures give. The s2 presenter note's N = 80 exercise keeps N = 80 with \|P\| = 50.
- **s3.** The Intuition says that averaging alone drives every node to one belief, and that keeping a
  share of each node's own evidence stops it. The Formal line states the rule with A, its convergence
  for w < 1 and its consensus at w = 1. The Worked step derives the fixed point, the contraction bound,
  and the consensus value at w = 1. The Implications state the complete-graph case, where the fixed
  point is reached in one round and the spread falls once by (1 − w), and say that IMP's update is
  learned and this rule models averaging. The presenter note loses "per step".
- **s6.** The checkpoint asks about the collapse at w = 1 rather than a per-step contraction; its
  presenter note keeps its acceptable answers.
- **s5.** "the committed predictions" becomes "the predictions in `data/predictions/`": nothing under
  `data/` is committed since D109.
- **Symbols.** M5's table gains A and 𝒩(i).

---

## 4. Shared parts

### 4.1 The slice, ordered

`playgrounds/M5/pairs.ts`: the 80 frames of `VG_FRAMES`, ordered by object count and then by image
id as a number, each with N, N(N − 1), its relationship rows, and its related ordered pairs, distinct
(subject, object) with at least one relation. Totals over the slice: 1,348, 26,282, 892 and 651.
Rank 1 is frame `2045` (N = 4, 12 pairs, 2 related), rank 40 frame `547` (N = 16, 240 pairs, 5
related), rank 80 frame `3182` (N = 39, 1,482 pairs, 29 related).

### 4.2 The six beliefs

`playgrounds/M5/beliefs.ts`: ph-001's objects and starting beliefs, designed on paper so that the two
graphs part ways and the degree-weighted mean differs from the plain one at two decimals.

| Object | id | b⁽⁰⁾ | Relation neighbours | Degree |
|---|---|---|---|---|
| table | 1 | 0.9 | box, person, panel, wrench | 4 |
| person | 2 | 0.2 | table, glove, wrench | 3 |
| box | 3 | 0.7 | table | 1 |
| glove | 4 | 0.4 | person | 1 |
| wrench | 5 | 0.1 | person, table | 2 |
| panel | 6 | 0.6 | table | 1 |

Under every pair each object has the other five as neighbours. The relation graph is connected and
has an odd cycle (table, person, wrench), so w = 1 converges on both graphs.

### 4.3 Logic

`logic.ts` gains pure functions, each unit-tested: the related ordered pairs of a frame; the
row-normalised neighbourhood of a graph; one round of the rule; t rounds; the fixed point, by Gaussian
elimination on (I − wA) b = (1 − w) b⁽⁰⁾; the max-norm distance; the spread; and the degree-weighted
mean. Nothing here touches `sgg-metrics`: no metric is computed.

---

## 5. The playgrounds

Parts follow D96, the count set in `PLAYGROUND_PARTS` by measurement at 1024 × 768 in 繁體中文 in the
longest state.

### 5.1 T1, after s2: pairs against relations

A `Slider` over the 80 frames by object count, 1 to 80, default 40 (frame `547`, N = 16, the median). Readouts: N;
N(N − 1) ordered pairs; N(N − 1) · 50 decisions; the frame's relationship rows; its related ordered
pairs, and their share of N(N − 1) as a ratio of counts; and, fixed, the slice's 651 of 26,282. No
photograph: the slice ships no images.

### 5.2 T2, after s3: beliefs under averaging

A two-way `Choice` of neighbourhood (relations, every pair), a `Slider` for w, 0 to 1 in steps of
0.05, default 0.5, and a `Slider` for t, 0 to 40, default 0. Readouts: the six beliefs b⁽ᵗ⁾, each
named with its neighbours; their spread; for w < 1, ‖b⁽ᵗ⁾ − b*‖∞ beside its bound wᵗ‖b⁽⁰⁾ − b*‖∞; for
w = 1, the value the beliefs converge to, Σⱼ πⱼ b⁽⁰⁾ⱼ, beside the plain mean. Beliefs to two
decimals, spread, distance and bound to four.

---

## 6. Testing

**Arithmetic.** Unit tests for each new function; the fixed point is checked against 2,000 rounds of
the rule, and the bound at every t from 0 to 40 for every w on the knob and both graphs.

**Golden cases** in `data/content/playground_golden.json`, each `why` writing out its arithmetic: T1 at
ranks 1, 40 and 80 and the slice totals; T2 at (relations, 0.5, t = 0, 1, 5), (relations, 0.9, 10),
(relations, 1, 40), (every pair, 0.9, 1) and (every pair, 1, 5).

**Structure, in jsdom.** Each component in both locales; no focus on mount; `registry.test.tsx` pins
M5's new step ids.

**Chromium.** `lecture.spec.ts`: each step shows its numbers with no backend; every knob works from
the keyboard and the deck does not advance; the knobs write the address bar. `projector.spec.ts`: the
new steps join the contrast walk and the 18 px floor at all three sizes; each part fits 1024 × 768 in
繁體中文 in its longest state. `perf.spec.ts`: one knob each, sixteen playgrounds measured.

---

## 7. Records and the gate

One deviation, with §2's findings and the corrections; one VERIFICATION section; `FROZEN.md` entries;
CLAUDE.md, INDEX and README updated in the same commit as the run they quote: 16 playgrounds, 12 live
points without one, the step and note counts, the test counts.

Branch `feat/playgrounds-m5`, from `main` at `dfe4dc4`. Before merge: `npm run ci`,
`npm run test:e2e` and `npm run check:perf`, all exit 0, then a review pass.

---

## 8. Out of scope

* T3 to T6, which are `spec`.
* s4's survey of later methods, beyond the one sentence s3 hands it.
* The map's toy playgrounds (D-14); only its formula, derivations and notes are corrected.
* Any recall, mean recall or score in a playground.
* The other twelve live points.

## 9. Open items

None that block the build. The decisions of §1 await the author's review.
