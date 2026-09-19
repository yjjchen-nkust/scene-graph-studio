import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { AblationReplay } from '../AblationReplay';
import { IndVisSGGReplica } from '../IndVisSGGReplica';
import { TABLE3 } from '../tables';
import { TECEditor } from '../TECEditor';
import type { OwnRun, ReplicaResult } from '../types';

beforeEach(() => {
  setLocale('en');
});

const OWN: OwnRun = {
  components: 'O+P+E',
  triplets: [
    ['worker', 'holding', 'wrench'],
    ['worker', 'near', 'workbench'],
  ],
  fidelity: 'reconstructed',
  note: 'Replayed from an authored transcript; no VLM produced this.',
};

const OBJECTS = [
  { object_id: 1, names: ['worker'] },
  { object_id: 2, names: ['workbench'] },
  { object_id: 3, names: ['terminals'] },
];

const RESULT: ReplicaResult = {
  step1: {
    graph: {
      objects: OBJECTS,
      relationships: [
        { subject_id: 1, object_id: 2, predicate: 'near' },
        { subject_id: 1, object_id: 3, predicate: 'installing' },
      ],
    },
    prompt_shown: 'INFORMATION\nstep one prompt',
  },
  step2: [
    { expert_index: 1, graph: { objects: OBJECTS, relationships: [] },
      analysis_en: 'expert one says', analysis_zh: '專家一表示',
      prompt_shown: 'TRIPLE-CHECKING -- expert 1 of N' },
    { expert_index: 2, graph: { objects: OBJECTS, relationships: [] },
      analysis_en: 'expert two says', analysis_zh: '專家二表示',
      prompt_shown: 'TRIPLE-CHECKING -- expert 2 of N' },
  ],
  step3: {
    graph: {
      objects: OBJECTS,
      relationships: [{ subject_id: 3, object_id: 2, predicate: 'on' }],
    },
    prompt_shown: 'SUMMARIZATION',
  },
  provider_used: 'transcript',
};

function mount(result: ReplicaResult | null, onRun = vi.fn()) {
  const view = render(
    <MemoryRouter initialEntries={['/lab/L5']}>
      <IndVisSGGReplica result={result} onRun={onRun} />
    </MemoryRouter>,
  );
  return { ...view, onRun };
}

