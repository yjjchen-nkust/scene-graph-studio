# Playground for M2: F3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the three statements about IoU that the opened sources contradict, then build F3 (one annotated box, a movable prediction, IoU, the scale bound and the threshold) as M2's new step s3, so M2 goes from 6 steps to 7.

**Architecture:** F3 is a component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, over the existing control kit, drawing `ph-001` from the committed placeholder slice through `playgrounds/slice.ts`. Its arithmetic lives in `playgrounds/logic.ts` as integer pixel counts and their quotient; one test holds the quotient equal to `sgg-metrics`' `boxIou`. Nothing computed is a metric.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12.

**Spec:** `docs/superpowers/specs/2026-09-27-playgrounds-m2-design.md`. It builds on `2026-09-19-playgrounds-design.md` (the step contract, §2; the shells, §4; testing, §6) and `2026-09-26-split-and-distinct-design.md` (parts, D96).

## Global Constraints

- **Branch `feat/playgrounds-m2`**, cut from `main` at `443abcb`. Do not merge; the user merges after review.
- **Working directory is `scene-graph-studio/system/`.** Every `npm` command runs there. Paths below are relative to it unless they start with `../`.
- **A playground computes a count, a bound or a set membership. Never a metric.** No R, mR or R@K in F3. Nothing in `frontend/src/playgrounds/` outside `test/` imports a value from `sgg-metrics`; types are allowed.
- **`system/web/knowledge-map/` is frozen** (D-13). Task 1 corrects it, which D-13 permits; no other task touches it, and Task 1 adds no control, output or knowledge point.
- **No figure is recalled.** Every number on screen is computed from `ph-001`, or is τ = 0.5 labelled "Xu et al. 2017, §4, p. 5".
- **Bilingual parity** (NFR-6): every i18n key in `en.json` and `zh-TW.json`; every MDX step in both locale files with the same id, `kind` and `kp`, and its own locale's presenter note.
- **Chinese is formal written Chinese** with Chinese punctuation (、。：「」（）／); numbers, proper nouns and technical terms verbatim. Titles are noun phrases.
- **Lecture legibility:** type in `em`, never below 18 px in the lecture shell; ink `slate-700` or darker on `slate-50`; colour never the only channel.
- **Knob ids equal their query keys:** `F3.dx`, `F3.dy`, `F3.lambda`, `F3.tau`.
- **Working-tree files are CRLF** (`core.autocrlf=true`), and the Edit tool inserts bare LF. Edit existing CRLF files with a CRLF-preserving script, then confirm with `git diff --stat` that only the intended lines changed. `data/content/*.json` is pinned LF in `.gitattributes`.
- **`npm run ci` exits 0 before every commit.** Kill any stale `vite preview` on port 4173 before `npm run test:e2e` or `npm run check:perf`.

## Review Focus

Five conditions the spec implies and no happy path exercises. Each has its test in the owning task.

1. **Knobs out of range or malformed in the URL**: `?F3.lambda=9`, `?F3.tau=0`, `?F3.dx=-999`. Expected: clamped to the §4.3 ranges; IoU and the bound are finite numbers in [0, 1], never `NaN`. *(Task 3)*
2. **λ off the 0.1 grid from the URL**, `?F3.lambda=1.45`. Expected: the sizes round to integers, the bound is computed from those integer areas, and IoU ≤ bound still holds. *(Task 2, property test)*
3. **IoU exactly equal to τ**: Δx = 30 gives 4 200 / 8 400 = 0.5. Expected: counted as the same object, because the rule is IoU ≥ τ. *(Task 4 golden case; Task 6 in Chromium)*
4. **The bound exactly equal to τ**: λ = 2 and τ = 0.25. Expected: the "no placement reaches τ" sentence is absent, since the concentric box reaches τ exactly. *(Task 4 golden case; Task 3 component test)*
5. **The prediction at the knob extremes**: every corner of Δx ∈ {−120, 120}, Δy ∈ {−100, 100} at λ = 2. Expected: the predicted box stays inside the 640 × 480 photograph. *(Task 2)*

---

### Task 1: The three corrections

