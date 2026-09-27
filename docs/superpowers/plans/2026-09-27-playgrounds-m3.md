# Playgrounds for M3: E1 and E10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct four statements about matching and protocols that the engine and the sources contradict, take F3's overlay out as a shared `PhotoMarks`, then build E1 (the match relation, one defect at a time) and E10 (what each protocol hands over, as counts) as M3 steps s3 and s5.

**Architecture:** Each playground is a component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, over the control kit and the new `PhotoMarks`, drawing `ph-001` from the committed placeholder slice. The arithmetic lives in `playgrounds/logic.ts`: E1's five conjuncts and verdict, held to the engine's `classify` by one test; E10's hypothesis-space sizes as `bigint`. Nothing computed is a metric.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, KaTeX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12.

**Spec:** `docs/superpowers/specs/2026-09-27-playgrounds-m3-design.md`. It builds on the M0 playground design (the step contract), the split design (parts, D96) and the M2 design (`boxIou` cross-check pattern, D97).

## Global Constraints

- **Branch `feat/playgrounds-m3`**, cut from `main` at `9a3b644`. Do not merge; the user merges after review.
- **Working directory is `scene-graph-studio/system/`.** Every `npm` command runs there. Paths are relative to it unless they start with `../`.
- **A playground computes a count, a bound or a set membership. Never a metric.** No R, mR or R@K in E1 or E10. Nothing in `frontend/src/playgrounds/` outside `test/` imports a value from `sgg-metrics`; types are allowed.
- **`system/web/knowledge-map/` is frozen** (D-13). Task 1 corrects it and adds nothing; no other task touches it.
- **No figure is recalled.** Every number is computed from `ph-001` or the placeholder slice, or is Xu et al.'s 150 / 50 / 0.5, labelled "Xu et al. 2017, §4", or is Tang's table as quoted in spec §2.
- **Bilingual parity** (NFR-6); **formal written Chinese** with Chinese punctuation; titles are noun phrases; numbers and technical terms verbatim. Display math is shared by both locales, as M3's already is.
- **Lecture legibility:** type in `em`, never below 18 px; ink `slate-700` or darker; marks differ in shape as well as colour; no text inside an SVG.
- **Knob ids equal their query keys:** `E1.cs`, `E1.co`, `E1.p`, `E1.bs`, `E1.bo`, `E10.pr`, `E10.voc`.
- **Working-tree files are CRLF** (`core.autocrlf=true`). Never `sed -i` (it strips CR in Git Bash). Edit with a script that keeps CRLF, or normalise afterwards; confirm with `git diff --stat`. `data/content/*.json` is pinned LF.
- **`npm run ci` exits 0 before every commit.** Kill any stale `vite preview` on port 4173 before `test:e2e` or `check:perf`.

## Review Focus

1. **Every E1 toggle on at once.** Expected: all five conjunct rows false, t̂ ≃ t fails, failure mode "both", verdict `spurious` with t `missed`. *(Task 4 component test)*
2. **E10's SGDet count printed exactly.** Expected: `897,116,066,370,414,059,520,000` and `630,784,734,166,697,385,600,000,000` digit for digit, never in exponent notation or rounded through a `number`. *(Task 3 logic test, Task 5 component test)*
3. **Malformed knobs in the URL:** `?E1.cs=abc`, `?E10.pr=foo`, `?E10.voc=bar`. Expected: the default (defect off, PredCls, this slice), never a blank panel. *(Tasks 4 and 5)*
4. **SGDet hands over nothing.** Expected: no mark on the photograph and the text "no boxes, no labels" / 「無框、無標籤」, while the three counts stay visible. *(Task 5)*
5. **A setting changed on a playground's first part reaches its second** if Task 8 splits one. Expected: the second part computes from it, as D96 carries knobs. *(Task 8 lecture test, conditional on the split)*

---

### Task 1: The four corrections

**Files:**
- Modify: `frontend/src/content/m03.en.mdx`, `frontend/src/content/m03.zh-TW.mdx` (front-matter symbols; s2 Implications; s3 all four parts; s2 and s3 presenter notes)
- Modify: `web/knowledge-map/pg.js` (MATH E10; DERIV E1 and E10; E1 and E10 notes), `web/knowledge-map/kp-data.js` (E10 knobs), `web/knowledge-map/FROZEN.md`
- Modify: `web/brief/index.html` (lines 587–588), regenerated `../docs/brief.standalone.html`
- Regenerated: `../data/content/kp.json`, `math.json`, `deriv.json`
- Test: `frontend/src/content/test/registry.test.tsx`

