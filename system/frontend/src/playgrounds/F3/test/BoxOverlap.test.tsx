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
    // λ clamps to 2: 6,300 / (180 × 140) = 0.25, inside [0, 1] as a bound on IoU must be.
    expect(screen.getByTestId('readout-F3.bound-value')).toHaveTextContent('0.250');
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

  it('draws each outline over a white under-stroke, so it reads on dark and light ground alike', () => {
    renderAt('/m/m02?F3.lambda=1.4');
    for (const mark of ['f3-gt', 'f3-pred']) {
      const line = screen.getByTestId(mark);
      const halo = screen.getByTestId(`${mark}-halo`);
      for (const k of ['x', 'y', 'width', 'height']) {
        expect(halo.getAttribute(k), `${mark} ${k}`).toBe(line.getAttribute(k));
      }
      expect(halo.getAttribute('stroke')).toBe('#ffffff');
      expect(Number(halo.getAttribute('stroke-width'))).toBeGreaterThan(Number(line.getAttribute('stroke-width')));
      // Under, not over: the halo comes first in paint order.
      expect(halo.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('never prints an IoU of τ beside "IoU < τ"', () => {
    // λ 0.9 shifted (−10, 16): 3,800 / 7,603 = 0.49980, which rounds to 0.500 and is below 0.5.
    renderAt('/m/m02?F3.lambda=0.9&F3.dx=-10&F3.dy=16');
    expect(screen.getByTestId('readout-F3.iou-value')).toHaveTextContent('0.499');
    expect(screen.getByTestId('f3-member')).toHaveTextContent('IoU < τ');
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
