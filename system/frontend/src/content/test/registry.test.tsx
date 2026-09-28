import { readFileSync } from 'node:fs';
import deriv from '../../../../../data/content/deriv.json';
import kp from '../../../../../data/content/kp.json';
import math from '../../../../../data/content/math.json';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { PLAYGROUND_MOUNTS, PLAYGROUND_PARTS } from '../../playgrounds/mounts';
import { getMeta, getModule, moduleIds } from '../registry';

beforeEach(() => {
  setLocale('en');
});

/**
 * A repository file as text. Through a parameter, not a literal: Vite rewrites
 * `new URL('literal', import.meta.url)` into an asset URL, which `readFileSync` refuses.
 */
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * A count a record states is at least `floor`. A records test bounds the counts from below, so
 * that the next record, which raises them, does not have to rewrite this one's test (D103).
 */
const atLeast = (text: string, pattern: RegExp, floor: number, name: string) =>
  expect(Number(pattern.exec(text)?.[1]), name).toBeGreaterThanOrEqual(floor);

/** A count as README's prose writes it. */
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
  'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty',
];

/**
 * One deviation's record, from its heading to the next, empty when it has none. Sliced to the end
 * of the file, a later record naming an item would satisfy this one's test (D104).
 */
const record = (deviations: string, id: string) => {
  const start = deviations.indexOf(`## ${id} — `);
  if (start === -1) return '';
  const end = deviations.indexOf('\n## ', start + 1);
  return deviations.slice(start, end === -1 ? undefined : end);
};