**Interfaces:** none produced.

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`, beside the √2 test, `it('M3 states what is forced apart from what is observed, and the verdicts the engine gives')`. Read both M3 locale files with `readFileSync(new URL(file, import.meta.url), 'utf8')` and import `math.json` like `deriv.json`, then assert:
  - each M3 file contains `\\mathcal{H}_{\\text{PredCls}}\\subseteq\\mathcal{H}_{\\text{SGCls}}\\subseteq\\mathcal{H}_{\\text{SGDet}}`;
  - each file contains `\\begin{array}{c|cc}`;
  - neither contains `for every model`, `\\lvert V\\rvert^2` or `four diff colours`;
  - `math.E10` contains `\\subseteq`, and `deriv.E10` and `deriv.E1` contain neither `\\lvert V\\rvert^2` nor `four diff colours`.
  Write each backslash doubled in the TS source. In the same test, render M3's s2 and s3 through `getModule('m03', locale)` for both locales and assert no `.katex-error` element, so a malformed array fails here rather than in the room.

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL on the first `toContain`, with the message showing single backslashes in the expected string.

- [ ] **Step 3: M3 s3 in both files.** The new display math, shared by both locales:
  - **Formal:** `\mathcal{H}_{\text{PredCls}}\subseteq\mathcal{H}_{\text{SGCls}}\subseteq\mathcal{H}_{\text{SGDet}}`.
  - **Worked:** an `aligned` block of three rows: `\lvert\mathcal{H}_{\text{PredCls}}\rvert &= \lvert V\rvert(\lvert V\rvert-1)\lvert\mathcal{P}\rvert`, `\lvert\mathcal{H}_{\text{SGCls}}\rvert &= \lvert V\rvert(\lvert V\rvert-1)\lvert\mathcal{C}\rvert^2\lvert\mathcal{P}\rvert`, `\lvert\mathcal{H}_{\text{SGDet}}\rvert &= B(B-1)\lvert\mathcal{C}\rvert^2\lvert\mathcal{P}\rvert`.
  - **Implications:** a `gathered` block of three lines: `R_{\text{SGDet}}@k\le R_{\text{SGCls}}@k\le R_{\text{PredCls}}@k\ \text{is observed, not implied:}`, then `\text{the inclusion shrinks the space a model searches and bounds no model's recall.}`, then after `\\[4pt]`: `\textbf{Note } \lvert V\rvert(\lvert V\rvert-1) \text{ survives under PredCls and SGCls: boxes are given, pairs never are.}`

  The prose, with the rest of each paragraph kept:
  - **Intuition, en:** "The three protocols differ in how much they hand the model, and that difference is a fact about sets before it is a fact about any number: whatever PredCls lets a model output, SGCls lets it output too, and SGDet more again. The recall ordering that published tables show is a regularity observed across models, not a consequence of that inclusion."
  - **Intuition, zh-TW:** 「三種協定之差異在於提供模型之資訊多寡；此差異首先是集合之間的關係，其次才涉及任何數值：凡 PredCls 允許模型輸出者，SGCls 亦允許，SGDet 所允許者更多。已發表表格所呈現之 recall 大小關係，為跨模型觀察所得之規律，並非此一包含關係之推論結果。」
  - **Implications, en, a new first paragraph:** "`Scene-Graph-Benchmark.pytorch` reports the ordering for all four of its reimplemented models at every K. MOTIFS, for example, reaches R@50 of 32.78 under SGGen, that repository's name for SGDet, 38.92 under SGCls and 65.18 under PredCls (`METRICS.md`, "Recall@K"). Across those rows the ordering holds without exception, and it remains a measurement of those models: a model that did worse when handed the true labels would contradict no definition."
  - **Implications, zh-TW, a new first paragraph:** 「`Scene-Graph-Benchmark.pytorch` 對其重新實作之四個模型，於每一 K 值均呈現此一大小關係；例如 MOTIFS 之 R@50，於 SGGen（該程式庫對 SGDet 之稱呼）為 32.78，於 SGCls 為 38.92，於 PredCls 為 65.18（`METRICS.md`，「Recall@K」表）。上述各列無一例外，然此仍為對該等模型之量測：若某一模型於取得真實標籤後表現反而較差，亦不違反任何定義。」
  - **The existing `gt_boxes_not_pairs` paragraph:** the factor becomes `$\lvert V\rvert(\lvert V\rvert-1)$`. "present under every protocol" becomes "present under PredCls and SGCls"; in zh-TW, 「於三種協定下均存在」 becomes 「於 PredCls 與 SGCls 下均存在」.
  - **Front matter, both files:** add the symbol `B`, gloss_en "the number of whole-pixel boxes in the image", gloss_zh 「影像中整數像素框之個數」.

- [ ] **Step 4: M3 s2's Implications in both files.** Keep the first line of the `gathered` block. Replace the line after `\\[4pt]` with `\begin{array}{c|cc} & \Phi_{\text{loc}} & \neg\Phi_{\text{loc}}\\ \hline \Phi_{\text{cls}} & \texttt{match} & \texttt{localization}\\ \neg\Phi_{\text{cls}} & \texttt{spurious} & \texttt{spurious}\end{array}`. Replace the prose paragraph:
  - **en:** "The four-colour diff you have been reading since L1 is this table on the prediction side, and one colour more on the ground truth's: `missed` marks an annotated triplet that no prediction matched. `localization` is the case $\neg\Phi_{\text{loc}}\wedge\Phi_{\text{cls}}$, and it exists so that a right predicate on a badly placed box does not look the same as a wrong predicate. A wrong name is `spurious` wherever its box sits: the diff does not separate a wrong name in the right place from both halves wrong."
  - **zh-TW:** 「自 L1 起所閱讀之四色差異圖，於預測一側即為上表，於標準答案一側另有一色：`missed` 標示未被任何預測命中之標註三元組。`localization` 一色對應 $\neg\Phi_{\text{loc}}\wedge\Phi_{\text{cls}}$ 之情形，其設置目的正在於：使「predicate 正確但框位置不佳」不致與「predicate 錯誤」呈現為同一結果。名稱錯誤者，無論其框位於何處，均判為 `spurious`：差異圖並不區分「位置正確、名稱錯誤」與「兩部分皆錯」。」

- [ ] **Step 5: s3's presenter notes, both files.**
  - **en:** "Five minutes. Separate what is forced from what is observed. Forced: each protocol's hypothesis space contains the one before it, a set inclusion with nothing to measure. Observed: recall under SGDet is below SGCls and below PredCls in every row of the benchmark's own table, MOTIFS 32.78, 38.92, 65.18 at R@50. Ask the room whether the inclusion proves the ordering; it does not, because it says what a model may output, not what any model does."
  - **zh-TW:** 「五分鐘。須區分必然者與觀察所得者。必然者：各協定之假設空間均包含前一協定之假設空間，此為集合包含關係，無須量測。觀察所得者：該基準自身表格之每一列中，SGDet 之 recall 均低於 SGCls，亦低於 PredCls；以 MOTIFS 之 R@50 為例，依序為 32.78、38.92、65.18。宜請現場判斷此包含關係是否足以證明該大小關係；答案為否，因其僅規範模型可輸出之內容，而非任何模型實際之表現。」

- [ ] **Step 6: The frozen page.**
  - **`pg.js` formulas:** MATH `E10` becomes the Formal line in `\[ … \]`. DERIV `E10` becomes the Worked block followed by the Implications block. DERIV `E1`'s second `\[ … \]` becomes the corrected s2 Implications. Use the page's double-backslash string escaping.
  - **E1 `note_en`:** "Two independent failure modes, which is why the diff view uses four colours and why PredCls, SGCls and SGDet exist as separate protocols." becomes "Two independent failure modes: the diff view marks a right name in the wrong place localization and a wrong name spurious wherever it sits, and PredCls, SGCls and SGDet exist as separate protocols to pull them apart."
  - **E1 `note_zh`:** 「兩種互相獨立的失敗模式——這正是差異檢視要用四種顏色的原因，也是 PredCls、SGCls、SGDet 之所以分成三種 protocol 的原因。」 becomes 「兩種互相獨立的失敗模式——差異檢視把名稱正確、位置錯誤標為 localization，把名稱錯誤一律標為 spurious，而 PredCls、SGCls、SGDet 分成三種 protocol 正是為了拆開這兩者。」
  - **E10 `note_en`:** "— so \\(R_{\\text{SGDet}} \\le R_{\\text{SGCls}} \\le R_{\\text{PredCls}}\\) holds for every model, and the engine asserts it on every fixture." becomes "— and published tables show \\(R_{\\text{SGDet}} \\le R_{\\text{SGCls}} \\le R_{\\text{PredCls}}\\) for the models they report: observed, not implied, and no engine asserts it."
  - **E10 `note_zh`:** its "因此對任何模型都有 …，評測引擎會在每個樣本上檢查這條不變量。" becomes 「已發表表格對其所列模型均呈現 …；此為觀察所得而非推論結果，且評測引擎並未檢查此式。」
  - **`kp-data.js`:** E10's knobs become `3-way knob · the hypothesis space counted per protocol`.
  - **`FROZEN.md`:** an entry `### 2026-09-27 — E1's and E10's statements about matching and protocols`, listing spec §2's findings 1 to 4 with their sources, and the line "No option, control or knowledge point was added. The frozen E10's toy bars are unchanged."

- [ ] **Step 7: The brief.** In `web/brief/index.html` lines 587–588, `\(\lvert V\rvert^2\)` becomes `\(\lvert V\rvert(\lvert V\rvert-1)\)` in both languages. Then run `npm run build:standalone`.

- [ ] **Step 8: Verify.**
  - Run `npm run harvest && npx vitest run frontend/src/content && node --test tools/test/harvest.test.mjs && npm run lint:frozen && npm run lint:content && npm run lint:standalone`. Expected: all pass; the harvest still reports 26 formulas and 23 derivations; `git status` shows `kp.json`, `math.json` and `deriv.json` changed.

- [ ] **Step 9: Commit.** `npm run ci`, then stage the files above, then `git commit -m "fix(sgs): M3's protocol ordering forced apart from observed, its verdict table, and |V|(|V|−1)"`.

---

### Task 2: `PhotoMarks`, and F3 on it

**Files:**
- Create: `frontend/src/playgrounds/PhotoMarks.tsx`, `frontend/src/playgrounds/test/PhotoMarks.test.tsx`
- Modify: `frontend/src/playgrounds/F3/BoxOverlap.tsx`

**Interfaces:**
- Produces:
  - `export interface Mark { box: BBox; line: 'solid' | 'dashed'; stroke: string; testid: string }`.
  - `export const MARK_ANNOTATED = '#0f172a'` and `export const MARK_PREDICTED = '#b45309'`.
  - `export function PhotoMarks(props: { frame: SceneGraph; marks: Mark[]; hatch?: { box: BBox; testid: string } | null; maxVh: number; alt: string; testid: string; children?: ReactNode })`.
  - The component renders an outer `div[data-testid=testid]` with `min-w-0 flex-1` and `maxWidth: calc(maxVh vh × width / height)`. Inside it is a `relative` box holding `<img width={frame.width} height={frame.height} class="block h-auto w-full">` and an absolutely positioned `<svg viewBox="0 0 W H">`. Each mark is drawn over a white under-stroke (`${testid}-halo`, stroke `#ffffff`, width 10, the same dash). `children` render after the picture box.

- [ ] **Step 1: Write the failing tests** in `PhotoMarks.test.tsx`, rendering `ph-001` with one solid and one dashed mark:
  - `each mark stands on a white under-stroke drawn first` (geometry equal, stroke `#ffffff`, width greater than the mark's, the halo before the mark);
  - `the photograph states its size before it loads` (`img` has `width="640"` and `height="480"`);
  - `a dashed mark's under-stroke is dashed too`;
  - `draws the hatch only when given one`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/PhotoMarks.test.tsx`. Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement `PhotoMarks`, then move F3 onto it.** F3 keeps its test ids (`f3-picture`, `f3-gt`, `f3-pred`, `f3-inter`, `f3-caption`), its colours and its layout. The deferred minor that F3's `<img>` has no size is closed by this step.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/playgrounds`. Expected: PASS, with F3's tests unchanged.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "refactor(sgs): PhotoMarks, F3's overlay made shared, with the photograph's size stated"`.

---

### Task 3: E1's and E10's arithmetic

**Files:**
- Create: `frontend/src/playgrounds/E1/setup.ts`, `frontend/src/playgrounds/E10/setup.ts`
- Modify: `frontend/src/playgrounds/logic.ts`, `frontend/src/playgrounds/slice.ts` (add `SLICE_CLASS_COUNT`)
- Test: `frontend/src/playgrounds/test/logic.test.ts`

**Interfaces:**
- **`E1/setup.ts`:** `E1_FRAME = 'ph-001'`, `E1_RELATIONSHIP = 1`, and `E1_DEFECTS`:
  - `subject: 'glove'`, `object: 'panel'`, `predicate: 'near'`;
  - `subjectShift: { dx: 45, dy: 0 }`, `objectShift: { dx: 0, dy: 55 }`.
  - τ is `XU_TAU` from `../F3/setup`.
- **`E10/setup.ts`:** `VG150_CLASSES = 150` and `VG150_PREDICATES = 50`, with a doc comment quoting Xu et al. §4.
- **`slice.ts`:** `SLICE_CLASS_COUNT`, the distinct `names[0]` over the placeholder slice (10).
- **`logic.ts`, E1:**
  - `export interface BoxTriplet { subject: { name: string; box: BBox }; predicate: string; object: { name: string; box: BBox } }`;
  - `export interface E1Defects { cs: boolean; co: boolean; p: boolean; bs: boolean; bo: boolean }`;
  - `export interface Conjuncts { cs: boolean; co: boolean; p: boolean; is: boolean; io: boolean }`;
  - `annotatedTriplet(frame: SceneGraph, relationshipId: number): BoxTriplet`;
  - `withDefects(t: BoxTriplet, d: E1Defects): BoxTriplet`, which applies `E1_DEFECTS` through the existing `scaledBox(box, dx, dy, 1)`;
  - `iouCounts(a: BBox, b: BBox): [number, number]`, returning the shared and union pixel counts;
  - `conjuncts(pred: BoxTriplet, gt: BoxTriplet, tau: number): Conjuncts`;
  - `failureMode(c: Conjuncts): 'none' | 'name' | 'place' | 'both'`;
  - `frameVerdict(pred: BoxTriplet, frame: SceneGraph, tau: number): 'match' | 'localization' | 'spurious'`. This is the engine's rule for one prediction with nothing consumed: `match` if some annotated triplet agrees on all three names and both IoUs ≥ τ; else `localization` if some agrees on all three names; else `spurious`.
- **`logic.ts`, E10:**
  - `export type Protocol = 'predcls' | 'sgcls' | 'sgdet'`;
  - `wholePixelBoxes(width: number, height: number): bigint`, equal to C(width+1, 2)·C(height+1, 2);
  - `hypothesisSpace(protocol: Protocol, objects: number, classes: number, predicates: number, boxes: bigint): bigint`.

- [ ] **Step 1: Write the failing tests** in `logic.test.ts`:

```ts
describe('E1: one defect at a time', () => {
  const frame = frameById(E1_FRAME)!;
  const t = annotatedTriplet(frame, E1_RELATIONSHIP);
  const none = { cs: false, co: false, p: false, bs: false, bo: false };
  it('reads box#3 on table#1', () => {
    expect(t).toEqual({ subject: { name: 'box', box: { x: 250, y: 240, w: 90, h: 70 } }, predicate: 'on',
      object: { name: 'table', box: { x: 60, y: 300, w: 420, h: 110 } } });
  });
  it('each defect falsifies exactly its own conjunct', () => {
    const keys = [['cs', 'cs'], ['co', 'co'], ['p', 'p'], ['bs', 'is'], ['bo', 'io']] as const;
    for (const [defect, conj] of keys) {
      const c = conjuncts(withDefects(t, { ...none, [defect]: true }), t, 0.5);
      expect(Object.entries(c).filter(([, v]) => !v).map(([k]) => k), defect).toEqual([conj]);
    }
  });
  it('the shifted boxes keep a third of their overlap', () => {
    expect(iouCounts(t.subject.box, withDefects(t, { ...none, bs: true }).subject.box)).toEqual([3150, 9450]);
    expect(iouCounts(t.object.box, withDefects(t, { ...none, bo: true }).object.box)).toEqual([23100, 69300]);
  });
  it('names the failure as s2 does', () => {
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true }), t, 0.5))).toBe('name');
    expect(failureMode(conjuncts(withDefects(t, { ...none, bs: true }), t, 0.5))).toBe('place');
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true, bo: true }), t, 0.5))).toBe('both');
  });
  it('gives a wrong name spurious wherever its box sits', () => {
    expect(frameVerdict(withDefects(t, { ...none, cs: true }), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, cs: true, bs: true }), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, bs: true, bo: true }), frame, 0.5)).toBe('localization');
    expect(frameVerdict(withDefects(t, none), frame, 0.5)).toBe('match');
  });
});

describe('E10: what each protocol leaves to search', () => {
  const B = wholePixelBoxes(640, 480);
  it('counts whole-pixel boxes in 640 x 480', () => {
    expect(B).toBe(205120n * 115440n);
    expect(B).toBe(23679052800n);
  });
  it('counts one triplet\'s hypotheses per protocol, exactly', () => {
    expect(hypothesisSpace('predcls', 6, 10, 16, B)).toBe(480n);
    expect(hypothesisSpace('sgcls', 6, 10, 16, B)).toBe(48000n);
    expect(hypothesisSpace('sgdet', 6, 10, 16, B).toLocaleString('en-US')).toBe('897,116,066,370,414,059,520,000');
    expect(hypothesisSpace('predcls', 6, 150, 50, B)).toBe(1500n);
    expect(hypothesisSpace('sgcls', 6, 150, 50, B)).toBe(33750000n);
    expect(hypothesisSpace('sgdet', 6, 150, 50, B).toLocaleString('en-US')).toBe('630,784,734,166,697,385,600,000,000');
  });
  it('orders the three by inclusion, on either vocabulary', () => {
    for (const [c, p] of [[10, 16], [150, 50]] as const) {
      const [a, b, d] = (['predcls', 'sgcls', 'sgdet'] as const).map((pr) => hypothesisSpace(pr, 6, c, p, B));
      expect(a < b && b < d).toBe(true);
    }
  });
  it('counts the slice\'s own classes', () => {
    expect(SLICE_CLASS_COUNT).toBe(10);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: FAIL at import.

- [ ] **Step 3: Implement** the setup files, `SLICE_CLASS_COUNT` and the functions, with the signatures above.

- [ ] **Step 4: Run them and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E1's conjuncts and verdict, E10's hypothesis spaces counted exactly"`.

---

### Task 4: The E1 component, registered

**Files:**
- Create: `frontend/src/playgrounds/E1/MatchRelation.tsx`, `frontend/src/playgrounds/E1/test/MatchRelation.test.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx`, `frontend/src/playgrounds/test/Playground.test.tsx` (pinned ids gain `'E1'`), `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`, `frontend/src/playgrounds/test/logic.test.ts` (the engine checks)

**Interfaces:**
- Consumes: Task 2's `PhotoMarks`; Task 3's E1 functions and setup.
- Produces: `export function MatchRelation({ part }: PlaygroundProps = {})`.
  - Knobs: the toggles `E1.cs`, `E1.co`, `E1.p`, `E1.bs`, `E1.bo`, read with `flag(value, false)`.
  - Conjunct rows: `e1-c-cs`, `e1-c-co`, `e1-c-p`, `e1-c-is`, `e1-c-io`, each with `data-holds="true|false"`.
  - Lines: `e1-relation`, `e1-mode`, `e1-verdict`.
  - Picture: `e1-picture`, with marks `e1-gt-s`, `e1-gt-o` (solid) and `e1-pred-s`, `e1-pred-o` (dashed).

**Copy** (key: en / zh-TW):

| Key | en | zh-TW |
|---|---|---|
| `playground.e1.cs` | Subject: box → glove | 主詞類別：box → glove |
| `playground.e1.co` | Object: table → panel | 受詞類別：table → panel |
| `playground.e1.p` | Predicate: on → near | predicate：on → near |
| `playground.e1.bs` | Subject box moved 45 px | 主詞框位移 45 px |
| `playground.e1.bo` | Object box moved 55 px | 受詞框位移 55 px |
| `playground.e1.holds` | holds | 成立 |
| `playground.e1.fails` | fails | 不成立 |
| `playground.e1.relation` | t̂ ≃ t | t̂ ≃ t |
| `playground.e1.mode_none` | No failure | 無失敗 |
| `playground.e1.mode_name` | Right place, wrong name | 位置正確、名稱錯誤 |
| `playground.e1.mode_place` | Right name, wrong place | 名稱正確、位置錯誤 |
| `playground.e1.mode_both` | Both halves wrong | 兩部分皆錯 |
| `playground.e1.verdict_match` | The diff: match; t matched | 差異圖：match；t 已命中 |
| `playground.e1.verdict_localization` | The diff: localization; t missed | 差異圖：localization；t 為 missed |
| `playground.e1.verdict_spurious` | The diff: spurious; t missed | 差異圖：spurious；t 為 missed |
| `playground.e1.tau` | τ = 0.5: Xu et al. 2017, §4 | τ = 0.5：Xu 等人 2017，§4 |
| `playground.e1.picture` | Frame ph-001: box on table, annotated and predicted | 影格 ph-001：box on table 之標註與預測 |
| `playground.e1.legend` | Solid: the annotation. Dashed: the prediction. | 實線：標註；虛線：預測。 |

- [ ] **Step 1: Write the failing tests.**
  - In `MatchRelation.test.tsx`, with `renderAt(url)` in a `MemoryRouter` and `setLocale('en')`:
    - `opens on the annotation itself: every conjunct holds and the diff says match`;
    - `each toggle falsifies its own row only` (loop over the five);
    - `a wrong name is spurious wherever its box sits` (`?E1.p=1&E1.bs=1`: `e1-mode` "Both halves wrong", `e1-verdict` "spurious");
    - `every toggle on: all five rows fail, the relation fails, the diff says spurious` (Review Focus 1);
    - `a malformed toggle in the URL is off` (`?E1.cs=abc`: `e1-c-cs` has `data-holds="true"`);
    - `shows each IoU as its two counts` (`?E1.bs=1`: `e1-c-is` contains `3,150 / 9,450`);
    - `reads in 繁體中文`;
    - `takes no focus on mount`.
  - In `logic.test.ts`:
    - `E1's verdict equals the engine's classify in all 32 toggle states`: for each state, build an engine `Triplet` from the `BoxTriplet` and call `classify(pred, toTriplets(frame), frame.relationships.map(() => false), 0.5, false)[0]`, then compare with `frameVerdict`;
    - `no toggle state names another annotated triplet of ph-001`: the eight name triples against `toTriplets(frame)` agree only for (box, on, table).

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds`. Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement.**
  - Controls: the five toggles and the τ label.
  - Visual: `PhotoMarks` (maxVh 34) with the four marks, then a column holding the conjunct rows, the `e1-relation`, `e1-mode` and `e1-verdict` lines, and the legend.
  - Register `E1: MatchRelation` and pin `'E1'` in `Playground.test.tsx`.
  - Add the keys to both locale tables.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS and exit 0.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E1, the match relation one defect at a time, held to the engine's classify"`.

---

### Task 5: The E10 component, registered

**Files:**
- Create: `frontend/src/playgrounds/E10/ProtocolSpaces.tsx`, `frontend/src/playgrounds/E10/test/ProtocolSpaces.test.tsx`
- Modify: `mounts.tsx`, `Playground.test.tsx` (pinned ids gain `'E10'`), both locale tables

**Interfaces:**
- Consumes: Task 2's `PhotoMarks`; Task 3's E10 functions, `SLICE_CLASS_COUNT` and `SLICE_PREDICATE_COUNT`.
- Produces: `export function ProtocolSpaces({ part }: PlaygroundProps = {})`.
  - Knobs: `Choice` controls `E10.pr` (`predcls`, `sgcls`, `sgdet`; any other value → `predcls`) and `E10.voc` (`slice`, `vg150`; any other value → `slice`).
  - Picture: `e10-picture` holds the six annotated boxes as solid marks `e10-box-<object_id>` under PredCls and SGCls, and no marks under SGDet.
  - Given: `e10-given`, listing the six labels in object order under PredCls; "no labels" under SGCls; "no boxes, no labels" under SGDet.
  - Counts: the table `e10-counts` has rows `e10-row-predcls`, `e10-row-sgcls` and `e10-row-sgdet`, each with the protocol, its formula with the numbers substituted and the exact count. The chosen row carries `aria-current="true"`.
  - Inclusion: the line `e10-inclusion` reads `ℋ_PredCls ⊆ ℋ_SGCls ⊆ ℋ_SGDet`.

**Copy** (key: en / zh-TW):
- `playground.e10.protocol`: Protocol / 協定
- `playground.e10.vocabulary`: Vocabulary / 詞彙
- `playground.e10.voc_slice`: This slice: 10 classes, 16 predicates / 本切片：10 類、16 種 predicate
- `playground.e10.voc_vg150`: VG-150: 150 classes, 50 predicates (Xu et al. 2017, §4) / VG-150：150 類、50 種 predicate（Xu 等人 2017，§4）
- `playground.e10.given`: Given to the model / 提供予模型
- `playground.e10.no_labels`: no labels / 無標籤
- `playground.e10.nothing`: no boxes, no labels / 無框、無標籤
- `playground.e10.count`: Hypotheses per triplet / 每個三元組之假設數
- `playground.e10.boxes_note`: B = C(641, 2) · C(481, 2) whole-pixel boxes / B = C(641, 2) · C(481, 2) 個整數像素框
- `playground.e10.to_l2`: Recall under each protocol is scored in L2. / 各協定下之 recall 由 L2 評分。
- `playground.e10.picture`: Frame ph-001, as the chosen protocol hands it over / 影格 ph-001，依所選協定提供之內容

The labels are the slice's own names, printed verbatim.

- [ ] **Step 1: Write the failing tests** in `ProtocolSpaces.test.tsx`:
  - `opens on PredCls over this slice: six boxes, six labels, 480`;
  - `SGCls keeps the boxes and withholds the labels`;
  - `SGDet hands over nothing and still shows all three counts` (Review Focus 4);
  - `prints the SGDet count digit for digit` (`?E10.pr=sgdet&E10.voc=vg150`: `e10-row-sgdet` contains `630,784,734,166,697,385,600,000,000`; Review Focus 2);
  - `falls back on malformed knobs` (`?E10.pr=foo&E10.voc=bar` behaves as the default; Review Focus 3);
  - `marks the chosen row`;
  - `reads in 繁體中文`;
  - `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/E10`. Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement, register `E10: ProtocolSpaces`, and add the keys.** Format counts with `bigint.toLocaleString('en-US')`, never through `Number`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): E10, what each protocol hands over and the space it leaves, counted"`.

---

### Task 6: The golden cases

**Files:**
- Modify: `../data/content/playground_golden.json`, `frontend/src/playgrounds/test/golden.test.ts`

**Interfaces:**
- Consumes: Tasks 3 to 5. Rule 11 needs E1 and E10 registered first.
- Produces: twelve cases with `image_id: "ph-001"`.
  - **E1** knobs `{ cs, co, p, bs, bo }` (booleans); expect `{ is_shared, is_union, io_shared, io_union, relation, mode, verdict }`. Cases:
    - `pg-E1-none`: match;
    - `pg-E1-subject-class`: spurious, mode name;
    - `pg-E1-predicate`: spurious, name;
    - `pg-E1-subject-box`: localization, place, 3150/9450;
    - `pg-E1-both-boxes`: localization, place, both IoUs a third;
    - `pg-E1-name-and-place`: `p` and `bs`, spurious, both.
  - **E10** knobs `{ protocol, vocabulary }`; expect `{ count }` as a decimal string. Cases:
    - `pg-E10-predcls-slice` "480";
    - `pg-E10-sgcls-slice` "48000";
    - `pg-E10-sgdet-slice` "897116066370414059520000";
    - `pg-E10-predcls-vg150` "1500";
    - `pg-E10-sgcls-vg150` "33750000";
    - `pg-E10-sgdet-vg150` "630784734166697385600000000".
  - Each `why` writes out the arithmetic, for example "6 x 5 = 30 ordered pairs of distinct objects; 30 x 10^2 x 16 = 48,000".

- [ ] **Step 1: Write the failing tests.**
  - Add `E1: (c) => c.kp === 'E1'` and `E10: (c) => c.kp === 'E10'` to `RUNS`.
  - Add a length pin per block: 6 and 6.
  - Add `it.each` blocks that compute through Task 3's functions and compare. For E10, compare `hypothesisSpace(...).toString()` with `c.expect.count`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/golden.test.ts`. Expected: FAIL on the two length pins.

- [ ] **Step 3: Append the twelve cases.**

- [ ] **Step 4: Run and confirm.** Run `npx vitest run frontend/src/playgrounds/test && npm run lint:content`. Expected: PASS; content lint reports 42 playground cases.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "test(sgs): E1's six golden cases and E10's six counts"`.

---

### Task 7: M3 gains s3 and s5

**Files:**
- Modify: `frontend/src/content/m03.en.mdx`, `frontend/src/content/m03.zh-TW.mdx`, `frontend/src/content/test/registry.test.tsx`

**Interfaces:**
- Produces: M3 steps `s1:prose, s2:math, s3:playground/E1, s4:math, s5:playground/E10, s6:prose, s7:prose, s8:lab, s9:checkpoint`. Lecture indices are 0-based: E1 at `/lecture/m/m03/2`, E10 at `/lecture/m/m03/4`.

- [ ] **Step 1: Write the failing pin** `M3 carries E1 and E10, each directly after the step that teaches it`, in the M1 test's `${s.id}:${s.kind}/${s.kp}` form, against the list above.

- [ ] **Step 2: Run it and confirm it fails.** Expected: FAIL at `s3:math`.

- [ ] **Step 3: Renumber and insert.** Renumber in descending order in both files, in the front matter and the `<Step id>` tags: s7 → s9, s6 → s8, s5 → s7, s4 → s6, s3 → s4. Then:
  - insert s3 (E1, 180 s) after s2, and s5 (E10, 180 s) after s4;
  - bodies: en `## One triplet, one defect at a time` with `<Playground kp="E1" />`; en `## What each protocol hands over`; zh-TW `## 單一三元組之逐項缺陷` and `## 各協定提供之內容`;
  - update step references in the existing notes: s2's "s3 uses them" becomes "s4 uses them" (zh-TW 「保留至 s3」 becomes 「保留至 s4」).

  The new presenter notes:
  - **s3, en:** "Three minutes. Open with every toggle off: all five conjuncts hold and the prediction is the annotation. Turn on the subject box shift: IoU 3,150 / 9,450 = 0.333 fails τ = 0.5, the names still agree, and the diff says localization. Turn it off and turn on the predicate swap: the boxes are right, a name is wrong, and the diff says spurious. Turn the box shift back on: both halves fail and the diff still says spurious; it does not separate a wrong name in the right place from both wrong."
  - **s3, zh-TW:** 「三分鐘。所有切換皆關閉時，五個合取項均成立，預測即為標註。開啟主詞框位移：IoU 為 3,150 / 9,450 = 0.333，未達 τ = 0.5，名稱仍一致，差異圖判為 localization。關閉之，改開啟 predicate 替換：框位置正確而名稱錯誤，差異圖判為 spurious。再開啟框位移：兩部分皆不成立，差異圖仍判為 spurious；差異圖並不區分「位置正確、名稱錯誤」與「兩者皆錯」。」
  - **s5, en:** "Three minutes. Step through the three protocols on this slice's vocabulary: 480 hypotheses per triplet under PredCls, 48,000 under SGCls, and a 24-digit count under SGDet, where the boxes themselves are unknown. Each set contains the one before it; that inclusion is what s4 states. Switch to VG-150's vocabulary: 1,500 and 33,750,000. No recall is shown here; how recall moves under the three protocols is L2's, at s8."
  - **s5, zh-TW:** 「三分鐘。以本切片之詞彙依序切換三種協定：每個三元組之假設數，PredCls 為 480，SGCls 為 48,000，SGDet 因框亦屬未知而為 24 位數。各集合均包含前一者，此即 s4 所陳述之包含關係。切換為 VG-150 詞彙：1,500 與 33,750,000。本步驟不顯示 recall；三種協定下 recall 之變化屬 L2，見 s8。」

- [ ] **Step 4: Run and confirm.** Run `npx vitest run frontend/src/content && npm run lint:content`. Expected: PASS.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): M3 s3 and s5, E1 and E10 after the steps that teach them"`.

