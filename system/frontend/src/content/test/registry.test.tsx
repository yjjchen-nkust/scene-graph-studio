import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { getMeta, getModule, moduleIds } from '../registry';

beforeEach(() => {
  setLocale('en');
});

describe('the module registry', () => {
  it('finds m00 in both locales without a hand-kept list', () => {
    expect(moduleIds()).toContain('m00');
    expect(getMeta('m00', 'en')).not.toBeNull();
    expect(getMeta('m00', 'zh-TW')).not.toBeNull();
  });

  it('reads the frontmatter the content lint validates', () => {
    const meta = getMeta('m00', 'en')!;
    expect(meta.id).toBe('m00');
    expect(meta.steps.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
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
  it('supplies Playground to every module body, so no MDX file imports it', () => {
    // Both locale files would otherwise carry an import line, and two import lines are two
    // places to drift. NFR-6 is about the content saying the same thing in both languages;
    // this is the same rule applied to the machinery.
    const steps = getModule('m00', 'zh-TW');
    expect(steps).not.toBeNull();
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
