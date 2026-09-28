# Playgrounds for M4: E3, E4, E7, E13 and X2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct M4's statements about constraints, blends and VRD's per-pair count that the engine contradicts, then build E3, E4, E7, E13 and X2 as playground steps directly after the math steps that teach them.

**Architecture:** Each playground is a component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, over the control kit. E3, E4 and E7 share one hand-built ranked list on ph-001 (`playgrounds/M4/ranking.ts`), a `RankedList` and a `PairPhoto` over `PhotoMarks`; E13 reads copies of one mask pair; X2 is arithmetic alone. The arithmetic lives in `playgrounds/logic.ts`, held to the engine's `applyConstraint`, `applyPairing` and `evaluate` by tests. Nothing computed is a metric.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, KaTeX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12.

**Spec:** `docs/superpowers/specs/2026-09-28-playgrounds-m4-design.md`. It builds on the M0 playground design (the step contract), the split design (parts, D96) and the M3 design (`PhotoMarks`, the engine cross-check pattern, D98).

## Global Constraints

- **Branch `feat/playgrounds-m4`**, cut from `main` at `992287e`; the spec is its first commit.
- **Working directory is `scene-graph-studio/system/`.** Every `npm` command runs there. Paths are relative to it unless they start with `../`.
- **A playground computes a count, a bound or a set membership. Never a metric.** No R, mR or R@K is displayed; |G ∩ X_k| is shown as a count. Nothing in `frontend/src/playgrounds/` outside `test/` imports a value from `sgg-metrics`; types are allowed.
- **The ranked list is spec §4.1's table, exactly:** twelve rows, their ranks, pairs, predicates and scores. Its counts are spec §4.1's table; a test that disagrees with that table is the defect, not the table.
- **No figure is recalled.** Every number is computed from ph-001, the ranked list or the copies of §5.4; VRD's 70 predicates are labelled "M4 s8", and K = 100 "the engine's largest cut". [**As built (D106):** "M4 s8" was the VRD step's id before Task 10's renumbering, which made it s15; the label reads "M4 s15" since the records' fix round, and s8 is the step on mR and its weighting identity.]
- **Bilingual parity** (NFR-6); **formal written Chinese** with Chinese punctuation; titles are noun phrases; numbers and technical terms verbatim. Display math is shared by both locales, as M4's already is.
- **Lecture legibility:** type in `em`, never below 18 px; ink `slate-700` or darker; marks differ in shape as well as colour; no text inside an SVG.
- **Knob ids equal their query keys:** `E3.k`, `E3.row`, `E4.mode`, `E4.k`, `E4.row`, `E7.m`, `E7.k`, `E7.row`, `E13.multi`, `E13.d`, `X2.m`. Numbers pass through `snap(value, low, high, step)`; a string knob not among its options falls back to its default.
- **Working-tree files are CRLF** (`core.autocrlf=true`). Never `sed -i` (it strips CR in Git Bash). Edit with the Edit tool or a Node script that keeps CRLF; confirm with `git diff --stat`. `data/content/*.json` is pinned LF.
- **`npm run ci` exits 0 before every commit.** Kill any stale `vite preview` on port 4173 before `test:e2e` or `check:perf`. Commits carry no trailer.

## Review Focus

1. **Knobs the URL invented:** `?E3.k=99`, `?E3.k=abc`, `?E4.mode=foo`, `?E7.m=0`, `?E13.d=9`, `?X2.m=5`. Expected: the nearest valid value or the default (k 12, k 4, graph, m 1, d 5, m 10), never a blank panel or a count past the list. *(Tasks 4 to 8)*
2. **k beyond the constrained pool:** E4 under graph at k = 12 keeps 7. Expected: the cut drawn after the seventh kept row, `E4.truths` 3, and no row past the pool marked in the top k. *(Task 5)*
3. **A row the constraint drops is chosen for the photograph:** `?E4.mode=graph&E4.row=2`. Expected: the pair still drawn, the row struck through in the list, and nothing saying it is in the top k. *(Tasks 3 and 5)*
4. **E13 at d = 1:** Expected: SingleMPO and MultiMPO both admit 1, and g4 is not matched under either, since the one copy says next to. *(Task 7)*
5. **A setting changed on a playground's first part reaches its second:** `E4.mode` set on s6 is the mode s7 counts under. *(Task 11)*

---

### Task 1: The corrections

**Files:**
- Modify: `frontend/src/content/m04.en.mdx`, `frontend/src/content/m04.zh-TW.mdx` (front-matter symbol `C`; s3 Worked and Implications; s4 Worked and Implications; s5 Intuition, Worked, Implications and presenter notes; s6 Implications; s8 Formal, Worked, Implications and presenter notes; s10 L3 paragraph)
- Modify: `web/knowledge-map/pg.js` (MATH X2; DERIV E4, E6, E7, E11, X2; the E7 notes at lines 690–691), `web/knowledge-map/kp-data.js` (X2 knobs), `web/knowledge-map/FROZEN.md`
- Regenerated: `../data/content/kp.json`, `math.json`, `deriv.json`
- Test: `frontend/src/content/test/registry.test.tsx`

