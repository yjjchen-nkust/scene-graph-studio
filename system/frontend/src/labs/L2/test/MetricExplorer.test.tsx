import { fireEvent, render, screen } from '@testing-library/react';
import type { Constraint, Protocol } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { GT, PRED } from '../fixture';
import { underProtocol } from '../protocol';
import { MetricExplorer } from '../MetricExplorer';

function metricFor(
  k: number,
  metric: 'R' | 'mR' | 'ngR' | 'zR',
  constraint: Constraint,
  protocol: Protocol = 'predcls',
  tau = 0.5,
): number {
  const result = evaluate({
    gt: GT,
    pred: underProtocol(GT, PRED, protocol),
    protocol,
    constraint,
    k: [k],
    iou_thresh: tau,
    mask_pairing: 'single_mpo',
  });
  return result.metrics.find((m) => m.metric === metric && m.k === k)!.value!;
}

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/lab/L2') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <MetricExplorer gt={GT} pred={PRED} />
      <Address />
    </MemoryRouter>,
  );
}

const query = () => new URLSearchParams(screen.getByTestId('address').textContent ?? '');

beforeEach(() => {
  setLocale('en');
});

// ── the invariants SRS §11.2 says are asserted in the test suite ─────────────────────────────
//
// Asserted over the lab's own fixture, so a regression in the engine shows up as a broken
// lesson and not only as a failing engine test. Each is checked to be non-trivial as well as
// true: an invariant that holds because both sides are equal for every input teaches nothing
// and would survive the rule being deleted.

describe('the invariants', () => {
  it('R@K is monotone in K', () => {
    const values = [20, 50, 100].map((k) => metricFor(k, 'R', 'graph'));
    expect(values[0]!).toBeLessThanOrEqual(values[1]!);
    expect(values[1]!).toBeLessThanOrEqual(values[2]!);
  });

  it('R@K actually rises somewhere in K, so the monotonicity above is not vacuous', () => {
    const small = metricFor(1, 'R', 'graph');
    const large = metricFor(4, 'R', 'graph');
    expect(small).toBeLessThan(large);
  });

  it('dropping the graph constraint cannot lower recall', () => {
    expect(metricFor(50, 'R', 'none')).toBeGreaterThanOrEqual(metricFor(50, 'R', 'graph'));
  });

  it('and on this fixture it strictly raises it', () => {
    expect(metricFor(50, 'R', 'none')).toBeGreaterThan(metricFor(50, 'R', 'graph'));
  });

  it('the protocol ordering invariant holds on this fixture', () => {
    // R_SGDet <= R_SGCls <= R_PredCls on this fixture, which was built to lose something at each
    // protocol. The ordering is observed, not implied, and no test asserts it for every model (D98).
    expect(metricFor(50, 'R', 'graph', 'sgdet')).toBeLessThanOrEqual(
      metricFor(50, 'R', 'graph', 'sgcls'),
    );
    expect(metricFor(50, 'R', 'graph', 'sgcls')).toBeLessThanOrEqual(
      metricFor(50, 'R', 'graph', 'predcls'),
    );
  });

  it('and both steps of that ordering are strict here, so the knob is not a relabelling', () => {
    // The engine never reads `protocol`; it is a tag. If the lab did not degrade the prediction
    // itself, these three numbers would be one number and the invariant above would hold by
    // equality for any fixture whatsoever. See DEVIATIONS.md D27.
    expect(metricFor(50, 'R', 'graph', 'sgdet')).toBeLessThan(metricFor(50, 'R', 'graph', 'sgcls'));
    expect(metricFor(50, 'R', 'graph', 'sgcls')).toBeLessThan(
      metricFor(50, 'R', 'graph', 'predcls'),
    );
  });

  it('raising tau cannot raise recall', () => {
    expect(metricFor(50, 'R', 'graph', 'sgdet', 0.75)).toBeLessThanOrEqual(
      metricFor(50, 'R', 'graph', 'sgdet', 0.5),
    );
  });

  it('and raising it strictly lowers recall here, because one box sits between the two', () => {
    expect(metricFor(50, 'R', 'graph', 'sgdet', 0.75)).toBeLessThan(
      metricFor(50, 'R', 'graph', 'sgdet', 0.5),
    );
  });

  it('mean recall differs from recall, which is the reason mR is reported at all', () => {
    expect(metricFor(50, 'mR', 'graph')).not.toBe(metricFor(50, 'R', 'graph'));
  });
});

