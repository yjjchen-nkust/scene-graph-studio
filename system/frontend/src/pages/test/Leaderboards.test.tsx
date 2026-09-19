import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { BOARDS } from '../boards';
import { Leaderboards } from '../Leaderboards';

beforeEach(() => {
  setLocale('en');
});

describe('Leaderboards', () => {
  it('renders every board', () => {
    render(<Leaderboards />);
    for (const lb of BOARDS) expect(screen.getByTestId(`board-${lb.id}`)).toBeTruthy();
  });

  it('puts the banner above the table, never beside it or below it', () => {
    render(<Leaderboards />);
    for (const lb of BOARDS) {
      const board = screen.getByTestId(`board-${lb.id}`);
      const banner = within(board).getByTestId('banner');
      const table = within(board).getByRole('table');
      // Node.DOCUMENT_POSITION_FOLLOWING: the table comes after the banner in document order.
      expect(banner.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('never hides the banner behind a disclosure control', () => {
    // Plan 02 Task 10 Step 3. A banner a reader can fold away is a banner most readers fold away,
    // and the table underneath then reads exactly like the ranking PRD §6.4 forbids.
    const { container } = render(<Leaderboards />);
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
    for (const board of screen.getAllByTestId(/^board-/)) {
      const banner = within(board).getByTestId('banner');
      expect(banner.closest('[hidden]')).toBeNull();
      expect(banner.querySelector('button')).toBeNull();
      expect(banner.getAttribute('aria-expanded')).toBeNull();
    }
  });

  it('says in words that a column is unstated, never leaving the cell blank', () => {
    render(<Leaderboards />);
    const unstated = BOARDS.flatMap((lb) =>
      lb.rows.filter((r) => r.codebase === null).map((r) => `${lb.id}/${r.paper_key}`),
    );
    expect(unstated.length).toBeGreaterThan(0);
    for (const board of screen.getAllByTestId(/^board-/)) {
      for (const cell of within(board).getAllByTestId('unstated-cell')) {
        expect(cell.textContent?.trim()).toBeTruthy();
        expect(cell.textContent).not.toBe('—');
      }
    }
  });

  it('shows the dated sunset notice on every board', () => {
    render(<Leaderboards />);
    for (const lb of BOARDS) {
      const board = screen.getByTestId(`board-${lb.id}`);
      expect(within(board).getByTestId('sunset').textContent).toContain('24 July 2025');
    }
  });

  it('names the table every board was read out of', () => {
    render(<Leaderboards />);
    for (const lb of BOARDS) {
      const board = screen.getByTestId(`board-${lb.id}`);
      expect(within(board).getByTestId('provenance').textContent).toContain(lb.source_table);
      expect(within(board).getByTestId('provenance').textContent).toContain(lb.source);
    }
  });

  it('offers no way to sort a table', () => {
    // The absence of the affordance is the enforcement, exactly as for the merge function below.
    const { container } = render(<Leaderboards />);
    for (const th of container.querySelectorAll('th')) {
      expect(th.querySelector('button')).toBeNull();
      expect(th.getAttribute('aria-sort')).toBeNull();
    }
  });

  it('exports no function that merges, combines or ranks two boards', async () => {
    // PRD §6.4 the only way it can be enforced: the capability does not exist.
    const page = await import('../Leaderboards');
    const data = await import('../boards');
    for (const module of [page, data]) {
      expect(Object.keys(module).some((k) => /merge|combine|rank/i.test(k))).toBe(false);
    }
  });

  it('carries the protocol beside every figure, including when it is unstated', () => {
    render(<Leaderboards />);
    const board = screen.getByTestId('board-indvissgg-2025-t2-psg');
    // The engine's three protocol names are terms of art and stay verbatim; 'unstated' is a
    // sentence about the source, so it is translated. Either way it is never absent.
    expect(within(board).getAllByTestId('figure')[0].textContent).toMatch(/not stated/i);
  });
});
