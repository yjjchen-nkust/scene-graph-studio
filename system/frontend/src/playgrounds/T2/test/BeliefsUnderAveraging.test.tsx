import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { BeliefsUnderAveraging } from '../BeliefsUnderAveraging';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BeliefsUnderAveraging {...props} />
    </MemoryRouter>,
  );

/** Review Focus 1: an invented URL must never leave a NaN or an unfilled `{placeholder}` on screen. */
const expectClean = () => {
  const frame = screen.getByTestId('playground-frame').textContent ?? '';
  expect(frame).not.toMatch(/NaN/);
  expect(frame).not.toMatch(/\{/);
};

describe('T2', () => {
  it('opens on the relations at w = 0.5, t = 0', () => {
    renderAt('/m/m05');
    expect(screen.getByTestId('T2.graph')).toHaveValue('relations');
    expect(screen.getByTestId('T2.w')).toHaveValue('0.5');
    expect(screen.getByTestId('T2.t')).toHaveValue('0');
    expect(screen.getByTestId('t2-belief-1-b0')).toHaveTextContent('0.90');
    expect(screen.getByTestId('t2-belief-1-bt')).toHaveTextContent('0.90');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.8000');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('0.3924 at b*');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.2065');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.2065');
    expect(screen.getByTestId('readout-T2.bound')).toHaveTextContent('wᵗ × 0.2065; 0.2065 is the distance at t = 0');
    expect(screen.getByTestId('t2-regime')).toHaveTextContent('0 < w < 1');
    expect(screen.queryByTestId('readout-T2.limit')).toBeNull();
    expectClean();
  });

  it('names each object with its neighbours', () => {
    renderAt('/m/m05');
    expect(screen.getByTestId('t2-belief-1-nb').textContent).toBe('#2 person, #3 box, #5 wrench, #6 panel');
    expect(screen.getByTestId('t2-belief-3-nb').textContent).toBe('#1 table');
    expect(screen.getByTestId('t2-belief-5-nb').textContent).toBe('#1 table, #2 person');
    cleanup();

    renderAt('/m/m05?T2.graph=every');
    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`t2-belief-${id}-nb`).textContent).toBe('the other five');
    }
  });

  it("pads the table's cells so adjacent values do not touch", () => {
    renderAt('/m/m05');
    const rowHeader = screen.getByTestId('t2-belief-1').querySelector('th')!;
    expect(rowHeader).toHaveClass('pl-2', 'pr-4');
    expect(screen.getByTestId('t2-belief-1-nb')).toHaveClass('pr-4');
    expect(screen.getByTestId('t2-belief-1-b0')).toHaveClass('pr-4', 'text-right', 'tabular-nums');
    expect(screen.getByTestId('t2-belief-1-bt')).toHaveClass('pr-4', 'text-right', 'tabular-nums');
    const headerCells = screen.getByTestId('t2-beliefs').querySelectorAll('thead th');
    for (const cell of headerCells) expect(cell).toHaveClass('pr-4');
    expect(headerCells[2]).toHaveClass('text-right', 'tabular-nums');
    expect(headerCells[3]).toHaveClass('text-right', 'tabular-nums');
  });

  it("gives spec §2's round 1 and round 5", () => {
    renderAt('/m/m05?T2.t=1');
    const bt1 = ['0.65', '0.33', '0.80', '0.30', '0.33', '0.75'];
    for (const [i, value] of bt1.entries()) {
      expect(screen.getByTestId(`t2-belief-${i + 1}-bt`)).toHaveTextContent(value);
    }
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.5000');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.1011');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.1032');
    cleanup();

    renderAt('/m/m05?T2.t=5');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.3941');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.0022');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.0065');
  });

  it('holds the distance under its bound at w = 0.9', () => {
    renderAt('/m/m05?T2.w=0.9&T2.t=10');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.1053');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.0122');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.1276');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('0.1105 at b*');
    cleanup();

    for (const roundT of [0, 1, 5, 10, 40]) {
      renderAt(`/m/m05?T2.w=0.9&T2.t=${roundT}`);
      const distance = Number(screen.getByTestId('readout-T2.distance-value').textContent);
      const bound = Number(screen.getByTestId('readout-T2.bound-value').textContent);
      expect(distance, `t = ${roundT}`).toBeLessThanOrEqual(bound);
      cleanup();
    }
  });

  it('every pair at w = 0.9, t = 1', () => {
    renderAt('/m/m05?T2.graph=every&T2.w=0.9&T2.t=1');
    const bt1 = ['0.45', '0.51', '0.47', '0.49', '0.51', '0.47'];
    for (const [i, value] of bt1.entries()) {
      expect(screen.getByTestId(`t2-belief-${i + 1}-bt`)).toHaveTextContent(value);
    }
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.0640');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.0686');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.3432');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('0.0678 at b*');
  });

  it('w = 1 hides the distance and the bound and shows the limit', () => {
    renderAt('/m/m05?T2.w=1&T2.t=40');
    expect(screen.queryByTestId('readout-T2.distance')).toBeNull();
    expect(screen.queryByTestId('readout-T2.bound')).toBeNull();
    expect(screen.getByTestId('readout-T2.limit-value')).toHaveTextContent('0.5083');
    expect(screen.getByTestId('readout-T2.limit')).toHaveTextContent('6.1 / 12');
    expect(screen.getByTestId('readout-T2.mean-value')).toHaveTextContent('0.4833');
    expect(screen.getByTestId('readout-T2.mean')).toHaveTextContent('2.9 / 6');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.0002');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('0 in the limit');
    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByTestId(`t2-belief-${id}-bt`)).toHaveTextContent('0.51');
    }
    expect(screen.getByTestId('t2-regime')).toHaveTextContent('w = 1');
  });

  it('every pair at w = 1 meets at the plain mean', () => {
    renderAt('/m/m05?T2.graph=every&T2.w=1&T2.t=5');
    expect(screen.getByTestId('readout-T2.limit-value')).toHaveTextContent('0.4833');
    expect(screen.getByTestId('readout-T2.limit')).toHaveTextContent('14.5 / 30');
    expect(screen.getByTestId('readout-T2.mean-value')).toHaveTextContent('0.4833');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.0003');
  });

  it('w = 0 moves nothing', () => {
    renderAt('/m/m05?T2.w=0&T2.t=40');
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const b0 = screen.getByTestId(`t2-belief-${id}-b0`).textContent;
      expect(screen.getByTestId(`t2-belief-${id}-bt`)).toHaveTextContent(b0!);
    }
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.8000');
    expect(screen.getByTestId('readout-T2.distance-value')).toHaveTextContent('0.0000');
    expect(screen.getByTestId('readout-T2.bound-value')).toHaveTextContent('0.0000');
    expect(screen.getByTestId('t2-regime')).toHaveTextContent('w = 0');
  });

  it('knobs the URL invented fall back or snap', () => {
    renderAt('/m/m05?T2.graph=foo');
    expect(screen.getByTestId('T2.graph')).toHaveValue('relations');
    expect(screen.getByTestId('t2-belief-3-nb')).toHaveTextContent('#1 table');
    expectClean();
    cleanup();

    renderAt('/m/m05?T2.w=1.7');
    expect(screen.getByTestId('T2.w')).toHaveValue('1');
    expect(screen.getByTestId('readout-T2.limit')).toBeInTheDocument();
    expectClean();
    cleanup();

    renderAt('/m/m05?T2.w=0.53');
    expect(screen.getByTestId('T2.w')).toHaveValue('0.55');
    expectClean();
    cleanup();

    renderAt('/m/m05?T2.t=-3');
    expect(screen.getByTestId('T2.t')).toHaveValue('0');
    expect(screen.getByTestId('readout-T2.spread-value')).toHaveTextContent('0.8000');
    expectClean();
    cleanup();

    renderAt('/m/m05?T2.t=99');
    expect(screen.getByTestId('T2.t')).toHaveValue('40');
    expectClean();
  });

  it("names IMP's update as learned", () => {
    renderAt('/m/m05');
    expect(screen.getByTestId('t2-model')).toHaveTextContent(
      "IMP's own update is learned; this rule models repeated averaging.",
    );
  });

  it('shows no recall', () => {
    renderAt('/m/m05');
    const nodes = [
      screen.getByTestId('readout-T2.spread'),
      screen.getByTestId('readout-T2.distance'),
      screen.getByTestId('readout-T2.bound'),
      screen.getByTestId('t2-beliefs'),
      screen.getByTestId('t2-model'),
    ];
    for (const node of nodes) {
      expect(node.textContent ?? '').not.toContain('R@');
    }
  });

  it('part 1 holds the table and part 2 the readouts', () => {
    renderAt('/m/m05', { part: 1 });
    expect(screen.getByTestId('t2-beliefs')).toBeInTheDocument();
    expect(screen.getByTestId('t2-regime')).toBeInTheDocument();
    expect(screen.queryByTestId('readout-T2.spread')).toBeNull();
    expect(screen.queryByTestId('t2-model')).toBeNull();
    expect(screen.getByTestId('T2.graph')).toBeInTheDocument();
    expect(screen.getByTestId('T2.w')).toBeInTheDocument();
    expect(screen.getByTestId('T2.t')).toBeInTheDocument();
    cleanup();

    renderAt('/m/m05', { part: 2 });
    expect(screen.getByTestId('readout-T2.spread')).toBeInTheDocument();
    expect(screen.getByTestId('t2-regime')).toBeInTheDocument();
    expect(screen.getByTestId('t2-model')).toBeInTheDocument();
    expect(screen.queryByTestId('t2-beliefs')).toBeNull();
    expect(screen.getByTestId('T2.graph')).toBeInTheDocument();
    expect(screen.getByTestId('T2.w')).toBeInTheDocument();
    expect(screen.getByTestId('T2.t')).toBeInTheDocument();
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m05');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('b⁽ᵗ⁾ 之全距');
    expect(screen.getByTestId('readout-T2.spread')).toHaveTextContent('b* 處為 0.3924');
    expect(screen.getByTestId('readout-T2.bound')).toHaveTextContent('wᵗ × 0.2065；0.2065 為 t = 0 時之距離');
    expect(screen.getByTestId('t2-belief-1-nb').textContent).toBe('#2 person、#3 box、#5 wrench、#6 panel');
    expectClean();
    cleanup();

    setLocale('zh-TW');
    renderAt('/m/m05?T2.graph=every');
    expect(screen.getByTestId('t2-belief-1-nb')).toHaveTextContent('其餘五個物件');
    cleanup();

    setLocale('zh-TW');
    renderAt('/m/m05');
    expect(screen.getByTestId('t2-regime')).toHaveTextContent('0 < w < 1：信念收斂至 b*');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m05');
    expect(document.activeElement).toBe(document.body);
  });
});
