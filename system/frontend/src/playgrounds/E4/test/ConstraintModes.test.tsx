import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { ConstraintModes } from '../ConstraintModes';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ConstraintModes {...props} />
    </MemoryRouter>,
  );

describe('E4', () => {
  it('opens at graph, k = 2: pool 7, two matched, one under none', () => {
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E4.pool-value')).toHaveTextContent('7');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('2');
    expect(screen.getByTestId('readout-E4.truths_none-value')).toHaveTextContent('1');
  });

  it('semi at k = 6 finds four, where graph and none find three', () => {
    renderAt('/m/m04?E4.mode=semi&E4.k=6');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('4');
    cleanup();
    renderAt('/m/m04?E4.mode=graph&E4.k=6');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('3');
    cleanup();
    renderAt('/m/m04?E4.mode=none&E4.k=6');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('3');
  });

  it('at k = 12 the pools order the counts: 3, 5, 5', () => {
    renderAt('/m/m04?E4.mode=graph&E4.k=12');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('3');
    cleanup();
    renderAt('/m/m04?E4.mode=semi&E4.k=12');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('5');
    cleanup();
    renderAt('/m/m04?E4.mode=none&E4.k=12');
    expect(screen.getByTestId('readout-E4.truths-value')).toHaveTextContent('5');
  });

  it('under graph at k = 12 the cut follows the seventh kept row', () => {
    renderAt('/m/m04?E4.mode=graph&E4.k=12');
    const row12 = screen.getByTestId('e4-list-row-12');
    const cut = screen.getByTestId('e4-list-cut');
    expect(row12.nextElementSibling).toBe(cut);
    expect(screen.getByTestId('readout-E4.pool-value')).toHaveTextContent('7');
  });

  it('a mode the URL invented is graph', () => {
    renderAt('/m/m04?E4.mode=foo');
    expect(screen.getByTestId('E4.mode')).toHaveValue('graph');
    expect(screen.getByTestId('readout-E4.pool-value')).toHaveTextContent('7');
  });

  it('a dropped row can be shown', () => {
    renderAt('/m/m04?E4.row=2');
    expect(screen.getByTestId('e4-pair')).toBeInTheDocument();
    expect(screen.getByTestId('e4-list-row-2')).toHaveClass('line-through');
    expect(screen.getByTestId('e4-list-row-2')).toHaveAttribute('data-top', 'false');
  });

  it('part 1 holds the mode, the row, the photograph, its line and the pool; part 2 the mode, k and the list', () => {
    renderAt('/m/m04', { part: 1 });
    expect(screen.getByTestId('e4-pair')).toBeInTheDocument();
    expect(screen.getByTestId('E4.mode')).toBeInTheDocument();
    expect(screen.getByTestId('E4.row')).toBeInTheDocument();
    expect(screen.getByTestId('e4-row-line')).toBeInTheDocument();
    expect(screen.getByTestId('readout-E4.pool')).toBeInTheDocument();
    expect(screen.queryByTestId('E4.k')).toBeNull();
    expect(screen.queryByTestId('e4-list-table')).toBeNull();
    cleanup();
    renderAt('/m/m04', { part: 2 });
    expect(screen.getByTestId('e4-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('E4.mode')).toBeInTheDocument();
    expect(screen.getByTestId('E4.k')).toBeInTheDocument();
    expect(screen.queryByTestId('E4.row')).toBeNull();
    expect(screen.getByTestId('readout-E4.pool')).toBeInTheDocument();
    expect(screen.queryByTestId('e4-pair')).toBeNull();
    expect(screen.queryByTestId('e4-row-line')).toBeNull();
  });

  it('part 1 reads the pool at graph as 7, and names row 2 dropped by the constraint', () => {
    renderAt('/m/m04', { part: 1 });
    expect(screen.getByTestId('readout-E4.pool-value')).toHaveTextContent('7');
    expect(screen.getByTestId('readout-E4.pool')).toHaveTextContent('of 12 predictions');
    cleanup();
    renderAt('/m/m04?E4.row=2', { part: 1 });
    const line = screen.getByTestId('e4-row-line').textContent ?? '';
    expect(line).toBe('Row 2: #2 person next to #5 wrench, dropped by the constraint');
    expect(line.endsWith('dropped by the constraint')).toBe(true);
  });

  it('part 1 keeps row 2 under semi and none, and row 6 only under none', () => {
    for (const [url, state] of [
      ['?E4.mode=semi&E4.row=2', 'kept'],
      ['?E4.mode=none&E4.row=2', 'kept'],
      ['?E4.mode=semi&E4.row=6', 'dropped by the constraint'],
      ['?E4.mode=none&E4.row=6', 'kept'],
    ] as const) {
      renderAt(`/m/m04${url}`, { part: 1 });
      expect(screen.getByTestId('e4-row-line').textContent, url).toMatch(new RegExp(`, ${state}$`));
      cleanup();
    }
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E4.truths')).toHaveTextContent('共 6 筆標註：g1、g4');
    expect(screen.getByTestId('readout-E4.truths_none')).toHaveTextContent('共 6 筆標註：g4');
    cleanup();
    renderAt('/m/m04?E4.row=2', { part: 1 });
    expect(screen.getByTestId('e4-row-line')).toHaveTextContent('第 2 列：#2 person next to #5 wrench，遭約束排除');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m04');
    expect(document.activeElement).toBe(document.body);
  });
});