describe('the module registry', () => {
  it('finds m00 in both locales without a hand-kept list', () => {
    expect(moduleIds()).toContain('m00');
    expect(getMeta('m00', 'en')).not.toBeNull();
    expect(getMeta('m00', 'zh-TW')).not.toBeNull();
  });

  it('reads the frontmatter the content lint validates', () => {
    const meta = getMeta('m00', 'en')!;
    expect(meta.id).toBe('m00');
    expect(meta.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']);
    expect(meta.steps.find((s) => s.kind === 'lab')?.lab).toBe('L1');
    expect(meta.knowledge_points).toContain('F1');
  });

  it('gives the two locales the same step sequence, which is what the shells index by', () => {
    const en = getModule('m00', 'en')!;
    const zh = getModule('m00', 'zh-TW')!;
    expect(en.map((s) => [s.id, s.kind])).toEqual(zh.map((s) => [s.id, s.kind]));
  });

  it('returns one node per step, each rendering only its own step', () => {
    const steps = getModule('m00', 'en')!;
    const { container } = render(<>{steps[0]!.node}</>);
    expect(container.textContent).toContain('What a label cannot say');
    // the math step's prose must not leak into the prose step
    expect(container.textContent).not.toContain('Worked example');
  });

  it('renders the four-part contract inside the math step, in order', () => {
    const steps = getModule('m00', 'en')!;
    const mathStep = steps.find((s) => s.kind === 'math')!;
    const { container } = render(<>{mathStep.node}</>);
    const parts = [...container.querySelectorAll('[data-part]')].map((n) =>
      n.getAttribute('data-part'),
    );
    expect(parts).toEqual(['Intuition', 'Formal', 'Worked', 'Implications']);
  });

  it('typesets the mathematics at build time rather than leaving it as characters', () => {
    // SRS §11.3: rehype-katex runs in the Vite pipeline, so the DOM carries KaTeX markup and no
    // typesetting cost is paid at lecture time. A `$$...$$` surviving as text would mean the
    // plugin chain is not wired, which renders as visible dollar signs on a projector.
    const steps = getModule('m00', 'en')!;
    const { container } = render(<>{steps.find((s) => s.kind === 'math')!.node}</>);
    expect(container.querySelector('.katex-html')).not.toBeNull();
    expect(container.querySelector('.katex-display')).not.toBeNull();
    // KaTeX keeps the original TeX in a MathML annotation, so `\qquad` is present in the text
    // of a correctly typeset formula. Asserting on textContent would have tested the opposite
    // of what it claimed; the rendered side is what a projector shows.
    const tex = container.querySelector('annotation[encoding="application/x-tex"]');
    expect(tex?.textContent).toContain('\\mathcal{P}');
    // A formula the plugin never saw would still be sitting between its delimiters.
    const prose = [...container.querySelectorAll('p')].map((n) => n.textContent).join(' ');
    expect(prose).not.toContain('$$');
  });

  it('translates the contract headings with the locale, not with the content', () => {
    // The headings come from t(); the body comes from the file. Two different mechanisms, and
    // the test keeps the renders apart because setLocale re-renders everything already mounted.
    const en = render(<>{getModule('m00', 'en')!.find((s) => s.kind === 'math')!.node}</>);
    expect(within(en.container).getByText('Worked example')).toBeInTheDocument();
    en.unmount();

    setLocale('zh-TW');
    const zh = render(<>{getModule('m00', 'zh-TW')!.find((s) => s.kind === 'math')!.node}</>);
    expect(within(zh.container).getByText('計算範例')).toBeInTheDocument();
    expect(zh.container.textContent).toContain('場景圖');
  });

  it('compiles every module in both locales, with matching step sequences', () => {
    // Not m00 alone. A module is added by dropping two files into the directory, so the only
    // thing that would catch one whose MDX does not compile, or whose locales have drifted
    // apart, is a test that looks at all of them.
    for (const id of moduleIds()) {
      const en = getModule(id, 'en');
      const zh = getModule(id, 'zh-TW');
      expect(en, `${id} en`).not.toBeNull();
      expect(zh, `${id} zh-TW`).not.toBeNull();
      expect(en!.map((s) => [s.id, s.kind]), id).toEqual(zh!.map((s) => [s.id, s.kind]));
    }
  });

  // Fifteen modules, two locales, a full KaTeX render and teardown for every math step: this
  // one test is around ten seconds on the development machine and was sitting just under
  // Vitest's five-second default until the suite grew enough to push it over. A budget it
  // cannot plausibly reach is better than a flake that looks like a regression in whatever
  // was committed last.
  it('typesets every math step in every module, in both locales', { timeout: 60_000 }, () => {
    for (const id of moduleIds()) {
      for (const locale of ['en', 'zh-TW'] as const) {
        for (const step of getModule(id, locale)!.filter((s) => s.kind === 'math')) {
          const { container, unmount } = render(<>{step.node}</>);
          expect(container.querySelector('.katex-display'), `${id}.${locale} ${step.id}`)
            .not.toBeNull();
          const parts = [...container.querySelectorAll('[data-part]')].map((n) =>
            n.getAttribute('data-part'),
          );
          expect(parts, `${id}.${locale} ${step.id}`).toEqual([
            'Intuition',
            'Formal',
            'Worked',
            'Implications',
          ]);
          unmount();
        }
      }
    }
  });

  it('declines a module that does not exist rather than rendering an empty one', () => {
    expect(getModule('m99', 'en')).toBeNull();
    expect(getMeta('m99', 'en')).toBeNull();
  });
});

describe('the playground step kind', () => {
  it('M1 carries its three playgrounds, in two, two and three parts, after the steps that teach them', () => {
    const meta = getMeta('m01', 'en')!;
    const part = (n?: number) => (n === undefined ? '' : `.${n}`);
    expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}${part(s.part)}` : ''}`)).toEqual([
      's1:prose', 's2:math', 's3:playground/F6.1', 's4:playground/F6.2', 's5:math',
      's6:playground/F7.1', 's7:playground/F7.2', 's8:prose', 's9:playground/X1.1',
      's10:playground/X1.2', 's11:playground/X1.3', 's12:lab', 's13:checkpoint',
    ]);
    const steps = getModule('m01', 'zh-TW')!;
    for (const step of steps.filter((s) => s.kind === 'playground')) {
      const mounted = render(<MemoryRouter initialEntries={['/m/m01']}>{step.node}</MemoryRouter>);
      expect(within(mounted.container).getByTestId('playground-frame')).toBeInTheDocument();
      expect(mounted.container.querySelector('[data-testid="playground-unknown"]')).toBeNull();
      mounted.unmount();
    }
  });

  it('M3 states what is forced apart from what is observed, and the verdicts the engine gives', () => {
    // s3 claimed the recall ordering for every model; what the protocols force is an inclusion of
    // hypothesis spaces, and the ordering is observed (D98). s2 claimed two failure modes imply
    // four colours; the engine gives the four combinations three verdicts.
    for (const file of ['../m03.en.mdx', '../m03.zh-TW.mdx']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(text, file).toContain(
        '\\mathcal{H}_{\\text{PredCls}}\\subseteq\\mathcal{H}_{\\text{SGCls}}\\subseteq\\mathcal{H}_{\\text{SGDet}}',
      );
      expect(text, file).toContain('\\begin{array}{c|cc}');
      expect(text, file).not.toContain('for every model');
      expect(text, file).not.toContain('\\lvert V\\rvert^2');
      expect(text, file).not.toContain('four diff colours');
    }
    const formulas = math as Record<string, string>;
    const derivations = deriv as Record<string, string>;
    expect(formulas.E10).toContain('\\subseteq');
    for (const id of ['E1', 'E10']) {
      expect(derivations[id], id).not.toContain('\\lvert V\\rvert^2');
      expect(derivations[id], id).not.toContain('four diff colours');
    }
    for (const locale of ['en', 'zh-TW'] as const) {
      for (const step of getModule('m03', locale)!.filter((s) => s.kind === 'math')) {
        const { container, unmount } = render(<>{step.node}</>);
        expect(container.querySelector('.katex-error'), `${locale} ${step.id}`).toBeNull();
        unmount();
      }
    }
  });

  it('M4 derives only what the engine and the definitions force', () => {
    // §2's five findings: s3's Worked step claimed X_k ⊆ X_k^ng from the constrained pool, where
    // only the pools nest (X ⊆ X^ng) and R@k ≤ ngR@k holds once k covers the unconstrained pool;
    // s5 claimed the gap widens at a fixed k, where only the pool grows with m; s4 divided by C,
    // the count of all predicate classes, where the engine and the Formal line average over the
    // classes present in the ground truth, |P'|; s6 called both R and mR affine in λ, where only
    // the blended score is, recall over its ranking being piecewise constant; s8 used k for VRD's
    // per-pair count where the symbol table already defines k as the rank cutoff, cited a
    // "Proposition 4c" the course defines nowhere, and asserted an ordering M3 s3 records as
    // observed, not implied.
    for (const file of ['../m04.en.mdx', '../m04.zh-TW.mdx']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\s+/g, ' ');
      for (const present of [
        'k\\ge\\lvert X^{\\mathrm{ng}}\\rvert &\\Rightarrow R@k\\le \\mathrm{ngR}@k',
        'R@2=1,\\ \\mathrm{ngR}@2=0',
        '\\frac{1}{\\lvert\\mathcal{P}^{\\prime}\\rvert}',
        'recall over its ranking is piecewise constant',
        '\\text{VRD papers call it } k',
      ]) {
        expect(text, `${file}: ${present}`).toContain(present);
      }
      for (const absent of [
        'X_k\\subseteq X_k^{\\mathrm{ng}}',
        // The bare '\cap X_k' also matches s2's untouched R@k = |G ∩ X_k| / |G|, so the removed
        // s5 defect (top-m predicates ∩ X_k) is pinned by its closing brace instead.
        '\\bigr\\}\\cap X_k',
        'gap keeps widening',
        'The slider moves',
        'Both are affine in',
        'Proposition 4c',
        'for the same reason the protocol ordering holds',
        '同一切片上',
        'on the same slice',
      ]) {
        expect(text, `${file}: ${absent}`).not.toContain(absent);
      }
    }
    const formulas = math as Record<string, string>;
    const derivations = deriv as Record<string, string>;
    for (const id of ['E4', 'E7', 'E6', 'E11', 'X2']) {
      for (const absent of [
        'X_k\\subseteq X_k^{\\mathrm{ng}}',
        '\\cap X_k',
        '\\frac{1}{C}',
        'Both are affine in',
        'Proposition 4c',
      ]) {
        expect(derivations[id], `${id}: ${absent}`).not.toContain(absent);
      }
    }
    expect(formulas.X2).toContain('m=\\lvert');
    for (const locale of ['en', 'zh-TW'] as const) {
      for (const step of getModule('m04', locale)!.filter((s) => s.kind === 'math')) {
        const { container, unmount } = render(<>{step.node}</>);
        expect(container.querySelector('.katex-error'), `${locale} ${step.id}`).toBeNull();
        unmount();
      }
    }
  });

  it('M3 qualifies its verdict table and defines the inclusion it states', () => {
    // Branch review (D98): the table holds against a ground truth no earlier prediction has matched,
    // since the engine calls a repeat of a matched triplet localization; and the inclusion holds
    // only for hypotheses of that shape, with the given boxes and labels inside what the next
    // protocol allows.
    const en = source('../m03.en.mdx');
    const zh = source('../m03.zh-TW.mdx');
    for (const text of [en, zh]) expect(text).toContain('\\text{against a ground truth no earlier prediction has matched:}');
    expect(en).toContain('a repeat of a triplet already matched');
    expect(zh).toContain('重複預測一個已命中之三元組');
    expect(en).toContain('single-triplet hypotheses');
    expect(en).toContain('the given labels are in');
    expect(zh).toContain('單一三元組假設');
    expect(zh).toContain('所給之標籤屬於');
    expect((deriv as Record<string, string>).E1).toContain('no earlier prediction has matched');
  });

  it("semi is described as the cap it is, and Action Genome's rule as not computed", () => {
    // D99: the application's semi caps predicates per ordered object pair; Action Genome's semi
    // constraint, as STTran evaluates it, keeps one attention predicate and every spatial or
    // contacting predicate above 0.9, and the course must not present the one as the other.
    const en = [source('../m04.en.mdx'), source('../m12.en.mdx')];
    const zh = [source('../m04.zh-TW.mdx'), source('../m12.zh-TW.mdx')];
    for (const text of en) {
      expect(text).toContain('per ordered object pair');
      expect(text).toContain('0.9');
      expect(text).not.toContain('the mode that matches the data');
      expect(text).not.toContain('for this kind of data it is the correct one');
    }
    for (const text of zh) {
      expect(text).toContain('有序物件配對');
      expect(text).toContain('0.9');
      expect(text).not.toContain('方為與資料相符的模式');
      expect(text).not.toContain('它才是正確的設定');
    }
    const srs = source('../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-SRS.md');
    expect(srs).toContain('[**Corrected 2026-09-27 (D99):**');
  });

  it('the course, the code and the records say what the re-keyed engine does (D99 review)', () => {
    // Semi Constraint is STTran's proposal (Cong et al. 2021, arXiv 2107.12309, section 3), evaluated
    // on Action Genome; it is not Action Genome's own.
    for (const file of ['../m04.en.mdx', '../m12.en.mdx', '../m04.zh-TW.mdx', '../m12.zh-TW.mdx']) {
      const text = source(file);
      expect(text, file).toContain('STTran');
      expect(text, file).not.toContain("Action Genome's semi constraint");
      expect(text, file).not.toContain("Action Genome's rule");
      expect(text, file).not.toContain('Action Genome 之 semi constraint');
      expect(text, file).not.toContain('Action Genome 之規則');
    }
    for (const file of ['../../../../backend/app/eval/constraint.py', '../../../../packages/sgg-metrics/src/constraint.ts']) {
      expect(source(file), file).not.toMatch(/Action Genome's\s+semi/);
    }
    // Keyed on objects, the graph constraint no longer caps what single_mpo caps when two predicted
    // objects reuse one pair of masks.
    for (const file of ['../../../../backend/tests/test_pairing.py', '../../labs/L6/forensics.ts']) {
      expect(source(file), file).not.toMatch(/class pair, which is coarser|coarser class pair/);
    }
    expect(source('../../../../backend/scripts/build_golden.py')).not.toContain('collapse all nine predictions to one');
    const readme = source('../../../../../data/mini-isg/README.md');
    expect(readme.split('D99').length - 1).toBeGreaterThanOrEqual(2);
    const deviations = source('../../../../../DEVIATIONS.md');
    expect(deviations).not.toMatch(/Nine (of them )?are two hands on one assembly/);
    expect(deviations).not.toMatch(/written first and\s+watched failing: two object pairs/);
    expect(source('../../../../../docs/INDEX.md')).not.toContain('13 golden vectors');
    expect(source('../../../../../README.md')).not.toContain('thirteen cases');
    expect(source('../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-design.md'))
      .toContain('[**Corrected 2026-09-27 (D99):**');
  });

  it('the review minors of M2 and M3 are settled in the text', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const specM3 = source('../../../../../docs/superpowers/specs/2026-09-27-playgrounds-m3-design.md');
    // M3-1: the near-identical-boxes argument proved nothing; D99's engine test is the counterexample.
    for (const text of [deviations, specM3]) {
      expect(text).toContain('[**Corrected 2026-09-27 (D99):** this argument does not prove its claim');
    }
    // M3-2: the frozen E10 no longer calls its toy ordering an invariant.
    expect(source('../../../../web/knowledge-map/pg.js')).not.toContain("k:'invariant'");
    expect(source('../../../../web/knowledge-map/FROZEN.md')).toContain('ordering on this toy');
    // M2-1: the overlay's offset is named with the state it was measured in.
    for (const file of ['../../../../../DEVIATIONS.md', '../../../../../CLAUDE.md', '../../../../../docs/INDEX.md']) {
      expect(source(file), file).toContain('96.5 px');
    }
    // M2-2 and M2-5.
    expect(source('../../playgrounds/F3/BoxOverlap.tsx')).not.toContain('and the study shell mount it');
    expect(source('../../../../../docs/superpowers/specs/2026-09-27-playgrounds-m2-design.md'))
      .toContain('[**As built (D97):** M2 has 8 steps');
    // M3-9: the notes' wording.
    expect(source('../m03.zh-TW.mdx')).not.toContain('兩者皆錯');
    expect(source('../m03.en.mdx')).not.toContain('nothing at all');
    expect(source('../m03.zh-TW.mdx')).not.toContain('不提供任何內容');
    // D99-m5: M12 no longer asks L2 for a pair its fixture does not have.
    expect(source('../m12.en.mdx')).not.toMatch(/genuinely carries (both )?an attention relation/);
    expect(source('../m12.zh-TW.mdx')).not.toContain('確實同時具備 attention 關係與 contacting 關係');
  });

  it('the records carry D100 and the counts it measured', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const index = source('../../../../../docs/INDEX.md');
    expect(deviations).toContain('## D100 — ');
    // D98's 15 px predates the inclusion's condition (ca8b276); D100's branch found 71 px.
    expect(deviations).toContain('[**Corrected 2026-09-27 (D100):** 15 px was measured before');
    expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 24. ');
    // At least D100: a later deviation moves the upper bound, and D101 pins its own below.
    for (const [name, text] of [['CLAUDE.md', source('../../../../../CLAUDE.md')], ['INDEX', index]]) {
      expect(Number(/D1…D(\d+)/.exec(text)?.[1]), name).toBeGreaterThanOrEqual(100);
    }
    // D100's count of golden vectors is held with every later one's, from the file (D104).
  });

  it("the records say what D100's branch measured and moved (its review)", () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const verification = source('../../../../../docs/VERIFICATION.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    // Counts and section lists the branch moved; README's count of vectors is held from the file.
    expect(claude).toContain('§24 the review minors');
    expect(claude).toContain('three tests in `playgrounds/test/logic.test.ts`');
    expect(index).toContain('the review minors (§24)');
    // The offset at Δx = 18 is derived, (454 − 261) / 2 = 96.5 px, and is not rounded.
    for (const [name, text] of [['DEVIATIONS', deviations], ['CLAUDE.md', claude], ['INDEX', index]]) {
      expect(text, name).toContain('96.5 px');
      expect(text, name).not.toContain('97 px');
    }
    expect(source('../../playgrounds/PhotoMarks.tsx')).toContain("122 px below its object in F3's longest state");
    // What was measured, and when.
    for (const text of [deviations, verification]) expect(text).toContain('before its layout change');
    expect(deviations).not.toContain("this branch's start");
    expect(deviations).not.toMatch(/at the start of\s+D100's branch/);
    expect(verification).not.toContain('six tests fail');
    expect(deviations).toContain('"Subject box Δx 45 px"');
    // M12's comparative names what the middle setting is closer to.
    expect(source('../m12.en.mdx')).not.toContain('closer than either end');
    expect(source('../m12.zh-TW.mdx')).not.toContain('更為接近，');
  });

  it('the records carry D101 and the release of the freeze (D-23)', () => {
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const decisions = source('../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md');
    expect(source('../../../../../DEVIATIONS.md')).toContain('## D101 — ');
    expect(decisions).toContain('## D-23 The knowledge-map freeze is released');
    expect(decisions).toContain('> **Freeze released 2026-09-27 by D-23.**');
    expect(source('../../../../web/knowledge-map/FROZEN.md')).toContain('**Released 2026-09-27 by decision D-23.**');
    expect(source('../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md'))
      .toContain('`?view=kp` is the knowledge-point index (amended 2026-09-27, D101)');
    // At least D101: a later deviation moves the upper bound, and D102 pins its own below.
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      expect(Number(/D1…D(\d+)/.exec(text)?.[1]), name).toBeGreaterThanOrEqual(101);
    }
    expect(claude).toContain('D-01…D-23');
    expect(claude).toMatch(/all 1\d\d logged deviations/);
    expect(claude).not.toContain('as the seed corpus. Do not extend it.');
    expect(index).toContain('## 2. Decisions — D-01 … D-23');
    expect(source('../../../../../README.md')).not.toContain('Do not extend it;');
  });

  it('the records carry D102 and the counts it measured', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const verification = source('../../../../../docs/VERIFICATION.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const readme = source('../../../../../README.md');
    expect(deviations).toContain('## D102 — ');
    expect(verification).toContain('## 25. ');
    // At least D102's figures: a later record moves each upward, and pins nothing of D102's (D103).
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      atLeast(text, /D1…D(\d+)/, 102, name);
    }
    expect(claude).toContain('§25 the deferred minors');
    atLeast(claude, /all (\d+) logged deviations/, 102, 'CLAUDE.md deviations');
    atLeast(claude, /resolutions, (\d+) tests,/, 75, 'CLAUDE.md e2e');
    expect(index).toContain('the deferred minors (§25)');
    atLeast(readme, /i18n (\d+) keys/, 331, 'README i18n');
    atLeast(readme, /`npm run test:e2e` is (\d+)/, 75, 'README e2e');
    // The gate's counts, where README and INDEX state them (D102's review).
    atLeast(readme, /(\d+) Python tests/, 279, 'README pytest');
    atLeast(readme, /(\d+) TypeScript tests across \d+ files/, 893, 'README vitest');
    atLeast(readme, /TypeScript tests across (\d+) files/, 66, 'README vitest files');
    atLeast(index, /\*\*(\d+) pytest\*\*/, 279, 'INDEX pytest');
    atLeast(index, /\*\*(\d+) vitest\*\* in \d+ files/, 893, 'INDEX vitest');
    atLeast(index, /\*\*\d+ vitest\*\* in (\d+) files/, 66, 'INDEX vitest files');
    expect(index).not.toContain('the ten newest');
    // The five items D100's review deferred, each named where it was settled.
    for (const item of ['dangling_reference', 'gv-017', 'idRun', 'E1_DEFECTS', '►']) {
      expect(record(deviations, 'D102'), item).toContain(item);
    }
  });

  it('the records carry D103 and the checks it closed', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const readme = source('../../../../../README.md');
    // Whitespace collapsed, since a phrase may wrap across a line of the record.
    const d103 = record(deviations, 'D103').replace(/\s+/g, ' ');
    expect(deviations).toContain('## D103 — ');
    expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 26. ');
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      atLeast(text, /D1…D(\d+)/, 103, name);
    }
    atLeast(claude, /all (\d+) logged deviations/, 103, 'CLAUDE.md deviations');
    expect(claude).toContain('§26 the open checks');
    expect(index).toContain('the open checks (§26)');
    expect(source('../../../../../data/golden/README.md')).toContain('compare that set exactly');
    // What was closed, what was measured on main, and what is still queued.
    for (const item of ['masks_ignored', 'gv-011', 'i18n_parity.test.mjs', '9b678af', 'Waiting to run']) {
      expect(d103, item).toContain(item);
    }
    atLeast(readme, /(\d+) Python tests/, 281, 'README pytest');
    atLeast(readme, /(\d+) TypeScript tests across \d+ files/, 901, 'README vitest');
    atLeast(index, /\*\*(\d+) pytest\*\*/, 281, 'INDEX pytest');
    atLeast(index, /\*\*(\d+) vitest\*\* in \d+ files/, 901, 'INDEX vitest');
  });

  it('the records carry D104 and the vectors it added', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const readme = source('../../../../../README.md');
    const golden = source('../../../../../data/golden/README.md');
    const d104 = record(deviations, 'D104').replace(/\s+/g, ' ');
    expect(deviations).toContain('## D104 — ');
    expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 27. ');
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      atLeast(text, /D1…D(\d+)/, 104, name);
    }
    atLeast(claude, /all (\d+) logged deviations/, 104, 'CLAUDE.md deviations');
    expect(claude).toContain('§27 the review of the open checks');
    expect(index).toContain('the review of the open checks (§27)');
    // The three vectors, each where a reader of the golden file looks for what a case pins.
    for (const id of ['gv-018', 'gv-019', 'gv-020']) {
      expect(golden, id).toContain(`| \`${id}\` |`);
      expect(d104, id).toContain(id);
    }
    // What was settled, what was declined, what is left open, and what is still queued.
    for (const item of ['test_some_case_raises_every_warning', 'not a placeholder name',
      'a brace outside a placeholder', 'record(', 'Declined', 'zero_shot_train_triplets: []',
      '5eabab6', 'Waiting to run']) {
      expect(d104, item).toContain(item);
    }
    atLeast(readme, /(\d+) Python tests/, 285, 'README pytest');
    atLeast(index, /\*\*(\d+) pytest\*\*/, 285, 'INDEX pytest');
  });

  it('the records carry D105 and the ruling on an empty training split', () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const d105 = record(deviations, 'D105').replace(/\s+/g, ' ');
    expect(deviations).toContain('## D105 — ');
    expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 28. ');
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      atLeast(text, /D1…D(\d+)/, 105, name);
    }
    atLeast(claude, /all (\d+) logged deviations/, 105, 'CLAUDE.md deviations');
    expect(claude).toContain('§28 the empty training split');
    expect(index).toContain('the empty training split (§28)');
    // The ruling, where each reader of the definition, the contract and the vectors meets it, by
    // what it says and not only by its bracket (D105's branch review).
    const spec = (name: string) =>
      source(`../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-${name}.md`).replace(/\s+/g, ' ');
    const ruling = '[**Amended 2026-09-28 (D105):**';
    for (const name of ['SRS', 'design']) {
      expect(spec(name), name).toContain(`${ruling} a training split that is not supplied, or is supplied empty,`);
    }
    const contracts = spec('contracts');
    expect(contracts).toContain('`zero_shot_train_triplets: []` is read as omitted');
    expect(contracts).toContain('Omitted or `[]` (D105) → every zR MetricValue has value null.');
    expect(contracts).toContain('a prediction without a score shares no score');
    expect(source('../../../../../docs/INDEX.md').replace(/\s+/g, ' ')).toContain('[Settled by D105.]');
    const golden = source('../../../../../data/golden/README.md');
    expect(golden).toContain('| `gv-021` |');
    expect(golden).not.toContain('One condition has no case');
    for (const item of ['gv-021', 'zR = R', 'Treat as none', 'ba87229']) expect(d105, item).toContain(item);
  });

  it("the records carry D106 and M4's playgrounds", () => {
    const deviations = source('../../../../../DEVIATIONS.md');
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const d106 = record(deviations, 'D106').replace(/\s+/g, ' ');
    expect(deviations).toContain(
      "## D106 — M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted",
    );
    expect(source('../../../../../docs/VERIFICATION.md')).toContain('## 29. ');
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      atLeast(text, /D1…D(\d+)/, 106, name);
    }
    atLeast(claude, /all (\d+) logged deviations/, 106, 'CLAUDE.md deviations');
    expect(claude).toContain('§29 the M4 playgrounds');
    expect(index).toContain('the M4 playgrounds (§29)');
    // The counterexample, two of the five playgrounds, and where the branch was cut.
    for (const item of ['R@2=1', 'E13', 'X2', '992287e']) expect(d106, item).toContain(item);
    // M4's density is its own; the nine earlier playgrounds keep the layout their records measured.
    expect(claude).toContain("`PlaygroundFrame`'s `dense` is M4's");
    // The browser tests CLAUDE.md cites by name are tests the projector suite runs.
    const projector = source('../../../../e2e/projector.spec.ts');
    for (const cited of ['draw their marks on their photographs', 'show their photographs']) {
      const name = new RegExp(`\`([^\`]*${cited}[^\`]*)\``).exec(claude)?.[1];
      expect(name, cited).toBeDefined();
      expect(projector, cited).toContain(name);
    }
  });

  it('the records state as many playgrounds, uncovered live points and steps as the code holds', () => {
    // Taken from the mount table, the harvest and the modules, as the vectors' count is taken from
    // their file: a bound passes a count left stale (D104's branch review, D106).
    const claude = source('../../../../../CLAUDE.md');
    const index = source('../../../../../docs/INDEX.md');
    const readme = source('../../../../../README.md');
    const mounted = Object.keys(PLAYGROUND_MOUNTS);
    const uncovered = kp.filter((p) => p.status === 'live' && !mounted.includes(p.id)).length;
    const steps = moduleIds().reduce((n, id) => n + getMeta(id, 'en')!.steps.length, 0);
    const split = Object.keys(PLAYGROUND_PARTS).length;
    const stated = (text: string, pattern: RegExp) => pattern.exec(text)?.slice(1);
    // Whitespace as \s+, since a phrase may wrap across a line of the record.
    expect(stated(claude, /8 labs,\s+(\d+)\s+playgrounds/), 'CLAUDE.md playgrounds').toEqual([String(mounted.length)]);
    expect(stated(claude, /(\d+)\s+live\s+knowledge\s+points\s+have\s+none/), 'CLAUDE.md uncovered')
      .toEqual([String(uncovered)]);
    expect(stated(claude, /All\s+(\d+)\s+steps\s+carry\s+theirs;\s+(\d+)\s+notes/), 'CLAUDE.md notes')
      .toEqual([String(steps), String(2 * steps)]);
    expect(stated(index, /holds\s+(\d+)\s+and\s+(\d+)\s+since\s+D\d+\]/), 'INDEX notes')
      .toEqual([String(steps), String(2 * steps)]);
    for (const [name, text] of [['CLAUDE.md', claude], ['INDEX', index]]) {
      expect(stated(text, /five\s+labs\s+and\s+([\w-]+)\s+playgrounds/), `${name} perf`)
        .toEqual([NUMBER_WORDS[mounted.length]]);
    }
    expect(stated(readme, /The\s+([\w-]+)\s+playgrounds\s+too\s+tall\s+for\s+one\s+panel/), 'README parts')
      .toEqual([NUMBER_WORDS[split]]);
  });

  it('the records state as many golden vectors as the file holds', () => {
    // Taken from the file, not bounded from below: a bound passes a count left stale, and a pinned
    // count turns every earlier records test red when a vector is added (D104's branch review).
    const n = JSON.parse(source('../../../../../data/golden/vectors.json')).cases.length;
    const index = source('../../../../../docs/INDEX.md');
    const readme = source('../../../../../README.md');
    const stated = (text: string, pattern: RegExp) => pattern.exec(text)?.slice(1);
    expect(stated(index, /\| `parity\.mjs`, (\d+) golden vectors \|/), 'INDEX NFR-3').toEqual([String(n)]);
    expect(stated(index, /\| The (\d+) golden vectors \|/), 'INDEX artefacts').toEqual([String(n)]);
    expect(stated(index, /, (\d+) since D\d+\), slice ingestion/), 'INDEX state').toEqual([String(n)]);
    expect(stated(index, /parity (\d+) agree/), 'INDEX verification').toEqual([String(n)]);
    expect(stated(readme, /parity (\d+)\/(\d+)/), 'README status').toEqual([String(n), String(n)]);
    expect(stated(readme, /`data\/golden\/vectors\.json`, ([\w-]+) cases whose/), 'README engine')
      .toEqual([NUMBER_WORDS[n]]);
  });

  it('the protocol ordering survives nowhere as a law', () => {
    // The brief, the SRS and an L2 comment repeated what M3 s3 no longer claims (D98).
    const brief = source('../../../../web/brief/index.html');
    expect(brief).not.toContain('asserts on every fixture');
    expect(brief).toContain('\\mathcal{H}_{\\text{PredCls}}\\subseteq\\mathcal{H}_{\\text{SGCls}}\\subseteq\\mathcal{H}_{\\text{SGDet}}');
    const srs = source('../../../../../docs/superpowers/specs/2026-09-15-scene-graph-studio-SRS.md');
    expect(srs).toContain('[**Superseded 2026-09-27 (D98):**');
    const l2 = source('../../labs/L2/test/MetricExplorer.test.tsx');
    expect(l2).not.toContain('for every model and every fixture');
  });

  it('M2 s2 states the √2 boundary strictly, since at λ = √2 the concentric box reaches ½', () => {
    // IoU ≤ λ⁻² is an equality for the concentric box, and s2's own rule accepts IoU ≥ τ, so
    // "λ ≥ √2 ⇒ IoU < ½" is false at λ = √2. F3's case pg-F3-bound-equals-tau reaches its bound.
    for (const file of ['../m02.en.mdx', '../m02.zh-TW.mdx']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(text, file).toContain('\\lambda>\\sqrt{2}');
      expect(text, file).not.toContain('\\lambda\\ge\\sqrt{2}');
    }
    expect((deriv as Record<string, string>).F3).toContain('\\lambda>\\sqrt{2}');
  });

  it('M4 carries E3, E4, E7, E13 and X2 directly after the steps that teach them', () => {
    const meta = getMeta('m04', 'en')!;
    const part = (n?: number) => (n === undefined ? '' : `.${n}`);
    expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}${part(s.part)}` : ''}`)).toEqual([
      's1:prose', 's2:math', 's3:playground/E3.1', 's4:playground/E3.2', 's5:math',
      's6:playground/E4.1', 's7:playground/E4.2', 's8:math', 's9:math', 's10:playground/E7.1',
      's11:playground/E7.2', 's12:math', 's13:math', 's14:playground/E13', 's15:math',
      's16:playground/X2', 's17:prose', 's18:lab', 's19:checkpoint',
    ]);
    const steps = getModule('m04', 'zh-TW')!;
    for (const step of steps.filter((s) => s.kind === 'playground')) {
      const mounted = render(<MemoryRouter initialEntries={['/m/m04']}>{step.node}</MemoryRouter>);
      expect(within(mounted.container).getByTestId('playground-frame')).toBeInTheDocument();
      expect(mounted.container.querySelector('[data-testid="playground-unknown"]')).toBeNull();
      mounted.unmount();
    }
  });

  it('M3 carries E1 and E10, in two parts each, directly after the steps that teach them', () => {
    const meta = getMeta('m03', 'en')!;
    const part = (n?: number) => (n === undefined ? '' : `.${n}`);
    expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}${part(s.part)}` : ''}`)).toEqual([
      's1:prose', 's2:math', 's3:playground/E1.1', 's4:playground/E1.2', 's5:math',
      's6:playground/E10.1', 's7:playground/E10.2', 's8:prose', 's9:prose', 's10:lab', 's11:checkpoint',
    ]);
  });

  it('M2 carries F3, in two parts, directly after the step that teaches it', () => {
    const meta = getMeta('m02', 'en')!;
    const part = (n?: number) => (n === undefined ? '' : `.${n}`);
    expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}${part(s.part)}` : ''}`)).toEqual([
      's1:prose', 's2:math', 's3:playground/F3.1', 's4:playground/F3.2', 's5:prose', 's6:prose',
      's7:lab', 's8:checkpoint',
    ]);
  });

  it('supplies Playground to every module body, so no MDX file imports it', () => {
    // Both locale files would otherwise carry an import line, and two import lines are two
    // places to drift. NFR-6 is about the content saying the same thing in both languages;
    // this is the same rule applied to the machinery.
    const steps = getModule('m00', 'zh-TW');
    expect(steps).not.toBeNull();
    // Without this, every assertion below sits behind an `if` that nothing forces to be entered,
    // so the test would pass unchanged on a module that had no playground at all.
    // Four steps for three playgrounds: F1 is two parts (D96).
    expect(steps!.filter((s) => s.kind === 'playground')).toHaveLength(4);
    // Inside a router, because a playground's knobs live in the query string and a real mount
    // therefore reaches useSearchParams. Until M0 carried a playground step this body had no
    // <Playground/> in it, so the test asserted the tag resolved against a file that never used
    // it; the three steps added in Task 10 are what make it a test of the thing it names.
    for (const step of steps!) {
      const mounted = render(<MemoryRouter initialEntries={['/m/m00']}>{step.node}</MemoryRouter>);
      if (step.kind === 'playground') {
        expect(within(mounted.container).getByTestId('playground-frame')).toBeInTheDocument();
        // `playground-unknown` is what an unregistered kp renders, and it would satisfy a
        // "did not throw" assertion while teaching nobody anything.
        expect(mounted.container.querySelector('[data-testid="playground-unknown"]')).toBeNull();
      }
      mounted.unmount();
    }
  });
});
