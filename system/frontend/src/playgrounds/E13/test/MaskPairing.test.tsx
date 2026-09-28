import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { MaskPairing } from '../MaskPairing';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MaskPairing {...props} />
    </MemoryRouter>,
  );

describe('E13', () => {
  it('opens at SingleMPO, d = 3: 3 emitted, 1 admitted, 1 kept, not matched', () => {
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E13.emitted-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-E13.admitted-value')).toHaveTextContent('1');
    expect(screen.getByTestId('readout-E13.kept-value')).toHaveTextContent('1');
    expect(screen.getByTestId('readout-E13.g4-value')).toHaveTextContent('no');
  });

  it('MultiMPO at d = 3 admits and keeps 3 and matches g4', () => {
    renderAt('/m/m04?E13.multi=1&E13.d=3');
    expect(screen.getByTestId('readout-E13.emitted-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-E13.admitted-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-E13.kept-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-E13.g4-value')).toHaveTextContent('yes');
  });

  it('at d = 1 neither pairing matches g4', () => {
    renderAt('/m/m04?E13.d=1');
    expect(screen.getByTestId('readout-E13.g4-value')).toHaveTextContent('no');
    cleanup();
    renderAt('/m/m04?E13.multi=1&E13.d=1');
    expect(screen.getByTestId('readout-E13.g4-value')).toHaveTextContent('no');
  });

  it('a d the URL invented is snapped', () => {
    renderAt('/m/m04?E13.d=9');
    expect(screen.getByTestId('E13.d')).toHaveValue('5');
    expect(screen.getByTestId('readout-E13.emitted-value')).toHaveTextContent('5');
  });

  it('SingleMPO admits copy 1 only, the rest struck through', () => {
    renderAt('/m/m04?E13.d=3');
    expect(screen.getByTestId('e13-copy-1')).toHaveAttribute('data-admitted', 'true');
    expect(screen.getByTestId('e13-copy-1')).toHaveTextContent('next to');
    expect(screen.getByTestId('e13-copy-1')).toHaveTextContent('0.90');
    expect(screen.getByTestId('e13-copy-2')).toHaveAttribute('data-admitted', 'false');
    expect(screen.getByTestId('e13-copy-2')).toHaveTextContent('holding');
    expect(screen.getByTestId('e13-copy-2').className).toContain('line-through');
    expect(screen.getByTestId('e13-copy-3')).toHaveAttribute('data-admitted', 'false');
    expect(screen.getByTestId('e13-copy-1').className).not.toContain('line-through');
  });

  it('MultiMPO admits every copy, none struck through', () => {
    renderAt('/m/m04?E13.multi=1&E13.d=3');
    for (const i of [1, 2, 3]) {
      const row = screen.getByTestId(`e13-copy-${i}`);
      expect(row).toHaveAttribute('data-admitted', 'true');
      expect(row.className).not.toContain('line-through');
    }
  });

  it('shows no recall', () => {
    renderAt('/m/m04');
    for (const id of ['readout-E13.emitted-value', 'readout-E13.admitted-value', 'readout-E13.kept-value']) {
      const value = screen.getByTestId(id).textContent ?? '';
      expect(value).not.toContain('R@');
      expect(value).not.toContain('.');
    }
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m04');
    expect(screen.getByTestId('readout-E13.admitted')).toHaveTextContent('遮罩配對規則接納之數');
    expect(screen.getByTestId('readout-E13.admitted')).toHaveTextContent('SingleMPO 每一遮罩配對保留 1 筆；MultiMPO 全數保留');
    expect(screen.getByTestId('readout-E13.kept')).toHaveTextContent('每一複本各為一組物件編號配對');
    expect(screen.getByTestId('readout-E13.g4-value')).toHaveTextContent('否');
    expect(screen.getByTestId('e13-copies')).toHaveTextContent('person–wrench 遮罩配對之複本（依分數遞減）');
    expect(screen.getByText('此處遮罩以識別碼表示：每一複本沿用原物件之遮罩。')).toBeInTheDocument();
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m04');
    expect(document.activeElement).toBe(document.body);
  });
});