**Files:**
- Modify: `web/knowledge-map/pg.js` (F3 block, around line 541)
- Modify: `web/knowledge-map/FROZEN.md` (append an entry)
- Modify: `frontend/src/content/m02.en.mdx` (s2 `presenter_notes_en`), `frontend/src/content/m02.zh-TW.mdx` (s2 `presenter_notes_zh`)

**Interfaces:** none produced.

- [ ] **Step 1: Correct the ceiling.** In F3's `draw`, replace `fx(Math.min(1,1/Math.max(s.sc,1/s.sc)),3)` with `fx(Math.min(s.sc*s.sc,1/(s.sc*s.sc)),3)`.

- [ ] **Step 2: Correct the note's clause.** In `note_en`, replace "The threshold \\(\\tau=0.5\\) is convention inherited from Xu et al., never stated in the reference metric implementation" with "The threshold \\(\\tau=0.5\\) is stated by Xu et al. (2017, §4) and set in the reference implementation's configuration, though not in its METRICS.md". In `note_zh`, replace 「門檻 \\(\\tau=0.5\\) 是沿襲 Xu et al. 的慣例，參考實作從未寫明」 with 「門檻 \\(\\tau=0.5\\) 由 Xu et al.（2017，§4）載明，並設定於參考實作之組態，惟其 METRICS.md 未載」. Leave the rest of both notes unchanged.

- [ ] **Step 3: Append the `FROZEN.md` entry** under the heading `### 2026-09-27 — F3's scale ceiling and its note`. It gives the before and after ceiling formulas, the λ = 1.42 example (0.704 before, 0.496 after), the three sources in spec §2 with their locators, and the line "No option, control or knowledge point was added."

- [ ] **Step 4: Correct M2 s2's presenter notes.** en: replace "That bound is what the τ slider in L2 is demonstrating." with "The playground at s3 moves λ past √2 and shows the bound; L2's τ slider moves the threshold over boxes of the right size." zh-TW: replace 「此上界為 L2 中 τ 滑桿的解釋依據。」 with 「s3 之互動元件將 λ 調過 √2 以呈現此上界；L2 之 τ 滑桿則於尺寸正確之框上調整門檻。」 (s3 exists from Task 5; the notes are read in the room only after that.)

- [ ] **Step 5: Verify.** Run `npm run harvest && git status --short ../data/content/kp.json`. Expected: no output, because `tools/harvest.mjs:74` extracts only `MATH` and `DERIV` from `pg.js`. Then run `npm run lint:frozen && npm run lint:content`. Expected: exit 0. Then open `web/knowledge-map/index.html` in a browser, find F3, set scale to 1.42, and read "scale ceiling". Expected: `0.496`. Record the reading for VERIFICATION §21 (Task 7).

- [ ] **Step 6: Commit**

```bash
npm run ci
git add web/knowledge-map/pg.js web/knowledge-map/FROZEN.md frontend/src/content/m02.en.mdx frontend/src/content/m02.zh-TW.mdx
git commit -m "fix(sgs): F3's frozen ceiling squared, its note and M2 s2's notes brought into line with the sources"
```

---

### Task 2: F3's arithmetic

**Files:**
- Create: `frontend/src/playgrounds/F3/setup.ts`
- Modify: `frontend/src/playgrounds/logic.ts` (a new `// ---- F3 ----` section)
- Test: `frontend/src/playgrounds/test/logic.test.ts`

**Interfaces:**
- Produces, in `F3/setup.ts`: `F3_FRAME = 'ph-001'`, `F3_OBJECT = 3`, `XU_TAU = 0.5` (its doc comment quotes Xu et al. §4 verbatim), and `F3_RANGES: { dx: [-120, 120, 2], dy: [-100, 100, 2], lambda: [0.5, 2, 0.1], tau: [0.05, 0.95, 0.05] }` as `[min, max, step]` tuples.
- Produces, in `logic.ts` (`BBox` is `import type` from `sgg-metrics`):
  - `scaledBox(gt: BBox, dx: number, dy: number, lambda: number): BBox`. w′ = `Math.round(lambda * gt.w)`, h′ likewise; x′ = `Math.round(gt.x + gt.w / 2 + dx - w′ / 2)`, y′ likewise.
  - `area(b: BBox): number`, which is w × h.
  - `intersection(a: BBox, b: BBox): BBox | null`. The boxes are half-open, so it returns `null` when the overlap has no positive width or height.
  - `unionArea(a: BBox, b: BBox): number`, which is A + A′ − |a ∩ b|.
  - `scaleBound(a: BBox, b: BBox): number`, which is min(A, A′) / max(A, A′), and 0 when either area is 0.
  - IoU is `ratio(area-of-intersection, unionArea)`, using the existing `ratio`.

