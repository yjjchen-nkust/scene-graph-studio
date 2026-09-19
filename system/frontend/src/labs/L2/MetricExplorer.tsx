import { useMemo } from 'react';
import type { Constraint, MaskPairing, Protocol, SceneGraph } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { MetricReadout } from '../../components/MetricReadout';
import { WarningList } from '../../components/WarningList';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../useLabParams';
import { CURVE_STYLE } from './curveStyle';
import { MetricCurve } from './MetricCurve';
import { underProtocol } from './protocol';

const PROTOCOLS: Protocol[] = ['sgdet', 'sgcls', 'predcls'];
const CONSTRAINTS: Constraint[] = ['graph', 'semi', 'none'];
/** The K values the curve samples. R@K is defined at integers, so these are points, not a range. */
const CURVE_KS = [1, 2, 3, 5, 10, 20, 50, 100];
const METRICS = ['R', 'mR', 'ngR', 'zR'] as const;

/**
 * L2 — the same prediction, scored four ways, with every knob that changes the answer exposed.
 *
 * The lab's argument is that a recall figure is not a fact until the protocol, the constraint
 * mode, K and τ are all named. So every one of them is a control, every one writes to the URL,
 * and every metric is rendered through `MetricReadout`, which will not accept a bare number.
 *
 * The protocol knob rewrites the *prediction* through `underProtocol` before scoring, because
 * that is where the protocol acts. The engine treats `protocol` as a tag and never reads it, so
 * a knob that only passed the value through would move nothing at all.
 */
export function MetricExplorer({ gt, pred }: { gt: SceneGraph; pred: SceneGraph }) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    k: 50,
    protocol: 'predcls' as string,
    constraint: 'graph' as string,
    tau: 0.5,
    pairing: 'single_mpo' as string,
  });

  const protocol = (PROTOCOLS as string[]).includes(params.protocol)
    ? (params.protocol as Protocol)
    : 'predcls';
  const constraint = (CONSTRAINTS as string[]).includes(params.constraint)
    ? (params.constraint as Constraint)
    : 'graph';
  const pairing: MaskPairing = params.pairing === 'multi_mpo' ? 'multi_mpo' : 'single_mpo';
  const k = Math.min(100, Math.max(1, Math.round(params.k)));
  const tau = Math.min(0.95, Math.max(0.05, params.tau));

  const hasMasks = useMemo(
    () => gt.objects.some((o) => o.mask) && pred.objects.some((o) => o.mask),
    [gt, pred],
  );

  const scored = useMemo(() => underProtocol(gt, pred, protocol), [gt, pred, protocol]);

  const result = useMemo(
    () =>
      evaluate({
        gt,
        pred: scored,
        protocol,
        constraint,
        k: [...new Set([k, ...CURVE_KS])],
        iou_thresh: tau,
        mask_pairing: pairing,
      }),
    [gt, scored, protocol, constraint, k, tau, pairing],
  );

  const at = (metric: (typeof METRICS)[number]) =>
    result.metrics.find((m) => m.metric === metric && m.k === k) ?? null;

  const series = (['R', 'mR'] as const).map((metric) => ({
    key: metric,
    label: `${metric === 'mR' ? 'mR' : 'R'}@K`,
    colour: CURVE_STYLE[metric].colour,
    dash: CURVE_STYLE[metric].dash,
    points: CURVE_KS.map((kk) => ({
      k: kk,
      value: result.metrics.find((m) => m.metric === metric && m.k === kk)?.value ?? null,
    })),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <section className="space-y-5">
        <label className="block text-sm">
          <span className="text-slate-600">
            K <span className="font-mono text-slate-900">{k}</span>
          </span>
          <input
            data-testid="k"
            type="range"
            min={1}
            max={100}
            step={1}
            value={k}
            list="l2-k-ticks"
            onChange={(e) => setParams({ k: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          <datalist id="l2-k-ticks">
            {[20, 50, 100].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>

        <fieldset>
          <legend className="text-sm text-slate-600">{t('l2.protocol')}</legend>
          <div className="mt-1 flex gap-3">
            {PROTOCOLS.map((p) => (
              <label key={p} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="protocol"
                  value={p}
                  checked={protocol === p}
                  onChange={() => setParams({ protocol: p })}
                />
                <span className="font-mono">{p}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-slate-600">{t('l2.constraint')}</legend>
          <div className="mt-1 flex gap-3">
            {CONSTRAINTS.map((c) => (
              <label key={c} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="constraint"
                  value={c}
                  checked={constraint === c}
                  onChange={() => setParams({ constraint: c })}
                />
                <span className="font-mono">{c}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="text-slate-600">
            τ <span className="font-mono text-slate-900">{tau.toFixed(2)}</span>
          </span>
          <input
            data-testid="tau"
            type="range"
            min={0.05}
            max={0.95}
            step={0.05}
            value={tau}
            onChange={(e) => setParams({ tau: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          {/* SRS §4.1: 0.5 is what the field uses, and METRICS.md does not state it. A student
              who thinks it is part of the definition will misread every published table. */}
          <span data-testid="tau-note" className="mt-1 block text-xs text-slate-500">
            {t('l2.tau_note')}
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-slate-600">{t('l2.mask_pairing')}</span>
          <select
            value={pairing}
            disabled={!hasMasks}
            onChange={(e) => setParams({ pairing: e.target.value })}
            className="mt-1 block rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          >
            <option value="single_mpo">single_mpo</option>
            <option value="multi_mpo">multi_mpo</option>
          </select>
          {hasMasks ? null : (
            <span data-testid="mask-pairing-reason" className="mt-1 block text-xs text-slate-500">
              {t('l2.mask_pairing.absent')}
            </span>
          )}
        </label>
      </section>

      <section className="space-y-5">
        <dl className="grid grid-cols-2 gap-4">
          {METRICS.map((metric) => {
            const value = at(metric);
            return (
              <div key={metric} data-testid={`metric-${metric}`}>
                {value ? (
                  <MetricReadout
                    value={value}
                    reason={metric === 'zR' ? t('l2.zr_absent') : undefined}
                  />
                ) : null}
              </div>
            );
          })}
        </dl>

        <MetricCurve series={series} className="rounded border border-slate-200 bg-white" />

        <WarningList warnings={result.warnings} />
      </section>
    </div>
  );
}
