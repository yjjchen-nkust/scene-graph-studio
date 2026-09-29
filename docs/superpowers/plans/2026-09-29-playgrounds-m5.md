# Playgrounds for M5: T1 and T2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct M5's statements about pair counts and message passing that the corpus and M5's own derivation contradict, then build T1 and T2 as playground steps directly after the math steps that teach them.

**Architecture:** Each playground is a component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, over the control kit. T1 reads the 80 frames of the vg150-sgb slice through `playgrounds/M5/pairs.ts`, ordered by object count and then by image id as a number; T2 reads ph-001's six objects, spec §4.2's starting beliefs and ph-001's annotated relations through `playgrounds/M5/beliefs.ts`, over the annotated relations or every pair. The arithmetic lives in `playgrounds/logic.ts`: the related ordered pairs of a frame, the neighbour lists and their row-normalised matrix, one round and t rounds of the rule, the fixed point by Gaussian elimination, the max-norm distance, the spread and the degree-weighted mean. Nothing computed is a metric, and nothing touches `sgg-metrics`.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, KaTeX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12.

**Spec:** `docs/superpowers/specs/2026-09-29-playgrounds-m5-design.md`. It builds on the M0 playground design (the step contract), the split design (parts, D96) and the M4 design and plan (`dense`, the order of registration and golden cases, D106).

## Global Constraints