- [ ] **Step 1: Write the failing tests** in `logic.test.ts`, `describe('F3: one box against its annotation')`, with `const GT = frameById(F3_FRAME)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox`:

```ts
it('reads the annotated box it is built on', () => {
  expect(GT).toEqual({ x: 250, y: 240, w: 90, h: 70 });
});
it('scales about the centre and rounds to whole pixels', () => {
  expect(scaledBox(GT, 0, 0, 1.4)).toEqual({ x: 232, y: 226, w: 126, h: 98 });
  expect(scaledBox(GT, 0, 0, 1.5)).toEqual({ x: 228, y: 223, w: 135, h: 105 });
  expect(scaledBox(GT, 0, 0, 0.5)).toEqual({ x: 273, y: 258, w: 45, h: 35 });
});
it('counts the intersection and the union in pixels', () => {
  const p = scaledBox(GT, 18, 0, 1);
  expect(intersection(GT, p)).toEqual({ x: 268, y: 240, w: 72, h: 70 });
  expect(unionArea(GT, p)).toBe(7560);
});
it('shares no pixel with a box whose edge only touches it', () => {
  expect(intersection(GT, scaledBox(GT, 90, 0, 1))).toBeNull();
});
it('bounds IoU by the ratio of the two areas', () => {
  expect(scaleBound(GT, scaledBox(GT, 0, 0, 1.5))).toBeCloseTo(6300 / 14175, 12);
});
it('never lets IoU exceed the bound, on or off the λ grid', () => {
  for (const lambda of [0.5, 0.73, 1, 1.4, 1.45, 1.5, 2]) {
    for (const dx of [-120, -30, 0, 30, 120]) {
      for (const dy of [-100, 0, 100]) {
        const p = scaledBox(GT, dx, dy, lambda);
        const i = intersection(GT, p);
        const iou = ratio(i ? area(i) : 0, unionArea(GT, p));
        expect(iou).toBeLessThanOrEqual(scaleBound(GT, p) + 1e-12);
      }
    }
  }
});
it('keeps the prediction inside the photograph at every extreme of the knobs', () => {
  for (const dx of [-120, 120]) for (const dy of [-100, 100]) {
    const p = scaledBox(GT, dx, dy, 2);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(640);
    expect(p.y + p.h).toBeLessThanOrEqual(480);
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: FAIL, because `scaledBox` is not exported.

- [ ] **Step 3: Implement** `F3/setup.ts` and the five functions, with the signatures given above.

- [ ] **Step 4: Run the tests and confirm they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run ci
git add frontend/src/playgrounds/F3/setup.ts frontend/src/playgrounds/logic.ts frontend/src/playgrounds/test/logic.test.ts
git commit -m "feat(sgs): F3's arithmetic: a scaled box, two pixel counts and the scale bound"
```

---

### Task 3: The F3 component, registered

**Files:**
- Create: `frontend/src/playgrounds/F3/BoxOverlap.tsx`
- Create: `frontend/src/playgrounds/F3/test/BoxOverlap.test.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx` (add `F3: BoxOverlap`)
- Modify: `frontend/src/playgrounds/test/Playground.test.tsx:23` (the pinned ids gain `'F3'`)
- Modify: `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`

