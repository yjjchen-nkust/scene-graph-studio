# Playgrounds for M1: F6, F7 and X1 (design)

The three playgrounds M1 owns, the content corrections that X1 cannot be built without, and the
two contract changes they force. It follows the pattern `2026-09-19-playgrounds-design.md`
established for M0 and changes that pattern only where §6 says so.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and
the M0 playground design. Where this document and those disagree, they win and this one is wrong,
except for the two amendments §6 states and the in-place annotations §3 lists.

---

## 1. Context

`kp.json` marks 27 points `status: 'live'`. M0 built F1 and F2 (and F8, which is `spec`), leaving
25. `assignment.json` gives M1 three of them: **F6** (predicate synonymy), **F7** (the long-tail
distribution) and **X1** (the VG150 splits). M1 teaches them at steps s2 (math), s3 (math) and s4
(prose). M1 also cites F5, which M0 cites too and neither owns; it is not in this cycle.
[**Step ids as of this spec.** The plan's Task 8 renumbered M1 when the playgrounds were mounted:
the three steps are s2, s4 and s6 now, and F6, F7 and X1 are s3, s5 and s7, so §5.2's "after s3"
is after s4 and §5.3's "after s4" is after s6 (D95).]

### Decisions locked with the user, 2026-09-26

| Question | Answer |
|---|---|
| Scope | F6, F7, X1, each a `playground` step after the step that teaches it. M1 goes from 6 steps to 9. |
| The metric boundary | **Kept.** A playground computes a count, a bound or a set membership. F6 does not show mR; F7 does not show R, mR or γ. Both leave the metric to s2's and s3's own formulas and to L2/L3. |
| X1's figures | **Measured where the project holds the file, read from a primary source otherwise**, each figure cited on screen. A figure no source states is shown as "not stated by the source", never estimated. |
| X1's premise | **Corrected in this cycle.** The opened sources contradict M1 s4 as written (§2). s4, kp X1 and the frozen X1 are corrected before X1 is built on them. |
| Branch | `feat/playgrounds-m1`, cut from `fix/sgs-lint-test-gaps`, so D92, the 18 lint tests and the deviation numbering carry forward. |

### What the frozen page did, and why none of it is ported

The frozen page's F6 calls `pg.js evaluate()`, which D-14 forbids, and outputs mR@20. Its F7
computes R and mR from a closed-form model, which is L3's lesson; L3 already has a Zipf-exponent
control over a synthetic corpus and scores R against mR, so a playground doing the same would be
the collision M0 resolved between F2 and L1. Its X1 hard-codes nine split sizes with loose source
labels. §2 shows that three of them are the withdrawn v1 release labelled as current, and that the
ones labelled "Xu et al., CVPR 2017" are not stated in that paper.

---

## 2. What the sources say

Opened on 2026-09-26. Quotations are verbatim.

**Xu et al. 2017, *Scene Graph Generation by Iterative Message Passing*, arXiv 1701.02426, §4,
the "Visual Genome" paragraph (p. 5).** "The original VG scene graph dataset contains 108,077
images with an average of 38 objects and 22 relationships per image." "In this experiment, we use
the most frequent 150 object categories and 50 predicates for evaluation." "We use 70% of the
images for training and the remaining 30% for testing." No validation set and no per-split count
is stated. The same paper, §4.1.1, on Table 2: "many predicates have very similar semantic
meanings, for example, on vs. over and hanging from vs. attached to."

**The `vg150-sgb` dataset card**, `README.md` in the corpus at `raw:vg150-sgb`, published
with the release the project downloaded on 2026-09-16:

* *Changelog:* "the entire train/val pool was placed in `train` with no validation images held
  out, and `val` was actually built from the first ~4,844 images of the *test* pool — i.e. `val`
  was leaked test data, and the true 5,000-image canonical validation set was silently folded into
  `train`. This has been fixed: `val` is now exactly the standard Neural-Motifs /
  Scene-Graph-Benchmark 5,000-image validation set (all with ≥1 annotated relation), disjoint from
  both `train` and `test`, and `test` is the full, untouched test pool."
* *Dataset statistics:* train 68 538 images, val 5 000, test 31 876; zero-relation images kept
  10 815, 0 and 5 430.
* "relation-based training/eval effectively sees 57,723 / 5,000 / 26,446 images, matching the
  canonical VG150 protocol exactly".

**SGG-Benchmark issue #94**, opened 2026-07-15, reports the earlier COCO release at train 73,538,
val 4,844, test 27,032 against the H5 files' 57,723, 5,000 and 26,446. These figures were read
through a summarising fetch; the plan's first task re-reads them verbatim before any enters a data
file (§10).

**`Scene-Graph-Benchmark.pytorch`'s `DATASET.md`** names `VG-SGG-with-attri.h5` and credits Xu and
neural-motifs. It states no split counts.

**Measured here.** `annotations/val-00000-of-00001.parquet` has **5,000 rows**, so the corpus on
disk is the fixed release. The project's `vg150-sgb` slice was cut from it, so the slice is not
drawn from leaked test images. Train and test parquets are not on disk.

### Four findings that follow

1. **M1 s4's premise is not supported.** s4 says the splits "share a name and not a test set", and
   kp X1 says "three distinct (D_train, D_val, D_test)". The card says the fixed release's test is
   "the full, untouched test pool" and its relation-bearing counts match the canonical protocol
   exactly. What the sources support is that releases differ in the validation carve-out, in
   whether images with no relation are kept, and that one published version drew validation
   images from the test pool.
2. **D-09 describes a corpus the project does not have.** It says the project ships "the Xu et al.
   (2017) split as redistributed in `Scene-Graph-Benchmark.pytorch`'s `VG-SGG.h5`", and that
   `MANIFEST.json` carries that h5's SHA-256. The corpus is Maelic's `SGG-Benchmark` COCO parquet;
   the manifest holds per-image hashes, the seed and the distribution mode, and no source-file hash.
   D17 records the parquet layout and does not reconcile D-09.
3. **s4 overstates D-09's enforcement.** It says the short form is forbidden "anywhere in the
   codebase" and that a lint enforces it. Enforcement is the `DatasetId` literal in
   `backend/app/schema.py` and `test_bare_vg150_is_not_a_dataset`; bare VG150 appears in the prose
   of M01, M02, M04, M08 and M09, as the published benchmark's name.
4. **Two of the frozen X1's three rows do not say what they are.** "SGG-Bench" 73,538 / 27,032 /
   4,844 is the withdrawn v1 release, labelled as current. "Xu et al." 75,651 / 32,422 is
   attributed to Xu et al. 2017, which states a 70/30 split and no counts; where those two figures
   come from is not established, and they are not carried.

### The figures reconcile, and that is X1's arithmetic

| Difference | Arithmetic | What the card or issue says it is |
|---|---|---|
| v2 train − canonical train | 68,538 − 57,723 = **10,815** | v2's zero-relation train images kept, 10 815 |
| v2 test − canonical test | 31,876 − 26,446 = **5,430** | v2's zero-relation test images kept, 5 430 |
| v1 train − v2 train | 73,538 − 68,538 = **5,000** | the canonical val "silently folded into `train`" |
| v2 test − v1 test | 31,876 − 27,032 = **4,844** | v1's val, "built from the first ~4,844 images of the *test* pool" |

Nothing here is estimated: every operand is a quoted figure, and every result is either a figure
the same source states independently or a sentence of it.

---

## 3. Content corrections, before X1 is built

Correcting is in scope; extending the frozen page is not (D-13).

**M1 s4, both locales, body and presenter notes.** Draft, to be checked against §2's quotations
when written:

> ## `VG150` names several releases, not one
>
> $$\texttt{VG150}\ \mapsto\ \text{releases } r,\ \text{each with its own }(\mathcal{D}_{\text{train}},\mathcal{D}_{\text{val}},\mathcal{D}_{\text{test}})_r\ \Longrightarrow\ \text{a number is comparable only when its } r \text{ is named}$$
>
> The 150-object, 50-predicate subset of Visual Genome comes from Xu et al. (2017), who state a
> 70/30 split of the images and mention no validation set. Later releases carved a validation set
> out of the training images, kept or dropped the images that carry no relation, and in one
> published version drew the validation set from the test pool. They share a name, and the numbers
> they produce differ for reasons unrelated to any model. A figure beside another in a table is a
> comparison only when both papers say which release they used.
>
> This project names its own: the dataset identifier is `vg150-sgb`, the corrected release of
> Neau et al.'s SGG-Benchmark. Decision D-09 forbids `vg150` as a dataset identifier, and the
> schema refuses it; prose uses VG150 only for the published benchmark's name.

zh-TW, same claims in formal written Chinese with Chinese punctuation:

> ## `VG150` 指涉數個發布版本
>
> （同上之數學式）
>
> Visual Genome 的 150 物件類別、50 predicate 子集源自 Xu 等人（2017）；原論文載明影像以 70／30
> 比例分為訓練與測試，未提及驗證集。其後的發布版本自訓練影像另切驗證集，對不含任何關係的影像或保留
> 或剔除，其中一個已發布版本更曾自測試集抽取驗證集。各版本共用同一名稱，所得數值之差異與模型無關。
> 兩篇論文之數值並列於同一表格，唯有雙方皆載明所採用之發布版本，方構成比較。
>
> 本專案明確命名所採用之版本：資料集識別碼為 `vg150-sgb`，即 Neau 等人 SGG-Benchmark 之修正後發布版本。決策 D-09
> 禁止以 `vg150` 作為資料集識別碼，並由資料結構描述（schema）拒絕之；正文僅於指稱既有基準名稱時使用
> VG150。

Both presenter notes on s4 currently say the releases "do not share a test set"; they are rewritten
to the same claims.

**kp X1.** Its statement and title are harvest output, so they are corrected where the harvest reads
them, in the frozen page, with a `FROZEN.md` entry, and `npm run harvest` regenerates `kp.json`. The
math becomes the display formula above; `title_en` becomes "VG150 names several releases",
`title_zh` 「VG150 指涉數個發布版本」. `knobs` becomes "choose a release · compare it with another ·
watch the images move between splits".

**The frozen X1 playground.** Each figure is replaced by its verified value or removed, and each
source label names its locator. The v1 figures are labelled as the withdrawn v1 release. No option
and no control is added, which is the line between correcting and extending.

**D-09, annotated in place** in the decisions document: the corpus is the `SGG-Benchmark` COCO
parquet, v2, and the manifest never carried an h5 hash. The letters `sgb` fit both
`Scene-Graph-Benchmark.pytorch`, which D-09 names, and `SGG-Benchmark`, which the corpus is; the
annotation states that the identifier denotes the second. The decision itself, one named split and
no bare identifier, stands. SRS §10 hazard 1 and the adapter docstring in `vg150_sgb.py` repeat
"three incompatible splits"; both are brought into line with §2.

**Other modules.** The plan greps M02, M04, M08 and M09 for the same premise. A sentence asserting
it is corrected; a sentence that only uses the name VG150 is left alone.

---

## 4. Data

**F6 and F7 read the committed `vg150-sgb` annotations.** `playgrounds/slice.ts` gains a second
export beside the placeholder one, imported at build time. 80 frames, 892 edges, 36 predicates in
use, 115 object classes in use; 583 KB raw, 34 KB gzipped. No images are needed, so the ignored
image directory does not matter, and both playgrounds compute with no backend, network or corpus.

**X1 reads `data/content/vg150_splits.json`.** Four releases: `xu-2017`, `canonical` (as stated by
the card), `sgb-v1`, `sgb-v2`. Each carries `train`, `val` and `test`, plus `val_from` and
`zero_relation`. Every one of those is a figure object:

An example, with the URL left for the plan to record (§10):

```json
{ "value": 68538, "source": "vg150-sgb card", "url": "<upstream card URL>", "locator": "Dataset statistics",
  "quote": "| train |  68 538 |  730 270 |  405 822 | 10 815 |" }
```

`value` may be a number, a string such as `"70%"` or `"test pool"`, or `null`. A `null` renders as
"not stated by the source" and carries the locator of the passage that does not state it. The
`sgb-v2` val figure also carries `measured`: the command, the parquet's SHA-256, the row count and
the date.

**Rejected: literals in the component with on-screen labels.** A label is a promise nothing checks.
A data file lets §6's rule 12 refuse a figure without its source.

---

## 5. The three playgrounds

Common to all three, inherited from M0 and D91: real form controls only; knob state in the query
string, namespaced by kp; controls above the visual, which carries a max height; type in `em`; ink
at `slate-700` or darker; no focus on mount; nothing computed is a metric.

### 5.1 F6, after s2: Predicate synonymy has no hierarchy

**Knobs.** Two independent checkboxes, the two groups kp F6's own `knobs` field names: merge
{`on`, `above`, `over`, `sitting on`}, and merge {`man`, `person`, `people`}. A frame chooser and a
triplet chooser serve the membership panel. Keys: `F6.mp`, `F6.mo`, `F6.img`, `F6.rel`, `F6.sub`.

**Computes, over the 80-frame slice:**

* predicate classes in use, 36 → 33, with the merged count written out as the sum,
  382 + 11 + 5 + 10 = 408;
* object classes in use, 115 → 113, with 56 + 52 + 19 = 127;
* VG-150's 50 predicates beside the slice's 36, labelled "Xu et al. 2017, §4".

**Membership.** A frame's own triplet, such as one carrying `sitting on`, with a synonym
substituted for its predicate. Keyed on (subject id, predicate, object id) through the merge map,
as F8 keys on the frame's own E: 「此邊未收錄於 E」 before the merge, 「此邊收錄於 E′」 after. Never
correct against wrong. The object merge changes counts only, since membership is keyed on ids.

**On screen.** The checkboxes are independent because the vocabulary has no hierarchy; whether
`above` means `on` is a decision, and two papers deciding differently report numbers that cannot be
compared. The mR consequence is s2's inequality; the playground shows its two inputs, C and n_p̃.

### 5.2 F7, after s3: The long-tail predicate distribution

**Knobs.** s from 0 to 2.4 in steps of 0.05, starting at 1.0 and labelled "a starting value, not a
fit"; C from 4 to 50, starting at the slice's in-use count, computed rather than written; k, the
size of the head, from 1 to C; and a checkbox overlaying the slice's measured distribution, ranked.
Keys: `F7.s`, `F7.C`, `F7.k`, `F7.measured`.

**Computes only ratios of counts.** With H_m^(s) = Σ_{p=1}^{m} p^(−s), the generalized harmonic
number s3 already uses: the head share H_k^(s) / H_C^(s), and the tail-to-head ratio
n_C / n_1 = C^(−s). At s = 0 the head share is exactly k/C.

**Measured beside the model.** The slice's top predicate holds 382 of 892 triplets (42.8%) and its
top three hold 509 (57.1%). Students move s to match by eye. No fitted exponent is printed, since
fitting is estimation and the frozen page's "VG150 sits near s ≈ 1.1" has no source.

γ, R and mR are not shown. The presenter note sends the room to L3, which has the same s control
and scores R against mR.

### 5.3 X1, after s4: VG150 names several releases

**Knobs.** A release, and a release to compare it with, each one of the four in §4. Keys `X1.r`,
`X1.vs`.

**Shows**, for the chosen release: train, val and test; where val is drawn from; whether images with
no relation are kept. Every figure with its source and locator. Xu's row reads 70% and 30% of
108,077 exactly as §4 states them, with counts "not stated by the source". Nowhere does the
playground compute 0.7 × 108,077: that would assert a split size the paper does not assert.

**Computes**, for the compared pair: the per-split difference, only where both figures exist, and
states which sentence of the sources that difference equals, as in §2's reconciliation table. One
set membership: is val disjoint from test? `sgb-v1` no, `sgb-v2` yes, each with its quotation.
[**Amended 2026-09-26 (D95):** "`sgb-v1` no" claims an overlap no source states. The card states
where v1's validation was drawn from, the test pool, and v1's validation and test partition that
pool (27,032 + 4,844 = 31,876). As built, `valPool` returns the pool the source names, and X1
reads "validation drawn from the test pool" for v1 and "validation is disjoint from test" where the
card says so. A sentence explains a difference only on the split it is about, so each note carries
`split`.]

---

## 6. Contract changes

**Rule 9 is amended.** It requires every golden case to carry `image_id`. F7 has no frame and X1
none either. A case now carries exactly one of `image_id` or `scope`, where `scope` is one of
`slice`, `model` or `sources`. Contracts §2.4 and design §2.4 of the M0 document are updated in the
same commit.

**Rule 12 is added.** Every figure in `vg150_splits.json` carries `source`, `locator` and a
non-empty `quote`; a numeric `value`'s digits appear among the quote's digits, which catches a
transcription error mechanically (`68538` against "68 538"); a `null` carries the locator of the
passage that does not state it. [**Amended 2026-09-26 (D94):** as built, a figure also carries
`url`, and a count must equal one whole number of its quote, named by `index` when the quote holds
several, because comparing digits run together passed a figure from the wrong column and one
straddling two numbers. Coded values are checked against their sets, and every release states all
five figures. M0 design §2.4 rule 12 holds the current wording.] [**Amended again, 2026-09-26
(D95):** a share such as Xu's "70%" must appear in its quote as written, and every note names the
split it explains.]

Both rules get fixture tests in `tools/test/content_lint.test.mjs`, and §16's mutation method is run
over all twelve rules. None may be missed.

---

## 7. Testing

**Arithmetic.** `playgrounds/logic.ts` gains pure functions: the merge map and the counts it
yields, membership under a merge, head share, tail ratio, split differences and val–test
disjointness. Each has unit tests. [As built (D95): the pool validation is drawn from, in place of
a disjointness verdict; see §5.3.]

**Golden cases**, each `why` writing out its arithmetic:

| kp | Case | Expect | Arithmetic |
|---|---|---|---|
| F6 | merge the four predicates | C 36 → 33, n = 408 | 382 + 11 + 5 + 10 |
| F6 | merge the three object names | 115 → 113, n = 127 | 56 + 52 + 19 |
| F6 | one frame's `sitting on` edge, `on` substituted | absent, then present | chosen from the slice by the plan |
| F7 | s = 0, C = 36, k = 3 | 3/36 | a flat distribution |
| F7 | s = 1, C = 4, k = 1 | 12/25 | 1 / (1 + 1/2 + 1/3 + 1/4) |
| X1 | v2 test − canonical test | 5,430 | 31,876 − 26,446 |
| X1 | v2 train − canonical train | 10,815 | 68,538 − 57,723 |
| X1 | v1 train − v2 train | 5,000 | 73,538 − 68,538 |
| X1 | v2 test − v1 test | 4,844 | 31,876 − 27,032 |

[**As built, 2026-09-26:** `data/content/playground_golden.json` pins the last pair the other way
round. `pg-X1-v1-v2-test` compares `sgb-v1` with `sgb-v2` and expects a difference of −4,844,
explained by 4,844: X1 matches a negative difference to its note by magnitude (D94). The file
holds thirteen M1 cases, five for F6, three for F7 and five for X1, where this table plans nine;
the fifth X1 case, `pg-X1-xu-canonical-train`, pins Xu's difference as `null`.]

**Structure, in jsdom.** Each component renders its readouts in both locales, and nothing takes
focus on mount. `registry.test.tsx` pins M1's new step ids as it pins M0's.

**Interaction, in Chromium** (M0 design §6.2 still holds):

* `lecture.spec.ts`: each new step shows its computed numbers with no backend running; every knob
  moves its quantity from the keyboard; the deck does not advance.
* `projector.spec.ts`: M1's three playground steps join the contrast walk and the 18 px type floor
  at XGA, WXGA and 1920×1080, with `skipped` asserted empty.
* `perf.spec.ts`: one knob per playground, reported against the two-frame floor and never as a
  clamped zero (D91).
* M1's overflow at XGA is measured per step and recorded, so any addition to D71's list is a
  decision.

---

## 8. Records and the gate

Deviation **D93** for the cycle, including the four findings of §2. VERIFICATION **§17**. A
`FROZEN.md` entry. CLAUDE.md, INDEX and README updated in the same commit as the run they quote:
6 playgrounds, 22 live points remaining, 98 steps, 196 presenter notes, and the new test counts.
An INDEX §6 trap row for finding 2: a binding decision can describe an artefact the project never
obtained, and nothing compares the two.

Before merge: `npm run ci`, `npm run test:e2e` and `npm run check:perf`, all exit 0, then a review
pass. The branch is merged by the user, not by the cycle.

---

## 9. Out of scope

* mR in F6, and R, mR and γ in F7. The metric stays in the lab.
* The frozen page's F7 note and its "s ≈ 1.1". Recorded as not examined.
* A fourth option or any new control on the frozen X1.
* Re-cutting the `vg150-sgb` slice, or adding a source-file hash to its manifest. D-09 is annotated,
  not implemented after the fact.
* Opening Tang's or Neural Motifs' code for the canonical protocol's own statement of its counts.
  The canonical row is attributed to the card, which is where the figures were read.
* The other 22 live points.

---

## 10. Open items

None. Both items this section listed were closed on 2026-09-26, while the plan was written:

* **Issue #94's figures**, read through a summarising fetch at first, were re-read verbatim through
  the GitHub API: `| **Train** | 73,538 | 57,723 |`, `| **Val** | 4,844 | 5,000 |`,
  `| **Test** | 27,032 | 26,446 |`. They match §2. The issue was opened 2026-07-15T14:12:53Z and
  is closed.
* **The card's URL and revision.** `https://huggingface.co/datasets/maelic/VG150-coco-format`,
  revision `ea6fb3a56a0876eee98165ea17792fc6ec8460e6`, last modified 2026-07-16T15:49:20Z. The
  upstream README is byte-identical to the local copy (SHA-256 `6fe84d86…a5f15`), so the card
  quoted in §2 is the card the corpus was published with.
