import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import type { PlaygroundProps } from '../../mounts';
import { PairsAgainstRelations } from '../PairsAgainstRelations';

beforeEach(() => setLocale('en'));

const renderAt = (url: string, props: PlaygroundProps = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PairsAgainstRelations {...props} />
    </MemoryRouter>,
  );

describe('T1', () => {
  it('opens at rank 40: frame 547, 16 objects, 240 pairs, 12,000 decisions, 5 rows, 5 related', () => {
    renderAt('/m/m05');
    expect(screen.getByTestId('T1.frame')).toHaveValue('40');
    expect(screen.getByTestId('readout-T1.objects-value')).toHaveTextContent('16');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 547, rank 40 of 80');
    expect(screen.getByTestId('readout-T1.pairs-value')).toHaveTextContent('240');
    expect(screen.getByTestId('readout-T1.pairs')).toHaveTextContent('N(N − 1) = 16 × 15');
    expect(screen.getByTestId('readout-T1.decisions-value')).toHaveTextContent('12,000');
    expect(screen.getByTestId('readout-T1.rows-value')).toHaveTextContent('5');
    expect(screen.getByTestId('readout-T1.related-value')).toHaveTextContent('5');
    expect(screen.getByTestId('readout-T1.related')).toHaveTextContent('5 / 240 of the ordered pairs');
    expect(screen.getByTestId('readout-T1.slice-value')).toHaveTextContent('651 / 26,282');
  });

  it('rank 1 is frame 2045 and rank 80 is frame 3182', () => {
    renderAt('/m/m05?T1.frame=1');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 2045, rank 1 of 80');
    expect(screen.getByTestId('readout-T1.objects-value')).toHaveTextContent('4');
    expect(screen.getByTestId('readout-T1.pairs-value')).toHaveTextContent('12');
    expect(screen.getByTestId('readout-T1.decisions-value')).toHaveTextContent('600');
    expect(screen.getByTestId('readout-T1.rows-value')).toHaveTextContent('4');
    expect(screen.getByTestId('readout-T1.related-value')).toHaveTextContent('2');
    expect(screen.getByTestId('readout-T1.related')).toHaveTextContent('2 / 12 of the ordered pairs');
    cleanup();

    renderAt('/m/m05?T1.frame=80');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 3182, rank 80 of 80');
    expect(screen.getByTestId('readout-T1.objects-value')).toHaveTextContent('39');
    expect(screen.getByTestId('readout-T1.pairs-value')).toHaveTextContent('1,482');
    expect(screen.getByTestId('readout-T1.decisions-value')).toHaveTextContent('74,100');
    expect(screen.getByTestId('readout-T1.rows-value')).toHaveTextContent('45');
    expect(screen.getByTestId('readout-T1.related-value')).toHaveTextContent('29');
    expect(screen.getByTestId('readout-T1.related')).toHaveTextContent('29 / 1,482 of the ordered pairs');
  });

  it('counts a pair once however many rows it carries', () => {
    renderAt('/m/m05?T1.frame=2');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 4176, rank 2 of 80');
    expect(screen.getByTestId('readout-T1.rows-value')).toHaveTextContent('18');
    expect(screen.getByTestId('readout-T1.related-value')).toHaveTextContent('7');
    expect(screen.getByTestId('readout-T1.related')).toHaveTextContent('7 / 12 of the ordered pairs');
  });

  it('breaks a tie in object count by image id as a number', () => {
    renderAt('/m/m05?T1.frame=41');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 1246, rank 41 of 80');
  });

  it("the slice's 651 of 26,282 does not move with the frame", () => {
    for (const rank of [1, 40, 80]) {
      renderAt(`/m/m05?T1.frame=${rank}`);
      expect(screen.getByTestId('readout-T1.slice-value')).toHaveTextContent('651 / 26,282');
      cleanup();
    }
  });

  it('a frame the URL invented is snapped or defaulted', () => {
    renderAt('/m/m05?T1.frame=999');
    expect(screen.getByTestId('T1.frame')).toHaveValue('80');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('frame 3182, rank 80 of 80');
    cleanup();

    renderAt('/m/m05?T1.frame=0');
    expect(screen.getByTestId('T1.frame')).toHaveValue('1');
    cleanup();

    renderAt('/m/m05?T1.frame=abc');
    expect(screen.getByTestId('T1.frame')).toHaveValue('40');
    cleanup();

    renderAt('/m/m05?T1.frame=40.6');
    expect(screen.getByTestId('T1.frame')).toHaveValue('41');
  });

  it('shows no recall and no percentage', () => {
    renderAt('/m/m05');
    for (const id of [
      'readout-T1.objects-value',
      'readout-T1.pairs-value',
      'readout-T1.decisions-value',
      'readout-T1.rows-value',
      'readout-T1.related-value',
      'readout-T1.slice-value',
    ]) {
      const value = screen.getByTestId(id).textContent ?? '';
      expect(value).not.toContain('R@');
      expect(value).not.toContain('%');
      expect(value).not.toContain('.');
    }
  });

  it('says the slice ships no photograph', () => {
    renderAt('/m/m05');
    expect(screen.getByTestId('t1-source')).toHaveTextContent(
      'The 80 VG150 frames of data/slices/vg150-sgb, annotations only; no photograph ships with them.',
    );
    expect(screen.getByTestId('playground-frame').querySelector('img')).toBeNull();
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m05');
    expect(screen.getByTestId('readout-T1.objects')).toHaveTextContent('影像 547，80 張中第 40 名');
    expect(screen.getByTestId('readout-T1.decisions')).toHaveTextContent('VG150 之 50 個 predicate');
    expect(screen.getByTestId('readout-T1.related')).toHaveTextContent('占有序配對之 5 / 240');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m05');
    expect(document.activeElement).toBe(document.body);
  });
});
