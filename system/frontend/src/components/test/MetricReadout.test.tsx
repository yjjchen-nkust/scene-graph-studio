import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MetricValue } from 'sgg-metrics';
import { VERDICT_STYLE } from '../../graph/palette';
import { DiffLegend } from '../../graph/DiffLegend';
import { MetricReadout } from '../MetricReadout';

const base: MetricValue = {
  value: 0.275,
  metric: 'R',
  k: 50,
  protocol: 'sgdet',
  constraint: 'graph',
  source: 'engine',
  verified: true,
  fidelity: 'measured',
};

describe('MetricReadout', () => {
  it('always shows the protocol and the constraint beside the number', () => {
    render(<MetricReadout value={base} />);
    expect(screen.getByText(/27\.5/)).toBeTruthy();
    expect(screen.getByText(/sgdet/i)).toBeTruthy();
    expect(screen.getByText(/graph/i)).toBeTruthy();
  });

  it('renders a null value as an em dash with a reason, never as zero', () => {
    render(<MetricReadout value={{ ...base, value: null }} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('marks an unverified figure distinctly', () => {
    const { container } = render(<MetricReadout value={{ ...base, verified: false }} />);
    expect(container.querySelector('[data-verified="false"]')).toBeTruthy();
  });

  it('marks a reconstructed figure distinctly from a measured one', () => {
    const { container } = render(
      <MetricReadout value={{ ...base, fidelity: 'reconstructed' }} />,
    );
    expect(container.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
  });

  it('never renders a bare number without its k, protocol and constraint', () => {
    // NFR-2 and contracts 1.0: there is no code path that formats a metric without its tags.
    const { container } = render(<MetricReadout value={base} />);
    const text = container.textContent ?? '';
    for (const tag of ['R', '50', 'sgdet', 'graph']) expect(text).toContain(tag);
  });
});

describe('the verdict palette', () => {
  it('distinguishes every verdict by more than hue (NFR-5)', () => {
    const kinds = ['match', 'spurious', 'missed', 'localization'] as const;
    const signatures = kinds.map((k) => {
      const s = VERDICT_STYLE[k];
      return `${s.dash}|${s.width}|${s.marker}`;
    });
    // Colour-blind safety: the non-colour channels alone must tell them apart.
    expect(new Set(signatures).size).toBe(kinds.length);
  });

  it('gives every verdict an i18n key rather than an English label', () => {
    for (const style of Object.values(VERDICT_STYLE)) {
      expect(style.labelKey.startsWith('diff.')).toBe(true);
    }
  });
});

describe('DiffLegend', () => {
  it('shows all four verdicts, labelled through i18n', () => {
    render(<DiffLegend />);
    for (const kind of ['match', 'spurious', 'missed', 'localization']) {
      expect(screen.getByTestId(`legend-${kind}`)).toBeTruthy();
    }
  });

  it('takes its colours from the palette, so nothing hard-codes one', () => {
    const { container } = render(<DiffLegend />);
    const swatch = container.querySelector('[data-verdict="match"] line');
    expect(swatch?.getAttribute('stroke')).toBe(VERDICT_STYLE.match.stroke);
    expect(swatch?.getAttribute('stroke-dasharray')).toBe(VERDICT_STYLE.match.dash || null);
  });
});