**Interfaces:** none produced.

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`, beside M3's corrections test, `it('M4 derives only what the engine and the definitions force')`. Read both M4 locale files and import `math.json` like `deriv.json`, collapse whitespace, and assert, writing each backslash doubled in the TS source:
  - each M4 file contains `k\\ge\\lvert X^{\\mathrm{ng}}\\rvert &\\Rightarrow R@k\\le \\mathrm{ngR}@k`, `R@2=1,\\ \\mathrm{ngR}@2=0`, `\\frac{1}{\\lvert\\mathcal{P}^{\\prime}\\rvert}`, `recall over its ranking is piecewise constant` and `\\text{VRD papers call it } k`;
  - neither contains `X_k\\subseteq X_k^{\\mathrm{ng}}`, `\\cap X_k`, `gap keeps widening`, `The slider moves`, `Both are affine in`, `Proposition 4c`, `for the same reason the protocol ordering holds`, `同一切片上` or `on the same slice`; [**As built (D106):** `\\cap X_k` is narrowed to `\\bigr\\}\\cap X_k`, since s2's correct R@k = |G ∩ X_k| / |G| contains the broader string.]
  - `deriv.E4`, `deriv.E7`, `deriv.E6`, `deriv.E11` and `deriv.X2` contain none of `X_k\\subseteq X_k^{\\mathrm{ng}}`, `\\cap X_k`, `\\frac{1}{C}`, `Both are affine in`, `Proposition 4c`; `math.X2` contains `m=\\lvert`.
  In the same test, render M4's math steps through `getModule('m04', locale)` for both locales and assert no `.katex-error` element.

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL on the first `toContain`.

- [ ] **Step 3: The display math, identical in both files.**
  - **s3 Worked** becomes:

```latex
\begin{aligned}
X &= \{t\in X^{\mathrm{ng}} : \sigma(t)=\max_{p}\sigma(\langle s,p,o\rangle)\} &&\text{the constraint keeps the arg-max per pair}\\
&\Rightarrow X\subseteq X^{\mathrm{ng}} \Rightarrow \mu(G,X)\le\mu(G,X^{\mathrm{ng}}) &&\text{the pools nest}\\
X_k &= \text{top-}k(X),\qquad X_k^{\mathrm{ng}}=\text{top-}k(X^{\mathrm{ng}}) &&\text{each cut from its own pool}\\
k\ge\lvert X^{\mathrm{ng}}\rvert &\Rightarrow R@k\le \mathrm{ngR}@k &&\text{at a smaller } k \text{ either side can be larger}
\end{aligned}
```

  - **s3 Implications**, the `gathered` block: `\text{Over the whole pool the gap is strict whenever a ground-truth predicate is some pair's runner-up.}` / `\\ \text{At } k=2\text{: } (1,2,\text{on},.9),\ (1,2,\text{near},.8),\ (3,4,\text{on},.7) \text{ against } (3,4,\text{on}) \text{ give } R@2=1,\ \mathrm{ngR}@2=0.` / `\\ \text{STTran on Action Genome: PredCls } R@50 = 71.8 \text{ constrained}, \; 99.1 \text{ unconstrained.}`
  - **s4 Worked:** each `C` becomes `\lvert\mathcal{P}^{\prime}\rvert` (four places: `\frac{1}{C}`, `\frac{N}{C}`, `N/C`, `\frac{C}{N}`), and `\text{Definition 9}` becomes `\text{Definition 9, } p\in\mathcal{P}^{\prime}`.
  - **s4 Implications**, first line: `\text{As } \alpha \text{ moves from 1 to 0 in } w_p(\alpha)\propto n_p^{\alpha}, \text{ the weighted mean moves from } R \text{ to } mR.` The second line stays.
  - **s5 Worked** becomes:

```latex
\begin{aligned}
X^{\mathrm{ng}}(m) &= \bigcup_{(s,o)}\bigl\{\text{top-}m\text{ predicates for }(s,o)\bigr\} &&\text{the pool with } m \text{ per pair}\\
m'\ge m &\Rightarrow X^{\mathrm{ng}}(m)\subseteq X^{\mathrm{ng}}(m') &&\text{the pool grows with } m\\
k\ge\lvert X^{\mathrm{ng}}(m')\rvert &\Rightarrow \mathrm{ngR}_m@k\le \mathrm{ngR}_{m'}@k &&\text{at a smaller } k \text{ it need not}
\end{aligned}
```

  - **s5 Implications**, the `gathered` block: `\text{The pool stops growing once } m \text{ reaches the most predicates any pair carries.}` / `\\ \text{A model scoring all } \lvert\mathcal{P}\rvert=50 \text{ predicates per pair grows its pool until } m=50.`
  - **s6 Implications**, the first two lines of the `gathered` block become three: `\text{The blended score is affine in } \lambda\text{; recall over its ranking is piecewise constant.}` / `\\ \text{At } \lambda=0 \text{ the predictor reads no pixels, yet}` / `\\ \operatorname{Cov}(n,\pi)\gg 0 \text{ by construction, so } R \text{ is high and } mR \text{ is near zero.}` The `\\[4pt]` line and the VG150 line stay.
  - **s8 Formal:** `R@K \text{ on VRD depends on } m=\lvert\{p:\langle s,p,o\rangle\in X\}\rvert\in\{1,10,70\},\ \text{usually undeclared}`.
  - **s8 Worked:**

```latex
\begin{aligned}
&R@K \text{ on VRD admits } m \text{ predicates per ordered pair}, \ m\in\{1,10,70\} &&\text{VRD papers call it } k\\
m=1 &\equiv \text{graph constraint} \qquad m=\lvert\mathcal{P}\rvert=70 \equiv \text{no constraint at all}\\
m=70 &\Rightarrow \text{every predicate of every pair is a candidate; the cut at } K \text{ still ranks them}
\end{aligned}
```

  - **s8 Implications**, the `gathered` block: `\text{At } m=70 \text{ no predicate is excluded for its pair; only the cut at } K \text{ excludes a candidate.}` / `\\ \text{Papers routinely omit } m, \text{ so VRD numbers are not comparable across papers by default.}`

- [ ] **Step 4: The prose, per locale.**
  - **Front matter, both files:** the symbol `C` becomes `\\lvert\\mathcal{P}^{\\prime}\\rvert`, gloss_en "number of predicate classes present in the ground truth", gloss_zh 「標準答案中出現之 predicate 類別數」.
  - **s5 Intuition, en:** "No-graph recall is the constraint of step 5 relaxed by degrees rather than switched off: allow $m$ predicates per pair instead of one. Increasing $m$ can only add candidates to the pool, which stops growing once $m$ passes the number of predicates the model scores for any pair. Recall at a fixed $k$ need not rise with it: every runner-up admitted takes a place in the top $k$ from something else."
  - **s5 Intuition, zh-TW:** 「no-graph recall 係將第五節之約束以程度而非開關方式放寬：每一配對容許 $m$ 個 predicate 而非一個。提高 $m$ 僅能增加候選池之內容，且當 $m$ 超過模型對任一配對所評分之 predicate 數量時，候選池即停止增長。然於固定之 $k$，recall 未必隨之上升：每一新納入之次順位 predicate，均占去前 $k$ 名中原屬其他候選之位置。」
  - **s5 presenter notes, en:** "Four minutes. ng-R@k turns the constraint of s5 from a switch into a degree: m predicates per pair instead of one. Raising m can only add candidates, so the pool grows until m passes the most predicates the model scores for any pair; recall at a fixed k need not follow, since each runner-up admitted takes a place in the top k. The next step shows it fall at k = 2. If s5 landed, this one can be compressed."
  - **s5 presenter notes, zh-TW:** 「四分鐘。ng-R@k 將 s5 之約束由開關改為程度：每一配對容許 m 個 predicate。提高 m 僅能增加候選，故候選池隨之增長，直至 m 超過模型對任一配對所評分之 predicate 數量為止；固定 k 時 recall 未必隨之上升，因每一新納入之次順位均占去前 k 名之一席。下一步驟呈現其於 k = 2 時下降之情形。若 s5 已充分說明，此處可壓縮。」
  - **s8 Implications prose, en:** "At the top of that range the rule that excluded a pair's runner-ups is gone: every predicate of every pair is a candidate, and only the cut at $K$ decides which reach the score, by comparing candidates across pairs. A model is therefore still rewarded for scoring the right relation high, though no longer for ranking it first within its pair. Phrase detection, $PR@K$, is a different relaxation: it tests one box around the whole pair instead of one box per object. Nothing here orders the two metrics; as with the protocol ordering of M3, any gap between them is measured, not derived."
  - **s8 Implications prose, zh-TW:** 「於該範圍之上限，原先排除配對內次順位 predicate 之規則已不復存在：每一配對之每一 predicate 均為候選，僅由 $K$ 之截斷決定何者計入分數，而此截斷係跨配對比較各候選。因此模型若將正確關係評分較高，仍可獲益，僅不再要求其於配對內排於首位。phrase detection（$PR@K$）屬另一種放寬：其以涵蓋整個配對之單一框，取代每一物件各自之框進行定位檢驗。此處並未推導兩項指標之大小關係；如同 M3 之協定大小關係，二者之差距為量測所得，而非推導所得。」
  - **s8 presenter notes, en:** "k = 1 is the graph constraint and k = 70 is no constraint at all." becomes "The count is written m here, as in s9, because k is already the rank cutoff; VRD papers call it k. m = 1 is the graph constraint and m = 70 is no constraint at all."
  - **s8 presenter notes, zh-TW:** 「k = 1 等同 graph constraint，k = 70 則等同完全無約束。」 becomes 「此數量於此記為 m，與 s9 相同，因 k 已表示排序截斷位置；VRD 論文稱之為 k。m = 1 等同 graph constraint，m = 70 則等同完全無約束。」
  - **s10, en:** "L3 runs the frequency baseline against the learned models on the same slice, so" becomes "L3 fits the frequency prior to a synthetic long-tailed corpus and blends it with a hand-written visual scorer, so".
  - **s10, zh-TW:** 「L3 則於同一切片上，以頻率基線對照學習式模型，使」 becomes 「L3 則於合成之長尾語料上擬合頻率先驗，並與人工撰寫之視覺評分器混合，使」.

  The step ids named here (s5, s9) are the ids Task 10 gives; write them now so that Task 10 does not touch these notes.

- [ ] **Step 5: The map.**
  - **`pg.js`:** MATH `X2` becomes the new s8 Formal line in `\[ … \]`. DERIV `E4`, `E6`, `E7`, `E11` and `X2` each become the corrected Worked block followed by the corrected Implications block of s3, s4, s5, s6 and s8. Use the page's double-backslash string escaping.
  - **E7 `note_en`:** "— a real model carries fifty, and the gap keeps widening." becomes "— a real model scores fifty per pair, so its pool keeps growing to fifty, though recall at a fixed k need not grow with it."
  - **E7 `note_zh`:** 「——真實模型有五十個，差距會持續擴大。」 becomes 「——真實模型對每一配對評分五十個，候選池會持續增長至五十，但固定 k 之 recall 未必隨之增加。」
  - **`kp-data.js`:** X2's knobs become `knob: m ∈ {1,10,70}, the predicates admitted per pair (VRD's k)`.
  - **`FROZEN.md`:** an entry `### 2026-09-28 — M4's statements about constraints, blends and VRD's per-pair count`, listing spec §2's findings 1 to 5 with the counterexample, and the line "No option, control or knowledge point was added. The map's toy playgrounds are unchanged."

