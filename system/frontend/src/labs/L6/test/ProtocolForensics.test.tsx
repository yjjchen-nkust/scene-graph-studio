import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { GT, ONE_STAGE, TWO_STAGE } from '../fixture';
import { rankings, scoreBoth, type Scored } from '../forensics';
import { ProtocolForensics } from '../ProtocolForensics';

beforeEach(() => {
  setLocale('en');
});

function mount() {
  return render(
    <MemoryRouter initialEntries={['/lab/L6']}>
      <ProtocolForensics />
    </MemoryRouter>,
  );
}

describe('the mechanism', () => {
  it('shows one-stage numbers falling and two-stage numbers roughly stable', () => {
    const oneStage = scoreBoth(GT, ONE_STAGE);
    const twoStage = scoreBoth(GT, TWO_STAGE);
    expect(oneStage.single).toBeLessThan(oneStage.multi);
    expect(Math.abs(twoStage.single - twoStage.multi)).toBeLessThan(1e-9);
  });

  it('the one-stage loss is the duplicate pair, not noise', () => {
    // Four ground-truth relations, three of them at one ordered mask pair. The one-stage style
    // predicts all three: multi_mpo admits them and matches 3/4, single_mpo admits the
    // highest-scoring one and matches 1/4. The two-stage style predicts at two distinct pairs,
    // so the cap never bites and it scores 2/4 either way.
    expect(scoreBoth(GT, ONE_STAGE)).toEqual({ multi: 0.75, single: 0.25 });
    expect(scoreBoth(GT, TWO_STAGE)).toEqual({ multi: 0.5, single: 0.5 });
  });

  it('the correction reverses which style leads', () => {
    // 0.75 against 0.50 becomes 0.25 against 0.50. This is the whole lab in one line.
    expect(scoreBoth(GT, ONE_STAGE).multi).toBeGreaterThan(scoreBoth(GT, TWO_STAGE).multi);
    expect(scoreBoth(GT, ONE_STAGE).single).toBeLessThan(scoreBoth(GT, TWO_STAGE).single);
  });

  it('reorders a ranking when one methodology changes', () => {
    const rows: Scored[] = [
      { key: 'a', label: 'A', family: 'one_stage', multi: 30.3, single: 18.33,
        fidelity: 'reconstructed', note: null },
      { key: 'b', label: 'B', family: 'two_stage', multi: 25.0, single: 25.0,
        fidelity: 'reconstructed', note: null },
    ];
    const { byMulti, bySingle, moved } = rankings(rows);
    expect(byMulti[0].key).toBe('a');
    expect(bySingle[0].key).toBe('b');
    expect(moved.has('a')).toBe(true);
  });

  it('nothing moves when the correction changes nothing', () => {
    const rows: Scored[] = [
      { key: 'a', label: 'A', family: 'two_stage', multi: 30, single: 30,
        fidelity: 'reconstructed', note: null },
      { key: 'b', label: 'B', family: 'two_stage', multi: 25, single: 25,
        fidelity: 'reconstructed', note: null },
    ];
    expect(rankings(rows).moved.size).toBe(0);
  });
});

describe('ProtocolForensics', () => {
  it('labels the reconstructed predictions as reconstructed', () => {
    const { container } = mount();
    expect(container.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
  });

  it('states what this lab is and is not, without a click', () => {
    mount();
    const standing = screen.getByTestId('standing-note');
    expect(standing.textContent).toMatch(/reconstructed/i);
    expect(standing.textContent).toMatch(/mechanism/i);
    expect(standing.closest('details')).toBeNull();
  });

  it('puts the published direction in its own panel, never in the lab table', () => {
    mount();
    const own = screen.getByTestId('panel-own');
    const published = screen.getByTestId('panel-published');
    expect(own.contains(published)).toBe(false);
    expect(within(published).getByText(/PSGTR/)).toBeTruthy();
    expect(within(own).queryByText(/PSGTR/)).toBeNull();
  });

  it('never renders a published number and a lab number in one element', () => {
    const { container } = mount();
    const figures = container.querySelectorAll('[data-figure]');
    expect(figures.length).toBeGreaterThan(0);
    for (const el of figures) {
      const kinds = new Set(
        [...el.querySelectorAll('[data-fidelity]')].map((n) => n.getAttribute('data-fidelity')),
      );
      expect(kinds.size).toBeLessThanOrEqual(1);
    }
  });

  it('shows both rankings side by side and marks the rows that moved', () => {
    mount();
    expect(screen.getByTestId('rank-multi')).toBeTruthy();
    expect(screen.getByTestId('rank-single')).toBeTruthy();
    expect(screen.getAllByTestId(/^moved-/).length).toBeGreaterThan(0);
  });

  it('says the published figures are on a different set from the lab’s own', () => {
    mount();
    expect(screen.getByTestId('panel-published').textContent).toMatch(/PSG test set/i);
  });
});
