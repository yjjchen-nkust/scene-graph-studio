import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { LongTailDistribution } from '../LongTailDistribution';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <LongTailDistribution />
    </MemoryRouter>,
  );
}

const value = (id: string) => screen.getByTestId(`readout-${id}-value`);

describe('F7', () => {
  it('one class of four at s = 1 holds 12/25 of the triplets, and the rarest is a quarter of the most frequent', () => {
    at('?F7.s=1&F7.C=4&F7.k=1');
    expect(value('F7.head')).toHaveTextContent(/^48\.00%$/);
    expect(value('F7.tail')).toHaveTextContent(/^25\.00%$/);
  });

  it('at s = 0 the head holds exactly k/C', () => {
    at('?F7.s=0&F7.C=36&F7.k=3');
    expect(value('F7.head')).toHaveTextContent(/^8\.33%$/);
  });

  it('opens with C counted from the slice, not written down', () => {
    at();
    expect(screen.getByTestId('F7.C')).toHaveValue('36');
  });

  it('the overlay measures this slice: 353 of 684 distinct triplets in the top three', () => {
    at('?F7.measured=1&F7.k=3');
    expect(value('F7.measured')).toHaveTextContent(/^51\.61%$/);
    expect(screen.getByTestId('readout-F7.measured')).toHaveTextContent('353 / 684');
  });

  it('at k = 1 the overlay shows the figure s7\'s presenter note quotes', () => {
    at('?F7.measured=1&F7.k=1');
    expect(value('F7.measured')).toHaveTextContent(/^36\.26%$/);
    expect(screen.getByTestId('readout-F7.measured')).toHaveTextContent('248 / 684');
  });

  it('the overlay is off until asked for', () => {
    at();
    expect(screen.queryByTestId('readout-F7.measured')).toBeNull();
    fireEvent.click(screen.getByTestId('F7.measured'));
    expect(screen.getByTestId('readout-F7.measured')).toBeInTheDocument();
  });

  it('clamps knobs that arrive out of range from the URL', () => {
    at('?F7.s=-1&F7.C=4&F7.k=1');
    expect(value('F7.head')).toHaveTextContent(/^25\.00%$/);
  });

  it('clamps C to 50 and k to at least 1', () => {
    at('?F7.s=0&F7.C=500&F7.k=0');
    expect(value('F7.head')).toHaveTextContent(/^2\.00%$/);
  });

  it('shows no recall, no mR and no γ', () => {
    const { container } = at('?F7.measured=1');
    expect(container.textContent ?? '').not.toMatch(/\bmR\b|R@|γ|gamma/i);
  });

  it('a head larger than the class count from the URL is the whole distribution', () => {
    at('?F7.s=1&F7.C=4&F7.k=9');
    expect(value('F7.head')).toHaveTextContent(/^100\.00%$/);
    expect(screen.getByTestId('F7.k')).toHaveValue('4');
  });

  it('reads in 繁體中文 with the same numbers', () => {
    setLocale('zh-TW');
    at('?F7.s=1&F7.C=4&F7.k=1');
    expect(screen.getByTestId('readout-F7.head')).toHaveTextContent('頭部比例（模型）');
    expect(value('F7.head')).toHaveTextContent(/^48\.00%$/);
  });

  it('does not take focus when it mounts', () => {
    at();
    expect(document.activeElement).toBe(document.body);
  });
});
