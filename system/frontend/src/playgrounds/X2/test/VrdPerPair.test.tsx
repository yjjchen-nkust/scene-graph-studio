import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { VrdPerPair } from '../VrdPerPair';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <VrdPerPair {...props} />
    </MemoryRouter>,
  );

describe('X2', () => {
  it('opens at m = 10: 30 pairs, 300 candidates, 10 per pair, the cut selects', () => {
    renderAt('/m/m04');
    expect(screen.getByTestId('X2.m')).toHaveValue('10');
    expect(screen.getByTestId('readout-X2.pairs-value')).toHaveTextContent('30');
    expect(screen.getByTestId('readout-X2.pairs')).toHaveTextContent('6 × 5');
    expect(screen.getByTestId('readout-X2.pool-value')).toHaveTextContent('300');
    expect(screen.getByTestId('readout-X2.pool')).toHaveTextContent('30 × min(m, 70); 70 predicates, M4 s8');
    expect(screen.getByTestId('readout-X2.share-value')).toHaveTextContent('10');
    expect(screen.getByTestId('readout-X2.share')).toHaveTextContent('min(m, 100); K = 100, the engine\'s largest cut');
    expect(screen.getByTestId('readout-X2.cut-value')).toHaveTextContent('yes: 300 candidates for 100 places');
    expect(screen.getByTestId('readout-X2.cut')).toHaveTextContent('pool > 100');
  });

  it('m = 1: 30 candidates, the cut does not select', () => {
    renderAt('/m/m04?X2.m=1');
    expect(screen.getByTestId('readout-X2.pairs-value')).toHaveTextContent('30');
    expect(screen.getByTestId('readout-X2.pool-value')).toHaveTextContent('30');
    expect(screen.getByTestId('readout-X2.share-value')).toHaveTextContent('1');
    expect(screen.getByTestId('readout-X2.cut-value')).toHaveTextContent('no: all 30 candidates fit in 100');
  });

  it('m = 70: 2,100 candidates, 70 per pair', () => {
    renderAt('/m/m04?X2.m=70');
    expect(screen.getByTestId('readout-X2.pool-value')).toHaveTextContent('2,100');
    expect(screen.getByTestId('readout-X2.share-value')).toHaveTextContent('70');
    expect(screen.getByTestId('readout-X2.cut-value')).toHaveTextContent('yes: 2,100 candidates for 100 places');
  });

  it('an m the URL invented is 10', () => {
    renderAt('/m/m04?X2.m=5');
    expect(screen.getByTestId('X2.m')).toHaveValue('10');
    expect(screen.getByTestId('readout-X2.pool-value')).toHaveTextContent('300');
    expect(screen.getByTestId('readout-X2.share-value')).toHaveTextContent('10');
  });

  it('shows no recall', () => {
    renderAt('/m/m04');
    for (const id of ['readout-X2.pairs-value', 'readout-X2.pool-value', 'readout-X2.share-value', 'readout-X2.cut-value']) {
      const value = screen.getByTestId(id).textContent ?? '';
      expect(value).not.toContain('R@');
      expect(value).not.toContain('.');
    }
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-X2.pairs')).toHaveTextContent('ph-001 六個物件之有序配對數');
    expect(screen.getByTestId('readout-X2.pool')).toHaveTextContent('候選數');
    expect(screen.getByTestId('readout-X2.pool')).toHaveTextContent('30 × min(m, 70)；70 個 predicate，見 M4 s8');
    expect(screen.getByTestId('readout-X2.share')).toHaveTextContent('單一配對至多可占前 100 名之數量');
    expect(screen.getByTestId('readout-X2.share')).toHaveTextContent('min(m, 100)；K = 100 為引擎之最大截斷值');
    expect(screen.getByTestId('readout-X2.cut')).toHaveTextContent('截斷於 100 是否發揮篩選作用');
    expect(screen.getByTestId('readout-X2.cut-value')).toHaveTextContent('是：300 個候選競逐 100 個名次');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m04');
    expect(document.activeElement).toBe(document.body);
  });
});
