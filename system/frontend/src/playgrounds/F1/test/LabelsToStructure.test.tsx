import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { LabelsToStructure } from '../LabelsToStructure';

beforeEach(() => setLocale('en'));

function at(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/m/m00${search}`]}>
      <LabelsToStructure />
    </MemoryRouter>,
  );
}

// A layer toggle given a value that is neither 0 nor 1. `=== 1` read it as off, which for these
// three knobs is the opposite of the default, so `?F1.labels=7` silently turned a layer off.
function outOfRangeLayer() {
  render(
    <MemoryRouter initialEntries={['/m/m00?F1.labels=7&F1.boxes=9']}>
      <LabelsToStructure />
    </MemoryRouter>,
  );
}

describe('F1', () => {
  it('computes the bound and the share from the frame, at full density', () => {
    at('');
    expect(screen.getByTestId('readout-F1.objects-value')).toHaveTextContent('6');
    expect(screen.getByTestId('readout-F1.annotated-value')).toHaveTextContent('6');
    expect(screen.getByTestId('readout-F1.candidates-value')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-F1.ratio-value')).toHaveTextContent('1.25%');
  });

  it('shows the arithmetic beside the number rather than only the number', () => {
    at('');
    expect(screen.getByTestId('readout-F1.candidates')).toHaveTextContent('6 × 5 × 16');
  });

  it('moves only the annotated count when density falls, never the bound', () => {
    at('?F1.density=0.5');
    expect(screen.getByTestId('readout-F1.annotated-value')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-F1.candidates-value')).toHaveTextContent('480');
  });

  // Review Focus 4.
  it('reports 0.00% at zero density, not NaN', () => {
    at('?F1.density=0');
    expect(screen.getByTestId('readout-F1.annotated-value')).toHaveTextContent('0');
    expect(screen.getByTestId('readout-F1.ratio-value')).toHaveTextContent('0.00%');
  });

  // Review Focus 1.
  it('clamps a density the URL put out of range', () => {
    at('?F1.density=5');
    expect(screen.getByTestId('readout-F1.annotated-value')).toHaveTextContent('6');
    at('?F1.density=-1');
    expect(screen.getAllByTestId('readout-F1.annotated-value')[1]).toHaveTextContent('0');
  });

  it('clamps a negative density rather than letting it index from the end', () => {
    // The two cases above cannot fail if the clamp is deleted: `slice(0, 30)` returns all six
    // and `slice(0, -6)` returns none, which is what clamping produces anyway. A negative
    // density whose magnitude is smaller than |E| is where the two part company -- unclamped,
    // `Math.round(-0.5 * 6) = -3` makes `slice(0, -3)` return the FIRST THREE edges, so a URL
    // asking for less than nothing would display half the graph.
    at('?F1.density=-0.5');
    expect(screen.getByTestId('readout-F1.annotated-value')).toHaveTextContent('0');
  });

  it('falls back to the slice vocabulary when the URL names a |P| that is not on offer', () => {
    at('?F1.P=0');
    expect(screen.getByTestId('readout-F1.candidates-value')).toHaveTextContent('480');
  });

  it('recomputes the bound against VG-150 when asked, and says where 50 comes from', () => {
    at('?F1.P=50');
    // 6 x 5 x 50 = 1500; 6 / 1500 = 0.40%.
    expect(screen.getByTestId('readout-F1.candidates-value')).toHaveTextContent('1500');
    expect(screen.getByTestId('readout-F1.ratio-value')).toHaveTextContent('0.40%');
    expect(screen.getByLabelText('|P|')).toHaveValue('50');
  });

  it('does not take focus when it mounts', () => {
    at('');
    expect(document.activeElement).toBe(document.body);
  });

  it('reads a layer value the URL invented as the default, not as its opposite', () => {
    outOfRangeLayer();
    // Six of six, not "more than none": ph-001 carries six objects and each layer draws one
    // mark per object, so a layer that half rendered would satisfy a floor of zero.
    expect(screen.getAllByTestId(/^label-/)).toHaveLength(6);
    expect(screen.getAllByTestId(/^box-/)).toHaveLength(6);
  });
});
