import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MetricValue } from 'sgg-metrics';
import { VERDICT_STYLE } from '../../graph/palette';
import { DiffLegend } from '../../graph/DiffLegend';
import { setLocale } from '../../i18n/useLocale';
import { BOARDS } from '../../pages/boards';
import { Leaderboards } from '../../pages/Leaderboards';
import { PaperCard } from '../../pages/PaperCard';
import { PAPERS } from '../../pages/papers';
import { MetricReadout } from '../MetricReadout';

beforeEach(() => {
  setLocale('en');
});

const base: MetricValue = {
  value: 0.275,
  metric: 'R',
  k: 50,
  protocol: 'sgdet',
  constraint: 'graph',
  source: 'engine',
  verified: true,
  fidelity: 'measured',
};

describe('MetricReadout', () => {
  it('always shows the protocol and the constraint beside the number', () => {
    render(<MetricReadout value={base} />);
    expect(screen.getByText(/27\.5/)).toBeTruthy();
    expect(screen.getByText(/sgdet/i)).toBeTruthy();
    expect(screen.getByText(/graph/i)).toBeTruthy();
  });

  it('renders a null value as an em dash with a reason, never as zero', () => {
    render(<MetricReadout value={{ ...base, value: null }} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('marks an unverified figure distinctly', () => {
    const { container } = render(<MetricReadout value={{ ...base, verified: false }} />);
    expect(container.querySelector('[data-verified="false"]')).toBeTruthy();
  });

  it('marks a reconstructed figure distinctly from a measured one', () => {
    const { container } = render(
      <MetricReadout value={{ ...base, fidelity: 'reconstructed' }} />,
    );
    expect(container.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
  });

  it('never renders a bare number without its k, protocol and constraint', () => {
    // NFR-2 and contracts 1.0: there is no code path that formats a metric without its tags.
    const { container } = render(<MetricReadout value={base} />);
    const text = container.textContent ?? '';
    for (const tag of ['R', '50', 'sgdet', 'graph']) expect(text).toContain(tag);
  });
});

/** The figure a readout prints: its first span, the number, before the tags. */
const figureOf = (root: Element) => root.querySelector('[data-fidelity] > span')?.textContent;

/**
 * A frozen file with every `value` kept as the text its source printed, `16.0` and not 16.
 *
 * JSON.parse's source text access hands the reviver the literal, which a parsed number has
 * already lost; the app's own import loses it too, which is the reason this test reads the text.
 */
function published(file: string) {
  // A variable, not a literal, inside `new URL`: Vite rewrites `new URL('…', import.meta.url)`
  // into an asset URL, which `readFileSync` cannot open.
  const path = `../../../../../data/content/${file}`;
  const text = readFileSync(new URL(path, import.meta.url), 'utf8');
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) =>
    key === 'value' && typeof value === 'number' ? context?.source : value,
  );
}

describe('a published figure', () => {
  const quoted = (value: number) => ({ ...base, value, fidelity: 'published' as const });

  it('prints at the places its source printed, not at one', () => {
    // 0.1298 * 100 is 12.979999999999999 in binary, so the shift must be made in decimal too.
    const { container } = render(<MetricReadout value={quoted(12.98 / 100)} />);
    expect(figureOf(container)).toBe('12.98');
  });

  it('keeps the one place of a figure whose place the JSON number dropped', () => {
    const { container } = render(<MetricReadout value={quoted(16.0 / 100)} />);
    expect(figureOf(container)).toBe('16.0');
  });

  it('leaves a computed figure at one place', () => {
    const { container } = render(<MetricReadout value={{ ...base, value: 12.98 / 100 }} />);
    expect(figureOf(container)).toBe('13.0');
  });

  it('prints every frozen board and card figure as its source prints it', () => {
    // Through the pages, from the modules the app imports, against the literal in the file. A
    // figure is checked under its own column header, so a value printed in another column fails.
    const mismatches: string[] = [];
    let checked = 0;

    const boards = published('leaderboards.json') as Array<{
      id: string;
      rows: Array<{ values: Array<{ metric: string; k: number; value: string }> }>;
    }>;
    expect(boards.map((b) => b.id)).toEqual(BOARDS.map((b) => b.id));
    render(<Leaderboards />);
    for (const board of boards) {
      const section = screen.getByTestId(`board-${board.id}`);
      const headers = [...section.querySelectorAll('thead th')].slice(4).map((th) => th.textContent);
      const rows = section.querySelectorAll('tbody tr');
      board.rows.forEach((row, r) => {
        const cells = within(rows[r] as HTMLElement).getAllByTestId('figure');
        cells.forEach((cell, c) => {
          const source = row.values.find((v) => `${v.metric}@${v.k}` === headers[c]);
          if (!source) return;
          checked += 1;
          const shown = figureOf(cell);
          if (shown !== source.value) mismatches.push(`${board.id} row ${r} ${headers[c]}: ${source.value} as ${shown}`);
        });
      });
    }

    const cards = published('papers.json') as Array<{ key: string; reported: Array<{ value: string }> }>;
    expect(cards.map((p) => p.key)).toEqual(PAPERS.map((p) => p.key));
    PAPERS.forEach((paper, p) => {
      if (paper.reported.length === 0) return;
      const { unmount } = render(<PaperCard paper={paper} />);
      const items = within(screen.getByTestId(`paper-${paper.key}`)).getAllByRole('listitem');
      cards[p]!.reported.forEach((source, i) => {
        checked += 1;
        const shown = figureOf(items[i]!);
        if (shown !== source.value) mismatches.push(`${paper.key} #${i}: ${source.value} as ${shown}`);
      });
      unmount();
    });

    // Every figure in both files reached the screen and was compared: 174 on 2026-10-01.
    const total =
      boards.reduce((n, b) => n + b.rows.reduce((m, row) => m + row.values.length, 0), 0) +
      cards.reduce((n, p) => n + p.reported.length, 0);
    expect(checked).toBe(total);
    expect(mismatches).toEqual([]);
  });
});

describe('the verdict palette', () => {
  it('distinguishes every verdict by more than hue (NFR-5)', () => {
    const kinds = ['match', 'spurious', 'missed', 'localization'] as const;
    const signatures = kinds.map((k) => {
      const s = VERDICT_STYLE[k];
      return `${s.dash}|${s.width}|${s.marker}`;
    });
    // Colour-blind safety: the non-colour channels alone must tell them apart.
    expect(new Set(signatures).size).toBe(kinds.length);
  });

  it('gives every verdict an i18n key rather than an English label', () => {
    for (const style of Object.values(VERDICT_STYLE)) {
      expect(style.labelKey.startsWith('diff.')).toBe(true);
    }
  });
});

describe('DiffLegend', () => {
  it('shows all four verdicts, labelled through i18n', () => {
    render(<DiffLegend />);
    for (const kind of ['match', 'spurious', 'missed', 'localization']) {
      expect(screen.getByTestId(`legend-${kind}`)).toBeTruthy();
    }
  });

  it('takes its colours from the palette, so nothing hard-codes one', () => {
    const { container } = render(<DiffLegend />);
    const swatch = container.querySelector('[data-verdict="match"] line');
    expect(swatch?.getAttribute('stroke')).toBe(VERDICT_STYLE.match.stroke);
    expect(swatch?.getAttribute('stroke-dasharray')).toBe(VERDICT_STYLE.match.dash || null);
  });
});
