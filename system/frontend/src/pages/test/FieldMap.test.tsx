import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { FieldMap } from '../FieldMap';
import { PaperCard } from '../PaperCard';
import { byKey, PAPERS } from '../papers';

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/map') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <FieldMap />
      <Address />
    </MemoryRouter>,
  );
}

const query = () => new URLSearchParams(screen.getByTestId('address').textContent ?? '');

beforeEach(() => {
  setLocale('en');
});

describe('FieldMap', () => {
  it('shows every card when nothing is filtered', () => {
    mount();
    expect(screen.getByTestId('visible-count')).toHaveTextContent(`${PAPERS.length}`);
  });

  it('filters by branch and says so in the URL', () => {
    mount();
    fireEvent.change(screen.getByLabelText(/branch/i), { target: { value: 'debiasing' } });
    expect(query().get('branch')).toBe('debiasing');
    const expected = PAPERS.filter((p) => p.branch === 'debiasing').length;
    expect(screen.getByTestId('column-debiasing').getAttribute('data-count')).toBe(String(expected));
    expect(screen.getByTestId('column-video').getAttribute('data-count')).toBe('0');
  });

  it('filters by year range', () => {
    mount('/map?from=2024&to=2024');
    const shown = PAPERS.filter((p) => p.year === 2024).length;
    expect(screen.getByTestId('visible-count')).toHaveTextContent(`${shown}`);
    expect(shown).toBeGreaterThan(0);
  });

  it('filters to papers that carry numbers', () => {
    mount('/map?scored=1');
    const scored = PAPERS.filter((p) => p.tier === 'A').length;
    expect(screen.getByTestId('visible-count')).toHaveTextContent(`${scored}`);
  });

  it('draws an arrow only when both ends survive the filter', () => {
    // A line to a card the filter removed would assert a lineage the reader cannot check.
    mount();
    const child = PAPERS.find((p) => p.predecessor)!;
    expect(screen.getByTestId(`card-${child.key}`).getAttribute('data-predecessor'))
      .toBe(child.predecessor);

    mount(`/map?branch=${child.branch}&from=${child.year}&to=${child.year}`);
    const parent = byKey(child.predecessor!)!;
    const stillShown = parent.branch === child.branch && parent.year === child.year;
    if (!stillShown) {
      expect(screen.getByTestId(`card-${child.key}`).getAttribute('data-predecessor')).toBeNull();
    }
  });

  it('opens a card and keeps it in the URL', () => {
    mount();
    fireEvent.click(screen.getByTestId('card-indvissgg-2025'));
    expect(query().get('open')).toBe('indvissgg-2025');
    expect(screen.getByTestId('paper-indvissgg-2025')).toBeInTheDocument();
  });
});

describe('PaperCard', () => {
  it('renders every figure through MetricReadout, tagged with protocol and constraint', () => {
    // A card whose source names its protocol prints the term of art verbatim.
    const tang = byKey('imp-plus-2017')!;
    const first = render(<PaperCard paper={tang} />);
    expect(tang.reported.length).toBeGreaterThan(0);
    // MetricReadout prints `metric@k · protocol · constraint`; a bare number would print neither.
    expect(first.container.textContent).toContain('mR@100');
    expect(first.container.textContent).toContain('predcls');
    expect(first.container.textContent).toContain('graph');

    // A card whose source names none says so in words rather than dropping the tag. IndVisSGG
    // names no protocol anywhere in the paper, so every figure from its Table 2 reads 'unstated'.
    const ind = byKey('indvissgg-2025')!;
    const second = render(<PaperCard paper={ind} />);
    expect(ind.reported.length).toBeGreaterThan(0);
    expect(second.container.textContent).toContain('R@50');
    expect(second.container.textContent).toMatch(/not stated/i);
    expect(second.container.textContent).not.toContain('sgdet');
  });

  it('says plainly that a tier-B card carries no number, rather than showing a blank', () => {
    const paper = PAPERS.find((p) => p.tier === 'B')!;
    render(<PaperCard paper={paper} />);
    expect(screen.getByTestId('no-numbers')).toBeInTheDocument();
  });

  it('warns that the rows are not a ranking', () => {
    const { container } = render(<PaperCard paper={byKey('indvissgg-2025')!} />);
    expect(container.textContent).toContain('not a ranking');
  });

  it('names the defect fixed beside the predecessor', () => {
    const paper = byKey('neural-motifs-2018')!;
    render(<PaperCard paper={paper} />);
    const line = screen.getByTestId('predecessor');
    expect(line.textContent).toContain(paper.predecessor!);
    expect(line.textContent).toContain(paper.defect_fixed_en!);
  });

  it('attributes a re-implemented figure to the paper that printed it', () => {
    // A MOTIFS number in IndVisSGG's Table 2 is a figure IndVisSGG reports for MOTIFS.
    const paper = byKey('neural-motifs-2018')!;
    const borrowed = paper.reported.find((r) => r.source !== paper.key);
    expect(borrowed, 'no borrowed figure to check').toBeTruthy();
    const { container } = render(<PaperCard paper={paper} />);
    expect(container.querySelector(`[title*="${borrowed!.source}"]`)).not.toBeNull();
  });

  it('shows the two tables that disagree, rather than choosing one', () => {
    // M4's lesson: Tang Table 1 and KERN Table 1 give the same method different figures.
    const paper = byKey('freq-2018')!;
    const sources = new Set(
      paper.reported.filter((r) => r.protocol === 'predcls').map((r) => r.source),
    );
    expect(sources).toEqual(new Set(['tde-2020', 'kern-2019']));
  });

  it('carries the caveat where a card has one', () => {
    render(<PaperCard paper={byKey('psgtr-2022')!} />);
    expect(screen.getByTestId('caveat')).toBeInTheDocument();
  });

  it('is bilingual', () => {
    const paper = byKey('indvissgg-2025')!;
    const first = render(<PaperCard paper={paper} />);
    expect(within(first.container).getByText(paper.core_idea_en)).toBeInTheDocument();
    first.unmount();
    setLocale('zh-TW');
    const second = render(<PaperCard paper={paper} />);
    expect(within(second.container).getByText(paper.core_idea_zh)).toBeInTheDocument();
  });
});