---

### Task 8: Chromium: interaction, legibility, fit, time

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`, `e2e/perf.spec.ts`
- Conditional, if Step 4 finds a step past the panel: the component, `PLAYGROUND_PARTS`, both M3 locale files, the registry pin and the parts test

**Interfaces:**
- Consumes: `/lecture/m/m03/2` (E1) and `/lecture/m/m03/4` (E10), and the test ids from Tasks 4 and 5.

- [ ] **Step 1: Lecture tests.**
  - `M3's playgrounds compute with no backend running`: E1's `e1-verdict` matches `/match/`; E10's `e10-row-predcls` contains `480`.
  - `M3's knobs work from the keyboard and never advance the deck`:
    - `E1.bs` with Space, watching `e1-verdict`;
    - `E10.pr` with ArrowDown, watching `e10-given`.
    - In both, the `position` is unchanged.
  - `M3's knobs write the address bar`: click `E1.p` → `/E1\.p=1/`; `E10.pr` `selectOption('sgdet')` → `/E10\.pr=sgdet/`. Reopen the URL cold and find `e10-given` "no boxes, no labels".
  - Add `['m03', 2], ['m03', 4]` to the no-focus list.
  - The study shell shows M3's frames: 2, or one per part.

- [ ] **Step 2: Projector additions.**
  - Longest states added to `PARTS_LONGEST`: E1 `?E1.cs=1&E1.co=1&E1.p=1&E1.bs=1&E1.bo=1`; E10 `?E10.pr=sgdet&E10.voc=vg150`.
  - The controls-reachable list gains both steps.
  - The 18 px walk gains `m03` indices 0 to 8.
  - The contrast walk gains both steps with `floor: 999`. Read the measured row counts from the failure, then set each floor about a quarter below its count and record the counts in the comment, as for F3.
  - The photograph test and the overlay test loop over `m03/2` and `m03/4?E10.pr=predcls` too.

