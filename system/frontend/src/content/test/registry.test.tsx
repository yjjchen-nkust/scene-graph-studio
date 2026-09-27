import { readFileSync } from 'node:fs';
import deriv from '../../../../../data/content/deriv.json';
import math from '../../../../../data/content/math.json';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { getMeta, getModule, moduleIds } from '../registry';

beforeEach(() => {
  setLocale('en');
});

/**
 * A repository file as text. Through a parameter, not a literal: Vite rewrites
 * `new URL('literal', import.meta.url)` into an asset URL, which `readFileSync` refuses.
 */
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

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
