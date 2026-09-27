# Playgrounds for M3: E1 and E10 (design)

The two live knowledge points M3 owns, and four statements about matching and protocols that the
engine and the primary sources contradict. It follows the M0, M1 and M2 playground designs and
changes no contract rule.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and
the playground designs before this one. Where this document and those disagree, they win and this
one is wrong.

---

## 1. Context

`assignment.json` gives M3 four points: **E1** (the match relation ≃) and **E10** (PredCls, SGCls,
SGDet), both `status: 'live'`, and **E2** (greedy against maximum bipartite assignment) and **E12**
(missing annotations counted as errors), both `status: 'spec'`. M3 teaches E1 at s2 and E10 at s3,
both math steps; L2 at s6 scores one prediction under all three protocols.

### Decisions locked with the user, 2026-09-27

| Question | Answer |
|---|---|
| Scope | **E1 and E10**, each a `playground` step directly after the math step that teaches it. E2 and E12 stay `spec`. |
| M3 s3's claim | **What is forced, against what is observed.** The forced part is a set inclusion of hypothesis spaces; the recall ordering is an observed regularity, cited to a primary-source table (§3). |
| E10 | **Counts and what is given.** What each protocol hands the model, drawn on the photograph, and the size of each protocol's hypothesis space. No recall: L2 scores recall under each protocol. |
| E1 | **Grounded defects.** Five toggles, each injecting one defect into one annotated triplet of `ph-001` and so flipping exactly one conjunct; the conjuncts, the relation, the failure mode and the engine's verdict. |
| The picture | **One shared component**, `PhotoMarks`, taken out of F3 and used by F3, E1 and E10. |
| E1's verdict | **Computed in `playgrounds/logic.ts`**, held to the engine's `classify` by one test, as F3's IoU is held to `boxIou`. |

---

## 2. What the engine and the sources say

Read on 2026-09-27.

**The engine's verdicts.** `packages/sgg-metrics/src/match.ts`, `classify`: a prediction agreeing
with an unused ground truth on subject class, predicate and object class, with both IoUs at least
τ, is `match`; one agreeing on all three classes with some ground truth but failing an IoU is
`localization`; anything else is `spurious`. `VerdictKind` (`types.ts:19`) is `'match' |
'spurious' | 'localization' | 'missed'`, `missed` being assigned to ground truths no prediction
matched.

**No protocol-ordering assertion exists.** The only monotonicity test in the engine is
`test_recall_is_monotone_in_k` (`backend/tests/test_metrics.py:82`), which is about K.

**The observed ordering.** `Scene-Graph-Benchmark.pytorch`, `METRICS.md` at commit
`d05be9f9e52e9b2722dc6dc2f0b8b05b47da38f7` (2020-06-23; identical to `master` on 2026-09-27),
section "Reported Results", table "Recall@K":

| Models | SGGen R@20 | SGGen R@50 | SGGen R@100 | SGCls R@20 | SGCls R@50 | SGCls R@100 | PredCls R@20 | PredCls R@50 | PredCls R@100 |
|---|---|---|---|---|---|---|---|---|---|
| IMP | 18.09 | 25.94 | 31.15 | 34.01 | 37.48 | 38.50 | 54.34 | 61.05 | 63.06 |
| MOTIFS | 25.48 | 32.78 | 37.16 | 35.63 | 38.92 | 39.77 | 58.46 | 65.18 | 67.01 |
| Transformer | 25.55 | 33.04 | 37.40 | 36.87 | 40.18 | 41.02 | 59.06 | 65.55 | 67.29 |
| VCTree | 24.53 | 31.93 | 36.21 | 42.77 | 46.67 | 47.64 | 59.02 | 65.42 | 67.18 |

SGGen is that repository's name for SGDet. Every row satisfies SGGen < SGCls < PredCls at every K.

**The vocabulary.** Xu et al. 2017, §4 (p. 5): "we use the most frequent 150 object categories and
50 predicates for evaluation" (M1 design §2).

### Four findings that follow