**Interfaces:**
- Consumes: Task 2's `setup.ts` and `logic.ts` exports; `frameById`; `useLabParams`; `Slider`, `Readout` and `PlaygroundFrame` from `../controls`.
- Produces: `export function BoxOverlap({ part }: PlaygroundProps = {})`. The test ids are:
  - the knobs `F3.dx`, `F3.dy`, `F3.lambda`, `F3.tau`;
  - the readouts `readout-F3.intersection`, `readout-F3.union`, `readout-F3.iou`, `readout-F3.bound`, each with a `-value` element;
  - the status line `f3-member`, and `f3-unreachable`, which is present only when the bound < τ;
  - the picture `f3-picture`, with the marks `f3-gt`, `f3-pred`, and `f3-inter`, which is present only when the intersection is non-null.

**Copy** (key: en / zh-TW):

| Key | en | zh-TW |
|---|---|---|
| `playground.f3.dx` | Shift Δx | 水平位移 Δx |
| `playground.f3.dy` | Shift Δy | 垂直位移 Δy |
| `playground.f3.lambda` | Scale λ | 尺度 λ |
| `playground.f3.tau` | Threshold τ | 門檻 τ |
| `playground.f3.tau_origin` | τ starts at 0.5: Xu et al. 2017, §4, p. 5 | τ 起始值 0.5：Xu 等人 2017，§4，第 5 頁 |
| `playground.f3.intersection` | Intersection \|b ∩ b′\|, pixels | 交集 \|b ∩ b′\|（像素） |
| `playground.f3.union` | Union \|b ∪ b′\|, pixels | 聯集 \|b ∪ b′\|（像素） |
| `playground.f3.iou` | IoU | IoU |
| `playground.f3.bound` | Bound min(A, A′) / max(A, A′) | 上界 min(A, A′) / max(A, A′) |
| `playground.f3.member` | IoU ≥ τ: counted as the same object | IoU ≥ τ：視為同一物件 |
| `playground.f3.not_member` | IoU < τ: not counted as the same object | IoU < τ：不視為同一物件 |
| `playground.f3.unreachable` | At this λ the bound is below τ: no placement reaches τ. | 此 λ 下上界低於 τ：任何位置皆無法達到 τ。 |
| `playground.f3.legend` | Solid: the annotation. Dashed: the prediction. Hatched: their intersection. | 實線：標註框；虛線：預測框；斜線：兩者之交集。 |

**Layout.**
- Controls: the four sliders, each clamped with `clamp` to `F3_RANGES`. τ's `valueLabel` is `tau.toFixed(2)`, and `tau_origin` is printed beneath the controls.
- Visual: `PlaygroundFrame title="F3" clip={false}`. A flex column, which becomes `lg:flex-row`, holds:
  - the picture, in a `min-w-0 flex-1` box with `maxWidth: calc(34vh * 640 / 480)`, containing the `<img>` in flow and an absolutely positioned `<svg viewBox="0 0 640 480">`. The ground truth is a solid stroke, the prediction has a `stroke-dasharray`, and the intersection is filled with a hatch `<pattern>`. The SVG label text over the ground-truth box reads `box #3`, taken from the frame's data;
  - the column of four readouts, then `f3-member`, then `f3-unreachable` when shown, then the legend.
- Counts are formatted with `new Intl.NumberFormat('en-US')` (as X1 does). IoU and the bound use `toFixed(3)`.
- The readout notes are:
  - intersection: `w × h` of the overlap, or `0` when it is null;
  - union: `A + A′ − I`;
  - IoU: `I / U`;
  - bound: `min / max`.
- One part. Task 6 decides whether a split is needed.

- [ ] **Step 1: Write the failing tests** in `BoxOverlap.test.tsx`, with `const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><BoxOverlap /></MemoryRouter>)` and `setLocale('en')` in `beforeEach`:

