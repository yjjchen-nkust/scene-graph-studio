# Frozen

This page is frozen as of 2026-09-15 (decision D-13). Its knowledge-point inventory, its `MATH`
map and its `DERIV` map are the seed corpus for the MDX modules under
`system/frontend/src/content/`, harvested by `system/tools/harvest.mjs` into `data/content/`.
Written 2026-09-16 as plan 02 Task 1. `npm run ci` re-runs the harvest and fails if its output
drifts from this page, so the corpus cannot quietly diverge from the source it came out of.

**Do not extend this page.** Content changes belong in `data/content/` and the module corpus. It
is kept for two reasons: it is the only artefact here that runs with no toolchain at all, which
makes it the last-resort offline fallback; and `npm run ci` still gates it through
`tools/audit.js` and `tools/check.js`, so it cannot rot silently.

`audit.js` catches the failure that matters most on this page: a `\\` line break inside display
math but outside an alignment environment is a TeX error, and MathJax renders it as a visible red
message rather than failing loudly.

## `pg.js evaluate()` is not the evaluation engine

`pg.js` contains a function named `evaluate()`. It is a teaching instrument over fifteen
hard-coded prediction rows, and it was deliberately excluded from the harvest (decision D-14). It
matches on string equality against a precomputed per-prediction IoU scalar, carries no protocol
and no constraint mode, and its `Ra` weighting dial is a pedagogical interpolation rather than a
published metric.

The real engine is `backend/app/eval/` and its TypeScript mirror, written test-first from
`METRICS.md` and arXiv 2404.09616. Promoting `evaluate()` would ship something plausible and
wrong, in a way the cross-implementation parity check could not detect — because both sides would
be wrong together.

## Corrections after the freeze

Freezing forbids *extending* this page. It does not forbid correcting a statement that is false:
a frozen artefact that teaches something wrong is worse than one that is merely out of date.
Corrections are listed here so the freeze stays auditable.

### 2026-09-16 — the expert-count claim, and Table 3's shape

Reading the anchor paper against the harvested derivations found two errors, both in content
about IndVisSGG's ablation studies.

**1 · `DERIV.L9` and the L9 playground note overstated the expert-count result.** Both asserted
that *N* = 5 experts is "better on both axes" than *N* = 3. That holds at *k* = 20 only:

| N | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|
| 3 | 23.158 | 16.947 | 28.447 | **25.480** | **30.142** | 27.031 |
| 5 | **23.287** | **17.890** | **28.754** | 24.383 | 30.020 | **27.591** |

At *k* = 50, *N* = 3 leads on mR; at *k* = 100 it leads on R. *N* = 3 is therefore **not
dominated**, and the paper's recommendation rests on more than token cost. Both sites now say so,
in both languages.

**2 · `DERIV.L8` showed Table 3 as a four-row cumulative sequence.** It is a five-row factorial
over (*O*, *P*, *E*&Analysis). The omitted row is *P* alone, and it is the one that makes the
result visible:

| *O* | *P* | *E*&Analysis | R@20 |
|---|---|---|---|
| ✗ | ✗ | ✗ | 0.032 |
| ✓ | ✗ | ✗ | 1.787 |
| ✗ | ✓ | ✗ | **2.079** ← the row that was missing |
| ✓ | ✓ | ✗ | 20.792 |
| ✓ | ✓ | ✓ | 23.040 |

*O* alone gives 1.787 and *P* alone gives 2.079, but together they give 20.792 — an order of
magnitude beyond either. **The effect is superadditive**: constraining one end of the triplet is
nearly worthless, constraining both is transformative. The paper does not remark on this. The
missing row and the observation are now in the derivation.

**Neither error would have been caught by `audit.js` or `check.js`.** Every number involved was
real and correctly transcribed; only the sentences around them were wrong. That is the class of
defect NFR-2 exists for, and it is why the paper-card corpus carries `source_table` on every
figure — so a reader can check the claim against the table, not only the number.

### 2026-09-16 — three false propositions, one misattribution, and the control surface