describe('underProtocol', () => {
  it('leaves an SGDet prediction exactly as the model made it', () => {
    expect(underProtocol(GT, PRED, 'sgdet')).toBe(PRED);
  });

  it('gives SGCls the boxes but not the labels', () => {
    const out = underProtocol(GT, PRED, 'sgcls');
    expect(out.objects[1]!.bbox).toEqual(GT.objects[1]!.bbox);
    expect(out.objects[3]!.names).toEqual(['door']); // still the model's mistake
  });

  it('gives PredCls the boxes and the labels', () => {
    const out = underProtocol(GT, PRED, 'predcls');
    expect(out.objects[3]!.names).toEqual(['window']);
    expect(out.objects[0]!.bbox).toEqual(GT.objects[0]!.bbox);
  });

  it('gives nothing to a detection the ground truth does not contain', () => {
    const extra = {
      ...PRED,
      objects: [...PRED.objects, { object_id: 99, names: ['ghost'], bbox: { x: 0, y: 0, w: 5, h: 5 } }],
    };
    const out = underProtocol(GT, extra, 'predcls');
    expect(out.objects[4]).toEqual(extra.objects[4]);
  });
});

describe('MetricExplorer', () => {
  it('reports every metric through MetricReadout, tagged with protocol and constraint', () => {
    mount();
    const recall = screen.getByTestId('metric-R');
    expect(recall.textContent).toContain('R@50');
    expect(recall.textContent).toContain('predcls');
    expect(recall.textContent).toContain('graph');
    for (const m of ['mR', 'ngR', 'zR']) expect(screen.getByTestId(`metric-${m}`)).toBeInTheDocument();
  });

  it('shows the number the engine computes, for the controls in the URL', () => {
    mount('/lab/L2?k=50&protocol=sgdet&constraint=graph&tau=0.5');
    const shown = (metricFor(50, 'R', 'graph', 'sgdet') * 100).toFixed(1);
    expect(screen.getByTestId('metric-R').textContent).toContain(shown);
  });

  it('moves the number when the protocol knob moves, and says so in the URL', () => {
    mount('/lab/L2?protocol=sgdet');
    const before = screen.getByTestId('metric-R').textContent;
    fireEvent.click(screen.getByRole('radio', { name: /sgcls/i }));
    expect(query().get('protocol')).toBe('sgcls');
    expect(screen.getByTestId('metric-R').textContent).not.toBe(before);
  });

  it('writes the default protocol as an absent key, not an explicit one', () => {
    // A value equal to its default is one state, not two that render alike. `?protocol=sgdet`
    // returning to PredCls therefore clears the key rather than spelling it out.
    mount('/lab/L2?protocol=sgdet');
    fireEvent.click(screen.getByRole('radio', { name: /predcls/i }));
    expect(query().get('protocol')).toBeNull();
    expect(screen.getByTestId('metric-R').textContent).toContain('predcls');
  });

  it('moves the number when the constraint knob moves', () => {
    mount();
    const before = screen.getByTestId('metric-R').textContent;
    fireEvent.click(screen.getByRole('radio', { name: /^none$/i }));
    expect(query().get('constraint')).toBe('none');
    expect(screen.getByTestId('metric-R').textContent).not.toBe(before);
  });

  it('writes K to the URL and leaves the default out of it', () => {
    mount();
    expect(query().get('k')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^K\b/i), { target: { value: '2' } });
    expect(query().get('k')).toBe('2');
  });

  it('carries the PredCls warning beside the PredCls number', () => {
    mount('/lab/L2?protocol=predcls');
    expect(screen.getByTestId('warning-gt_boxes_not_pairs')).toBeInTheDocument();
  });

  it('drops the PredCls warning under SGDet, where it does not apply', () => {
    mount('/lab/L2?protocol=sgdet');
    expect(screen.queryByTestId('warning-gt_boxes_not_pairs')).toBeNull();
  });

  it('disables the mask-pairing toggle with a reason when the image has no masks', () => {
    mount();
    const toggle = screen.getByLabelText(/mask pairing/i);
    expect(toggle).toBeDisabled();
    expect(screen.getByTestId('mask-pairing-reason')).toBeInTheDocument();
  });

  it('says that 0.5 is convention rather than a stated rule', () => {
    mount();
    expect(screen.getByTestId('tau-note')).toBeInTheDocument();
  });

  it('draws R and mR on one axis, so the gap is the visible object', () => {
    mount();
    const curve = screen.getByTestId('metric-curve');
    expect(curve.querySelector('path[data-series="R"]')).not.toBeNull();
    expect(curve.querySelector('path[data-series="mR"]')).not.toBeNull();
  });

  it('plots one point per K on the axis, not a smoothed guess between them', () => {
    mount();
    const d = screen
      .getByTestId('metric-curve')
      .querySelector('path[data-series="R"]')!
      .getAttribute('d')!;
    // A polyline through the sampled K values: one move, then one line per remaining sample.
    expect(d.startsWith('M')).toBe(true);
    expect(d.includes('C')).toBe(false);
  });
});