- [ ] **Step 3: Perf additions.**
  - E1: `{ kind: 'click', testid: 'E1.bs' }`.
  - E10: `{ kind: 'set', testid: 'E10.pr', value: 'sgcls' }`.
  - E1 reads `[data-testid="e1-verdict"]` and E10 reads `[data-testid="e10-given"]`, the line each knob changes.
  - The count test becomes "all nine playgrounds".

- [ ] **Step 4: Run.** Run `npm run test:e2e`. Expected: all pass. If a step runs past the panel, record the overshoot at each size and split it under D96:
  - **E1:** part 1 holds the five toggles, the photograph and the five conjunct rows. Part 2 holds the five toggles, Φ_cls, Φ_loc, the relation, the mode and the verdict.
  - **E10:** part 1 holds the protocol, the photograph and the given list. Part 2 holds the vocabulary, the counts and the inclusion.
  - Each split step gets 90 s and its own notes in both locales, the later steps renumber, and the notes' step references follow.
  - Add a lecture test that a knob set on part 1 is read on part 2 (Review Focus 5). Then re-run.

- [ ] **Step 5: Perf.** Run `npm run check:perf`. Expected: exit 0; E1 and E10 are reported against the two-frame floor, and neither is a clamped zero.

- [ ] **Step 6: Commit.** `npm run ci`, then `git commit -m "test(sgs): E1 and E10 in Chromium: keyboard, address bar, legibility, fit and input-to-paint"`.