Found while reviewing the page against its own sources, on the other machine, before the
`sgs/plan-01-eval-engine` branch was merged. The first four are corrections in the sense this
document permits. The fifth is recorded separately because it is closer to the line.

**1 · Proposition 4(b) was false as stated.** It asserted `ngR@k ≥ R@k` and derived it from
`X_k ⊆ X_k^ng`. That containment does not follow from Definitions 6 and 7: at a *shared* top-k
budget, lifting the constraint lets one strong pair spend several slots. Counterexample now in the
page — four pairs scoring `A: 0.90, 0.88, 0.86`, `B: 0.85`, `C: 0.84`, `D: 0.83` give
`X_3 = {A₁,B₁,C₁}` but `X_3^ng = {A₁,A₂,A₃}`, so with ground truth `{B₁,C₁}`, `R@3 = 1` while
`ngR@3 = 0`. The proposition now reads `ngR@(mk) ≥ R@k` with the rank-inflation derivation, and a
callout carries the counterexample. Swept the shipped fixture over `K = 1…15` and `m = 2…10`: zero
violations, so the E7 playground was never wrong — only the general claim was.

**2 · Proposition 5 proved the wrong object.** The derivation argues about the supremum over each
protocol's hypothesis space, then the displayed inequality was written for a specific model's
measured scores, with "a violation means the implementation is wrong, not the model". Three
separately trained systems need not rank in that order. Now stated over `sup`, with a paragraph
separating attainable recall from measured scores, and noting that E10 forces the ordering by
construction — it degrades localization rather than re-running detection — which is why the
assertion is sound *there* and would not be on a published table.

**3 · Proposition 8 contradicted Proposition 4(a).** It said an out-of-vocabulary predicate "is
scored a false positive", three sections after 4(a) states in bold that no precision term exists
anywhere in this literature. Under recall there is no false positive: the spurious triplet consumes
one of the `k` ranked slots and the true triplet it displaced goes unmatched. Both costs land inside
recall. Corrected at four sites — `index.html` §2.11 in both languages, `MATH.L10`, and the `F6`
derivation, which carried the same wording. `DERIV.L10` already had the slot-consumption argument
and needed no change.