1. **M3 s3's Formal line claims more than its argument proves.** "R_SGDet@k ≤ R_SGCls@k ≤
   R_PredCls@k for every model, every fixture" is a statement about each model's measured recall.
   The argument given, that a model can ignore extra input, is about what the protocols allow. Nor
   does the weaker statement "for every model given less input some model given more does at least
   as well" hold without qualification: two ground truths with near-identical boxes and different
   labels leave an SGCls model unable to place a label it could place under SGDet within the same
   K. What is forced is the inclusion of the hypothesis spaces (§3).
2. **The frozen E10's note says the engine asserts the ordering on every fixture.** It does not.
   The frozen E10 obtains its ordering from invented IoU scale factors, 0.88 for SGCls and 0.74
   for SGDet, passed to `pg.js evaluate()`.
3. **M3 s3's Worked block counts |V|² ordered pairs and writes "|H_SGDet| ⊇ |H_SGCls|".** The
   first includes an object paired with itself, where M0 and F1 count |V|(|V| − 1); the second
   relates two numbers with a set symbol. The brief (`web/brief/index.html`) repeats |V|².
4. **M3 s2 writes "two independent failure modes ⇒ four diff colours".** The two halves give four
   combinations and the engine gives them three verdicts: `match`, `localization`, and `spurious`
   for both combinations in which a name is wrong. The fourth colour, `missed`, belongs to the
   ground truth. The diff does not separate "right place, wrong name" from "both wrong".

---

## 3. Content corrections, before the playgrounds are built

Correcting is in scope; extending the frozen page is not (D-13).

**M3 s3, both locales, all four parts.** Let 𝓗 be the set of single-triplet hypotheses
⟨(b_s, c_s), p, (b_o, c_o)⟩ a protocol lets the model output. Draft:

> *Intuition.* The three protocols differ in how much they hand the model, and that difference is
> a fact about sets before it is a fact about any number: whatever PredCls lets a model output,
> SGCls lets it output too, and SGDet more again. The recall ordering that published tables show
> is a regularity observed across models, not a consequence of that inclusion.
>
> *Formal.* $\mathcal{H}_{\text{PredCls}}\subseteq\mathcal{H}_{\text{SGCls}}\subseteq\mathcal{H}_{\text{SGDet}}$
>
> *Worked.* $\lvert\mathcal{H}_{\text{PredCls}}\rvert=\lvert V\rvert(\lvert V\rvert-1)\lvert\mathcal{P}\rvert$,
> $\lvert\mathcal{H}_{\text{SGCls}}\rvert=\lvert V\rvert(\lvert V\rvert-1)\lvert\mathcal{C}\rvert^2\lvert\mathcal{P}\rvert$,
> $\lvert\mathcal{H}_{\text{SGDet}}\rvert=B(B-1)\lvert\mathcal{C}\rvert^2\lvert\mathcal{P}\rvert$, with $B$ the number of
> whole-pixel boxes in the image.
>
> *Implications.* $R_{\text{SGDet}}@k\le R_{\text{SGCls}}@k\le R_{\text{PredCls}}@k$ is observed, not implied: the
> inclusion shrinks the space a model searches and bounds no model's recall. Note that
> $\lvert V\rvert(\lvert V\rvert-1)$ survives under PredCls and SGCls: boxes are given, pairs never are.
> Prose: `Scene-Graph-Benchmark.pytorch` reports the ordering for all four of its reimplemented
> models at every K (MOTIFS at R@50: 32.78 under SGGen, its name for SGDet, 38.92 under SGCls,
> 65.18 under PredCls); across those rows it holds without exception, and it remains a
> measurement of those models. The two paragraphs on `gt_boxes_not_pairs` and on PredCls as the
> case where relation reasoning is measured alone stay, with |V|(|V| − 1).

zh-TW carries the same claims in formal written Chinese, the Intuition's first sentence being
「三種協定之差異在於提供模型之資訊多寡；此差異首先是集合之間的關係，其次才涉及任何數值」. s3's presenter
notes, which tell the presenter to "show why there is none", are rewritten to the same claims.

**M3 s2's Implications, both locales.** The line "Two independent failure modes ⇒ four diff
colours, and three protocols to separate them" becomes the table the engine implements:

$$\begin{array}{c|cc} & \Phi_{\text{loc}} & \neg\Phi_{\text{loc}}\\ \hline \Phi_{\text{cls}} & \texttt{match} & \texttt{localization}\\ \neg\Phi_{\text{cls}} & \texttt{spurious} & \texttt{spurious}\end{array}$$

and the prose says that `missed`, the fourth colour, marks an annotated triplet no prediction
matched, and that a wrong name is `spurious` wherever its box sits.

**The frozen page.** E1's and E10's MATH and DERIV entries in `pg.js` are brought into line with
the corrected steps, and `npm run harvest` regenerates `kp.json`, `math.json` and `deriv.json`.
E10's note loses "and the engine asserts it on every fixture" and states the ordering as observed;
E1's note loses "which is why the diff view uses four colours" for the mapping above. kp E10's
`knobs`, "monotonicity invariant asserted live", describes an assertion that does not exist and
becomes "3-way knob · the hypothesis space counted per protocol". The toy bars of the frozen E10
stay: its note is corrected, its demonstration is the frozen page's own. `FROZEN.md` records all
of it.

**The brief.** "|V|² ordered pairs" becomes |V|(|V| − 1) in both languages, and
`docs/brief.standalone.html` is rebuilt in the same commit.

---

## 4. `PhotoMarks`

F3's overlay becomes `playgrounds/PhotoMarks.tsx`: the placeholder photograph in flow, an `<svg>`
on the frame's own viewBox inside a box only the photograph sizes, and a list of marks, each a box
with `line: 'solid' | 'dashed'`, a stroke colour and a test id, each drawn over a white
under-stroke; optionally one hatched region. The `<img>` carries the frame's width and height, so
the overlay has its aspect ratio before the photograph loads. F3 is refactored onto it with its
tests and the projector's overlay check unchanged. Marks carry no text: a label is HTML beside the
picture, since SVG text is scaled below the 18 px floor while its computed size reads unscaled.

---

## 5. The playgrounds

Common to all: real form controls only; knob state in the query string, namespaced by kp; controls
above the visual; type in `em`; ink at `slate-700` or darker; no focus on mount; nothing computed
is a metric; a playground too tall for 1024 × 768 in 繁體中文 spans parts under D96, and the
measurement is recorded.

### 5.1 E1, after s2: the match relation, one defect at a time

The ground truth t is `ph-001` relationship 1, **box#3 on table#1**: box (250, 240) 90 × 70,
table (60, 300) 420 × 110. τ = 0.5, labelled with Xu et al. 2017 §4. Five toggles, all off to
begin, each a defect in the prediction t̂:

| Key | Defect | Conjunct it falsifies |
|---|---|---|
| `E1.cs` | subject class box → glove | c_ŝ = c_s |
| `E1.co` | object class table → panel | c_ô = c_o |
| `E1.p` | predicate on → near | p̂ = p |
| `E1.bs` | subject box shifted Δx = 45: IoU 3,150 / 9,450 = 0.333 | IoU_s ≥ τ |
| `E1.bo` | object box shifted Δy = 55: IoU 23,100 / 69,300 = 0.333 | IoU_o ≥ τ |

**On screen.** The photograph with t's two boxes solid and t̂'s two dashed; the five conjuncts,
each true or false, the two IoU conjuncts with their quotients; Φ_cls, Φ_loc and t̂ ≃ t; the
failure mode in s2's words (right place, wrong name; right name, wrong place; both); and the
verdict pair the engine's diff gives: `match`, with t matched; `localization`, with t `missed`;
or `spurious`, with t `missed`.

**No collision.** The toggles produce subject ∈ {box, glove}, predicate ∈ {on, near} and object ∈
{table, panel}; of those eight label triples only (box, on, table) is annotated in `ph-001`, so
the verdict against the whole frame equals the verdict against t. A test asserts it.

[**As built, 2026-09-27 (D98):** E1 spans two parts. As one step it ran 229 px past 1024 × 768 with
every toggle on. Part 1 is the defects on the photograph and the five conjuncts; part 2 is Φ_cls and
Φ_loc, the relation, the failure mode and the verdict. Both show the five toggles, since both read
them.]

### 5.2 E10, after s3: what each protocol hands over, as counts