```ts
it('opens on the annotation itself: IoU 1 and counted as the same object', () => {
  renderAt('/m/m02');
  expect(screen.getByTestId('readout-F3.intersection-value')).toHaveTextContent('6,300');
  expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('1.000');
  expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ: counted as the same object');
  expect(screen.queryByTestId('f3-unreachable')).toBeNull();
});
it('past √2 the bound falls below τ and says no placement reaches it', () => {
  renderAt('/m/m02?F3.lambda=1.5');
  expect(screen.getByTestId('readout-F3.bound-value')).toHaveTextContent('0.444');
  expect(screen.getByTestId('f3-member')).toHaveTextContent('not counted');
  expect(screen.getByTestId('f3-unreachable')).toBeInTheDocument();
});
it('with the bound exactly at τ, the concentric box reaches it and nothing is claimed unreachable', () => {
  renderAt('/m/m02?F3.lambda=2&F3.tau=0.25');
  expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('0.250');
  expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ');
  expect(screen.queryByTestId('f3-unreachable')).toBeNull();
});
it('clamps knobs the URL puts out of range', () => {
  renderAt('/m/m02?F3.lambda=9&F3.tau=0&F3.dx=-999');
  expect(screen.getByTestId('F3.lambda')).toHaveValue('2');
  expect(screen.getByTestId('F3.tau')).toHaveValue('0.05');
  expect(screen.getByTestId('F3.dx')).toHaveValue('-120');
  expect(screen.getByTestId('readout-F3.iou-value').textContent).toMatch(/^[01]\.\d{3}$/);
});
it('draws three marks that differ in shape, not only in colour', () => {
  renderAt('/m/m02?F3.dx=18');
  expect(screen.getByTestId('f3-gt').getAttribute('stroke-dasharray')).toBeNull();
  expect(screen.getByTestId('f3-pred').getAttribute('stroke-dasharray')).toBeTruthy();
  expect(screen.getByTestId('f3-inter').getAttribute('fill')).toMatch(/^url\(#/);
});
it('draws no intersection when the boxes only touch', () => {
  renderAt('/m/m02?F3.dx=90');
  expect(screen.queryByTestId('f3-inter')).toBeNull();
  expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('0.000');
});
it('reads in 繁體中文', () => {
  setLocale('zh-TW');
  renderAt('/m/m02');
  expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ：視為同一物件');
});
it('takes no focus on mount', () => {
  renderAt('/m/m02');
  expect(document.activeElement).toBe(document.body);
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/F3`. Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement** the component, add the i18n keys, register `F3: BoxOverlap` in `mounts.tsx`, and change `Playground.test.tsx:23` to `['F1', 'F2', 'F3', 'F6', 'F7', 'F8', 'X1']`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
npm run ci
git add frontend/src/playgrounds/F3 frontend/src/playgrounds/mounts.tsx frontend/src/playgrounds/test/Playground.test.tsx frontend/src/i18n/en.json frontend/src/i18n/zh-TW.json
git commit -m "feat(sgs): F3, one annotated box against a prediction the student moves"
```

---

### Task 4: The golden cases and the cross-check

**Files:**
- Modify: `../data/content/playground_golden.json` (eight cases appended)
- Modify: `frontend/src/playgrounds/test/golden.test.ts` (a `F3` entry in `RUNS` and its block)
- Modify: `frontend/src/playgrounds/test/logic.test.ts` (the `boxIou` cross-check)

**Interfaces:**
- Consumes: Task 2's functions and `F3/setup.ts`.
- Produces: eight cases with `kp: "F3"` and `image_id: "ph-001"`. Knobs are `{ dx, dy, lambda, tau }`. Expect is `{ intersection, union, iou, bound, member, unreachable }`, where `member` is IoU ≥ τ and `unreachable` is bound < τ.

| id | knobs (dx, dy, λ, τ) | intersection | union | iou | bound | member | unreachable |
|---|---|---|---|---|---|---|---|
| `pg-F3-identical` | 0, 0, 1, 0.5 | 6300 | 6300 | 1 | 1 | true | false |
| `pg-F3-lambda-14` | 0, 0, 1.4, 0.5 | 6300 | 12348 | 0.510204 | 0.510204 | true | false |
| `pg-F3-lambda-15` | 0, 0, 1.5, 0.5 | 6300 | 14175 | 0.444444 | 0.444444 | false | true |
| `pg-F3-shift-18` | 18, 0, 1, 0.5 | 5040 | 7560 | 0.666667 | 1 | true | false |
| `pg-F3-at-threshold` | 30, 0, 1, 0.5 | 4200 | 8400 | 0.5 | 1 | true | false |
| `pg-F3-touching` | 90, 0, 1, 0.5 | 0 | 12600 | 0 | 1 | false | false |
| `pg-F3-inside` | 0, 0, 0.5, 0.5 | 1575 | 6300 | 0.25 | 0.25 | false | true |
| `pg-F3-bound-equals-tau` | 0, 0, 2, 0.25 | 6300 | 25200 | 0.25 | 0.25 | true | false |

Each `why` writes out the sizes, the positions and the division. For example, `pg-F3-at-threshold`: "Object 3 is 90 x 70 at (250, 240), A = 6300. Shifted 30 px right it spans x 280 to 370, so the overlap is (340 - 280) x 70 = 4200 and the union is 6300 + 6300 - 4200 = 8400. IoU = 4200 / 8400 = 0.5, which meets tau = 0.5 because acceptance is IoU >= tau."

- [ ] **Step 1: Write the failing tests.**
  - Add `F3: (c) => c.kp === 'F3'` to `RUNS`, and an `it.each(run('F3'))` block. It computes `p = scaledBox(GT, dx, dy, lambda)` and asserts `intersection`, `union`, `iou` (`toBeCloseTo(…, 6)`), `bound` (`toBeCloseTo(…, 6)`), `member` and `unreachable` against `c.expect`.
  - Add a block that asserts `run('F3')` has length 8, so the block cannot pass by running nothing.
  - In `logic.test.ts`, add `import { boxIou } from 'sgg-metrics'` and a test named `F3's IoU equals the engine's boxIou on every golden case`, asserting `ratio(I, U)` `toBeCloseTo(boxIou(GT, p), 12)` for each F3 case.

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/golden.test.ts`. Expected: FAIL on the length-8 assertion.

