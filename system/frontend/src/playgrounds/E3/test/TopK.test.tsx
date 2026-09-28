import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { TopK } from '../TopK';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TopK {...props} />
    </MemoryRouter>,
  );

describe('E3', () => {
  it('opens at k = 4: four predictions, three ground truths, g1, g4 and g5', () => {
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E3.in_top-value')).toHaveTextContent('4');
    expect(screen.getByTestId('readout-E3.truths-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-E3.truths')).toHaveTextContent('of the 6 annotated: g1, g4, g5');
  });

  it('checks off ranks 1, 3 and 5 at the default k, and no others', () => {
    renderAt('/m/m04');
    for (const rank of [1, 3, 5]) {
      expect(screen.getByTestId(`e3-list-row-${rank}`)).toHaveAttribute('data-matched', 'true');
    }
    for (const rank of [2, 4, 6, 7, 8, 9, 10, 11, 12]) {
      expect(screen.getByTestId(`e3-list-row-${rank}`)).toHaveAttribute('data-matched', 'false');
    }
  });

  it('never lets the count fall as k rises', () => {
    const expected = [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3];
    const seen: string[] = [];
    for (let k = 1; k <= 12; k += 1) {
      renderAt(`/m/m04?E3.k=${k}`);
      seen.push(screen.getByTestId('readout-E3.truths-value').textContent ?? '');
      cleanup();
    }
    expect(seen).toEqual(expected.map(String));
  });

  it('holds seven predictions from k = 7', () => {
    renderAt('/m/m04?E3.k=7');
    expect(screen.getByTestId('readout-E3.in_top-value')).toHaveTextContent('7');
    cleanup();
    renderAt('/m/m04?E3.k=12');
    expect(screen.getByTestId('readout-E3.in_top-value')).toHaveTextContent('7');
  });

  it('a k the URL invented is snapped or defaulted', () => {
    renderAt('/m/m04?E3.k=99');
    expect(screen.getByTestId('E3.k')).toHaveValue('12');
    expect(screen.getByTestId('readout-E3.in_top-value')).toHaveTextContent('7');
    cleanup();
    renderAt('/m/m04?E3.k=abc');
    expect(screen.getByTestId('E3.k')).toHaveValue('4');
    expect(screen.getByTestId('readout-E3.in_top-value')).toHaveTextContent('4');
  });

  it('the photograph follows the row', () => {
    renderAt('/m/m04?E3.row=10');
    expect(screen.getByTestId('e3-pair-badge-s')).toHaveTextContent('#2');
    expect(screen.getByTestId('e3-pair-badge-o')).toHaveTextContent('#4');
  });

  it('shows no recall', () => {
    renderAt('/m/m04');
    for (const id of ['readout-E3.in_top-value', 'readout-E3.truths-value']) {
      const value = screen.getByTestId(id).textContent ?? '';
      expect(value).not.toContain('R@');
      expect(value).not.toContain('.');
    }
  });

  it('part 1 holds the photograph and the row line, and part 2 the list', () => {
    renderAt('/m/m04', { part: 1 });
    expect(screen.getByTestId('e3-pair')).toBeInTheDocument();
    expect(screen.getByTestId('e3-row-line')).toBeInTheDocument();
    expect(screen.queryByTestId('e3-list-table')).toBeNull();
    expect(screen.queryByTestId('readout-E3.in_top')).toBeNull();
    cleanup();
    renderAt('/m/m04', { part: 2 });
    expect(screen.getByTestId('e3-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('readout-E3.in_top')).toBeInTheDocument();
    expect(screen.queryByTestId('e3-pair')).toBeNull();
    expect(screen.queryByTestId('e3-row-line')).toBeNull();
  });

  it('the row line names the chosen row and whether the graph constraint keeps it', () => {
    renderAt('/m/m04', { part: 1 });
    expect(screen.getByTestId('e3-row-line')).toHaveTextContent('Row 1: #2 person holding #5 wrench, kept');
    cleanup();
    // Row 2 is the person–wrench pair's runner-up, which one prediction per pair drops.
    renderAt('/m/m04?E3.row=2', { part: 1 });
    expect(screen.getByTestId('e3-row-line')).toHaveTextContent(
      'Row 2: #2 person next to #5 wrench, dropped by the constraint',
    );
    cleanup();
    renderAt('/m/m04?E3.row=12', { part: 1 });
    expect(screen.getByTestId('e3-row-line')).toHaveTextContent('Row 12: #1 table behind #2 person, kept');
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E3.truths')).toHaveTextContent('共 6 筆標註：g1、g4、g5');
    expect(screen.getByTestId('e3-row-line')).toHaveTextContent('第 1 列：#2 person holding #5 wrench，保留');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m04');
    expect(document.activeElement).toBe(document.body);
  });
});