**4 · The E11 note misattributed mean Recall.** It claimed the FREQ-beats-everything result was
"published inside the Neural Motifs paper itself in 2018". Mean Recall did not exist in 2018; it was
introduced in 2019, independently by KERN and by VCTree. The note now says Zellers et al. published
the baseline in Neural Motifs (CVPR 2018) where it won on `R@K`, and that mR arrived a year later.
The three figures are kept and now cite their table — Tang et al., **Table 1**
([arXiv 2002.11949](https://arxiv.org/abs/2002.11949)): PredCls `mR@100` of 16.0 for FREQ, 15.3 for
MOTIFS, 10.5 for IMP**+**. Checking that table fixed a second error: the row is IMP+, not IMP. KERN's
own Table 1 gives the same FREQ and Motifs as 15.8 and 14.4, and the note now says so and links to
X1 — two tables, two answers, which is the lesson X1 exists to teach.

**5 · The control surface was not bilingual.** Every control label, option label, readout key, hint
and verdict rendered in English regardless of the toggle, on a page whose README advertised that
"every string exists as `<span lang="en">` and `<span lang="zh">`". Roughly 140 strings. Added a `ZH`
table and `uiT()` in `pg.js`, routed through `buildControls`, the readout renderer and the four
raw-HTML sites that build verdict chips; `tools/audit.js` now fails on any UI string in neither `ZH`
nor a `KEEP` list that enumerates what stays English by design — notation, protocol and split names,
and the VG150 class and predicate vocabulary itself. Also extracted the hard-coded `E5 → E3` branch
in `pgAnchor()` into a named `PG_ALIAS` map so `tools/check.js` can assert that every knowledge point
marked `live` resolves to a playground.

**Whether item 5 is a correction or an extension is a fair question.** It is logged here because
the answer was not obvious: it adds no knowledge point, no playground and no claim — it makes an
existing bilingual promise true in a place it was silently broken — but it does touch ~140 strings
and two renderers, which is more surface than items 1–4 together. It was kept on that reading,
with the user's agreement, on 2026-09-16. If the frozen page is ever re-harvested into
`data/content/`, note that the `ZH` table is UI chrome and not content: it has no counterpart in
the MDX corpus, where i18n parity is enforced by `tools/i18n_parity.mjs` instead.

**Two validator gaps closed at the same time.** `audit.js` declared `const BR = '../web/brief/'`
and never used it, so the brief page — 13 display blocks, 602 inline delimiters — had never been
audited at all; it is now checked by the same routine as the knowledge map. And `check.js` gained
the `live`-flag cross-check described above, verified by deliberately flipping `F8` to `live` and
confirming a non-zero exit. Both validators now exit non-zero on a problem, which neither did before.

### 2026-09-26 — X1's premise, its figures, and its statement

Opened for the M1 playgrounds (`docs/superpowers/specs/2026-09-26-playgrounds-m1-design.md` §2).

**1 · The premise.** The page said three incompatible splits share the name and, in the harvested
statement, "three distinct (D_train, D_val, D_test)". The sources opened do not support that as
worded: the `vg150-sgb` card states that its current release's test is "the full, untouched test
pool" and that its relation-bearing counts match the canonical protocol exactly. What they support
is that releases differ in the validation carve-out and in filtering, and that one published
release drew its validation set from the test pool. Title, knobs and statement are corrected.

**2 · The figures.** "SGG-Bench" 73,538 / 27,032 / 4,844 were the withdrawn v1 release, labelled as
current; they are now the card's current figures, 68,538 / 31,876 / 5,000. "Xu et al." 75,651 /
32,422 are not in Xu et al. 2017, which states 70% / 30% of 108,077 images and no counts; the row
now says so. "Tang" 57,723 / 26,446 / 5,000 stand, attributed to the card that states them.

**3 · The note's four figures** (65.3, 64.6, 31.0, 25.1) are removed. No table in this corpus
verifies them in the role the note gave them.

**4 · The brief.** `web/brief/index.html` item 01 carried the same claim and the same nine figures,
and is corrected by the same rule; `docs/brief.standalone.html` is rebuilt from it.

No option, control or knowledge point was added. One UI string, `not stated`, entered the `ZH` table.

### 2026-09-27 — F3's scale ceiling and its note

Opened for the M2 playground (`docs/superpowers/specs/2026-09-27-playgrounds-m2-design.md` §2).

**1 · The ceiling.** The page printed `Math.min(1, 1/Math.max(s.sc, 1/s.sc))`, which is
min(λ, λ⁻¹). Its `sc` scales width and height alike, so the area ratio is λ² and the ceiling is
min(λ², λ⁻²): at λ = 1.42 the page read 0.704 where the bound is 0.496, contradicting M2 s2, the
module it was harvested into. It now prints `Math.min(s.sc*s.sc, 1/(s.sc*s.sc))`.

**2 · The note.** Both locales said the 0.5 threshold was "never stated in the reference metric
implementation". The sources opened say otherwise: Xu et al. 2017 (arXiv 1701.02426v2, §4,
"Setup", item 3, p. 5) state "at least 0.5 IoU overlap with the ground-truth box";
`Scene-Graph-Benchmark.pytorch`'s `maskrcnn_benchmark/config/defaults.py` line 570 sets
`_C.TEST.RELATION.IOU_THRESHOLD = 0.5`; its `METRICS.md` contains no occurrence of "IoU". The clause
now says that, and the rest of each note is unchanged.

No option, control or knowledge point was added.

### 2026-09-27 — F3's derivation: the √2 boundary made strict

Found by the branch review of the M2 playground (D97). The derivation ended
"λ ≥ √2 ⇒ IoU < ½ at τ = 0.5". The bound it follows from, IoU ≤ λ⁻², is an equality for the
concentric box, so at λ = √2 that box has IoU = ½ exactly, which the formula above it accepts
(accept ⇔ IoU ≥ τ). It now reads "λ > √2 ⇒ IoU < ½". `npm run harvest` carries the change into
`data/content/deriv.json` and `kp.json`; M2 s2 carries the same line in both locales and is
corrected with it. No option, control or knowledge point was added.