- [ ] **Step 3: Append the eight cases** to `playground_golden.json`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/playgrounds/test && npm run lint:content`. Expected: PASS and exit 0. Rules 9 to 11 accept the cases.

- [ ] **Step 5: Commit**

```bash
npm run ci
git add ../data/content/playground_golden.json frontend/src/playgrounds/test/golden.test.ts frontend/src/playgrounds/test/logic.test.ts
git commit -m "test(sgs): F3's eight golden cases, and its IoU held to the engine's boxIou"
```

---

### Task 5: M2 gains s3

**Files:**
- Modify: `frontend/src/content/m02.en.mdx`, `frontend/src/content/m02.zh-TW.mdx`
- Modify: `frontend/src/content/test/registry.test.tsx` (a pin for M2 in `describe('the playground step kind')`)

**Interfaces:**
- Consumes: `F3` registered (Task 3).
- Produces: M2's steps `s1:prose, s2:math, s3:playground/F3, s4:prose, s5:prose, s6:lab, s7:checkpoint`, which the lecture URLs `/lecture/m/m02/0` to `/6` address. F3 is at `/lecture/m/m02/2`.

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`:

```ts
it('M2 carries F3 directly after the step that teaches it', () => {
  const meta = getMeta('m02', 'en')!;
  expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}` : ''}`)).toEqual([
    's1:prose', 's2:math', 's3:playground/F3', 's4:prose', 's5:prose', 's6:lab', 's7:checkpoint',
  ]);
});
```

- [ ] **Step 2: Run the test and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL at `s3:prose`.

- [ ] **Step 3: Renumber, in descending order so no id collides.** In both locale files, rename s6 → s7, s5 → s6, s4 → s5 and s3 → s4, in the front matter and in the `<Step id>` tags.

- [ ] **Step 4: Insert s3** into both files: front matter directly after s2, and body directly after `</Step>` of s2.

```yaml
  - id: s3
    kind: playground
    kp: F3
    seconds_budget: 180
```

