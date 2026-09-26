import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { BoxOverlap } from '../BoxOverlap';

beforeEach(() => setLocale('en'));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BoxOverlap />
    </MemoryRouter>,
  );

describe('F3', () => {
  it('opens on the annotation itself: IoU 1 and counted as the same object', () => {
    renderAt('/m/m02');
    expect(screen.getByTestId('readout-F3.intersection-value')).toHaveTextContent('6,300');
    expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('1.000');
    expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ: counted as the same object');
    expect(screen.queryByTestId('f3-unreachable')).toBeNull();
  });

  it('past √2 the bound falls below τ and says no placement reaches it', () => {
    renderAt('/m/m02?F3.lambda=1.5');
    expect(screen.getByTestId('readout-F3.bound-value')).toHaveTextContent('0.444');
    expect(screen.getByTestId('f3-member')).toHaveTextContent('not counted');
    expect(screen.getByTestId('f3-unreachable')).toBeInTheDocument();
  });

  it('with the bound exactly at τ, the concentric box reaches it and nothing is claimed unreachable', () => {
    renderAt('/m/m02?F3.lambda=2&F3.tau=0.25');
    expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('0.250');
    expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ');
    expect(screen.queryByTestId('f3-unreachable')).toBeNull();
  });

  it('clamps knobs the URL puts out of range', () => {
    renderAt('/m/m02?F3.lambda=9&F3.tau=0&F3.dx=-999');
    expect(screen.getByTestId('F3.lambda')).toHaveValue('2');
    expect(screen.getByTestId('F3.tau')).toHaveValue('0.05');
    expect(screen.getByTestId('F3.dx')).toHaveValue('-120');
    expect(screen.getByTestId('readout-F3.iou-value').textContent).toMatch(/^[01]\.\d{3}$/);
  });

  it('draws three marks that differ in shape, not only in colour', () => {
    renderAt('/m/m02?F3.dx=18');
    expect(screen.getByTestId('f3-gt').getAttribute('stroke-dasharray')).toBeNull();
    expect(screen.getByTestId('f3-pred').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(screen.getByTestId('f3-inter').getAttribute('fill')).toMatch(/^url\(#/);
  });

  it('draws no intersection when the boxes only touch', () => {
    renderAt('/m/m02?F3.dx=90');
    expect(screen.queryByTestId('f3-inter')).toBeNull();
    expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('0.000');
  });

  it('writes the arithmetic beside each count', () => {
    renderAt('/m/m02?F3.dx=18');
    expect(screen.getByTestId('readout-F3.intersection')).toHaveTextContent('72 × 70');
    expect(screen.getByTestId('readout-F3.union')).toHaveTextContent('6,300 + 6,300 − 5,040');
    expect(screen.getByTestId('readout-F3.iou')).toHaveTextContent('5,040 / 7,560');
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m02');
    expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU ≥ τ：視為同一物件');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m02');
    expect(document.activeElement).toBe(document.body);
  });
});