- **Branch `feat/playgrounds-m5`**, cut from `main` at `dfe4dc4`; the spec is its first commit, `57e678b`. The next deviation is **D111**; the next VERIFICATION section is **§30**.
- **Working directory is `scene-graph-studio/system/`.** Every `npm` and `npx` command runs there. Paths are relative to it unless they start with `../`.
- **Python:** `SGS_PYTHON` set to `C:\Python\pyVenv\py12\Scripts\python.exe` before `npm run ci` (Git Bash: `export SGS_PYTHON=/c/Python/pyVenv/py12/Scripts/python.exe`; PowerShell: `$env:SGS_PYTHON = 'C:\Python\pyVenv\py12\Scripts\python.exe'`).
- **A playground computes a count, a bound, a set membership or a belief under a stated rule. Never a metric.** No R, mR or R@K is displayed. Nothing in `frontend/src/playgrounds/` outside `test/` imports a value from `sgg-metrics`; T1 and T2 import nothing from it at all (spec §4.3).
- **Notation (controller's ruling, 2026-09-29; spec §2 amended):** the averaging matrix is **S** in every displayed string (MDX, symbol table, map notes, `FROZEN.md`, D111, golden `why` texts), never A, which M2 defines as area; the limit is written Σⱼ dⱼ b⁽⁰⁾ⱼ / Σⱼ dⱼ, never with π, which M4 defines. Code identifiers such as the parameter `a` are not displayed and stay.
- **The data are the spec's, exactly.** T1: the 80 frames of `VG_FRAMES`, spec §4.1's order and totals, |P| = 50 through the existing `VG150_PREDICATES` of `E10/setup.ts`, no photograph. T2: ph-001's six objects, spec §4.2's b⁽⁰⁾ = (0.9, 0.2, 0.7, 0.4, 0.1, 0.6) for object ids 1 to 6, the relation neighbourhood read from ph-001's six relationships. A test that disagrees with spec §2 or §4 to four decimals is the defect, not the spec, unless the implemented function, re-run, says otherwise; then stop and report.
- **`data/` is not in git (D109) and is a directory junction to `C:\DataRaw\scene-graph` on the NAS (D110).** `npm run harvest` (Task 1) and the golden cases (Task 6) write `../data/content/*.json`, which lands on the NAS and appears in no commit and no `git diff`. **Each task that changes a data file records in its report the exact change**: the new JSON entries verbatim, or the before and after of each changed value, so a reviewer can check what no diff shows. Data JSON stays LF. **Never `rm -rf data/`** with the trailing slash: it deletes the NAS files through the link.
- **Bilingual parity** (NFR-6); **formal written Chinese** (書面語) with Chinese punctuation (、。：「」（）／); titles are noun phrases; no second person (廠內／現場, never 你); numbers, proper nouns and technical terms verbatim. Display math is shared by both locales, as M5's already is.
- **Lecture legibility:** type in `em`, never below 18 px; ink `slate-700` or darker; T1 and T2 draw no SVG.
- **Knob ids equal their query keys:** `T1.frame`, `T2.graph`, `T2.w`, `T2.t`. Numbers pass through `snap(value, low, high, step)`; a string knob not among its options falls back to its default.
- **Both frames are `clip={false}` and `dense`.** Neither draws a picture (D93). `dense` was M4's opt-in (D106) so that nine earlier playgrounds keep the spacing their records measured; T1 and T2 have no earlier measurement to move, and X2's four readouts ran 74 px past 1024 × 768 at the base spacing (D106), where T1 carries six and T2 a six-row table beside three. Task 5 adds both to the dense pin in `Playground.test.tsx`.
- **Parts follow D96, by measurement.** T1 and T2 are one step each until Task 7 measures each in its longest state at 1024 × 768 in 繁體中文; Task 7 splits one that runs past the panel, by the recipe given there.
- **Order, departing from the controller's breakdown where the code requires it.** Registration moves to the task that inserts the steps (Task 5), and the golden cases follow it (Task 6): `KnowledgeIndex.test.tsx:75-90` fails for a registered playground with no lecture step, and `content_lint.mjs:271-273` refuses a golden case for an unregistered one. M4 met both (D106: "E3 registered alone failed 1 test of 943"; "Task 9 ran after Task 10"). Tasks 3 and 4 test their components by direct mount.
- **The records counts are read at every `npm run ci`.** `registry.test.tsx:769-794` compares CLAUDE.md's, INDEX's and README's playground, uncovered-point, step, note and split counts with the mount table, the harvest and the modules. The commit that registers a playground (Task 5) or splits one (Task 7) updates those phrases in the same commit.
- **Working-tree files are CRLF** (`core.autocrlf=true`). Never `sed -i` in Git Bash (it strips CR). Edit with the Edit tool, or a Node script that keeps CRLF; confirm with `git diff --stat`. Backslashes in Bash heredocs and `node -e` strings are collapsed: any edit or script that carries a regex or LaTeX goes in a file, never inline.
- **`npm run ci` exits 0 before every commit.** Kill any stale `vite preview` on port 4173 before `test:e2e` or `check:perf`. Commits carry no trailer.

## Review Focus

1. **Knobs the URL invented:** `?T1.frame=999`, `?T1.frame=0`, `?T1.frame=abc`, `?T1.frame=40.6`, `?T2.w=1.7`, `?T2.w=0.53`, `?T2.graph=foo`, `?T2.t=-3`, `?T2.t=99`. Expected: rank 80 (frame 3182), rank 1, rank 40, rank 41; w = 1 with the limit shown, w = 0.55; `relations`; t = 0; t = 40. Never a blank panel, never `NaN`, never a fixed point solved at w = 1. *(Tasks 3 and 4)*
2. **w = 1 hides the distance and the bound and shows the limit:** no `readout-T2.distance` or `readout-T2.bound` element at all, not one reading `NaN` or `0.0000`; `readout-T2.limit` 0.5083 beside `readout-T2.mean` 0.4833 on the relations, 0.4833 beside 0.4833 on every pair; `fixedPoint` returns `null` and nothing divides by it. *(Tasks 2 and 4)*
3. **w = 0 shows that nothing moves:** at `?T2.w=0&T2.t=40` every b⁽ᵗ⁾ equals its b⁽⁰⁾, the distance and the bound are both 0.0000 (0⁰ = 1 times a zero distance), and the regime line says no neighbour is consulted. *(Tasks 2 and 4)*
4. **The bound, and no claim beyond it:** distance ≤ bound at every t from 0 to 40, for every w on the knob below 1 and both graphs, with equality at t = 0. The spread is not monotone in t (every pair, w = 0.9: 0.0640 at t = 1, below 0.0678 at b*); no text or note says it falls monotonically. *(Tasks 2 and 6)*
5. **The complete-graph statement names the node itself:** s3's Implications state the one-round fixed point for averaging over all n nodes, i included (S = 𝟏𝟏ᵀ/n). T2's "every pair" excludes i and does not reach b* in one round (w = 0.5, t = 1: distance 0.0227). Nothing in the course says it does. *(Tasks 1 and 2)*
6. **A pair counted once, and ties broken as numbers:** `?T1.frame=2` is frame 4176, 18 relationship rows on 7 of its 12 ordered pairs, shown as 7 / 12, never 18 / 12. Rank 40 is frame 547, not 1246, which sorts first as a string. *(Tasks 2 and 3)*
7. **What no commit shows:** the harvest's three files and the golden file change on the NAS only; Task 1's and Task 6's reports list every changed value and every new case. *(Tasks 1 and 6)*
8. **A knob set on a playground's first part reaches its second** (only if Task 7 splits T2): `m05/4?T2.w=1`, ArrowRight, and `readout-T2.limit-value` reads 0.5083. *(Task 7)*
9. **The course no longer cites the old rate:** M7's opening note and first step state M5's corrected rate, and no module says "one candidate pair in a hundred thousand" or 每十萬. *(Task 1)*

---

### Task 1: The corrections

**Files:**
- Modify: `frontend/src/content/m05.en.mdx`, `frontend/src/content/m05.zh-TW.mdx` (front-matter symbols `S` and `\mathcal{N}(i)`; s2 Implications and presenter notes; s3 Intuition, Formal, Worked, Implications and presenter notes; s5 body; s6 body and presenter notes)
- Modify: `frontend/src/content/m07.en.mdx`, `frontend/src/content/m07.zh-TW.mdx` (s1 presenter notes and s1 body: the rate they quote from M5)
- Modify: `web/knowledge-map/pg.js` (DERIV T1; MATH T2; DERIV T2; the T1 and T2 notes), `web/knowledge-map/FROZEN.md`
- Regenerated on the NAS, in no commit: `../data/content/kp.json`, `math.json`, `deriv.json`
- Test: `frontend/src/content/test/registry.test.tsx`

**Interfaces:** none produced.

**M7 is beyond spec §3's list.** `m07.en.mdx:19` and `:45` and `m07.zh-TW.mdx:19` and `:45` quote M5's rate as "about one candidate pair in a hundred thousand" / 約每十萬組候選配對僅一組. Once s2 is corrected that rate is stated nowhere in M5, so M7 is corrected with it and D111 records why.

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`, beside M4's corrections test in `describe('the playground step kind')`:

```tsx
it('M5 states the pair counts and the averaging rule its corpus and its derivation support', () => {
  // Spec §2: s2 used GQA's 310 predicates, which no source here states, for "≈ 20 relations";
  // s3's Formal line claimed consensus for every w > 0, its Worked step reached its fixed point in
  // one round under a whole-graph mean, and its Implications wrote a non-expression and a per-step
  // contraction that the checkpoint repeated.
  const text = (file: string) => source(file).replace(/\s+/g, ' ');
  for (const file of ['../m05.en.mdx', '../m05.zh-TW.mdx']) {
    const m05 = text(file);
    for (const present of [
      '\\lvert\\mathcal{P}\\rvert=50\\ (\\text{VG150})',
      '6{,}320\\cdot 50=316{,}000',
      '651 \\text{ of } 26{,}282',
      '(1-w)(I-wS)^{-1}\\,b^{(0)}',
      '(I-wS)\\,b^{\\ast}=(1-w)\\,b^{(0)}',
      '\\lVert b^{(t)}-b^{\\ast}\\rVert_\\infty\\le w^{t}\\,\\lVert b^{(0)}-b^{\\ast}\\rVert_\\infty',
      'd^{\\top}S &= d^{\\top}',
      'S=\\tfrac{1}{n}\\mathbf{1}\\mathbf{1}^{\\top}',
      'data/predictions/',
    ]) {
      expect(m05, `${file}: ${present}`).toContain(present);
    }
    for (const absent of [
      '\\lvert\\mathcal{P}\\rvert=310', '1{,}958{,}800', '\\approx 20', '(1-w^t)', 'per step',
      'information destroyed', 'committed predictions', '{w>0}',
    ]) {
      expect(m05, `${file}: ${absent}`).not.toContain(absent);
    }
  }
  expect(text('../m05.en.mdx')).not.toContain('hundred thousand');
  expect(text('../m05.zh-TW.mdx')).not.toMatch(/每十萬|每步收縮|既存預測/);
  for (const locale of ['en', 'zh-TW'] as const) {
    expect(getMeta('m05', locale)!.symbols!.map((s) => s.sym))
      .toEqual(expect.arrayContaining(['S', '\\mathcal{N}(i)']));
  }
  // M7 quoted M5's old rate in its opening note and its first step, in both locales.
  expect(text('../m07.en.mdx')).not.toContain('hundred thousand');
  expect(text('../m07.en.mdx')).toContain('forty-five thousand');
  expect(text('../m07.zh-TW.mdx')).not.toContain('十萬');
  expect(text('../m07.zh-TW.mdx')).toContain('四萬五千');
  // The harvest carries the corrected s2 and s3; the Formal line of s2 is unchanged.
  const formulas = math as Record<string, string>;
  const derivations = deriv as Record<string, string>;
  expect(formulas.T1).toContain('N(N-1)\\lvert\\mathcal{P}\\rvert');
  expect(formulas.T2).toContain('(I-wS)^{-1}');
  expect(formulas.T2).not.toContain('information destroyed');
  expect(derivations.T1).toContain('316{,}000');
  expect(derivations.T1).not.toContain('310');
  expect(derivations.T2).toContain('d^{\\top}S &= d^{\\top}');
  for (const absent of ['(1-w^t)', 'per step']) expect(derivations.T2, absent).not.toContain(absent);
  // The map's notes, read without the toy's controls (T1's slider still runs to 310, spec §8).
  const map = source('../../../../web/knowledge-map/pg.js');
  const t1 = /pg\(\{id:'T1'[\s\S]*?note_en:'((?:[^'\\]|\\.)*)',\s*note_zh:'((?:[^'\\]|\\.)*)'/.exec(map);
  const t2 = /pg\(\{id:'T2'[\s\S]*?note_en:'((?:[^'\\]|\\.)*)',\s*note_zh:'((?:[^'\\]|\\.)*)'/.exec(map);
  for (const note of [t1?.[1], t1?.[2]]) {
    expect(note).toContain('316,000');
    expect(note).not.toMatch(/310|GQA/);
  }
  expect(t2?.[1]).toContain('degree-weighted mean');
  expect(t2?.[1]).not.toContain('converges to the graph mean');
  expect(t2?.[2]).toContain('依分支度加權之平均');
  expect(t2?.[2]).not.toContain('收斂到全圖平均');
  for (const locale of ['en', 'zh-TW'] as const) {
    for (const step of getModule('m05', locale)!.filter((s) => s.kind === 'math')) {
      const { container, unmount } = render(<>{step.node}</>);
      expect(container.querySelector('.katex-error'), `${locale} ${step.id}`).toBeNull();
      unmount();
    }
  }
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL on the first `toContain`, `\lvert\mathcal{P}\rvert=50\ (\text{VG150})`.

- [ ] **Step 3: The display math, identical in both files.**
  - **s2 Implications** (the `$$ … $$` inside `<Implications>`) becomes:

```latex
\begin{gathered}\lvert\mathcal{P}\rvert=50\ (\text{VG150}),\ N=12:\quad 12\cdot 11=132 \ \text{pairs},\quad 132\cdot 50=6{,}600 \ \text{decisions for} \approx 7 \ \text{relations}
\\ N=80 \ \text{boxes kept}:\quad 80\cdot 79=6{,}320 \ \text{pairs},\quad 6{,}320\cdot 50=316{,}000 \ \text{decisions for the same} \approx 7
\\[4pt]
\text{positive rate} \approx 1.1\times 10^{-3} \ \text{at } N=12, \quad \approx 2.2\times 10^{-5} \ \text{at } N=80
\\ \text{The 80 VG150 frames bundled here: } 651 \text{ of } 26{,}282 \text{ ordered pairs carry a relation.}\end{gathered}
```

  The arithmetic: 12 · 11 = 132; 132 · 50 = 6,600; 7 / 6,600 = 1.06 × 10⁻³; 80 · 79 = 6,320; 6,320 · 50 = 316,000; 7 / 316,000 = 2.2 × 10⁻⁵. The s2 Formal and Worked blocks stay.
  - **s3 Formal** becomes:

```latex
\begin{gathered}
b^{(t+1)}=(1-w)\,b^{(0)}+w\,S\,b^{(t)},\qquad S_{ij}=\tfrac{1}{d_i}\ \text{for } j\in\mathcal{N}(i),\ \text{else } 0,\qquad d_i=\lvert\mathcal{N}(i)\rvert
\\ 0\le w<1:\quad b^{(t)}\longrightarrow b^{\ast}=(1-w)(I-wS)^{-1}\,b^{(0)}
\\ w=1:\quad b^{(t)}_i\longrightarrow\frac{\sum_j d_j\,b^{(0)}_j}{\sum_j d_j}\quad(\text{connected, with an odd cycle})
\end{gathered}
```

  - **s3 Worked** becomes:

```latex
\begin{aligned}
b^{\ast} &= (1-w)\,b^{(0)}+w\,S\,b^{\ast} \iff (I-wS)\,b^{\ast}=(1-w)\,b^{(0)} &&\text{the fixed point}\\
\lVert wS\rVert_\infty &= w\,\max_i\textstyle\sum_j S_{ij}\le w<1 \;\Rightarrow\; b^{\ast}=(1-w)\textstyle\sum_{k\ge 0}w^{k}S^{k}\,b^{(0)} &&\text{a mixture of } k\text{-hop averages}\\
b^{(t+1)}-b^{\ast} &= w\,S\,\bigl(b^{(t)}-b^{\ast}\bigr) \;\Rightarrow\; \lVert b^{(t)}-b^{\ast}\rVert_\infty\le w^{t}\,\lVert b^{(0)}-b^{\ast}\rVert_\infty &&\text{the contraction bound}\\
w=1:\ \ d^{\top}S &= d^{\top} \;\Rightarrow\; d^{\top}b^{(t)}=d^{\top}b^{(0)}\ \text{for every } t &&j\in\mathcal{N}(i)\iff i\in\mathcal{N}(j)\\
b^{(t)}\to c\,\mathbf{1} &\;\Rightarrow\; c=\frac{\sum_j d_j\,b^{(0)}_j}{\sum_j d_j} &&\text{the degree-weighted mean}
\end{aligned}
```

  Proof obligations the lines discharge: each row of S sums to 1 or 0, so ‖wS‖∞ ≤ w < 1, the Neumann series converges and I − wA is invertible; the error obeys e⁽ᵗ⁺¹⁾ = wSe⁽ᵗ⁾, so ‖e⁽ᵗ⁾‖∞ ≤ wᵗ‖e⁽⁰⁾‖∞; at w = 1, Σᵢ dᵢSᵢⱼ = Σ_{i∈𝒩(j)} 1 = dⱼ for a symmetric neighbourhood, so dᵀb⁽ᵗ⁾ is invariant, and convergence to a constant vector (connected, aperiodic by the odd cycle) fixes that constant.
  - **s3 Implications** (the `$$ … $$` inside `<Implications>`) becomes:

```latex
\begin{gathered}\text{Averaging over all } n \text{ nodes, } i \text{ included}:\quad S=\tfrac{1}{n}\mathbf{1}\mathbf{1}^{\top},\ \ S\,b=\overline{b}\,\mathbf{1},\ \ \overline{b^{(t)}}=\overline{b^{(0)}}
\\ \Rightarrow\ b^{(1)}=b^{\ast}=(1-w)\,b^{(0)}+w\,\overline{b^{(0)}}\,\mathbf{1}: \ \text{the fixed point in one round; the spread falls once, by the factor } (1-w).
\\[4pt]
w<1:\ b^{\ast} \text{ keeps a } (1-w) \text{ share of each node's own evidence, so no consensus.}
\\ w=1:\ \text{consensus, at the degree-weighted mean.}\end{gathered}
```

  Spec §3 asks for "the complete-graph case, where the fixed point is reached in one round and the spread falls once by (1 − w)". That holds only when the node averages over itself too, which is the earlier Worked rule's b̄ = (1/n)Σⱼ bⱼ. With 𝒩(i) excluding i, as the Formal line and T2's "every pair" do, the error shrinks by w/(n − 1) per round and alternates in sign, and b* is not reached in one round (every pair, w = 0.5, t = 1: distance 0.0227). The line therefore names the node included and does not use 𝒩(i), whose gloss excludes i.

- [ ] **Step 4: The prose, per locale.**
  - **Front matter, both files**, two entries appended to `symbols`, identical in both:

```yaml
  - sym: "S"
    gloss_en: "the averaging matrix: each row averages over a node's neighbours"
    gloss_zh: "平均矩陣：每一列對該節點之鄰居取平均"
  - sym: "\\mathcal{N}(i)"
    gloss_en: "the neighbours of node i, i itself not among them"
    gloss_zh: "節點 i 之鄰居集合，不含 i 本身"
```

  - **s2 Implications prose, en** (replaces the paragraph that begins "One decision in a hundred thousand"; the paragraph on M7 stays): "VG150's dataset card gives its validation split 5,000 images, 62,754 object annotations and 33,203 relations: 12.6 objects and 6.6 relations per image. At twelve objects about one decision in a thousand is positive, and about one in forty-five thousand once a detector keeps 80 boxes, a setting chosen here rather than a figure from a paper. Across the 80 VG150 frames this course bundles, 651 of 26,282 ordered pairs carry any relation, 2.5 per cent, before the 50 predicates multiply the decisions. A classifier trained on that distribution learns to say "no relation" and is right almost always, which is why every two-stage method spends its capacity on pair *pruning* and on priors, and why the frequency baseline of M4 does so well."
  - **s2 Implications prose, zh-TW** (replaces the paragraph that begins 「每十萬次判定」; the paragraph on M7 stays): 「VG150 之資料卡記載其驗證集含 5,000 張影像、62,754 個物件標註與 33,203 個關係，即每張影像 12.6 個物件與 6.6 個關係。影像含十二個物件時，約每一千次判定之中有一次為正例；若偵測器保留 80 個框（此為本頁所設之數值，並非取自論文），則約每四萬五千次判定之中僅有一次。本課程所附之 80 張 VG150 影像中，26,282 個有序配對僅 651 個承載任何關係，即 2.5%，此比例尚未計入 50 個 predicate 對判定次數之倍增。以此種分布訓練的分類器，將學會輸出「無關係」，且幾乎總是正確；此即每一兩階段方法均將其容量投注於配對*剪枝*與先驗的理由，亦為 M4 所述頻率基線表現優異的理由。」
  - **s2 presenter notes, en:** "Five minutes. Pair enumeration is quadratic in the detections while the true relations are linear, and that ratio is the entire cost structure of the two-stage design. Ask the room to estimate the number of decisions at N = 80 with VG150's 50 predicates before showing it: 80 · 79 · 50 = 316,000. The answer is worse than intuition says, and the size of that error is the lesson. The next step sets the same count against 80 annotated frames."
  - **s2 presenter notes, zh-TW:** 「五分鐘。配對列舉與偵測數呈平方關係，成立的關係則呈線性，此比值即兩階段設計的全部成本結構。宜先請現場估計 N = 80、採用 VG150 之 50 個 predicate 時的判定次數，再揭示實際數量：80 · 79 · 50 = 316,000。其嚴重程度高於直覺所示，而直覺的誤差本身即為本頁的教學效果。下一步驟將同一計數對照 80 張已標註之影像。」
  - **s3 Intuition, en:** "IMP's idea is that a relation's evidence lives partly in its neighbours, so let nodes exchange beliefs and iterate. The idea is right, and the arithmetic has a trap: averaging alone, repeated, drives every node to one belief. Keeping a share of each node's own evidence in every round is what stops it."
  - **s3 Intuition, zh-TW:** 「IMP 的構想在於：關係的證據部分存在於其鄰居之中，故令節點交換信念並反覆迭代。此一構想正確，但其算術含有陷阱：若僅反覆執行平均運算，全部節點將趨向同一信念；每一輪保留各節點自身證據之一部分，方能阻止此一結果。」
  - **s3 Implications prose, en** (replaces the paragraph that begins "The fixed point is a contraction"; the paragraph "Everything after IMP is an answer to this." stays as it is; the closing line is replaced as shown):
    - "Averaging alone is what collapses the beliefs; the $(1-w)$ share of each node's own evidence is what prevents the collapse. For $w < 1$ the beliefs settle on $b^{\ast}$, a mixture of $k$-hop averages that is not a consensus, and the distance to it shrinks at least by the factor $w$ each round. Only at $w = 1$, where that share is zero, does every belief reach one value, and on a graph whose nodes have unequal numbers of neighbours that value is the degree-weighted mean, not the plain one."
    - (new paragraph) "IMP itself (Xu et al. 2017) does not apply this rule. It updates GRU hidden states over a node graph and an edge graph, pooling messages with learned weights. The rule here is a model of what repeated averaging does, and the question it poses stands for every method after IMP: how to pass context without averaging away the signal."
    - closing line: "Read them as four attempts to keep the context without averaging away each node's own evidence."
  - **s3 Implications prose, zh-TW** (same three places):
    - 「造成信念趨同者為平均運算本身；每一輪保留之 $(1-w)$ 份自身證據，則為阻止趨同者。當 $w < 1$ 時，信念收斂至 $b^{\ast}$，其為各階鄰域平均之混合，並非共識；每一輪與 $b^{\ast}$ 之距離至少縮小為原來之 $w$ 倍。唯有當 $w = 1$、該份自身證據為零時，全部信念方趨於同一數值；若各節點之鄰居數不等，該數值為依分支度加權之平均，而非算術平均。」
    - （新段落）「IMP 本身（Xu 等人 2017）並未採用此一規則：其於節點圖與邊圖上更新 GRU 隱藏狀態，並以學習而得之權重彙整訊息。此處之規則係重複平均運算之模型，而其所揭示之問題適用於 IMP 之後的每一方法：如何傳遞脈絡而不將訊號平均殆盡。」
    - closing line: 「宜將此四者視為「保留脈絡而不致以平均運算消除各節點自身證據」的四種嘗試。」
  - **s3 presenter notes, en:** "Six minutes. IMP's idea is right and its arithmetic has a trap in it: averaging alone, repeated, drives every node to one belief. Write the derivation out: for w < 1 the beliefs settle on b*, which keeps a (1 − w) share of each node's own evidence, and the distance to b* shrinks at least by the factor w each round; at w = 1 that share is gone and every belief reaches the degree-weighted mean. The collapse at w = 1 is what the checkpoint asks about. The next step runs this rule on ph-001's six objects. If time is short, drop the bound and keep the two cases, w < 1 and w = 1."
  - **s3 presenter notes, zh-TW:** 「六分鐘。IMP 的構想正確而算術含有陷阱：若僅反覆執行平均運算，全部節點將趨向同一信念。宜將推導寫完：w < 1 時信念收斂至 b*，保留各節點自身證據之 (1 − w) 份，且與 b* 之距離每輪至少縮小為原來之 w 倍；w = 1 時該份證據消失，全部信念趨於依分支度加權之平均。w = 1 時之趨同即為檢核點所問之內容。下一步驟於 ph-001 之六個物件上執行此規則。若時間不足，可略去界限，保留 w < 1 與 w = 1 兩種情形。」
  - **s5 body, en:** "L4 runs the committed predictions of these models on one image side by side." becomes "L4 runs the predictions in `data/predictions/` of these models on one image side by side."
  - **s5 body, zh-TW:** 「L4 將上述各模型於同一影像上的既存預測並列執行。」 becomes 「L4 將上述各模型存於 `data/predictions/` 之預測，於同一影像上並列執行。」
  - **s6 body, en:** "When repeated averaging keeps no share of a node's own evidence, $w = 1$, every belief converges to one value. Name one design in this module that avoids that collapse, and state what it gives up to do so."
  - **s6 body, zh-TW:** 「當重複平均運算不保留節點自身證據之任何份額（$w = 1$）時，全部信念趨於同一數值。請指出本單元中一項可避免此一趨同的設計，並說明其為此所付出的代價。」
  - **s6 presenter notes:** the opening "Checkpoint." becomes "Checkpoint, on the collapse at w = 1."; the opening 「檢核點。」 becomes 「檢核點，對應 w = 1 時之趨同。」 The acceptable answers and their costs stay word for word.

  No step id is written into these notes: the checkpoint is named by what it asks, so Task 5's renumbering touches none of them.
  - **M7 s1 presenter notes, en:** "it picks up M05's ratio: roughly one candidate pair in a hundred thousand carries a relation." becomes "it picks up M05's ratio: at VG150's 50 predicates, about one decision in a thousand is positive for an image of twelve objects, and about one in forty-five thousand once a detector keeps 80 boxes."
  - **M7 s1 body, en:** "M5 ended on a ratio: about one candidate pair in a hundred thousand carries a relation." becomes "M5 ended on a ratio: at VG150's 50 predicates, about one decision in a thousand is positive for an image of twelve objects, and about one in forty-five thousand once a detector keeps 80 boxes."
  - **M7 s1 presenter notes, zh-TW:** 「約每十萬組候選配對僅一組承載關係。」 becomes 「採用 VG150 之 50 個 predicate 時，含十二個物件之影像約每一千次判定僅一次為正例；偵測器保留 80 個框時，約每四萬五千次僅一次。」
  - **M7 s1 body, zh-TW:** 「約每十萬組候選配對之中，僅一組承載關係。」 becomes 「採用 VG150 之 50 個 predicate 時，含十二個物件之影像約每一千次判定之中僅一次為正例；偵測器保留 80 個框時，約每四萬五千次之中僅一次。」

- [ ] **Step 5: The map.**
  - **Build the strings from the corrected MDX, not by hand.** Save this as `$SCRATCH/m5-map-strings.mjs`, where `$SCRATCH` is the implementer's scratch directory outside the repository, and run `node "$SCRATCH/m5-map-strings.mjs"` from `system/`:

```js
import { readFileSync } from 'node:fs';

const text = readFileSync('frontend/src/content/m05.en.mdx', 'utf8').replace(/\r\n/g, '\n');
const step = (id) => {
  const start = text.indexOf(`<Step id="${id}">`);
  return text.slice(start, text.indexOf('</Step>', start));
};
const block = (body, part) => {
  const inner = body.slice(body.indexOf(`<${part}>`), body.indexOf(`</${part}>`));
  const from = inner.indexOf('$$\n') + 3;
  return inner.slice(from, inner.indexOf('\n$$', from));
};
const math = (id) => JSON.stringify(`\\[ ${block(step(id), 'Formal')} \\]`);
const deriv = (id) =>
  JSON.stringify(`\\[${block(step(id), 'Worked')}\\]\\[${block(step(id), 'Implications')}\\]`);
console.log(`T1 MATH  ${math('s2')}`);
console.log(`T1 DERIV ${deriv('s2')}`);
console.log(`T2 MATH  ${math('s3')}`);
console.log(`T2 DERIV ${deriv('s3')}`);
```

  - **`pg.js`:** with the Edit tool, `T2:` in `MATH` (line 369) becomes `T2:` followed by the printed T2 MATH literal; `T1:` and `T2:` in `DERIV` (lines 398 and 399) become the printed DERIV literals. Confirm that the printed T1 MATH literal equals the existing `MATH.T1` (line 368) character for character; s2's Formal line is unchanged, so it must.
  - **T1 `note_en`** (line 777) becomes: `'The two-stage recipe classifies every ordered pair, so cost grows as \\(N(N-1)\\lvert\\mathcal{P}\\rvert\\). With VG150\'s 50 predicates, an image of twelve objects, near the validation mean of 12.6, gives 6,600 decisions for about seven relations; a detector keeping 80 boxes gives 316,000 for the same seven. Across 80 VG150 frames, 651 of 26,282 ordered pairs carry any relation. The toy\'s readout of about twenty real relations is the original Visual Genome\'s 22 per image; VG150\'s validation images carry 6.6. This quadratic term is the motivation for one-stage set prediction, and for Pair-Net\'s finding that sparsifying pairs <i>before</i> classification is where the win is.'`
  - **T1 `note_zh`** (line 778) becomes: `'兩階段做法對每一有序配對進行分類，成本因此以 \\(N(N-1)\\lvert\\mathcal{P}\\rvert\\) 成長。採用 VG150 之 50 個 predicate 時，含十二個物件（接近其驗證集平均 12.6）之影像產生 6,600 次判定，對應約七個關係；偵測器保留 80 個框時為 316,000 次，對應同樣約七個關係。於 80 張 VG150 影像中，26,282 個有序配對僅 651 個承載任何關係。下方示範所示約二十個真實關係，係原始 Visual Genome 每張影像 22 個關係之水準；VG150 驗證集影像平均為 6.6 個。此平方項即 one-stage 集合預測之動機，亦為 Pair-Net 主張於分類<i>之前</i>先稀疏化配對方為關鍵之原因。'`
  - **T2 `note_en`** (line 793) becomes: `'Each node starts with a belief from its own appearance and mixes in the average of its neighbours, \\(b^{(t+1)} = (1-w)\\,b^{(0)} + w\\,S\\,b^{(t)}\\), where \\(S\\) averages over each node\'s neighbours. For \\(w<1\\) the beliefs converge to a fixed point that keeps a \\((1-w)\\) share of each node\'s own evidence, and the distance to it shrinks at least by the factor \\(w\\) each round: no consensus. Only at \\(w=1\\) does every belief reach one value, the degree-weighted mean. IMP\'s own update is learned, over GRU states; this rule models what repeated averaging does. The toy below averages over the whole graph, each node included, so its iteration slider changes nothing after the first round.'`
  - **T2 `note_zh`** (line 794) becomes: `'每一節點先由自身外觀取得一個信念，再混入其鄰居之平均，\\(b^{(t+1)} = (1-w)\\,b^{(0)} + w\\,S\\,b^{(t)}\\)，其中 \\(S\\) 對各節點之鄰居取平均。當 \\(w<1\\) 時，信念收斂至一個不動點，該點保留各節點自身證據之 \\((1-w)\\) 份，且與其距離每輪至少縮小為原來之 \\(w\\) 倍，並非共識。唯有 \\(w=1\\) 時，全部信念方收斂至同一數值，即依分支度加權之平均。IMP 本身之更新係於 GRU 狀態上學習而得；此規則為重複平均運算之模型。下方示範對全圖（含各節點本身）取平均，故其迭代次數滑桿於第一輪之後即不再改變任何數值。'`
  - **Not changed (spec §8, D-14):** the toys' `ctrls` and `draw`, including T1's `|P|` slider to 310 and its `real relations ~20` readout, and `kp-data.js`.
  - **`FROZEN.md`:** append after the M4 entry:

```markdown
### 2026-09-29 — M5's pair counts and its averaging rule

Opened for the M5 playgrounds (`docs/superpowers/specs/2026-09-29-playgrounds-m5-design.md` §2),
read against `data/slices/vg150-sgb/annotations.json`, the vg150-sgb dataset card and M5's own
derivation.

**1 · T1 set N = 80 and |P| = 310, "GQA's 310 predicates", for "≈ 20 relations".** No source in
this repository states 310. The course's anchor dataset is VG150, whose card states 50 predicate
categories and, for its validation split, 5,000 images, 62,754 object annotations and 33,203
relations: 12.6 objects and 6.6 relations per image. "≈ 20" is near the original Visual Genome's
22 relationships per image (Xu et al. 2017, §4), not VG150's. M5 s2's Implications and DERIV.T1 now
use |P| = 50: twelve objects give 132 ordered pairs and 6,600 decisions for about seven relations;
80 boxes, a setting rather than a figure from a paper, give 6,320 pairs and 316,000 decisions; the
80 bundled frames hold 651 related ordered pairs of 26,282. The T1 note says the same.

**2 · T2's Formal line claimed b⁽ᵗ⁾ → mean(b⁽⁰⁾) for every w > 0.** For 0 ≤ w < 1 the rule
b ↦ (1 − w)b⁽⁰⁾ + wSb, S row-normalised over the neighbours, is a contraction in the max norm with
factor w: the beliefs converge to b* = (1 − w)(I − wS)⁻¹b⁽⁰⁾, which is no consensus, and
‖b⁽ᵗ⁾ − b*‖∞ ≤ wᵗ‖b⁽⁰⁾ − b*‖∞. Only at w = 1, on a connected graph with an odd cycle, do they reach
one value, the degree-weighted mean Σⱼ dⱼb⁽⁰⁾ⱼ / Σⱼ dⱼ.

**3 · T2's Worked step replaced the neighbourhood mean by the whole-graph mean, the node
included.** Under that rule the mean is invariant and the first round already reaches the fixed
point. The Implications now state that case as the one where the node averages over itself too.

**4 · T2's Implications wrote "b⁽ᵗ⁾ = (1 − wᵗ)[…]·…", which is not an expression, and "spread
contracts by (1 − w) per step";** under the Worked rule it contracts once. M5's checkpoint and the
s3 presenter note repeated "per step"; both now ask about the collapse at w = 1.

MATH.T2 and DERIV.T2 are rebuilt from the corrected s3, DERIV.T1 from the corrected s2; MATH.T1 is
unchanged. On ph-001 with the starting beliefs of the M5 spec §4.2, w = 0.5 settles at a spread of
0.3924, w = 0.9 at 0.1105, and w = 1 converges to 0.5083 where the plain mean is 0.4833.
`npm run harvest` carries the three into `data/content/`. The brief (`web/brief/index.html`) was
searched for `310`, `consensus`, `message passing` and `per step`; it states none of them. No
option, control or knowledge point was added. The map's toy playgrounds are unchanged (D-14, spec
§8): T1's toy still reads "real relations ~20, per image, VG150", which its corrected note now
attributes to the original Visual Genome, and T2's toy still averages over the whole graph, so its
iteration slider changes nothing after the first round, as its corrected note now says.
```

- [ ] **Step 6: Search the brief.** Run `grep -n -w -e 310 -e consensus -e "message passing" -e "per step" web/brief/index.html`. Expected: no output (`103107` is not the word 310). If a line matches, correct it in both languages and run `npm run build:standalone`; otherwise the commit message records "the brief states none of them".

- [ ] **Step 7: Harvest, and record the data change.** Save as `$SCRATCH/diff-content.mjs`:

```js
import { readFileSync } from 'node:fs';

const [before, after] = process.argv.slice(2);
const read = (dir, name) => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
for (const name of ['math.json', 'deriv.json']) {
  const a = read(before, name);
  const b = read(after, name);
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) {
      console.log(`${name} ${key}\n  before: ${JSON.stringify(a[key])}\n  after:  ${JSON.stringify(b[key])}`);
    }
  }
}
const ka = read(before, 'kp.json');
const kb = read(after, 'kp.json');
for (const point of kb) {
  const old = ka.find((p) => p.id === point.id) ?? {};
  for (const field of new Set([...Object.keys(point), ...Object.keys(old)])) {
    if (JSON.stringify(point[field]) !== JSON.stringify(old[field])) console.log(`kp.json ${point.id}.${field} changed`);
  }
}
```

  Then run `mkdir -p "$SCRATCH/before" && cp ../data/content/kp.json ../data/content/math.json ../data/content/deriv.json "$SCRATCH/before/" && npm run harvest && node "$SCRATCH/diff-content.mjs" "$SCRATCH/before" ../data/content`. Expected: the harvest reports 93 knowledge points (27 live), 26 formulas and 23 derivations; the diff lists exactly `math.json T2`, `deriv.json T1`, `deriv.json T2`, `kp.json T1.deriv`, `kp.json T2.math`, `kp.json T2.deriv`. **Paste the whole diff output into the task report.** `git status` shows no file under `data/`.

- [ ] **Step 8: Verify.** Run `npx vitest run frontend/src/content tools/test/harvest.test.mjs && npm run lint:frozen && npm run lint:content && npm run lint:standalone`. Expected: all pass; content lint reports 50 symbols (48 before).

- [ ] **Step 9: Commit.** `npm run ci`, then stage the six MDX, test, `pg.js` and `FROZEN.md` files, then `git commit -m "fix(sgs): M5's pair counts on VG150's 50 predicates and its averaging rule stated for w < 1 and w = 1"`.

---

### Task 2: The slice ordered, the six beliefs, and their arithmetic

**Files:**
- Create: `frontend/src/playgrounds/M5/pairs.ts`, `frontend/src/playgrounds/M5/beliefs.ts`
- Modify: `frontend/src/playgrounds/logic.ts`
- Test: `frontend/src/playgrounds/test/logic.test.ts`

**Interfaces:**
- **`logic.ts`**, a new section `// ---- M5: pairs against relations, and beliefs under averaging ----`, none importing a playground module (the existing test `the shared module imports no playground of its own` holds it):
  - `relatedPairs(relationships: readonly { subject_id: number; object_id: number }[]): number`: distinct ordered `(subject_id, object_id)` pairs with `subject_id !== object_id`;
  - `neighbours(ids: readonly number[], edges: readonly (readonly [number, number])[]): number[][]`: for each id in `ids` order, the ids joined to it by an edge in either direction, ascending, never itself;
  - `rowNormalised(ids: readonly number[], lists: readonly (readonly number[])[]): number[][]`: `A[i][j] = 1 / lists[i].length` when `ids[j]` is in `lists[i]`, else 0; a node with no neighbour has a zero row;
  - `averagingRound(a: readonly (readonly number[])[], w: number, b0: readonly number[], b: readonly number[]): number[]`: `(1 − w) b0 + w S b`;
  - `averagingRounds(a, w, b0, t: number): number[]`: t rounds from `b0`; t = 0 returns a copy of `b0`;
  - `fixedPoint(a, w, b0): number[] | null`: the solution of `(I − wS) b* = (1 − w) b0` by Gaussian elimination with partial pivoting; `null` when `w >= 1`;
  - `maxDistance(a: readonly number[], b: readonly number[]): number`: `max_i |a_i − b_i|`, 0 for empty input;
  - `spread(b: readonly number[]): number`: `max − min`;
  - `mean(values: readonly number[]): number`;
  - `degreeWeightedMean(lists: readonly (readonly number[])[], b0: readonly number[]): number`: `Σ_j d_j b0_j / Σ_j d_j`, `d_j = lists[j].length`;
  - `decimals(value: number, places: number): string`: `Number(value.toFixed(10)).toFixed(places)`, so that a value the arithmetic lands one ulp either side of a tie prints the same.
- **`M5/pairs.ts`:**
  - `export interface PairRow { rank: number; imageId: string; objects: number; pairs: number; rows: number; related: number }`;
  - `export const PAIR_ROWS: PairRow[]`: `VG_FRAMES` mapped to `{ imageId: image_id, objects: N, pairs: candidateSpace(N, 1, true), rows: relationships.length, related: relatedPairs(relationships) }`, sorted by `objects` and then by `Number(imageId)`, then given `rank` 1 to 80; a doc comment saying that as strings `'1246'` sorts before `'547'`;
  - `export const SLICE_TOTALS: { frames: number; objects: number; pairs: number; rows: number; related: number }`, summed over `PAIR_ROWS`;
  - `export const T1_RANK_DEFAULT = 40`.
- **`M5/beliefs.ts`:**
  - `export const M5_FRAME = 'ph-001'`;
  - `export const M5_B0: Readonly<Record<number, number>> = { 1: 0.9, 2: 0.2, 3: 0.7, 4: 0.4, 5: 0.1, 6: 0.6 }`, with a doc comment: spec §4.2's starting beliefs, designed on paper so the two graphs part and the degree-weighted mean differs from the plain mean at two decimals;
  - `export type BeliefGraphName = 'relations' | 'every'` and `export const BELIEF_GRAPHS: readonly BeliefGraphName[] = ['relations', 'every']`;
  - `export const W_STEP = 0.05`, `export const W_DEFAULT = 0.5`, `export const T_MAX = 40`, `export const T_DEFAULT = 0`;
  - `export interface BeliefGraph { ids: number[]; names: string[]; b0: number[]; lists: number[][]; a: number[][] }`;
  - `export function beliefGraph(name: BeliefGraphName): BeliefGraph`: ph-001's objects by ascending id, their first names, `M5_B0` in that order; edges from `frame.relationships` (`[subject_id, object_id]`) for `relations`, every `[i, j]` with `i < j` for `every`; `lists = neighbours(ids, edges)`; `a = rowNormalised(ids, lists)`.

- [ ] **Step 1: Write the failing tests** in `logic.test.ts`, importing the new functions, `PAIR_ROWS`, `SLICE_TOTALS` from `../M5/pairs` and `beliefGraph`, `W_STEP` from `../M5/beliefs`:

```ts
describe('M5: pairs against relations', () => {
  it('counts a related ordered pair once, however many rows it carries, and each direction apart', () => {
    const rows = [
      { subject_id: 1, object_id: 2 }, { subject_id: 1, object_id: 2 },
      { subject_id: 2, object_id: 1 }, { subject_id: 3, object_id: 3 },
    ];
    expect(relatedPairs(rows)).toBe(2);
    expect(relatedPairs([])).toBe(0);
  });

  it('orders the 80 frames by object count, then by image id as a number', () => {
    expect(PAIR_ROWS.map((r) => r.rank)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
    for (let i = 1; i < PAIR_ROWS.length; i += 1) {
      const [a, b] = [PAIR_ROWS[i - 1]!, PAIR_ROWS[i]!];
      const ordered = a.objects < b.objects || (a.objects === b.objects && Number(a.imageId) < Number(b.imageId));
      expect(ordered, `${a.imageId} before ${b.imageId}`).toBe(true);
    }
  });

  it("gives spec §4.1's ranks 1, 40 and 80, and 1246 after 547", () => {
    expect(PAIR_ROWS[0]).toEqual({ rank: 1, imageId: '2045', objects: 4, pairs: 12, rows: 4, related: 2 });
    expect(PAIR_ROWS[39]).toEqual({ rank: 40, imageId: '547', objects: 16, pairs: 240, rows: 5, related: 5 });
    expect(PAIR_ROWS[40]).toEqual({ rank: 41, imageId: '1246', objects: 16, pairs: 240, rows: 8, related: 8 });
    expect(PAIR_ROWS[79]).toEqual({ rank: 80, imageId: '3182', objects: 39, pairs: 1482, rows: 45, related: 29 });
  });

  it('never has more related pairs than pairs, though 4176 has more rows than pairs', () => {
    expect(PAIR_ROWS[1]).toEqual({ rank: 2, imageId: '4176', objects: 4, pairs: 12, rows: 18, related: 7 });
    for (const r of PAIR_ROWS) expect(r.related, r.imageId).toBeLessThanOrEqual(r.pairs);
  });

  it('totals 1,348 objects, 26,282 ordered pairs, 892 rows and 651 related pairs', () => {
    expect(SLICE_TOTALS).toEqual({ frames: 80, objects: 1348, pairs: 26282, rows: 892, related: 651 });
  });
});

describe('M5: beliefs under averaging', () => {
  const rel = beliefGraph('relations');
  const every = beliefGraph('every');
  // Every setting of the w knob, 0 to 1 in steps of 0.05, each on its decimal.
  const onKnob = Array.from({ length: 21 }, (_, i) => snap(i * W_STEP, 0, 1, W_STEP));
  const below1 = onKnob.filter((w) => w < 1);

  it("reads spec §4.2's six objects, beliefs and relation neighbours from ph-001", () => {
    expect(rel.ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rel.names).toEqual(['table', 'person', 'box', 'glove', 'wrench', 'panel']);
    expect(rel.b0).toEqual([0.9, 0.2, 0.7, 0.4, 0.1, 0.6]);
    expect(rel.lists).toEqual([[2, 3, 5, 6], [1, 4, 5], [1], [2], [1, 2], [1]]);
    expect(every.lists).toEqual(rel.ids.map((i) => rel.ids.filter((j) => j !== i)));
  });

  it('row-normalises: every row sums to 1 over its neighbours, and no node is its own neighbour', () => {
    for (const g of [rel, every]) {
      g.a.forEach((row, i) => {
        expect(row[i]).toBe(0);
        expect(row.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
        expect(row.filter((x) => x > 0)).toHaveLength(g.lists[i]!.length);
      });
    }
    expect(rowNormalised([1, 2, 3], [[2], [1], []])[2]).toEqual([0, 0, 0]);
  });

  it('one round is (1 − w) b⁽⁰⁾ + w S b, and zero rounds is b⁽⁰⁾', () => {
    const b1 = averagingRound(rel.a, 0.5, rel.b0, rel.b0);
    [0.65, 1 / 3, 0.8, 0.3, 0.325, 0.75].forEach((x, i) => expect(b1[i]).toBeCloseTo(x, 12));
    expect(averagingRounds(rel.a, 0.5, rel.b0, 1)).toEqual(b1);
    expect(averagingRounds(rel.a, 0.5, rel.b0, 0)).toEqual(rel.b0);
  });

  it('w = 0 moves nothing, at any t, on either graph', () => {
    for (const g of [rel, every]) {
      for (const t of [0, 1, 5, 40]) expect(averagingRounds(g.a, 0, g.b0, t)).toEqual(g.b0);
      expect(fixedPoint(g.a, 0, g.b0)).toEqual(g.b0);
    }
  });

  it('the fixed point solves (I − wA) b* = (1 − w) b⁽⁰⁾ and is where 2,000 rounds arrive, at every w below 1', () => {
    for (const g of [rel, every]) {
      for (const w of below1) {
        const star = fixedPoint(g.a, w, g.b0)!;
        const residual = star.map((x, i) =>
          x - w * g.a[i]!.reduce((s, aij, j) => s + aij * star[j]!, 0) - (1 - w) * g.b0[i]!);
        expect(maxDistance(residual, residual.map(() => 0)), `w = ${w}`).toBeLessThan(1e-12);
        expect(maxDistance(averagingRounds(g.a, w, g.b0, 2000), star), `w = ${w}`).toBeLessThan(1e-12);
      }
    }
  });

  it('solves nothing at w = 1, where I − A is singular', () => {
    expect(fixedPoint(rel.a, 1, rel.b0)).toBeNull();
    expect(fixedPoint(every.a, 1, every.b0)).toBeNull();
  });

  it('never lets the distance exceed wᵗ‖b⁽⁰⁾ − b*‖∞, at every t from 0 to 40, every w below 1 and both graphs', () => {
    for (const g of [rel, every]) {
      for (const w of below1) {
        const star = fixedPoint(g.a, w, g.b0)!;
        const d0 = maxDistance(g.b0, star);
        let b = [...g.b0];
        for (let t = 0; t <= 40; t += 1) {
          expect(maxDistance(b, star), `w = ${w}, t = ${t}`).toBeLessThanOrEqual(w ** t * d0 + 1e-12);
          b = averagingRound(g.a, w, g.b0, b);
        }
      }
    }
  });

  it('at w = 1 keeps the degree-weighted sum and reaches the degree-weighted mean', () => {
    const d = rel.lists.map((l) => l.length);
    const weighted = (b: number[]) => b.reduce((s, x, j) => s + d[j]! * x, 0);
    let b = [...rel.b0];
    for (let t = 0; t < 10; t += 1) {
      b = averagingRound(rel.a, 1, rel.b0, b);
      expect(weighted(b)).toBeCloseTo(6.1, 12);
    }
    for (const g of [rel, every]) {
      const limit = degreeWeightedMean(g.lists, g.b0);
      for (const x of averagingRounds(g.a, 1, g.b0, 2000)) expect(x).toBeCloseTo(limit, 9);
    }
  });

  it('the degree-weighted mean is the plain mean only on the regular graph', () => {
    expect(degreeWeightedMean(rel.lists, rel.b0)).toBeCloseTo(6.1 / 12, 12);
    expect(mean(rel.b0)).toBeCloseTo(2.9 / 6, 12);
    expect(degreeWeightedMean(every.lists, every.b0)).toBeCloseTo(mean(every.b0), 12);
  });

  it("gives spec §2's spreads and limits to four decimals", () => {
    expect(spread(fixedPoint(rel.a, 0.5, rel.b0)!)).toBeCloseTo(0.3924, 4);
    expect(spread(fixedPoint(rel.a, 0.9, rel.b0)!)).toBeCloseTo(0.1105, 4);
    expect(spread(fixedPoint(every.a, 0.9, every.b0)!)).toBeCloseTo(0.0678, 4);
    expect(maxDistance(rel.b0, fixedPoint(rel.a, 0.9, rel.b0)!)).toBeCloseTo(0.3659, 4);
    expect(spread(averagingRounds(rel.a, 1, rel.b0, 20))).toBeCloseTo(0.0094, 4);
    expect(spread(averagingRounds(rel.a, 1, rel.b0, 40))).toBeCloseTo(0.0002, 4);
    expect(degreeWeightedMean(rel.lists, rel.b0)).toBeCloseTo(0.5083, 4);
    expect(mean(rel.b0)).toBeCloseTo(0.4833, 4);
  });

  it('reaches b* in one round only when each node averages over itself too', () => {
    // Spec §3's complete-graph case includes the node; T2's every pair excludes it (Review Focus 5).
    const star = fixedPoint(every.a, 0.5, every.b0)!;
    expect(maxDistance(averagingRounds(every.a, 0.5, every.b0, 1), star)).toBeCloseTo(0.0227, 4);
    const withSelf = rel.ids.map(() => rel.ids.map(() => 1 / 6));
    const once = averagingRounds(withSelf, 0.5, rel.b0, 1);
    expect(maxDistance(once, fixedPoint(withSelf, 0.5, rel.b0)!)).toBeLessThan(1e-12);
    expect(spread(once)).toBeCloseTo(0.5 * 0.8, 12);
  });

  it('spread is max − min, and the distance the max norm', () => {
    expect(spread([0.2, 0.9, 0.5])).toBeCloseTo(0.7, 12);
    expect(maxDistance([0.1, 0.5], [0.3, 0.4])).toBeCloseTo(0.2, 12);
  });

  it('prints a tie the same whichever side of it the arithmetic lands', () => {
    expect(decimals(0.325, 2)).toBe('0.33');
    expect(decimals(0.32499999999999996, 2)).toBe('0.33');
    expect(decimals(0.1 + 0.2, 4)).toBe('0.3000');
    expect(decimals(-0, 4)).toBe('0.0000');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: FAIL at import.

- [ ] **Step 3: Implement** the two data modules and the eleven functions with the signatures above. `fixedPoint`, with `noUncheckedIndexedAccess` in mind:

```ts
export function fixedPoint(
  a: readonly (readonly number[])[], w: number, b0: readonly number[],
): number[] | null {
  if (w >= 1) return null;
  const n = b0.length;
  const m = a.map((row, i) => [...row.map((aij, j) => (i === j ? 1 : 0) - w * aij), (1 - w) * b0[i]!]);
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    [m[c], m[p]] = [m[p]!, m[c]!];
    const pivot = m[c]!;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const row = m[r]!;
      const k = row[c]! / pivot[c]!;
      for (let q = c; q <= n; q += 1) row[q] = row[q]! - k * pivot[q]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}
```

  Its doc comment states the complexity, O(n³) for n = 6, and why pivoting cannot meet a zero: every row of I − wA is strictly diagonally dominant for w < 1.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds/test/logic.test.ts`. Expected: PASS. If a value of spec §2 fails at four decimals, re-run the function, report the value it gives, and stop.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): M5's slice ordered by object count and ph-001's six beliefs, with the averaging rule's arithmetic"`.

---

### Task 3: T1, pairs against relations

**Files:**
- Create: `frontend/src/playgrounds/T1/PairsAgainstRelations.tsx`, `frontend/src/playgrounds/T1/test/PairsAgainstRelations.test.tsx`
- Modify: `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`, `frontend/src/playgrounds/controls.tsx` (the doc comments of `DensityContext` and `PlaygroundFrame` name M5's T1 and T2 beside M4's five, with the reason of Global Constraints)
- Not registered here: Task 5 registers it with its step.

**Interfaces:**
- Consumes: Task 2's `PAIR_ROWS`, `SLICE_TOTALS`, `T1_RANK_DEFAULT`, `candidateSpace`, `snap`; `VG150_PREDICATES` from `E10/setup.ts`.
- Produces: `export function PairsAgainstRelations(_: PlaygroundProps = {})`. Knob `T1.frame`, a `Slider` 1 to 80, step 1, default 40, `valueLabel` the rank. `PlaygroundFrame title="T1" clip={false} dense`. Readouts, in one `flex flex-wrap items-baseline gap-x-6 gap-y-2` row: `T1.objects` (N), `T1.pairs` (N(N − 1)), `T1.decisions` (N(N − 1) × 50), `T1.rows`, `T1.related`, `T1.slice` (`651 / 26,282`, fixed). Counts printed with `toLocaleString('en-US')`. Below them the line `t1-source`. No photograph and no image element.

**Copy** (key: en / zh-TW); `−` is U+2212:

| Key | en | zh-TW |
|---|---|---|
| `playground.t1.frame` | Frame, by object count | 影像（依物件數排序） |
| `playground.t1.objects` | Objects N | 物件數 N |
| `playground.t1.objects_note` | frame {image}, rank {rank} of 80 | 影像 {image}，80 張中第 {rank} 名 |
| `playground.t1.pairs` | Ordered pairs | 有序配對數 |
| `playground.t1.pairs_note` | N(N − 1) = {n} × {m} | N(N − 1) = {n} × {m} |
| `playground.t1.decisions` | Decisions | 判定次數 |
| `playground.t1.decisions_note` | N(N − 1) × 50; VG150's 50 predicates | N(N − 1) × 50；VG150 之 50 個 predicate |
| `playground.t1.rows` | Relationship rows | 關係標註列數 |
| `playground.t1.rows_note` | one row per annotated relation; a pair may carry several | 每一標註關係一列；同一配對可有多列 |
| `playground.t1.related` | Ordered pairs with a relation | 承載關係之有序配對數 |
| `playground.t1.related_note` | {related} / {pairs} of the ordered pairs | 占有序配對之 {related} / {pairs} |
| `playground.t1.slice` | All 80 frames | 全部 80 張影像 |
| `playground.t1.slice_note` | ordered pairs with a relation / ordered pairs | 承載關係之有序配對數 / 有序配對數 |
| `playground.t1.source` | The 80 VG150 frames of data/slices/vg150-sgb, annotations only; no photograph ships with them. | data/slices/vg150-sgb 之 80 張 VG150 影像，僅含標註，不附照片。 |

- [ ] **Step 1: Write the failing tests** in `PairsAgainstRelations.test.tsx`, with `renderAt(url, props)` in a `MemoryRouter`, as `X2/test/VrdPerPair.test.tsx` does, at `/m/m05`:
  - `opens at rank 40: frame 547, 16 objects, 240 pairs, 12,000 decisions, 5 rows, 5 related`: `T1.frame` has value `'40'`; `readout-T1.objects-value` `16` and `readout-T1.objects` contains `frame 547, rank 40 of 80`; `readout-T1.pairs-value` `240`, note `N(N − 1) = 16 × 15`; `readout-T1.decisions-value` `12,000`; `readout-T1.rows-value` `5`; `readout-T1.related-value` `5`, note `5 / 240 of the ordered pairs`; `readout-T1.slice-value` `651 / 26,282`;
  - `rank 1 is frame 2045 and rank 80 is frame 3182`: `?T1.frame=1` gives 4, 12, 600, 4, 2 and `2 / 12 of the ordered pairs`; `?T1.frame=80` gives 39, `1,482`, `74,100`, 45, 29 and `29 / 1,482 of the ordered pairs`;
  - `counts a pair once however many rows it carries`: `?T1.frame=2` is frame 4176: rows `18`, related `7`, note `7 / 12 of the ordered pairs` (Review Focus 6);
  - `breaks a tie in object count by image id as a number`: `?T1.frame=41` names `frame 1246, rank 41 of 80`;
  - `the slice's 651 of 26,282 does not move with the frame`: at ranks 1, 40 and 80, `readout-T1.slice-value` is `651 / 26,282`;
  - `a frame the URL invented is snapped or defaulted`: `?T1.frame=999` gives value `'80'` and frame 3182; `?T1.frame=0` gives `'1'`; `?T1.frame=abc` gives `'40'`; `?T1.frame=40.6` gives `'41'` (Review Focus 1);
  - `shows no recall and no percentage`: no readout value contains `R@`, `%` or `.`;
  - `says the slice ships no photograph`: `t1-source` has the English line, and the frame holds no `img`;
  - `reads in 繁體中文`: `readout-T1.objects` contains `影像 547，80 張中第 40 名`; `readout-T1.decisions` contains `VG150 之 50 個 predicate`; `readout-T1.related` contains `占有序配對之 5 / 240`;
  - `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/T1`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the component and add the fourteen keys to both locale tables. The rank is `snap(params['T1.frame'], 1, PAIR_ROWS.length, 1)`; the row is `PAIR_ROWS[rank - 1]`; decisions are `candidateSpace(row.objects, VG150_PREDICATES, true)`. Placeholders are filled with `replace`.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS and exit 0; i18n reports 394 keys.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): T1, ordered pairs and decisions against the relations of 80 VG150 frames"`.

---

### Task 4: T2, beliefs under averaging

**Files:**
- Create: `frontend/src/playgrounds/T2/BeliefsUnderAveraging.tsx`, `frontend/src/playgrounds/T2/test/BeliefsUnderAveraging.test.tsx`
- Modify: `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`
- Not registered here: Task 5 registers it with its step.

**Interfaces:**
- Consumes: Task 2's `beliefGraph`, `BELIEF_GRAPHS`, `W_STEP`, `W_DEFAULT`, `T_MAX`, `T_DEFAULT`, and `averagingRounds`, `fixedPoint`, `maxDistance`, `spread`, `mean`, `degreeWeightedMean`, `decimals`, `snap`.
- Produces: `export function BeliefsUnderAveraging({ part }: PlaygroundProps = {})`. Knobs: `T2.graph` (`Choice` of `relations`, `every`; default `relations`), `T2.w` (`Slider` 0 to 1, step 0.05, default 0.5, `valueLabel` `decimals(w, 2)`), `T2.t` (`Slider` 0 to 40, step 1, default 0). `PlaygroundFrame title="T2" clip={false} dense`. All three knobs on every part.
  - `t2-regime`, a line in `text-[0.75em] leading-tight text-slate-700`: `regime_zero` when w = 0, `regime_one` when w = 1, `regime_between` otherwise.
  - `t2-beliefs`, a `<table>` in `text-[0.75em] leading-tight`, caption `playground.t2.table`, columns `playground.t2.object`, `playground.t2.neighbours`, `b⁽⁰⁾`, `b⁽ᵗ⁾`; one row `t2-belief-${id}` per object with a `th scope="row"` `#${id} ${name}` and cells `t2-belief-${id}-nb`, `t2-belief-${id}-b0` and `t2-belief-${id}-bt`, beliefs to two decimals by `decimals`. The neighbours cell lists `#${j} ${name}` in ascending id, joined by `, ` in English and `、` in 繁體中文, under `relations`; it reads `playground.t2.others` under `every`.
  - Readouts, in one `flex flex-wrap items-baseline gap-x-6 gap-y-2` row, to four decimals by `decimals`: `T2.spread` (note `spread_note` with `{fixed}` the spread of b*, or `spread_note_limit` at w = 1); for w < 1, `T2.distance` and `T2.bound` (`w ** t * d0`, note `bound_note` with every `{d0}` filled, `replaceAll`); for w = 1, `T2.limit` (note with `{weighted}` = `decimals(Σ dⱼ b⁽⁰⁾ⱼ, 1)` and `{degrees}` = `Σ dⱼ`) and `T2.mean` (note with `{sum}` = `decimals(Σ b⁽⁰⁾ⱼ, 1)`). At w = 1 the distance and bound readouts are not rendered and `fixedPoint` is not called for them.
  - `t2-model`, the line `playground.t2.model`.
  - Part 1: the regime line and the table. Part 2: the regime line, the readouts and `t2-model`. No part: all of them. Task 7 decides by measurement whether the parts are used.

**Copy** (key: en / zh-TW):

| Key | en | zh-TW |
|---|---|---|
| `playground.t2.graph` | Neighbourhood 𝒩(i) | 鄰域 𝒩(i) |
| `playground.t2.relations` | relations annotated on ph-001 | ph-001 標註之關係 |
| `playground.t2.every` | every pair of objects | 每一物件配對 |
| `playground.t2.w` | w, weight on the neighbours | 鄰居權重 w |
| `playground.t2.t` | t, rounds | 輪數 t |
| `playground.t2.table` | ph-001's six objects: belief at the start and after t rounds | ph-001 六個物件：初始信念與 t 輪後之信念 |
| `playground.t2.object` | Object | 物件 |
| `playground.t2.neighbours` | Neighbours 𝒩(i) | 鄰居 𝒩(i) |
| `playground.t2.others` | the other five | 其餘五個物件 |
| `playground.t2.spread` | Spread of b⁽ᵗ⁾ | b⁽ᵗ⁾ 之全距 |
| `playground.t2.spread_note` | max − min; {fixed} at b* | 最大值減最小值；b* 處為 {fixed} |
| `playground.t2.spread_note_limit` | max − min; 0 in the limit | 最大值減最小值；極限處為 0 |
| `playground.t2.distance` | Distance to b*, ‖b⁽ᵗ⁾ − b*‖∞ | 與 b* 之距離 ‖b⁽ᵗ⁾ − b*‖∞ |
| `playground.t2.distance_note` | the largest difference over the six objects | 六個物件差值絕對值之最大者 |
| `playground.t2.bound` | Its bound, wᵗ‖b⁽⁰⁾ − b*‖∞ | 其界限 wᵗ‖b⁽⁰⁾ − b*‖∞ |
| `playground.t2.bound_note` | wᵗ × {d0}; {d0} is the distance at t = 0 | wᵗ × {d0}；{d0} 為 t = 0 時之距離 |
| `playground.t2.limit` | Value every belief converges to | 全部信念收斂之值 |
| `playground.t2.limit_note` | Σ dⱼ b⁽⁰⁾ⱼ / Σ dⱼ = {weighted} / {degrees}, the degree-weighted mean | Σ dⱼ b⁽⁰⁾ⱼ / Σ dⱼ = {weighted} / {degrees}，依分支度加權之平均 |
| `playground.t2.mean` | Plain mean of b⁽⁰⁾ | b⁽⁰⁾ 之算術平均 |
| `playground.t2.mean_note` | Σ b⁽⁰⁾ⱼ / 6 = {sum} / 6 | Σ b⁽⁰⁾ⱼ / 6 = {sum} / 6 |
| `playground.t2.regime_zero` | w = 0: no neighbour is consulted, so b⁽ᵗ⁾ = b⁽⁰⁾ at every t. | w = 0：不參考任何鄰居，故每一 t 均有 b⁽ᵗ⁾ = b⁽⁰⁾。 |
| `playground.t2.regime_between` | 0 < w < 1: the beliefs converge to b*, which keeps a (1 − w) share of each object's own evidence. | 0 < w < 1：信念收斂至 b*，其保留各物件自身證據之 (1 − w) 份。 |
| `playground.t2.regime_one` | w = 1: no share of an object's own evidence is kept, and every belief converges to one value. | w = 1：不保留物件自身證據之任何份額，全部信念收斂至同一數值。 |
| `playground.t2.model` | IMP's own update is learned; this rule models repeated averaging. | IMP 本身之更新係學習而得；此規則為重複平均運算之模型。 |

- [ ] **Step 1: Write the failing tests** in `BeliefsUnderAveraging.test.tsx`, `renderAt` at `/m/m05`, mounted without a part unless stated:
  - `opens on the relations at w = 0.5, t = 0`: `T2.graph` `'relations'`, `T2.w` `'0.5'`, `T2.t` `'0'`; `t2-belief-1-b0` and `-bt` both `0.90`; `readout-T2.spread-value` `0.8000`, `readout-T2.spread` contains `0.3924 at b*`; `readout-T2.distance-value` and `readout-T2.bound-value` both `0.2065`, `readout-T2.bound` contains `wᵗ × 0.2065`; `t2-regime` contains `0 < w < 1`; no `readout-T2.limit`;
  - `names each object with its neighbours`: `t2-belief-1-nb` is `#2 person, #3 box, #5 wrench, #6 panel`, `t2-belief-3-nb` `#1 table`, `t2-belief-5-nb` `#1 table, #2 person`; under `?T2.graph=every`, every `-nb` cell reads `the other five`;
  - `gives spec §2's round 1 and round 5`: `?T2.t=1`: `-bt` of rows 1 to 6 are `0.65`, `0.33`, `0.80`, `0.30`, `0.33`, `0.75`; spread `0.5000`, distance `0.1011`, bound `0.1032`. `?T2.t=5`: spread `0.3941`, distance `0.0022`, bound `0.0065`;
  - `holds the distance under its bound at w = 0.9`: `?T2.w=0.9&T2.t=10`: spread `0.1053`, distance `0.0122`, bound `0.1276`, spread note `0.1105 at b*`; at t = 0, 1, 5, 10 and 40 the distance value never exceeds the bound value;
  - `every pair at w = 0.9, t = 1`: `?T2.graph=every&T2.w=0.9&T2.t=1`: `-bt` of rows 1 to 6 are `0.45`, `0.51`, `0.47`, `0.49`, `0.51`, `0.47`; spread `0.0640`, distance `0.0686`, bound `0.3432`, spread note `0.0678 at b*`;
  - `w = 1 hides the distance and the bound and shows the limit`: `?T2.w=1&T2.t=40`: no `readout-T2.distance`, no `readout-T2.bound`; `readout-T2.limit-value` `0.5083`, note contains `6.1 / 12`; `readout-T2.mean-value` `0.4833`, note contains `2.9 / 6`; spread `0.0002`, note `0 in the limit`; every `-bt` `0.51`; `t2-regime` contains `w = 1` (Review Focus 2);
  - `every pair at w = 1 meets at the plain mean`: `?T2.graph=every&T2.w=1&T2.t=5`: limit `0.4833` with `14.5 / 30`, mean `0.4833`, spread `0.0003`;
  - `w = 0 moves nothing`: `?T2.w=0&T2.t=40`: every `-bt` equals its `-b0`; spread `0.8000`; distance and bound `0.0000`; `t2-regime` contains `w = 0` (Review Focus 3);
  - `knobs the URL invented fall back or snap`: `?T2.graph=foo` gives `'relations'` and `t2-belief-3-nb` `#1 table`; `?T2.w=1.7` gives `'1'` and `readout-T2.limit`; `?T2.w=0.53` gives `'0.55'`; `?T2.t=-3` gives `'0'` and spread `0.8000`; `?T2.t=99` gives `'40'` (Review Focus 1);
  - `names IMP's update as learned`: `t2-model` has the English line;
  - `shows no recall`: no readout or cell contains `R@`;
  - `part 1 holds the table and part 2 the readouts`: `{ part: 1 }` renders `t2-beliefs` and `t2-regime`, no `readout-T2.spread`, no `t2-model`; `{ part: 2 }` renders `readout-T2.spread`, `t2-regime` and `t2-model`, no `t2-beliefs`; each part renders all three knobs;
  - `reads in 繁體中文`: `readout-T2.spread` contains `b⁽ᵗ⁾ 之全距` and `b* 處為 0.3924`; `t2-belief-1-nb` is `#2 person、#3 box、#5 wrench、#6 panel`; under `?T2.graph=every` it is `其餘五個物件`; `t2-regime` contains `0 < w < 1：信念收斂至 b*`;
  - `takes no focus on mount`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run frontend/src/playgrounds/T2`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the component and add the twenty-four keys to both locale tables. `w = snap(params['T2.w'], 0, 1, W_STEP)`, `t = snap(params['T2.t'], 0, T_MAX, 1)`, the graph `BELIEF_GRAPHS.includes(params['T2.graph'])` or `relations`.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run frontend/src/playgrounds && npm run lint:i18n`. Expected: PASS and exit 0; i18n reports 418 keys.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "feat(sgs): T2, six beliefs under repeated averaging, their fixed point and its bound"`.

---

### Task 5: M5 gains its playground steps

**Files:**
- Modify: `frontend/src/playgrounds/mounts.tsx` (`T1: PairsAgainstRelations`, `T2: BeliefsUnderAveraging`; no `PLAYGROUND_PARTS` entry), `frontend/src/playgrounds/test/Playground.test.tsx`
- Modify: `frontend/src/content/m05.en.mdx`, `frontend/src/content/m05.zh-TW.mdx`, `frontend/src/content/test/registry.test.tsx`
- Modify: `e2e/perf.spec.ts` (the two cases and the count), `../CLAUDE.md`, `../docs/INDEX.md` (the count phrases the records test reads, Global Constraints)

- [ ] **Step 1: Write the failing test** in `registry.test.tsx`, in M4's form:

```tsx
it('M5 carries T1 and T2 directly after the steps that teach them', () => {
  const meta = getMeta('m05', 'en')!;
  const part = (n?: number) => (n === undefined ? '' : `.${n}`);
  expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}${part(s.part)}` : ''}`)).toEqual([
    's1:prose', 's2:math', 's3:playground/T1', 's4:math', 's5:playground/T2', 's6:prose', 's7:lab',
    's8:checkpoint',
  ]);
  for (const step of getModule('m05', 'zh-TW')!.filter((s) => s.kind === 'playground')) {
    const mounted = render(<MemoryRouter initialEntries={['/m/m05']}>{step.node}</MemoryRouter>);
    expect(within(mounted.container).getByTestId('playground-frame')).toBeInTheDocument();
    expect(mounted.container.querySelector('[data-testid="playground-unknown"]')).toBeNull();
    mounted.unmount();
  }
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL on the step list.

- [ ] **Step 3: Register.** In `mounts.tsx`, import both components and add `T1` and `T2` to `PLAYGROUND_MOUNTS`. In `Playground.test.tsx`, the pinned ids become `['E1', 'E10', 'E13', 'E3', 'E4', 'E7', 'F1', 'F2', 'F3', 'F6', 'F7', 'F8', 'T1', 'T2', 'X1', 'X2']` and that test is renamed `registers exactly the playgrounds M0 to M5 mount`; the dense list becomes `['E13', 'E3', 'E4', 'E7', 'T1', 'T2', 'X2']` and that test is renamed `gives exactly M4's five playgrounds and M5's two the dense frame, and every other the measured one`, its comment naming M5's reason.

- [ ] **Step 4: Renumber and insert**, in both files, front matter and body alike. Rename the old steps from the last to the first so no two share an id at any point: s6 → s8, s5 → s7, s4 → s6, s3 → s4. Then insert, each with `kind: playground`, its `kp`, `seconds_budget: 90`, its notes, and a body of one noun-phrase heading and the tag:
  - **s3, T1:** heading "Pairs against relations" / 「配對數與關係數之對照」, `<Playground kp="T1" />`.
    - en: "Ninety seconds. The slider walks the 80 frames by object count. Open at rank 40, frame 547: 16 objects, 240 ordered pairs, 12,000 decisions, and 5 of the 240 pairs carry a relation. Move to rank 80, frame 3182: 39 objects, 1,482 pairs, 74,100 decisions, 29 related pairs. The pairs grow as N(N − 1) and the related pairs do not; across all 80 frames 651 of 26,282 pairs are related. Rank 2, frame 4176, carries 18 rows on only 7 of its 12 pairs: a pair with several predicates counts once."
    - zh-TW: 「九十秒。滑桿依物件數逐一走過 80 張影像。自第 40 名（影像 547）開始：16 個物件、240 個有序配對、12,000 次判定，240 個配對中僅 5 個承載關係。移至第 80 名（影像 3182）：39 個物件、1,482 個配對、74,100 次判定、29 個承載關係之配對。配對數隨 N(N − 1) 增長，承載關係之配對數則否；全部 80 張影像中，26,282 個配對僅 651 個承載關係。第 2 名（影像 4176）之 18 列關係僅落於 12 個配對中之 7 個：同一配對之多個 predicate 僅計一次。」
  - **s5, T2:** heading "Beliefs under averaging" / 「平均運算下之信念」, `<Playground kp="T2" />`.
    - en: "Ninety seconds. Open on the annotated relations at w = 0.5 and step t from 0 to 5: the spread falls from 0.8000 to 0.3941 and settles near 0.3924, the spread at b*, which is no consensus; the distance to b* stays under its bound at every t. At w = 0.9 the spread at b* is 0.1105. Only at w = 1 do the beliefs meet, at 0.5083, the degree-weighted mean, not the plain mean 0.4833: the table has four neighbours and the box one. Switch to every pair at w = 1 and the two means agree, 0.4833, since every object then has five neighbours."
    - zh-TW: 「九十秒。以標註之關係、w = 0.5 開啟，將 t 由 0 調至 5：全距由 0.8000 降至 0.3941，並趨近 b* 之全距 0.3924，並非共識；每一 t 與 b* 之距離均不超過其界限。w = 0.9 時 b* 之全距為 0.1105。唯有 w = 1 時信念方趨於一致，其值為 0.5083，即依分支度加權之平均，而非算術平均 0.4833：table 有四個鄰居，box 僅有一個。改選每一物件配對並令 w = 1，兩種平均均為 0.4833，因此時每一物件皆有五個鄰居。」

  Run `grep -rn -E "\bM0?5 s[0-9]+" frontend/src/content frontend/src/i18n`. Expected: no output; no module or locale table cites an M5 step by id, and Task 1 wrote none.

- [ ] **Step 5: The counts the records test reads, and the perf cases they name.**
  - `../CLAUDE.md`: "8 labs, 14 playgrounds" → "8 labs, 16 playgrounds"; "All 117 steps carry theirs; 234 notes." → "All 119 steps carry theirs; 238 notes."; "M3 two (E1, E10) and M4 five (E3, E4, E7, E13, X2); 14 live knowledge points have none. See D88, D93, D97, D98 and D106." → "M3 two (E1, E10), M4 five (E3, E4, E7, E13, X2) and M5 two (T1, T2); 12 live knowledge points have none. See D88, D93, D97, D98, D106 and D111."; "input-to-paint on five labs and fourteen playgrounds" (the phrase wraps after "five") → "five labs and sixteen playgrounds".
  - `../docs/INDEX.md`: "and holds 117 and 234 since D106]" → "117 and 234 after D106, and holds 119 and 238 since D111]"; "28 passed, NFR-8 measured over five labs and fourteen playgrounds, plus the D75 selection guard." → "28 passed, NFR-8 measured over five labs and the fourteen playgrounds of M0 to M4, plus the D75 selection guard; since D111 it measures five labs and sixteen playgrounds." Task 8 replaces this sentence with the M5 run.
  - `e2e/perf.spec.ts`: `PLAYGROUND_CASES` gains `{ module: 'm05', kp: 'T1', step: 2, act: { kind: 'set', testid: 'T1.frame', value: '80' }, readout: '[data-testid="playground-frame"] [data-testid^="readout-"]', why: 'another frame recounts its pairs, decisions and related pairs' }` and `{ module: 'm05', kp: 'T2', step: 4, act: { kind: 'set', testid: 'T2.t', value: '5' }, readout: '[data-testid^="t2-belief-"], [data-testid="playground-frame"] [data-testid^="readout-"]', why: 'five rounds of the rule re-average every belief and re-measure the distance to b*' }`; `all fourteen playgrounds were actually measured` becomes `all sixteen …`, its message "M0 to M5 carry sixteen" and its count 16. `T2.t` changes the table on every part and the readouts on any part that has them, so the case holds whether or not Task 7 splits T2.

- [ ] **Step 6: Run and confirm they pass.** Run `npx vitest run frontend/src/content frontend/src/playgrounds frontend/src/pages && npm run lint:content`. Expected: PASS, including `the records state as many playgrounds, uncovered live points and steps as the code holds` and KnowledgeIndex's `links a playground to the lecture step that mounts it`.

- [ ] **Step 7: Commit.** `npm run ci`, then `git commit -m "feat(sgs): M5 gains T1 and T2 after the steps that teach them"`.

---

### Task 6: The golden cases

**Files:**
- Modify: `../data/content/playground_golden.json` (on the NAS, in no commit), `frontend/src/playgrounds/test/golden.test.ts`

- [ ] **Step 1: Add the eleven cases of spec §6** before the closing `]` of `cases`, LF, two-space indentation as the file has:

```json
    {
      "id": "pg-T1-rank1",
      "kp": "T1",
      "image_id": "2045",
      "knobs": { "frame": 1 },
      "expect": { "objects": 4, "pairs": 12, "decisions": 600, "rows": 4, "related": 2 },
      "why": "Ordered by object count and then by image id as a number, the first of the 80 vg150-sgb frames is 2045, one of two with 4 objects (2045 before 4176). Ordered pairs 4 x 3 = 12; decisions 12 x 50 = 600 with VG150's 50 predicates. Its 4 relationship rows fall on 2 distinct ordered pairs, so 2 of the 12 pairs are related."
    },
    {
      "id": "pg-T1-rank40",
      "kp": "T1",
      "image_id": "547",
      "knobs": { "frame": 40 },
      "expect": { "objects": 16, "pairs": 240, "decisions": 12000, "rows": 5, "related": 5 },
      "why": "Ranks 1 to 39 hold the frames of 4 to 15 objects. The four frames of 16 objects are 547, 1246, 1632 and 1701 by image id as a number, so rank 40, the median place, is 547. Ordered pairs 16 x 15 = 240; decisions 240 x 50 = 12000. Its 5 relationship rows fall on 5 distinct ordered pairs: 5 of 240."
    },
    {
      "id": "pg-T1-rank80",
      "kp": "T1",
      "image_id": "3182",
      "knobs": { "frame": 80 },
      "expect": { "objects": 39, "pairs": 1482, "decisions": 74100, "rows": 45, "related": 29 },
      "why": "3182 carries the most objects of the 80 frames, 39, and is rank 80 alone (rank 79 has 35). Ordered pairs 39 x 38 = 1482; decisions 1482 x 50 = 74100. Its 45 relationship rows fall on 29 distinct ordered pairs: 29 of 1482."
    },
    {
      "id": "pg-T1-slice",
      "kp": "T1",
      "scope": "slice",
      "knobs": {},
      "expect": { "frames": 80, "objects": 1348, "pairs": 26282, "rows": 892, "related": 651 },
      "why": "Summed over the 80 frames of data/slices/vg150-sgb: 1348 objects; the sum of N(N - 1) over the frames is 26282 ordered pairs; 892 relationship rows; 651 distinct (subject, object) pairs carry at least one row, so 651 / 26282 = 0.0248 of the ordered pairs are related, before the 50 predicates multiply the decisions."
    },
    {
      "id": "pg-T2-relations-w05-t0",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "relations", "w": 0.5, "t": 0 },
      "expect": { "beliefs": "0.9000,0.2000,0.7000,0.4000,0.1000,0.6000", "spread": 0.8, "distance": 0.2065, "bound": 0.2065, "spread_fixed": 0.3924 },
      "why": "t = 0 is b0 itself, (0.9, 0.2, 0.7, 0.4, 0.1, 0.6) for table, person, box, glove, wrench, panel; spread 0.9 - 0.1 = 0.8. The fixed point solves (I - 0.5S) b* = 0.5 b0 on the relation graph: b* = (0.6978, 0.3280, 0.6989, 0.3640, 0.3065, 0.6489), spread 0.6989 - 0.3065 = 0.3924. Distance max |b0 - b*| = |0.1 - 0.3065| = 0.2065 at the wrench; bound 0.5^0 x 0.2065 = 0.2065."
    },
    {
      "id": "pg-T2-relations-w05-t1",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "relations", "w": 0.5, "t": 1 },
      "expect": { "beliefs": "0.6500,0.3333,0.8000,0.3000,0.3250,0.7500", "spread": 0.5, "distance": 0.1011, "bound": 0.1032, "spread_fixed": 0.3924 },
      "why": "One round, b1 = 0.5 b0 + 0.5 S b0. table 0.45 + 0.5 x (0.2 + 0.7 + 0.1 + 0.6)/4 = 0.65; person 0.1 + 0.5 x (0.9 + 0.4 + 0.1)/3 = 0.3333; box 0.35 + 0.5 x 0.9 = 0.8; glove 0.2 + 0.5 x 0.2 = 0.3; wrench 0.05 + 0.5 x (0.9 + 0.2)/2 = 0.325; panel 0.3 + 0.5 x 0.9 = 0.75. Spread 0.8 - 0.3 = 0.5. Distance max |b1 - b*| = 0.8 - 0.6989 = 0.1011 at the box (the panel ties); bound 0.5 x 0.2065 = 0.1032."
    },
    {
      "id": "pg-T2-relations-w05-t5",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "relations", "w": 0.5, "t": 5 },
      "expect": { "beliefs": "0.6962,0.3288,0.7011,0.3629,0.3070,0.6511", "spread": 0.3941, "distance": 0.0022, "bound": 0.0065, "spread_fixed": 0.3924 },
      "why": "Five rounds of the same rule give b5 = (0.6962, 0.3288, 0.7011, 0.3629, 0.3070, 0.6511); spread 0.7011 - 0.3070 = 0.3941, near the fixed point's 0.3924 and not falling toward 0. Distance max |b5 - b*| = 0.7011 - 0.6989 = 0.0022 at the box; bound 0.5^5 x 0.2065 = 0.03125 x 0.2065 = 0.0065."
    },
    {
      "id": "pg-T2-relations-w09-t10",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "relations", "w": 0.9, "t": 10 },
      "expect": { "beliefs": "0.5614,0.4561,0.5539,0.4623,0.4631,0.5439", "spread": 0.1053, "distance": 0.0122, "bound": 0.1276, "spread_fixed": 0.1105 },
      "why": "At w = 0.9 the fixed point solves (I - 0.9S) b* = 0.1 b0: b* = (0.5512, 0.4618, 0.5661, 0.4556, 0.4659, 0.5561), spread 0.5661 - 0.4556 = 0.1105; its distance from b0 is |0.1 - 0.4659| = 0.3659 at the wrench. Ten rounds give b10 = (0.5614, 0.4561, 0.5539, 0.4623, 0.4631, 0.5439), spread 0.5614 - 0.4561 = 0.1053. Distance max |b10 - b*| = 0.5661 - 0.5539 = 0.0122 at the box; bound 0.9^10 x 0.3659 = 0.3487 x 0.3659 = 0.1276."
    },
    {
      "id": "pg-T2-relations-w1-t40",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "relations", "w": 1, "t": 40 },
      "expect": { "beliefs": "0.5084,0.5083,0.5082,0.5084,0.5083,0.5082", "spread": 0.0002, "distance": null, "bound": null, "limit": 0.5083, "mean": 0.4833 },
      "why": "At w = 1 the own-evidence term vanishes and b40 = S^40 b0; I - S is singular, so no fixed point is solved. The degree-weighted sum is invariant: degrees (4, 3, 1, 1, 2, 1) sum to 12, and 4 x 0.9 + 3 x 0.2 + 0.7 + 0.4 + 2 x 0.1 + 0.6 = 6.1, so every belief tends to 6.1 / 12 = 0.5083. After 40 rounds b40 = (0.5084, 0.5083, 0.5082, 0.5084, 0.5083, 0.5082), spread 0.0002. The plain mean is 2.9 / 6 = 0.4833."
    },
    {
      "id": "pg-T2-every-w09-t1",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "every", "w": 0.9, "t": 1 },
      "expect": { "beliefs": "0.4500,0.5060,0.4660,0.4900,0.5140,0.4740", "spread": 0.064, "distance": 0.0686, "bound": 0.3432, "spread_fixed": 0.0678 },
      "why": "Every pair: each object's neighbours are the other five, so (S b0)_i = (2.9 - b0_i) / 5. One round at w = 0.9: table 0.09 + 0.9 x 2.0/5 = 0.45; person 0.02 + 0.9 x 2.7/5 = 0.506; box 0.07 + 0.9 x 2.2/5 = 0.466; glove 0.04 + 0.9 x 2.5/5 = 0.49; wrench 0.01 + 0.9 x 2.8/5 = 0.514; panel 0.06 + 0.9 x 2.3/5 = 0.474. Spread 0.514 - 0.45 = 0.064, below the fixed point's 0.0678. b* = (0.5186, 0.4593, 0.5017, 0.4763, 0.4508, 0.4932); its distance from b0 is 0.9 - 0.5186 = 0.3814 at the table. Distance max |b1 - b*| = 0.5186 - 0.45 = 0.0686; bound 0.9 x 0.3814 = 0.3432."
    },
    {
      "id": "pg-T2-every-w1-t5",
      "kp": "T2",
      "image_id": "ph-001",
      "knobs": { "graph": "every", "w": 1, "t": 5 },
      "expect": { "beliefs": "0.4832,0.4834,0.4833,0.4834,0.4835,0.4833", "spread": 0.0003, "distance": null, "bound": null, "limit": 0.4833, "mean": 0.4833 },
      "why": "Every pair gives each object 5 neighbours, a regular graph, so the degree-weighted mean is the plain mean: 5 x 2.9 / 30 = 2.9 / 6 = 0.4833. At w = 1 each round maps b_i to (sum - b_i)/5, which multiplies every deviation from the mean by -1/5; after 5 rounds the spread is 0.8 / 5^5 = 0.8 / 3125 = 0.0003, and b5 = (0.4832, 0.4834, 0.4833, 0.4834, 0.4835, 0.4833)."
    }
```

  **Paste these eleven entries verbatim into the task report**, and the count content lint prints (75 playground cases, 64 before): the file is on the NAS and no commit carries it.

- [ ] **Step 2: Run the golden test and confirm it fails.** Run `npx vitest run frontend/src/playgrounds/test/golden.test.ts`. Expected: FAIL on `every case is run by exactly one block`, first at `pg-T1-rank1`.

- [ ] **Step 3: Add the blocks.** `RUNS` gains `'T1 frame': (c) => c.kp === 'T1' && Boolean(c.image_id)`, `'T1 slice': (c) => c.kp === 'T1' && c.scope === 'slice'` and `T2: (c) => c.kp === 'T2'`. Import `relatedPairs`, `averagingRounds`, `fixedPoint`, `maxDistance`, `spread`, `mean`, `degreeWeightedMean` from `../logic`, `PAIR_ROWS`, `SLICE_TOTALS` from `../M5/pairs`, `beliefGraph`, `type BeliefGraphName` from `../M5/beliefs`, and `type SceneGraph` from `sgg-metrics`:

```ts
it.each(run('T1 frame'))('$id', (c) => {
  const row = PAIR_ROWS[(c.knobs.frame as number) - 1]!;
  expect(row.imageId).toBe(c.image_id);
  const frame = vgFrameById(c.image_id!)!;
  const n = frame.objects.length;
  expect(n).toBe(c.expect.objects);
  expect(candidateSpace(n, 1, true)).toBe(c.expect.pairs);
  expect(candidateSpace(n, VG150_PREDICATES, true)).toBe(c.expect.decisions);
  expect(frame.relationships).toHaveLength(c.expect.rows as number);
  expect(relatedPairs(frame.relationships)).toBe(c.expect.related);
  expect([row.objects, row.pairs, row.rows, row.related])
    .toEqual([c.expect.objects, c.expect.pairs, c.expect.rows, c.expect.related]);
});

it.each(run('T1 slice'))('$id', (c) => {
  const sum = (f: (g: SceneGraph) => number) => VG_FRAMES.reduce((total, g) => total + f(g), 0);
  expect(VG_FRAMES).toHaveLength(c.expect.frames as number);
  expect(sum((g) => g.objects.length)).toBe(c.expect.objects);
  expect(sum((g) => candidateSpace(g.objects.length, 1, true))).toBe(c.expect.pairs);
  expect(sum((g) => g.relationships.length)).toBe(c.expect.rows);
  expect(sum((g) => relatedPairs(g.relationships))).toBe(c.expect.related);
  expect(SLICE_TOTALS).toEqual(c.expect);
});

it.each(run('T2'))('$id', (c) => {
  const { graph, w, t } = c.knobs as { graph: BeliefGraphName; w: number; t: number };
  const g = beliefGraph(graph);
  expect(frameById(c.image_id!)!.objects.map((o) => o.object_id).sort((a, b) => a - b)).toEqual(g.ids);
  const b = averagingRounds(g.a, w, g.b0, t);
  const expected = (c.expect.beliefs as string).split(',').map(Number);
  b.forEach((value, i) => expect(value, `belief ${i + 1}`).toBeCloseTo(expected[i]!, 4));
  expect(spread(b)).toBeCloseTo(c.expect.spread as number, 4);
  const star = fixedPoint(g.a, w, g.b0);
  if (c.expect.distance === null) {
    expect(star).toBeNull();
    expect(degreeWeightedMean(g.lists, g.b0)).toBeCloseTo(c.expect.limit as number, 4);
    expect(mean(g.b0)).toBeCloseTo(c.expect.mean as number, 4);
  } else {
    expect(maxDistance(b, star!)).toBeCloseTo(c.expect.distance as number, 4);
    expect(w ** t * maxDistance(g.b0, star!)).toBeCloseTo(c.expect.bound as number, 4);
    expect(spread(star!)).toBeCloseTo(c.expect.spread_fixed as number, 4);
  }
});

it("pins T1's four cases and T2's seven, so no block passes by running none", () => {
  expect(run('T1 frame')).toHaveLength(3);
  expect(run('T1 slice')).toHaveLength(1);
  expect(run('T2')).toHaveLength(7);
});
```

- [ ] **Step 4: Run it and confirm it passes**, then `npm run lint:content`. Expected: PASS; content lint reports 75 playground cases.

- [ ] **Step 5: Commit.** `npm run ci`, then `git commit -m "test(sgs): M5's playground arithmetic pinned by hand-computed golden cases"`.

---

### Task 7: Chromium: fit, interaction, legibility, time

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`
- Create and delete before the commit: `e2e/zz-measure-m5.spec.ts`
- Modify only if Step 2 splits T2: `frontend/src/playgrounds/mounts.tsx`, `frontend/src/playgrounds/test/parts.test.tsx`, `frontend/src/content/m05.en.mdx`, `frontend/src/content/m05.zh-TW.mdx`, `frontend/src/content/test/registry.test.tsx`, `e2e/perf.spec.ts`, `../CLAUDE.md`, `../docs/INDEX.md`, `../README.md`

- [ ] **Step 1: Measure.** Kill any `vite preview` on port 4173. Save as `e2e/zz-measure-m5.spec.ts`:

```ts
import { test } from '@playwright/test';

const WHERE = [
  'm05/2?T1.frame=80', 'm05/2?T1.frame=1', 'm05/4', 'm05/4?T2.w=0.95&T2.t=40',
  'm05/4?T2.w=1&T2.t=40', 'm05/4?T2.graph=every&T2.w=1&T2.t=5', 'm05/4?T2.w=0&T2.t=40',
];

for (const lang of ['zh-TW', 'en']) {
  test(`M5's playground steps against 1024 x 768 in ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript((l) => localStorage.setItem('sgs:v1:lang', JSON.stringify(l)), lang);
    for (const where of WHERE) {
      await page.goto(`/lecture/m/${where}`);
      await page.getByTestId('playground-frame').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const past = await page.getByTestId('step').evaluate((el) => el.scrollHeight - el.clientHeight);
      console.log(`${lang} ${where} past ${past}`);
    }
  });
}
```

  Run `npx playwright test e2e/zz-measure-m5.spec.ts`. Record every printed line in the task report and in D111; "past" ≤ 0 fits.

- [ ] **Step 2: Decide the parts (D96).** A whole playground whose longest state runs past 0 px in 繁體中文 is split; English is recorded, not held.
  - **T1 fits** (expected): no change. If it does not, split it as T2 below, part 1 the slider with `T1.objects`, `T1.pairs` and `T1.decisions`, part 2 the slider with `T1.rows`, `T1.related`, `T1.slice` and `t1-source`, and write the ids the same way.
  - **T2 fits:** no change; the component's parts stay unused, and D111 says so.
  - **T2 runs past:** `PLAYGROUND_PARTS.T2 = 2` in `mounts.tsx` (its comment "each of these ten" becomes "eleven"); `parts.test.tsx`'s pinned table gains `T2: 2` and its title says eleven. In both MDX files, s5 becomes `part: 1` with heading "Six beliefs, round by round" / 「六個信念之逐輪變化」 and `<Playground kp="T2" part="1" />`; a new s6, `part: 2`, heading "Where the beliefs settle" / 「信念之收斂位置」, `<Playground kp="T2" part="2" />`; the old s6, s7 and s8 become s7, s8 and s9, renamed from the last. Notes:
    - s5 en: "Ninety seconds. Six beliefs, each beside its neighbours. At w = 0.5 step t from 0 to 5: the table, with four neighbours, falls from 0.90 to 0.70; the box, with one, rises to 0.80 at t = 1 and returns to 0.70. Switch to every pair and each object averages the other five. The next step reads where they settle."
    - s5 zh-TW: 「九十秒。六個信念各與其鄰居並列。w = 0.5 時將 t 由 0 調至 5：table 有四個鄰居，由 0.90 降至 0.70；box 僅有一個鄰居，於 t = 1 升至 0.80 後回到 0.70。改選每一物件配對，則每一物件對其餘五個物件取平均。下一步驟說明信念之收斂位置。」
    - s6: Task 5's T2 note from "Open on the annotated relations" onward, in each locale (「以標註之關係」 onward), after "Ninety seconds." / 「九十秒。」.
    - The registry pin becomes `'s1:prose', 's2:math', 's3:playground/T1', 's4:math', 's5:playground/T2.1', 's6:playground/T2.2', 's7:prose', 's8:lab', 's9:checkpoint'`, and its title "… T1, and T2 in two parts, …".
    - The counts: CLAUDE.md "All 120 steps carry theirs; 240 notes."; INDEX "holds 120 and 240 since D111]"; README "The ten playgrounds too tall for one panel" → "The eleven …"; CLAUDE.md's list "E1, E10, E3, E4, E7, F1, F3, F6 and F7 in two" → "E1, E10, E3, E4, E7, F1, F3, F6, F7 and T2 in two".
    - Every later step index in Steps 3 to 5 that names T2's readouts uses `m05/5`; the table stays at `m05/4`. Re-run Step 1 with `m05/5` added to `WHERE` and record each part.

- [ ] **Step 3: `lecture.spec.ts`**, in the form of M2's keyboard test, whose cases carry an optional `at` query and `step`:
  - `M5's playgrounds compute with no backend running`: `m05/2` shows `readout-T1.pairs-value` `240`, `readout-T1.related-value` `5` and `readout-T1.slice-value` `651 / 26,282`; `m05/4` shows `t2-belief-1-bt` `0.90`; the step with T2's readouts (`m05/4`, or `m05/5` if split) shows `readout-T2.spread-value` `0.8000` and `readout-T2.bound-value` `0.2065`;
  - `M5's knobs work from the keyboard and never advance the deck`: cases `{ step: 2, knob: 'T1.frame', key: 'ArrowRight', watch: 'readout-T1.rows-value' }` (5 to 8), `{ step: 4, knob: 'T2.t', key: 'ArrowRight', watch: 't2-belief-1-bt' }` (0.90 to 0.65), `{ step: 4, at: '?T2.t=1', knob: 'T2.w', key: 'ArrowRight', watch: 't2-belief-1-bt' }` (0.65 to 0.63), `{ step: 4, knob: 'T2.graph', key: 'ArrowDown', watch: 't2-belief-1-nb' }`;
  - `M5's knobs write the address bar`: at `m05/4`, `T2.graph` → `every` gives `T2.graph=every`; opened cold at that URL, `t2-belief-1-nb` reads `the other five`;
  - only if T2 is split: `M5's knobs cross from T2's first part to its second`: `m05/4?T2.w=1`, ArrowRight, `readout-T2.limit-value` `0.5083` (Review Focus 8);
  - `no playground takes focus when its step opens` gains `['m05', 2]` and `['m05', 4]` (and `['m05', 5]` if split).

- [ ] **Step 4: `projector.spec.ts`.**
  - `PARTS_LONGEST` gains `'m05/2?T1.frame=80'`, `'m05/4?T2.w=0.95&T2.t=40'`, `'m05/4?T2.w=1&T2.t=40'` and `'m05/4?T2.graph=every&T2.w=1&T2.t=5'` (with the `m05/5` forms too if split), and its comment names T1 at rank 80, where the numbers are widest, and T2 at w < 1 and w = 1, whose readouts differ.
  - `a playground step fits the panel, with its controls reachable` gains `'m05/2'` and `'m05/4'` (and `'m05/5'`).
  - The contrast walk gains `{ module: 'm05', step: 2, floor }` and `{ module: 'm05', step: 4, floor }` (and step 5). Each floor is measured: add the page with `floor: 1` and a temporary `console.log(module, step, rows.length)` in the walk, run `npx playwright test e2e/projector.spec.ts -g "NFR-5"`, set each floor to four fifths of the count read at 1024 × 768, rounded down, remove the log, and extend the comment that lists the measured rows with M5's and "(2026-09-29, D111)".
  - The 18 px floor gains `...[2, 4].map((s) => ['m05', s] as const)` (with 5 if split): spec §6 names the new steps.
  - Delete `e2e/zz-measure-m5.spec.ts` and confirm `git status` does not list it.

- [ ] **Step 5: Run.** Kill any `vite preview` on port 4173, then `npm run test:e2e` and `npm run check:perf` (`SGS_PYTHON` set). Expected: both exit 0; e2e 82 passed (83 if T2 is split); perf 30 passed, the log listing `playground   T1` and `playground   T2` inside 100 ms. Record the totals, the durations and the two playgrounds' times.

- [ ] **Step 6: Commit.** `npm run ci`, then stage the specs (and, if split, the files of Step 2), then `git commit -m "test(sgs): M5's playgrounds in the browser: with no backend, by keyboard, on the projector, in time"`.

---

### Task 8: Records, and the full run

**Files:**
- Modify: `../DEVIATIONS.md` (append **D111**), `../docs/VERIFICATION.md` (append **§30**), `../docs/INDEX.md`, `../README.md`, `../CLAUDE.md`, and the spec, where the build departed from it (in-place bracketed notes)
- Test: `frontend/src/content/test/registry.test.tsx`

- [ ] **Step 1: Write the failing records test**, after D110's:

```tsx
it("the records carry D111 and M5's playgrounds", () => {
  const deviations = source('../../../../../DEVIATIONS.md');
  const claude = source('../../../../../CLAUDE.md');
  const index = source('../../../../../docs/INDEX.md');
  const readme = source('../../../../../README.md');
  const d111 = record(deviations, 'D111').replace(/\s+/g, ' ');
  expect(deviations).toContain(
    "## D111 — M5's playgrounds, T1 and T2, and the pair and averaging statements the corpus and the derivation contradicted",
  );
  expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 30. ');
  for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
    atLeast(text, /D1…D(\d+)/, 111, name);
  }
  atLeast(claude, /all (\d+) logged deviations/, 111, 'CLAUDE.md deviations');
  expect(claude).toContain('§30 the M5 playgrounds');
  expect(index).toContain('the M5 playgrounds (§30)');
  atLeast(readme, /`npm run test:e2e` is (\d+)/, 82, 'README e2e');
  atLeast(readme, /`npm run check:perf` is (\d+)/, 30, 'README perf');
  // The corpus figures, the averaging values, where the branch was cut, and the data no commit shows.
  for (const item of ['651', '26,282', '0.3924', '0.5083', '0.4833', 'dfe4dc4', 'D109', 'playground_golden.json', 'M7']) {
    expect(d111, item).toContain(item);
  }
});
```

- [ ] **Step 2: Run it and confirm it fails** on the missing heading.

- [ ] **Step 3: Write the records.**
  - **D111**, with the heading above: **Plan** and **Decisions** lines as D106's (the spec's §1 table, taken without a design session, awaiting the author's review; branch from `main` at `dfe4dc4`, the spec at `57e678b`); spec §2's findings for T1 and T2; the corrections and their commit; the complete-graph statement made to name the node itself, with the every-pair distance 0.0227 at t = 1; **M7**, corrected beyond spec §3's list, and why; the map's toy readout "~20" left per spec §8 and attributed by the corrected note; the two playgrounds, their data and the eleven functions; every measurement of Tasks 2, 6 and 7 (spec §2's values as the tests hold them, the golden test's failure count before its blocks, each fit line of Task 7 Step 1, the parts decision, the contrast-walk rows, the e2e and perf totals); the order of Tasks 5 and 6 and its two reasons; `dense` for T1 and T2 and its reason; and a paragraph **Data no commit carries** naming D109 and D110, listing Task 1's six harvested changes (`math.json` T2; `deriv.json` T1 and T2; `kp.json` T1.deriv, T2.math and T2.deriv) and the eleven cases added to `data/content/playground_golden.json` (64 to 75), with their ids, and saying where their full text is recorded.
  - **VERIFICATION §30**, `## 30. The M5 playgrounds — measured, 2026-09-29`, in §29's form: the table of the `npm run ci` steps with before and after (harvest; pytest; vitest; parity; i18n keys and placeholders; content lint with 75 playground cases and 50 symbols; frozen lints; standalone; frontend modules; `test:e2e`; `check:perf`); `### The corrections` (the test's strings); `### The arithmetic` (T1 at ranks 1, 2, 40, 41 and 80 with the totals; T2's values at the seven golden settings and spec §2's fixed-point spreads, limits and bound checks); `### Golden cases`; `### Fit` (Task 7 Step 1's lines, both locales, and each part if split); `### In the browser` (the new lecture tests, the projector additions, perf times).
  - **CLAUDE.md:** the sentence "**It computes a count, a bound or a set membership, never a metric**" becomes "**It computes a count, a bound, a set membership or a value of the rule its step teaches, never a metric**", and D111 records why (T2 shows the course's own averaging rule, a quantity its definition contains, as the M0 design's §1 allows; controller's ruling, 2026-09-29); the §-list gains "and §30 the M5 playgrounds", "all 111 logged deviations", `D1…D111`; the e2e count; "**`PlaygroundFrame`'s `dense` is M4's**, for its twelve-row lists at 1024×768" gains ", and M5's, for T1's six readouts and T2's table (D111)"; "requires the dense frame of exactly E3, E4, E7, E13 and X2" becomes "E3, E4, E7, E13, X2, T1 and T2".
  - **INDEX:** rows for the M5 spec ("T1, T2, and the pair and averaging statements the corpus and M5's derivation contradict", **executed**) and this plan ("M5's corrections, the slice ordered and the six beliefs, T1 and T2, their golden cases, M5 s3 and s5", **executed**); `D1…D111`; the VERIFICATION row gains "and the M5 playgrounds (§30)"; a paragraph "**M5's playgrounds, T1 and T2, 2026-09-29.**" in M4's form; the verification paragraph with the new runs, replacing Task 5's interim perf sentence.
  - **README:** the status paragraph's test counts, "`npm run test:e2e` is N", "`npm run check:perf` is 30", "§30 records those runs, §15 to §29 the fifteen before it"; the fit paragraph gains §30 and any English overflow Task 7 measured.
  - **The spec**, in-place `[**As built (D111):** …]` notes: §3's complete-graph case (the node included); §3 and §8 on M7; §5's frames (`dense`); §5.2's parts (as measured); §6's order of the golden cases after the steps.

- [ ] **Step 4: Run the full run.** `npm run ci`, `npm run test:e2e`, `npm run check:perf`, each exit 0, and `git status` clean afterwards (nothing under `data/` appears, by D109).

- [ ] **Step 5: Commit.** `git commit -m "docs(sgs): D111 and VERIFICATION §30, M5's playgrounds and the counts brought up to date"`.
