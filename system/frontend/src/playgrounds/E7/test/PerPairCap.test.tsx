import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { PerPairCap } from '../PerPairCap';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PerPairCap {...props} />
    </MemoryRouter>,
  );

describe('E7', () => {
  it('the pool grows 7, 11, 12 and stops', () => {
    const expected = [7, 11, 12, 12, 12, 12, 12, 12, 12, 12];
    const seen: string[] = [];
    for (let m = 1; m <= 10; m += 1) {
      renderAt(`/m/m04?E7.m=${m}`);
      seen.push(screen.getByTestId('readout-E7.pool-value').textContent ?? '');
      cleanup();
    }
    expect(seen).toEqual(expected.map(String));
  });

  it('at k = 2 the count falls from 2 to 1 as m rises from 1 to 2', () => {
    renderAt('/m/m04?E7.m=1&E7.k=2');
    expect(screen.getByTestId('readout-E7.truths-value')).toHaveTextContent('2');
    cleanup();
    renderAt('/m/m04?E7.m=2&E7.k=2');
    expect(screen.getByTestId('readout-E7.truths-value')).toHaveTextContent('1');
  });

  it('at k = 12 it rises from 3 to 5', () => {
    renderAt('/m/m04?E7.m=1&E7.k=12');
    expect(screen.getByTestId('readout-E7.truths-value')).toHaveTextContent('3');
    cleanup();
    renderAt('/m/m04?E7.m=2&E7.k=12');
    expect(screen.getByTestId('readout-E7.truths-value')).toHaveTextContent('5');
  });

  it('an m the URL invented is snapped', () => {
    renderAt('/m/m04?E7.m=0');
    expect(screen.getByTestId('E7.m')).toHaveValue('1');
    expect(screen.getByTestId('readout-E7.pool-value')).toHaveTextContent('7');
    cleanup();
    renderAt('/m/m04?E7.m=99');
    expect(screen.getByTestId('E7.m')).toHaveValue('10');
    expect(screen.getByTestId('readout-E7.pool-value')).toHaveTextContent('12');
  });

  it('part 1 holds m, the row and the photograph; part 2 holds m, k and the list', () => {
    renderAt('/m/m04', { part: 1 });
    expect(screen.getByTestId('e7-pair')).toBeInTheDocument();
    expect(screen.getByTestId('E7.m')).toBeInTheDocument();
    expect(screen.getByTestId('E7.row')).toBeInTheDocument();
    expect(screen.queryByTestId('E7.k')).toBeNull();
    expect(screen.queryByTestId('e7-list-table')).toBeNull();
    expect(screen.queryByTestId('readout-E7.pool')).toBeNull();
    cleanup();
    renderAt('/m/m04', { part: 2 });
    expect(screen.getByTestId('e7-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('E7.m')).toBeInTheDocument();
    expect(screen.getByTestId('E7.k')).toBeInTheDocument();
    expect(screen.queryByTestId('E7.row')).toBeNull();
    expect(screen.getByTestId('readout-E7.pool')).toBeInTheDocument();
    expect(screen.getByTestId('readout-E7.truths')).toBeInTheDocument();
    expect(screen.queryByTestId('e7-pair')).toBeNull();
  });

  it('shows no recall', () => {
    renderAt('/m/m04');
    for (const id of ['readout-E7.pool-value', 'readout-E7.truths-value']) {
      const value = screen.getByTestId(id).textContent ?? '';
      expect(value).not.toContain('R@');
      expect(value).not.toContain('.');
    }
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E7.truths')).toHaveTextContent('共 6 筆標註：g1、g4');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m04');
    expect(document.activeElement).toBe(document.body);
  });
});