**Knobs.** `E10.pr`, the protocol: PredCls, SGCls or SGDet. `E10.voc`, the vocabulary: this
slice's, |𝒫| = 16 and |𝒞| = 10, counted from `data/slices/placeholder/annotations.json`, or
VG-150's, 50 and 150, labelled with Xu et al. 2017 §4.

**On screen.** The photograph shows what the chosen protocol gives: the six annotated boxes and,
beside the picture, their six labels (PredCls); the boxes and "no labels" (SGCls); the bare
photograph and "no boxes, no labels" (SGDet). Beneath, the three hypothesis-space sizes per
triplet with their formulas, the chosen one marked, and the inclusion between them:

| | PredCls | SGCls | SGDet |
|---|---|---|---|
| formula | \|V\|(\|V\| − 1)\|𝒫\| | \|V\|(\|V\| − 1)\|𝒞\|²\|𝒫\| | B(B − 1)\|𝒞\|²\|𝒫\| |
| this slice | 480 | 48,000 | 897,116,066,370,414,059,520,000 |
| VG-150 | 1,500 | 33,750,000 | 630,784,734,166,697,385,600,000,000 |

B = C(641, 2) · C(481, 2) = 205,120 × 115,440 = 23,679,052,800 whole-pixel boxes in 640 × 480.
The SGDet counts exceed 2^53 and are computed with `BigInt`. PredCls's 480 and 1,500 are F1's.
|V| is given under PredCls and SGCls and not under SGDet, where the model proposes its own boxes.

No recall is shown. The presenter note sends the room to L2 at its step, where the same fixture
is scored under all three protocols.

[**As built, 2026-09-27 (D98):** E10 spans two parts, having run 96 px past as one step: what the
protocol hands over, then the vocabulary and the three counts. The vocabulary labels carry no
count ("This slice", "VG-150 (Xu et al. 2017, §4)"); the computed |V|, |𝒞| and |𝒫| stand on a line
of their own, so regenerating the slice cannot make a label lie. M3 has 11 steps: E1 at s3 and
s4, the protocol step at s5, E10 at s6 and s7, L2 at s10.]

---

## 6. Testing

**Arithmetic.** `logic.ts` gains the five conjuncts and the verdict for one prediction against a
frame, and the three hypothesis-space sizes as `bigint`. Unit tests for each.

**Golden cases**, each `why` writing out its arithmetic: E1 with no defect, each single defect,
the two box defects together, and a name defect with a box defect; E10's six counts. Counts beyond
2^53 are stored as decimal strings.

**The engine.** One test compares E1's verdict with `classify` over all 32 toggle states; one asserts
the no-collision property of §5.1. The source rule stands: nothing in `playgrounds/` outside `test/`
imports a value from `sgg-metrics`.

**Structure, in jsdom.** Both components in both locales; no focus on mount; `PhotoMarks` draws
each mark over its under-stroke; `registry.test.tsx` pins M3's step ids.

**Chromium.** `lecture.spec.ts`: each step shows its numbers with no backend; every knob works from
the keyboard and the deck does not advance; the knobs write the address bar. `projector.spec.ts`:
the new steps join the contrast walk and the 18 px floor at all three sizes; each part fits
1024 × 768 in 繁體中文 in its longest state; the photograph has a size and the overlay coincides
with it. `perf.spec.ts`: one knob each.

---

## 7. Records and the gate

Deviation **D98**, with §2's findings. VERIFICATION **§22**. `FROZEN.md` entries. CLAUDE.md, INDEX
and README updated in the same commit as the run they quote: 9 playgrounds, 19 live points
remaining, the step and note counts, the test counts.

Branch `feat/playgrounds-m3`, from `main` at `9a3b644`. Before merge: `npm run ci`,
`npm run test:e2e` and `npm run check:perf`, all exit 0, then a review pass. The user merges.

---

## 8. Out of scope

* E2 and E12.
* Recall, mean recall or any score in either playground; L2 is unchanged.
* The frozen E10's toy bars and `pg.js evaluate()` (D-14).
* Greedy against maximum matching, which s4 states and E2 would build.
* The other 19 live points.

## 9. Open items

None.