Each file carries its own locale's note:
- `presenter_notes_en`: "Three minutes. Open concentric and set λ to 1.4: the bound reads 0.510 and the box counts as the same object. Move λ to 1.5: the bound falls to 0.444, below τ = 0.5, and no Δx or Δy brings it back; that is s2's √2 made visible. Return λ to 1 and move Δx to 30: IoU is exactly 0.500, and the box still counts, because the rule is IoU ≥ τ. Move τ last, and say that 0.5 is the value Xu et al. state, not part of the definition."
- `presenter_notes_zh`: 「三分鐘。先於同心位置將 λ 調至 1.4：上界為 0.510，預測框視為同一物件。將 λ 調至 1.5：上界降為 0.444，低於 τ = 0.5，任何 Δx 或 Δy 皆無法使其通過，此即 s2 之 √2 界限。其後將 λ 還原為 1，Δx 調至 30：IoU 恰為 0.500，因判定規則為 IoU ≥ τ，仍視為同一物件。最後調整 τ，並說明 0.5 為 Xu 等人所載明之數值，而非定義之一部分。」

Bodies: en `## IoU and the threshold, on one box`; zh-TW `## 單一邊界框之 IoU 與門檻`. Each is followed by `<Playground kp="F3" />` inside `<Step id="s3">…</Step>`.

- [ ] **Step 5: Run the tests and confirm they pass.** Run `npx vitest run frontend/src/content && npm run lint:content`. Expected: PASS and exit 0. Rules 1 to 8 accept the step, and presenter notes are present in both locales (D76).

- [ ] **Step 6: Commit**

```bash
npm run ci
git add frontend/src/content/m02.en.mdx frontend/src/content/m02.zh-TW.mdx frontend/src/content/test/registry.test.tsx
git commit -m "feat(sgs): M2 s3, F3 after the step that derives its bound"
```

---

### Task 6: Chromium: interaction, legibility, fit, time

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`, `e2e/perf.spec.ts`
- Conditional, only if Step 4 fails: `frontend/src/playgrounds/F3/BoxOverlap.tsx`, `frontend/src/playgrounds/mounts.tsx` (`PLAYGROUND_PARTS`), both M2 locale files, and `registry.test.tsx`

**Interfaces:**
- Consumes: `/lecture/m/m02/2` (Task 5) and the test ids from Task 3.

- [ ] **Step 1: Write the lecture tests.**
  - `M2's playground computes with no backend running`: at `/lecture/m/m02/2`, `readout-F3.iou-value` has the text `1.000`, and `f3-member` matches `/IoU ≥ τ/`.
  - `M2's knobs work from the keyboard and never advance the deck`: the cases are `F3.dx` ArrowRight, `F3.dy` ArrowRight and `F3.lambda` ArrowRight, each watching `readout-F3.iou-value`. Add `F3.tau` ArrowRight, opened at `?F3.dx=30`, watching `f3-member`, where τ 0.5 → 0.55 turns "IoU ≥ τ" into "IoU < τ". Each case also asserts that `position` is unchanged.
  - `M2's knobs write the address bar`: `F3.lambda` ArrowRight → URL `/F3\.lambda=1\.1/`. The shared URL is reopened cold, and `readout-F3.union-value` contains `7,623` (99 × 77).
  - Add `['m02', 2]` to `no playground takes focus when its step opens`.
  - Extend the study-shell test to cover M2: `/m/m02` shows 1 `playground-frame`.

- [ ] **Step 2: Write the projector additions.**
  - Add `'m02/2?F3.lambda=2&F3.tau=0.95&F3.dx=120&F3.dy=100'` to `PARTS_LONGEST`. This is the state with both status lines and the longest notes. Amend the comment so that F3, one step, is named.
  - Add `'m02/2'` to `a playground step fits the panel, with its controls reachable`.
  - Add `...[0, 1, 2, 3, 4, 5, 6].map((s) => ['m02', s] as const)` to the 18 px walk.
  - Add `{ module: 'm02', step: 2, floor: N }` to the contrast walk. N is the measured row count less about a quarter, and the count goes in the comment beside the others.
  - Generalise `F1 shows its photograph` to loop over `['m00/1', 'm02/2']`, and rename it `F1 and F3 show their photographs, whole and on the screen`.