describe('TECEditor', () => {
  it('edits O and P as lists and reports the change', () => {
    const onChange = vi.fn();
    render(<TECEditor O={['worker']} P={['on']} E={[]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('edit-O'), { target: { value: 'worker\npanel' } });
    expect(onChange).toHaveBeenCalledWith({ O: ['worker', 'panel'] });
  });

  it('reports an edited analysis rather than swallowing it', () => {
    const onChange = vi.fn();
    render(
      <TECEditor
        O={[]}
        P={[]}
        E={[{ kind: 'positive', triplet: ['a', 'b', 'c'], analysis: 'why' }]}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('example-0-analysis')).toHaveValue('why');
    fireEvent.change(screen.getByTestId('example-0-analysis'), { target: { value: 'because' } });
    expect(onChange).toHaveBeenCalledWith({
      E: [{ kind: 'positive', triplet: ['a', 'b', 'c'], analysis: 'because' }],
    });
  });

  it('warns on an example whose analysis has gone missing', () => {
    // SRS §6 makes examples-with-analysis the third ablation dimension. An example stripped of
    // its analysis is not a smaller E, it is a different E, and Table 3 measured neither.
    render(
      <TECEditor
        O={[]}
        P={[]}
        E={[
          { kind: 'positive', triplet: ['a', 'b', 'c'], analysis: '   ' },
          { kind: 'negative', triplet: ['d', 'e', 'f'], analysis: 'stated' },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('example-0-warning')).toBeTruthy();
    expect(screen.queryByTestId('example-1-warning')).toBeNull();
  });
});

describe('AblationReplay', () => {
  it('never renders a published number and a student number in the same element', () => {
    const { container } = render(<AblationReplay published={TABLE3} own={OWN} />);
    const figures = container.querySelectorAll('[data-figure]');
    expect(figures.length).toBeGreaterThan(0);
    for (const el of figures) {
      const kinds = new Set(
        [...el.querySelectorAll('[data-fidelity]')].map((n) => n.getAttribute('data-fidelity')),
      );
      expect(kinds.size).toBeLessThanOrEqual(1);
    }
  });

  it('puts the published row and the student run in two panels with different headings', () => {
    render(<AblationReplay published={TABLE3} own={OWN} />);
    const a = screen.getByTestId('panel-published');
    const b = screen.getByTestId('panel-own');
    expect(a).not.toBe(b);
    expect(a.contains(b)).toBe(false);
    const headings = [a, b].map((p) => within(p).getByRole('heading').textContent);
    expect(new Set(headings).size).toBe(2);
  });

  it('shows all five rows of the factorial, not four', () => {
    render(<AblationReplay published={TABLE3} own={OWN} />);
    expect(within(screen.getByTestId('panel-published')).getAllByTestId(/^t3-row-/)).toHaveLength(5);
  });

  it('says why the student run carries no recall figure rather than printing one', () => {
    // There is no ground truth for the Figure 2 frame in this corpus, so R@20 cannot be computed
    // for the student's own output. Printing a number here would be the fabrication the whole
    // provenance apparatus exists to stop. DEVIATIONS D40.
    render(<AblationReplay published={TABLE3} own={OWN} />);
    const own = screen.getByTestId('panel-own');
    expect(within(own).getByTestId('no-metric').textContent).toMatch(/ground truth/i);
    expect(own.querySelector('[data-figure="recall"]')).toBeNull();
  });

  it('marks the student run with the fidelity it actually has', () => {
    render(<AblationReplay published={TABLE3} own={OWN} />);
    const own = screen.getByTestId('panel-own');
    expect(own.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
    expect(within(own).getByTestId('own-note').textContent).toBeTruthy();
  });
});

describe('IndVisSGGReplica', () => {
  it('asks for a run with the criteria and expert count the URL holds', () => {
    const { onRun } = mount(null);
    fireEvent.click(screen.getByTestId('run'));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ n_experts: 3, ablate: [], provider: 'transcript' }),
    );
  });

  it('offers only the expert counts Table 4 measures', () => {
    mount(null);
    const values = [...screen.getByTestId('n-experts').querySelectorAll('option')]
      .map((o) => Number(o.value));
    expect(values).toEqual([1, 2, 3, 5]);
  });

  it('writes the ablation to the URL so a configuration is a link', () => {
    mount(null);
    fireEvent.click(screen.getByTestId('ablate-O'));
    fireEvent.click(screen.getByTestId('run'));
    expect(screen.getByTestId('ablate-O')).toBeChecked();
  });

  it('renders one analysis per expert', () => {
    mount(RESULT);
    expect(screen.getAllByTestId(/^expert-\d+$/)).toHaveLength(2);
    expect(screen.getByTestId('expert-1').textContent).toContain('expert one says');
  });

  it('shows every prompt, because a student who cannot read it cannot evaluate the method', () => {
    mount(RESULT);
    const shown = screen.getAllByTestId(/^prompt-/).map((el) => el.textContent ?? '');
    expect(shown.length).toBeGreaterThanOrEqual(4); // step 1, two experts, step 3
    expect(shown.some((t) => t.includes('INFORMATION'))).toBe(true);
    expect(shown.some((t) => t.includes('SUMMARIZATION'))).toBe(true);
  });

  it('names the provider that answered, so a replay is never read as a live run', () => {
    mount(RESULT);
    expect(screen.getByTestId('provider-used').textContent).toContain('transcript');
  });

  it('puts the triplets the run produced into the panel, not an empty list', () => {
    // The first draft computed this as `cond ? [] : []`, so the panel was always empty and every
    // test still passed: AblationReplay was only ever exercised with a fixture of its own.
    mount(RESULT);
    const own = screen.getByTestId('panel-own');
    expect(within(own).getByText(/terminals, on, workbench/)).toBeTruthy();
  });

  it('falls back to step 1 when only step 1 was asked for', () => {
    mount({ ...RESULT, step3: null });
    const own = screen.getByTestId('panel-own');
    expect(within(own).getByText(/worker, near, workbench/)).toBeTruthy();
  });

  it('says nothing has run yet rather than rendering an empty graph', () => {
    mount(null);
    expect(screen.getByTestId('idle')).toBeTruthy();
    expect(screen.queryByTestId('provider-used')).toBeNull();
  });
});