- [ ] **Step 6: Search the brief.** Run `grep -n "ngR\|affine\|Proposition 4\|same slice" web/brief/index.html`. If a line states R@k ≤ ngR@k at a fixed k, monotonicity in m at a fixed k, recall affine in λ, or "Proposition 4c", correct it as above in both languages and run `npm run build:standalone`; otherwise record "the brief states none of them" in the commit message.

- [ ] **Step 7: Verify.** Run `npm run harvest && npx vitest run frontend/src/content && node --test tools/test/harvest.test.mjs && npm run lint:frozen && npm run lint:content && npm run lint:standalone`. Expected: all pass; the harvest still reports 26 formulas and 23 derivations; `git status` shows `kp.json`, `math.json` and `deriv.json` changed. [**As built (D106):** `harvest.test.mjs` is a vitest suite, which `node --test` cannot run; `npm run ci`'s vitest step runs it, 8 tests.]

- [ ] **Step 8: Commit.** `npm run ci`, then stage the files above, then `git commit -m "fix(sgs): M4's constraint inequalities stated for the pool, its blend, its α line and VRD's per-pair count"`.

---

### Task 2: The ranked list and its arithmetic

**Files:**
- Create: `frontend/src/playgrounds/M4/ranking.ts`, `frontend/src/playgrounds/E13/setup.ts`
- Modify: `frontend/src/playgrounds/logic.ts`
- Test: `frontend/src/playgrounds/test/logic.test.ts`

**Interfaces:**
- **`M4/ranking.ts`:**
  - `export const M4_FRAME = 'ph-001'`;
  - `export interface RankedRow { rank: number; subject: number; predicate: string; object: number; score: number }`;
  - `export const M4_RANKING: RankedRow[]`, spec §4.1's twelve rows in rank order, `rank` 1 to 12;
  - `export const M4_CAPS = { graph: 1, semi: 2, none: Infinity } as const`, `semi` being the engine's default cap (`index.ts:58`);
  - `export const M4_K_MAX = 12`.
- **`E13/setup.ts`:**
  - `export interface MaskRow { subject: number; object: number; masks: string; predicate: string; score: number }`;
  - `export const E13_COPIES: { predicate: string; score: number }[]`: next to 0.90, holding 0.88, near 0.70, attached to 0.60, in front of 0.50;
  - `export function e13Copies(d: number): MaskRow[]`: copy 1 on objects 2 → 5, copy i ≥ 2 on objects `10 + i` → `20 + i`, every `masks` equal to `'2|5'`, the i-th predicate and score;
  - `export const VRD_PREDICATES = 70`, with a doc comment "as M4 s8 states", and `export const VRD_CUT = 100`, "the engine's largest cut". [**As built (D106):** the comment reads "as M4 s15 states", the VRD step's id after Task 10.]
- **`logic.ts`:**
  - `byScore<T extends { score: number }>(rows: T[]): T[]`, score descending, equal scores in input order;
  - `capPerPair<T extends { subject: number; object: number }>(ranked: T[], cap: number): T[]`, at most `cap` rows per ordered pair, in order;
  - `topK<T>(pool: T[], k: number): T[]`;
  - `matchedTruths(top: { subject: number; predicate: string; object: number }[], truths: SGRelationship[]): number[]`, the `relationship_id`s whose subject id, object id and predicate agree with some row, ascending;
  - `admitByMask<T extends { masks: string }>(ranked: T[], multi: boolean): T[]`, the first row per `masks` under SingleMPO, all under MultiMPO;
  - `matchedByMask(rows: MaskRow[], truths: SGRelationship[]): number[]`, a truth matched when `${subject_id}|${object_id}` equals a row's `masks` and the predicates agree. X2 uses the existing `candidateSpace(6, Math.min(m, VRD_PREDICATES), true)`.
  - [**As built (D106):** `matchedByMask` takes `{ masks: string; predicate: string }[]`, since an existing test forbids `logic.ts` to import a playground module; and `matchedRanks(top, truths): Set<number>`, the ranks a top k matches, was added in Task 4's review, sharing `matchedTruths`'s rule.]

- [ ] **Step 1: Write the failing tests** in `logic.test.ts`:

```ts
describe('M4: one ranked list, capped and cut', () => {
  const frame = frameById(M4_FRAME)!;
  const ranked = byScore(M4_RANKING);
  const counts = (cap: number) => Array.from({ length: 12 }, (_, i) =>
    matchedTruths(topK(capPerPair(ranked, cap), i + 1), frame.relationships).length);
  it('ranks the twelve by score', () => {
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('keeps 7, 11 and 12 under caps 1, 2 and 3 and any cap above', () => {
    expect([1, 2, 3, 10, Infinity].map((c) => capPerPair(ranked, c).length)).toEqual([7, 11, 12, 12, 12]);
  });
  it('counts the ground truths of spec §4.1 at every k', () => {
    expect(counts(1)).toEqual([1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(counts(2)).toEqual([1, 1, 2, 2, 3, 4, 4, 4, 5, 5, 5, 5]);
    expect(counts(3)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(counts(Infinity)).toEqual(counts(3));
  });
  it('names what it matches', () => {
    expect(matchedTruths(topK(capPerPair(ranked, 1), 2), frame.relationships)).toEqual([1, 4]);
    expect(matchedTruths(topK(capPerPair(ranked, Infinity), 12), frame.relationships)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('E13: copies of one mask pair', () => {
  const frame = frameById(M4_FRAME)!;
  it('SingleMPO admits one copy, MultiMPO every copy', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(admitByMask(e13Copies(d), false)).toHaveLength(1);
      expect(admitByMask(e13Copies(d), true)).toHaveLength(d);
    }
  });
  it('the graph constraint keeps every admitted copy', () => {
    expect(capPerPair(admitByMask(e13Copies(5), true), 1)).toHaveLength(5);
  });
  it('matches person holding wrench only once the second copy is admitted', () => {
    expect(matchedByMask(admitByMask(e13Copies(5), false), frame.relationships)).toEqual([]);
    expect(matchedByMask(admitByMask(e13Copies(1), true), frame.relationships)).toEqual([]);
    expect(matchedByMask(admitByMask(e13Copies(2), true), frame.relationships)).toEqual([4]);
  });
});

describe('X2: VRD per-pair count on ph-001', () => {
  it('pools 30, 300 and 2,100 candidates', () => {
    expect([1, 10, 70].map((m) => candidateSpace(6, Math.min(m, VRD_PREDICATES), true))).toEqual([30, 300, 2100]);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: FAIL at import.

- [ ] **Step 3: Implement** the two setup files and the six functions with the signatures above.

- [ ] **Step 4: Write the engine checks** in `logic.test.ts`, importing `applyConstraint`, `applyPairing`, `encodeCounts`, `evaluate`, `rank` and `toTriplets` from `sgg-metrics`. Build the prediction graph as ph-001 with `relationships` from `M4_RANKING` (`relationship_id` = `rank`), `provenance: { kind: 'model', fidelity: 'reconstructed', model: 'm4' }`:
  - `the cap agrees with applyConstraint at every cap from 1 to 10`: `applyConstraint(rank(toTriplets(pred)), cap === 1 ? 'graph' : 'semi', cap)` and `capPerPair(byScore(M4_RANKING), cap)` list the same relationship ids and ranks; and `'none'` against `Infinity`;
  - `the counts agree with evaluate at every k and cap`: for caps 1, 2, 3 and `'none'`, `evaluate({ gt: frame, pred, protocol: 'predcls', constraint, semi_constraint_max_per_pair: cap, k: [1, …, 12], iou_thresh: 0.5, mask_pairing: 'single_mpo' })` gives R@k × 6 equal to `counts(cap)[k − 1]`, compared after `Math.round`;
  - `E13's admission agrees with applyPairing`: give every ph-001 object a mask `{ counts: encodeCounts([id, 1, 15 − id]), size: [4, 4] }`, each copy's objects the masks of objects 2 and 5, and assert that `applyPairing(rank(toTriplets(pred)), mode)` has length `admitByMask(e13Copies(d), mode === 'multi_mpo').length` for d 1 to 5 and both modes, and that `evaluate(...)` with `constraint: 'graph'` gives `matched_count` equal to `matchedByMask(...).length`.

- [ ] **Step 5: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit.** `npm run ci`, then `git commit -m "feat(sgs): M4's ranked list on ph-001, capped and cut, and E13's copies, held to the engine"`.

---

### Task 3: `RankedList` and `PairPhoto`

**Files:**
- Create: `frontend/src/playgrounds/M4/RankedList.tsx`, `frontend/src/playgrounds/M4/PairPhoto.tsx`, `frontend/src/playgrounds/M4/test/RankedList.test.tsx`
- Modify: `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`

**Interfaces:**
- Consumes: Task 2's `RankedRow`, `M4_RANKING`, `M4_FRAME`; `PhotoMarks`, `MARK_ANNOTATED`.
- Produces:
  - `export function RankedList({ rows, kept, k, chosen, matched, testid }: { rows: RankedRow[]; kept: RankedRow[]; k: number; chosen: number; matched: Set<number>; testid: string })`. Each row `${testid}-row-${rank}` carries `data-kept`, `data-top` (in the first k of `kept`) and `data-matched` (`"true"|"false"`); a dropped row is struck through; a matched row carries a ✓ in its own cell; the chosen row is outlined and carries `aria-current="true"`. The cut `${testid}-cut` is a rule after the k-th kept row, or after the last kept row when k exceeds the pool, labelled `playground.m4.cut`. `matched` holds ranks.
  - `export function PairPhoto({ row, testid }: { row: RankedRow; testid: string })`: `PhotoMarks` on `M4_FRAME`, maxVh 34, solid marks `${testid}-s` and `${testid}-o` on the subject's and object's boxes, badges `#s` and `#o`, alt from `playground.m4.picture`.

**Copy** (key: en / zh-TW):

| Key | en | zh-TW |
|---|---|---|
| `playground.m4.k` | k, the cut | 截斷位置 k |
| `playground.m4.row` | Row shown | 顯示之列 |
| `playground.m4.list` | The ranked list on ph-001, PredCls, scores descending | ph-001 之排序清單（PredCls，依分數遞減） |
| `playground.m4.cut` | top {k} | 前 {k} 名 |
| `playground.m4.legend` | Struck through: dropped by the constraint. ✓: a ground truth matched in the top k. | 刪除線：遭約束排除。✓：前 k 名中命中之標準答案。 |
| `playground.m4.picture` | Row {row} on ph-001, its subject and object | ph-001 第 {row} 列之主詞與受詞 |
| `playground.m4.truths` | Ground truths matched in the top k | 前 k 名命中之標準答案數 |
| `playground.m4.truths_note` | of the 6 annotated: {ids} | 共 6 筆標註：{ids} |
| `playground.m4.none` | none | 無 |
| `playground.m4.to_l2` | Recall, this count over 6, is L2's to score. | recall 即此數除以 6，其計分屬 L2。 |

- [ ] **Step 1: Write the failing tests** in `RankedList.test.tsx`, rendered with `setLocale('en')`:
  - `draws twelve rows in rank order`;
  - `puts the cut after the k-th kept row`: kept = `capPerPair(M4_RANKING, 1)`, k = 2: the cut follows `…-row-3`, and rows 1 and 3 have `data-top="true"`, row 2 `data-kept="false"`;
  - `puts the cut after the last kept row when k passes the pool`: k = 12 under cap 1, the cut follows row 12's position among kept rows, row 12 kept, no dropped row `data-top="true"`;
  - `marks a matched row by a sign, not by colour alone`: row 1 in `matched` contains `✓`;
  - `outlines the chosen row, even a dropped one`: chosen 2 under cap 1 has `aria-current="true"` and `data-kept="false"` (Review Focus 3);
  - `PairPhoto draws the chosen row's two boxes`: row 1 gives marks on person #2 and wrench #5 with badges `#2` and `#5`;
  - `reads in 繁體中文`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/M4`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** both components and add the keys to both locale tables. Rows are a `<table>` of text; the ✓ and the strike-through are text and CSS, not SVG.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds/M4 && npm run lint:i18n`. Expected: PASS and exit 0.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): the ranked list and the pair on the photograph, shared by E3, E4 and E7"`.

---

### Task 4: E3, the top k

**Files:**
- Create: `frontend/src/playgrounds/E3/TopK.tsx`, `frontend/src/playgrounds/E3/test/TopK.test.tsx`
- Modify: `mounts.tsx` (`E3: TopK`, `PLAYGROUND_PARTS.E3 = 2`), `test/Playground.test.tsx` (pinned ids gain `'E3'`), both locale tables
- [**As built (D106):** registration of all five, here and in Tasks 5 to 8, moved to Task 10, which inserts their steps in the same commit: `KnowledgeIndex.test` requires every registered playground to have a lecture step, and E3 registered alone failed 1 test of 943. Tasks 4 to 8 test their components by direct mount, and Task 9 ran after Task 10, since content-lint rule 11 refuses a golden case for an unregistered playground.]

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces: `export function TopK({ part }: PlaygroundProps = {})`. Knobs `E3.k` (1–12, default 4) and `E3.row` (1–12, default 1), under the graph constraint. Part 1: the controls and `PairPhoto` (`e3-pair`); part 2: `E3.k` and `RankedList` (`e3-list`) with the readouts `E3.in_top` and `E3.truths`, and the line `playground.m4.to_l2`. No part: both.

**Copy:**

| Key | en | zh-TW |
|---|---|---|
| `playground.e3.in_top` | Predictions in the top k | 前 k 名之預測數 |
| `playground.e3.in_top_note` | min(k, 7): the graph constraint keeps 7 of 12 | min(k, 7)：graph constraint 保留 12 筆中之 7 筆 |

- [ ] **Step 1: Write the failing tests** in `TopK.test.tsx`, with `renderAt(url)` in a `MemoryRouter`:
  - `opens at k = 4: four predictions, three ground truths, g1, g4 and g5`;
  - `never lets the count fall as k rises` (k 1 to 12: `E3.truths` 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3);
  - `holds seven predictions from k = 7`;
  - `a k the URL invented is snapped or defaulted` (`?E3.k=99` → 12, `?E3.k=abc` → 4) (Review Focus 1);
  - `the photograph follows the row` (`?E3.row=10`: marks on person #2 and glove #4);
  - `shows no recall`: the rendered text contains no `R@` and no decimal point in any readout value;
  - `part 1 holds the photograph and part 2 the list`;
  - `reads in 繁體中文`; `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement**, register, pin, and add the keys.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E3, the top k of one ranked list, counted"`.

---

### Task 5: E4, what each mode keeps

**Files:**
- Create: `frontend/src/playgrounds/E4/ConstraintModes.tsx`, `frontend/src/playgrounds/E4/test/ConstraintModes.test.tsx`
- Modify: `mounts.tsx` (`E4: ConstraintModes`, `PLAYGROUND_PARTS.E4 = 2`), `Playground.test.tsx`, both locale tables

**Interfaces:**
- Produces: `export function ConstraintModes({ part }: PlaygroundProps = {})`. Knobs `E4.mode` (`graph`, `semi`, `none`; default `graph`), `E4.k` (1–12, default 2), `E4.row` (1–12, default 1). Part 1: the mode, the row and `PairPhoto` (`e4-pair`); part 2: the mode, k, `RankedList` (`e4-list`) and the readouts `E4.pool`, `E4.truths`, `E4.truths_none`. No part: both.

**Copy:**

| Key | en | zh-TW |
|---|---|---|
| `playground.e4.mode` | Constraint | 約束模式 |
| `playground.e4.graph` | graph, 1 per pair | graph，每一配對 1 個 |
| `playground.e4.semi` | semi, 2 per pair | semi，每一配對 2 個 |
| `playground.e4.none` | none | none，不設上限 |
| `playground.e4.pool` | Pool the mode keeps | 該模式保留之候選數 |
| `playground.e4.pool_note` | of 12 predictions | 共 12 筆預測 |
| `playground.e4.truths_none` | Matched under none, same k | 相同 k 下 none 之命中數 |

- [ ] **Step 1: Write the failing tests:**
  - `opens at graph, k = 2: pool 7, two matched, one under none` (spec §5.2);
  - `semi at k = 6 finds four, where graph and none find three`;
  - `at k = 12 the pools order the counts: 3, 5, 5` (graph, semi, none);
  - `under graph at k = 12 the cut follows the seventh kept row` (Review Focus 2);
  - `a mode the URL invented is graph` (`?E4.mode=foo`);
  - `a dropped row can be shown` (`?E4.row=2`: `e4-pair` drawn, `e4-list-row-2` struck and `data-top="false"`) (Review Focus 3);
  - `reads in 繁體中文`; `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**, register, pin, and add the keys. `E4.truths_none` counts `topK(capPerPair(ranked, Infinity), k)`.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E4, what graph, semi and none keep, and what reaches the top k"`.

---

### Task 6: E7, predicates admitted per pair

**Files:**
- Create: `frontend/src/playgrounds/E7/PerPairCap.tsx`, `frontend/src/playgrounds/E7/test/PerPairCap.test.tsx`
- [**As built (D106):** first, `frontend/src/playgrounds/M4/truths.ts`, the matched-truths note E3 and E4 each carried, shared by E3, E4 and E7 (`2db3f6f`).]
- Modify: `mounts.tsx` (`E7: PerPairCap`, `PLAYGROUND_PARTS.E7 = 2`), `Playground.test.tsx`, both locale tables

**Interfaces:**
- Produces: `export function PerPairCap({ part }: PlaygroundProps = {})`. Knobs `E7.m` (1–10, default 1), `E7.k` (1–12, default 2), `E7.row` (1–12, default 1). Part 1: m, the row and `PairPhoto` (`e7-pair`); part 2: m, k, `RankedList` (`e7-list`) and the readouts `E7.pool` and `E7.truths`. No part: both.

**Copy:**

| Key | en | zh-TW |
|---|---|---|
| `playground.e7.m` | m, predicates per pair | 每一配對之 predicate 數 m |
| `playground.e7.pool` | Pool with m per pair | 每一配對 m 個時之候選數 |
| `playground.e7.pool_note` | 7, 11, then 12 from m = 3, where it stops growing | 7、11，自 m = 3 起為 12 且不再增長 |

- [ ] **Step 1: Write the failing tests:**
  - `the pool grows 7, 11, 12 and stops` (m 1 to 10);
  - `at k = 2 the count falls from 2 to 1 as m rises from 1 to 2`;
  - `at k = 12 it rises from 3 to 5`;
  - `an m the URL invented is snapped` (`?E7.m=0` → 1, `?E7.m=99` → 10);
  - `reads in 繁體中文`; `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**, register, pin, and add the keys.

- [ ] **Step 4: Run them and confirm they pass.**

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E7, the pool per pair grows while the count at a fixed k need not"`.

---

### Task 7: E13, predictions admitted at one mask pair

**Files:**
- Create: `frontend/src/playgrounds/E13/MaskPairing.tsx`, `frontend/src/playgrounds/E13/test/MaskPairing.test.tsx`
- Modify: `mounts.tsx` (`E13: MaskPairing`, one part), `Playground.test.tsx`, both locale tables

**Interfaces:**
- Produces: `export function MaskPairing(_: PlaygroundProps = {})`. Knobs `E13.multi` (toggle, default off, read with `flag`) and `E13.d` (1–5, default 3). A list `e13-copies` of the d copies with each row's `data-admitted`; readouts `E13.emitted`, `E13.admitted`, `E13.kept`, `E13.g4`; the line `playground.e13.masks`. No photograph; `clip={false}`.

**Copy:**

| Key | en | zh-TW |
|---|---|---|
| `playground.e13.multi` | MultiMPO (off: SingleMPO) | MultiMPO（未勾選：SingleMPO） |
| `playground.e13.d` | d, copies of one mask pair | 同一遮罩配對之複本數 d |
| `playground.e13.list` | Copies of the person–wrench mask pair, scores descending | person–wrench 遮罩配對之複本（依分數遞減） |
| `playground.e13.emitted` | Predictions emitted | 輸出之預測數 |
| `playground.e13.admitted` | Admitted by the pairing | 遮罩配對規則接納之數 |
| `playground.e13.admitted_note` | SingleMPO keeps 1 per mask pair; MultiMPO keeps all | SingleMPO 每一遮罩配對保留 1 筆；MultiMPO 全數保留 |
| `playground.e13.kept` | Kept by the graph constraint | graph constraint 保留之數 |
| `playground.e13.kept_note` | each copy is its own pair of object ids | 每一複本各為一組物件編號配對 |
| `playground.e13.g4` | person holding wrench matched | person holding wrench 是否命中 |
| `playground.e13.yes` | yes | 是 |
| `playground.e13.no` | no | 否 |
| `playground.e13.masks` | Masks are identities here: each copy carries its original's mask. | 此處遮罩以識別碼表示：每一複本沿用原物件之遮罩。 |

[**As built (D106):** the review added `playground.e13.g4_note`, "kept: {predicates}; g4 is person holding wrench" / 「保留：{predicates}；g4 為 person holding wrench」, since a note reading "g4" carried no arithmetic.]

- [ ] **Step 1: Write the failing tests:**
  - `opens at SingleMPO, d = 3: 3 emitted, 1 admitted, 1 kept, not matched`;
  - `MultiMPO at d = 3 admits and keeps 3 and matches g4`;
  - `at d = 1 neither pairing matches g4` (Review Focus 4);
  - `a d the URL invented is snapped` (`?E13.d=9` → 5);
  - `reads in 繁體中文`; `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**, register (no `PLAYGROUND_PARTS` entry), pin, and add the keys.

- [ ] **Step 4: Run them and confirm they pass.**

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E13, what SingleMPO and MultiMPO admit at one mask pair"`.

---

### Task 8: X2, VRD's per-pair count

**Files:**
- Create: `frontend/src/playgrounds/X2/VrdPerPair.tsx`, `frontend/src/playgrounds/X2/test/VrdPerPair.test.tsx`
- Modify: `mounts.tsx` (`X2: VrdPerPair`, one part), `Playground.test.tsx`, both locale tables

**Interfaces:**
- Produces: `export function VrdPerPair(_: PlaygroundProps = {})`. Knob `X2.m` (`Choice` of `1`, `10`, `70`; default `10`). Readouts `X2.pairs` (30), `X2.pool` (30 · min(m, 70)), `X2.share` (min(m, 100)), `X2.cut`. `clip={false}`.

**Copy:**

| Key | en | zh-TW |
|---|---|---|
| `playground.x2.m` | m, predicates per pair (VRD's k) | 每一配對之 predicate 數 m（VRD 稱 k） |
| `playground.x2.pairs` | Ordered pairs of ph-001's 6 objects | ph-001 六個物件之有序配對數 |
| `playground.x2.pairs_note` | 6 × 5 | 6 × 5 |
| `playground.x2.pool` | Candidates | 候選數 |
| `playground.x2.pool_note` | 30 × min(m, 70); 70 predicates, M4 s8 | 30 × min(m, 70)；70 個 predicate，見 M4 s8 |
| `playground.x2.share` | Most of the top 100 one pair can take | 單一配對至多可占前 100 名之數量 |
| `playground.x2.share_note` | min(m, 100); K = 100, the engine's largest cut | min(m, 100)；K = 100 為引擎之最大截斷值 |
| `playground.x2.cut` | Does the cut at 100 select? | 截斷於 100 是否發揮篩選作用 |
| `playground.x2.cut_yes` | yes: {pool} candidates for 100 places | 是：{pool} 個候選競逐 100 個名次 |
| `playground.x2.cut_no` | no: all {pool} candidates fit in 100 | 否：{pool} 個候選均在 100 名以內 |

[**As built (D106):** the table gives `X2.cut` no note; it carries `pool > 100` in both locales, written in the component. `playground.x2.pool_note` reads "M4 s15" / 「見 M4 s15」 in place of "M4 s8", the VRD step's id after Task 10's renumbering.]

- [ ] **Step 1: Write the failing tests:**
  - `opens at m = 10: 30 pairs, 300 candidates, 10 per pair, the cut selects`;
  - `m = 1: 30 candidates, the cut does not select`;
  - `m = 70: 2,100 candidates, 70 per pair`;
  - `an m the URL invented is 10` (`?X2.m=5`);
  - `reads in 繁體中文`; `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Implement**, register, pin, and add the keys. Print counts with `toLocaleString('en-US')`.

- [ ] **Step 4: Run them and confirm they pass.**

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): X2, VRD's per-pair count as the candidates it admits"`.

---

### Task 9: The golden cases

**Files:**
- Modify: `../data/content/playground_golden.json`, `frontend/src/playgrounds/test/golden.test.ts`

- [ ] **Step 1: Add the 22 cases of spec §6**, each with `image_id: "ph-001"` and a `why` writing out its arithmetic, ids `pg-E3-k1` … `pg-X2-m70`:
  - E3, knobs `{ k }`, expect `{ in_top, matched, truths }`: k 1 → 1, 1, `"4"`; k 2 → 2, 2, `"1,4"`; k 4 → 4, 3, `"1,4,5"`; k 7 → 7, 3, `"1,4,5"`; k 12 → 7, 3, `"1,4,5"`.
  - E4, knobs `{ mode, k }`, expect `{ pool, matched, matched_none }`: (graph, 2) → 7, 2, 1; (none, 2) → 12, 1, 1; (semi, 6) → 11, 4, 3; (graph, 12) → 7, 3, 5; (none, 12) → 12, 5, 5.
  - E7, knobs `{ m, k }`, expect `{ pool, matched }`: (1, 2) → 7, 2; (2, 2) → 11, 1; (1, 12) → 7, 3; (2, 12) → 11, 5; (10, 12) → 12, 5.
  - E13, knobs `{ multi, d }`, expect `{ emitted, admitted, kept, g4 }`: (false, 3) → 3, 1, 1, false; (true, 1) → 1, 1, 1, false; (true, 2) → 2, 2, 2, true; (true, 5) → 5, 5, 5, true.
  - X2, knobs `{ m }`, expect `{ pairs, pool, share, cut }`: 1 → 30, 30, 1, false; 10 → 30, 300, 10, true; 70 → 30, 2100, 70, true.

- [ ] **Step 2: Run the golden test and confirm it fails.** Run `npx vitest run frontend/src/playgrounds/test/golden.test.ts`. Expected: FAIL on `every case is run by exactly one block`.

- [ ] **Step 3: Add the blocks** `E3`, `E4`, `E7`, `E13`, `X2` to `RUNS`, each computing its expectation through Task 2's functions.

- [ ] **Step 4: Run it and confirm it passes**, then `npm run lint:content`. Expected: PASS; content lint reports 64 playground cases.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "test(sgs): M4's playground counts pinned by hand-computed golden cases"`.

---

### Task 10: M4 gains its playground steps

**Files:**
- Modify: `frontend/src/content/m04.en.mdx`, `frontend/src/content/m04.zh-TW.mdx`, `frontend/src/content/test/registry.test.tsx`, `e2e/projector.spec.ts` (the widest-mathematics loop)

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`, `it('M4 carries E3, E4, E7, E13 and X2 directly after the steps that teach them')`, in M3's form, expecting: `s1:prose`, `s2:math`, `s3:playground/E3.1`, `s4:playground/E3.2`, `s5:math`, `s6:playground/E4.1`, `s7:playground/E4.2`, `s8:math`, `s9:math`, `s10:playground/E7.1`, `s11:playground/E7.2`, `s12:math`, `s13:math`, `s14:playground/E13`, `s15:math`, `s16:playground/X2`, `s17:prose`, `s18:lab`, `s19:checkpoint`.

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Renumber and insert**, in both files, front matter and body alike. The old s3 to s11 become s5, s8, s9, s12, s13, s15, s17, s18, s19. Each new step has `kind: playground`, its `kp`, its `part` where it has two, `seconds_budget: 90`, presenter notes in both locales naming the setting to show and the number it gives (for E4: "at k = 2, graph finds 2 and none 1"), and a body of one noun-phrase heading and the tag, as M3's are. Headings:
  - E3.1 "One ranked list, one pair at a time" / 「單一排序清單之逐列配對」; E3.2 "The top k, counted" / 「前 k 名之計數」;
  - E4.1 "What each mode keeps" / 「各約束模式之保留內容」; E4.2 "The top k of each pool" / 「各候選池之前 k 名」;
  - E7.1 "Predicates admitted per pair" / 「每一配對容許之 predicate 數」; E7.2 "The pool and the top k" / 「候選池與前 k 名」;
  - E13 "Copies of one mask pair" / 「同一遮罩配對之複本」; X2 "VRD's per-pair count" / 「VRD 之每配對數量」.
  Cross-references move with the ids: the s5 Intuition's "step 5" and 「第五節」 are already right from Task 1; the lab's notes' "s6" becomes "s12"; the checkpoint's "s9" becomes "s17", in both locales. [**As built (D106):** the em dashes already in those two notes stay, since only their ids were to change.]

- [ ] **Step 4: The widest-mathematics loop.** In `e2e/projector.spec.ts`, `for (const step of [0, 1, 2, 3])` on m04 becomes `[0, 1, 4, 7]`, so it still reads M4's widest mathematics.

- [ ] **Step 5: Run it and confirm it passes.** Run `npx vitest run frontend/src/content && npm run lint:content`. Expected: PASS; content lint reports 117 steps and 234 presenter notes. [**As built (D106):** content lint prints neither number; both were counted from the modules, and a records test now counts the steps.]

- [ ] **Step 6: Commit.** `npm run ci`, then `git commit -m "feat(sgs): M4 gains E3, E4, E7, E13 and X2 after the steps that teach them"`.

---

### Task 11: Chromium: interaction, legibility, fit, time

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`, `e2e/perf.spec.ts`

- [ ] **Step 1: `lecture.spec.ts`**, four tests in M3's form:
  - `M4's playgrounds compute with no backend running`: `m04/3` shows `readout-E3.truths-value` 3; `m04/6` shows `readout-E4.truths-value` 2 and `readout-E4.truths_none-value` 1; `m04/10` shows `readout-E7.pool-value` 7; `m04/13` shows `readout-E13.admitted-value` 1; `m04/15` shows `readout-X2.pool-value` 300;
  - `M4's knobs cross from each first part to its second`: `m04/5?E4.mode=none`, ArrowRight, `readout-E4.pool-value` 12; `m04/9?E7.m=2`, ArrowRight, `readout-E7.pool-value` 11 (Review Focus 5);
  - `M4's knobs work from the keyboard and never advance the deck`: `E3.k` ArrowRight watching `readout-E3.in_top-value`; `E4.mode` ArrowDown watching `readout-E4.pool-value`; `E7.m` ArrowRight watching `readout-E7.pool-value`; `E13.multi` Space watching `readout-E13.admitted-value`; `X2.m` ArrowDown watching `readout-X2.pool-value`;
  - `M4's knobs write the address bar`: `E4.mode` → `none` gives `E4.mode=none`.

- [ ] **Step 2: `projector.spec.ts`.** `PARTS_LONGEST` gains `m04/2?E3.k=12&E3.row=12`, `m04/3?E3.k=12`, `m04/5?E4.mode=none&E4.k=12`, `m04/6?E4.mode=none&E4.k=12`, `m04/9?E7.m=10&E7.k=12`, `m04/10?E7.m=10&E7.k=12`, `m04/13?E13.multi=1&E13.d=5` and `m04/15?X2.m=70`. The new steps join every list M3's steps are in: the contrast walk, the 18 px floor, and `F3, E1 and E10 draw their marks on their photographs`, which gains E3, E4 and E7 and is renamed to name them. If a part fails to fit, split it by measurement and record the measured overflow. [**As built (D106):** E3's, E4's and E7's second parts, E13 and X2 ran 411, 543, 411, 386 and 74 px past 1024 × 768 and were tightened within their parts, not split; the tightening is `PlaygroundFrame`'s opt-in `dense`, after the review found that tightening the shared kit moved the nine earlier playgrounds. The review also added M4's photographs to the photograph-size test and M4's playground steps to the controls-reachable check.]

- [ ] **Step 3: `perf.spec.ts`.** `PLAYGROUND_CASES` gains E3 (`set E3.k 5`, readout `[data-testid="readout-E3.in_top-value"]`), E4 (`set E4.mode semi`), E7 (`set E7.m 2`), E13 (`click E13.multi`), X2 (`set X2.m 70`), at their part-2 or single step; "all nine playgrounds" becomes "all fourteen", with the count 14.

- [ ] **Step 4: Run** `npm run test:e2e` and `npm run check:perf`. Expected: exit 0; e2e reports its new total; perf 28 passed.

- [ ] **Step 5: Commit.** `git commit -m "test(sgs): M4's playgrounds in the browser: with no backend, by keyboard, on the projector, in time"`.

---

### Task 12: Records, and the full gate

**Files:**
- Modify: `../DEVIATIONS.md` (append **D106**), `../docs/VERIFICATION.md` (append **§29**), `../docs/INDEX.md`, `../README.md`, `../CLAUDE.md`, and the spec, where the build departed from it (in-place bracketed notes)
- Test: `frontend/src/content/test/registry.test.tsx`

- [ ] **Step 1: Write the failing records test**, `it('the records carry D106 and M4's playgrounds')`, through `record(deviations, 'D106')` and `atLeast`: D106's heading, VERIFICATION `## 29. `, `D1…D106` in CLAUDE.md and INDEX, CLAUDE.md's `§29 the M4 playgrounds` and 106 deviations, INDEX's `the M4 playgrounds (§29)`, and D106 naming `R@2=1`, `E13`, `X2` and `992287e`. [**As built (D106):** a second test takes the number of playgrounds, of live points without one and of steps from the mount table, the harvest and the modules, and compares them with CLAUDE.md, INDEX and README.]

- [ ] **Step 2: Run it and confirm it fails** on the missing heading.

- [ ] **Step 3: Write the records.** D106: spec §2's findings, what each correction changed, the five playgrounds, every measurement of Tasks 2, 9, 10 and 11, and anything the build decided differently. VERIFICATION §29: the gate, e2e and perf figures from the runs that produced them. CLAUDE.md, INDEX and README: 14 playgrounds (M4 carries five), 14 live points remaining, the step and note counts, the test counts, as the runs report them.

- [ ] **Step 4: Run the full gate.** `npm run ci`, `npm run test:e2e`, `npm run check:perf`, each exit 0, and `git status` clean afterwards.

- [ ] **Step 5: Commit.** `git commit -m "docs(sgs): D106 and VERIFICATION §29, M4's playgrounds and the counts brought up to date"`.