---

### Task 9: Records, and the full gate

**Files:**
- Modify: `../DEVIATIONS.md` (append **D98**), `../docs/VERIFICATION.md` (append **§22**), `../docs/INDEX.md`, `../README.md`, `../CLAUDE.md`, and the spec, where the build departed from it (in-place bracketed notes)

- [ ] **Step 1: Run the full gate and collect the counts.** Run `npm run ci`, `npm run test:e2e` and `npm run check:perf`. Record the exit codes and test counts, and the corpus's steps and notes per locale.

- [ ] **Step 2: Write D98.** It covers:
  - the cycle;
  - spec §2's four findings with their locators;
  - the Tang table's commit;
  - `PhotoMarks`;
  - the fit measurements and any split;
  - the gate figures.

- [ ] **Step 3: Write VERIFICATION §22**, "The M3 playgrounds — measured, 2026-09-27". It covers:
  - the gate table;
  - the engine checks (all 32 toggle states, no collision);
  - the twelve golden cases;
  - fit per part at the three sizes in both locales;
  - the contrast rows and floors;
  - input-to-paint.

- [ ] **Step 4: Update the counts.**
  - **CLAUDE.md:**
    - 9 playgrounds; nine playgrounds in the perf line;
    - "21 live knowledge points" becomes 19, and M3 carries E1 and E10;
    - the step and note totals;
    - the e2e count;
    - D1…D98 and all 98 deviations;
    - §22 in the VERIFICATION list;
    - the `PhotoMarks` sentence in the `ImageOverlay` trap;
    - the `sgg-metrics` sentence names the `classify` test beside the `boxIou` one.
  - **INDEX:**
    - the spec and plan rows;
    - D98;
    - §22;
    - "thirty cases" becomes forty-two;
    - the corpus totals;
    - the status and verification paragraphs.
  - **README:** the quoted counts.

- [ ] **Step 5: Verify and commit.** Run `npm run ci`; expected exit 0. Then `git commit -m "docs(sgs): D98 and VERIFICATION §22 for E1 and E10; counts brought up to date"`. Then request a review of the branch against `main`; the user merges.
