import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { LongTailLab, gapAt } from '../LongTailLab';

beforeEach(() => {
  setLocale('en');
});

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/lab/L3') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LongTailLab />
      <Address />
    </MemoryRouter>,
  );
}

const query = () => new URLSearchParams(screen.getByTestId('address').textContent ?? '');

describe('LongTailLab', () => {
  it('shows R and mR for the prior and for the visual model, four figures', () => {
    mount();
    for (const who of ['freq', 'visual']) {
      const panel = screen.getByTestId(`panel-${who}`);
      expect(within(panel).getByTestId('R').textContent).toMatch(/\d/);
      expect(within(panel).getByTestId('mR').textContent).toMatch(/\d/);
    }
  });

  it('says plainly that the prior reads no pixels', () => {
    mount();
    expect(screen.getByTestId('panel-freq').textContent).toMatch(/no pixels/i);
  });

  it('writes the blend to the URL so a configuration is a link', () => {
    mount();
    fireEvent.change(screen.getByTestId('lambda'), { target: { value: '0.75' } });
    expect(query().get('lambda')).toBe('0.75');
  });

  it('writes the Zipf exponent to the URL', () => {
    mount();
    fireEvent.change(screen.getByTestId('zipf'), { target: { value: '0' } });
    expect(query().get('zipf')).toBe('0');
  });

  it('renders the covariance identity as one number beside the two metrics', () => {
    mount();
    // E6: R@k - mR@k = Cov(n, R)/n-bar. The whole bias problem is the sign of that covariance,
    // so the lab shows the number rather than the sentence.
    const shown = Number(screen.getByTestId('gap').textContent);
    const r = Number(within(screen.getByTestId('panel-freq')).getByTestId('R').textContent);
    const mr = Number(within(screen.getByTestId('panel-freq')).getByTestId('mR').textContent);
    expect(shown).toBeCloseTo(r - mr, 1);
  });

  it('opens the gap as the predicate distribution steepens', () => {
    // The point of the second slider: FREQ's advantage is a property of the corpus, not of the
    // metric. A flat distribution has nothing for the prior to exploit.
    expect(gapAt(2.0, 0)).toBeGreaterThan(gapAt(0, 0));
  });

  it('closes it again at a flat distribution', () => {
    expect(Math.abs(gapAt(0, 0))).toBeLessThan(Math.abs(gapAt(2.0, 0)));
  });
});