- [ ] **Step 3: Write the perf addition.** Add `{ module: 'm02', kp: 'F3', step: 2, act: { kind: 'set', testid: 'F3.lambda', value: '1.5' }, readout: '[data-testid="playground-frame"] [data-testid^="readout-"]', why: 'scaling the prediction re-counts its intersection and union' }`. The count test becomes "all seven playgrounds", with the message "M0, M1 and M2 carry seven".

- [ ] **Step 4: Run.** Run `npm run test:e2e`. Expected: all pass. If `every part … fits the panel` fails for `m02/2`, record the overshoot in px at each size, then split:
  - `PLAYGROUND_PARTS.F3 = 2`;
  - part 1 holds the picture, Δx, Δy, λ and the four readouts; part 2 holds τ, `f3-member`, `f3-unreachable` and the legend;
  - M2 becomes s3 (part 1) and s4 (part 2), each with 90 s and its own presenter notes, and the later steps shift by one again;
  - the pins in Task 5's test and in Step 1–2 follow;
  - PARTS_LONGEST lists both parts.
  Then re-run until all pass.

- [ ] **Step 5: Run perf.** Run `npm run check:perf`. Expected: exit 0, with F3 reported against the two-frame floor and not as a clamped zero (D91). Record the figure for §21.

- [ ] **Step 6: Commit**

```bash
npm run ci
git add e2e frontend/src
git commit -m "test(sgs): F3 in Chromium: keyboard, address bar, legibility, fit and input-to-paint"
```

---

### Task 7: Records, and the full gate

**Files:**
- Modify: `../DEVIATIONS.md` (append **D97**), `../docs/VERIFICATION.md` (append **§21**), `../docs/INDEX.md`, `../README.md`, `../CLAUDE.md`, `../docs/superpowers/specs/2026-09-27-playgrounds-m2-design.md` (status line only, if the split in Task 6 happened: an in-place bracketed amendment to §4.6)

**Interfaces:** none.

- [ ] **Step 1: Run the full gate and collect the counts.**
  - Run `npm run ci`, `npm run test:e2e` and `npm run check:perf`, and record each exit code and test count.
  - Count M2's steps and the corpus totals: 104 steps and 208 notes if F3 is one step, or 105 and 210 if it is two parts.

- [ ] **Step 2: Write D97.** It covers:
  - the cycle;
  - spec §2's three findings, with their sources and locators;
  - the out-of-scope note about kp F3's `knobs` field (it names x, y, w, h; F3 implements Δx, Δy and λ because s2's bound is stated in λ);
  - the Task 6 fit measurement, and the split if it happened.

- [ ] **Step 3: Write VERIFICATION §21**, "The M2 playground — measured, 2026-09-27". It records:
  - the frozen-page reading at λ = 1.42 from Task 1;
  - the golden cases (30 in the file, 8 for F3);
  - the `boxIou` cross-check;
  - the three gate commands with their exit codes and counts;
  - F3's fit at the three sizes;
  - its input-to-paint time.

- [ ] **Step 4: Update the counts.**
  - `CLAUDE.md`:
    - "6 playgrounds" becomes 7, and "six playgrounds" becomes seven;
    - "22 live knowledge points have none" becomes 21, and M2 carries F3;
    - the step and note totals change;
    - the e2e test count changes;
    - "D1…D96" becomes D97, "all 96 logged deviations" becomes 97, and §21 is added to the VERIFICATION list;
    - the playground trap's sentence on `sgg-metrics` names the one test that imports `boxIou`.
  - `docs/INDEX.md`:
    - the spec and plan rows are marked **executed**;
    - "twenty-two cases" becomes thirty;
    - the VERIFICATION row gains §21;
    - the step and note totals in the paragraph at line 216 change.
  - `README.md`: any quoted counts are updated.

- [ ] **Step 5: Verify the records.** Run `npm run ci`. Expected: exit 0, and `git status --short` shows only the files this task names.

- [ ] **Step 6: Commit**

```bash
git add ../DEVIATIONS.md ../docs ../README.md ../CLAUDE.md
git commit -m "docs(sgs): D97 and VERIFICATION §21 for F3; counts brought up to date"
```

Then request a review of the branch against `main`. The user merges.
