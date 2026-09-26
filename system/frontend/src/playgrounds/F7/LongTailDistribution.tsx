import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import {
  clamp, flag, formatRatio, harmonic, headShare, measuredHeadShare, predicateLabels, ranked, tailToHead,
} from '../logic';
import { VG_FRAMES } from '../slice';

/**
 * F7 — Predicate 的長尾分布.
 *
 * The shape of the data and nothing about any model. s shapes n_p ∝ p^(−s), C sets how many
 * classes share it, k marks the head, and every readout is a ratio of counts. γ, R and mR are
 * absent on purpose: under the rule this cycle kept, what recall does on this shape is L3's to
 * score, and L3 has the same s control.
 */
const RANK = ranked(predicateLabels(VG_FRAMES));
const TOTAL = RANK.reduce((n, c) => n + c.count, 0);
const S_MAX = 2.4;
const C_MIN = 4;
const C_MAX = 50;
const BAR = 10;
const GAP = 4;
const HEIGHT = 120;

export function LongTailDistribution() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F7.s': 1,
    'F7.C': RANK.length,
    'F7.k': 3,
    'F7.measured': 0,
  });
  const s = clamp(params['F7.s'], 0, S_MAX);
  const C = Math.round(clamp(params['F7.C'], C_MIN, C_MAX));
  const k = Math.round(clamp(params['F7.k'], 1, C));
  const overlay = flag(params['F7.measured'], false);

  const H = harmonic(C, s);
  const model = Array.from({ length: C }, (_, i) => (i + 1) ** -s / H);
  const measured = RANK.map((c) => c.count / TOTAL);
  const headCount = RANK.slice(0, Math.min(k, RANK.length)).reduce((n, c) => n + c.count, 0);
  const bars = Math.max(C, overlay ? RANK.length : 0);
  const top = Math.max(model[0] ?? 0, overlay ? measured[0] ?? 0 : 0) || 1;
  const h = (v: number) => (v / top) * HEIGHT;

  const controls = (
    <>
      <Slider
        id="F7.s"
        label={t('playground.f7.s')}
        value={s}
        min={0}
        max={S_MAX}
        step={0.05}
        onChange={(next) => setParams({ 'F7.s': next })}
        valueLabel={s.toFixed(2)}
      />
      <Slider
        id="F7.C"
        label={t('playground.f7.classes')}
        value={C}
        min={C_MIN}
        max={C_MAX}
        step={1}
        onChange={(next) => setParams({ 'F7.C': next })}
        valueLabel={String(C)}
      />
      <Slider
        id="F7.k"
        label={t('playground.f7.head')}
        value={k}
        min={1}
        max={C}
        step={1}
        onChange={(next) => setParams({ 'F7.k': next })}
        valueLabel={String(k)}
      />
      <Toggle
        id="F7.measured"
        label={t('playground.f7.overlay')}
        checked={overlay}
        onChange={(on) => setParams({ 'F7.measured': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F7" controls={controls} clip={false}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Readout
            id="F7.head"
            label={t('playground.f7.head_share')}
            value={formatRatio(headShare(k, C, s))}
            note={`H_${k}(${s.toFixed(2)}) / H_${C}(${s.toFixed(2)})`}
          />
          <Readout
            id="F7.tail"
            label={t('playground.f7.tail')}
            value={formatRatio(tailToHead(C, s))}
            note={`${C}^(−${s.toFixed(2)})`}
          />
          {overlay && (
            <Readout
              id="F7.measured"
              label={t('playground.f7.measured_share')}
              value={formatRatio(measuredHeadShare(RANK, k))}
              note={`${headCount} / ${TOTAL}`}
            />
          )}
        </div>
        <p className="text-[0.875em] text-slate-700">{t('playground.f7.s_note')}</p>
        {/* The key above the chart it explains, so a short panel never shows bars without it. */}
        <p className="text-[0.875em] text-slate-700">
          {t('playground.f7.legend_model')}
          {overlay && <> · {t('playground.f7.legend_measured')}</>}
        </p>
        <svg
          data-testid="f7-bars"
          viewBox={`0 0 ${bars * (BAR + GAP)} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[6em] w-full"
          aria-hidden="true"
        >
          {overlay &&
            measured.map((v, i) => (
              // slate-600, not slate-400: a chart mark needs 3:1 against the frame (WCAG 1.4.11),
              // and slate-400 on slate-50 measured 2.51:1 at every panel size.
              <rect key={`m${i}`} x={i * (BAR + GAP) + 2} y={HEIGHT - h(v)} width={BAR - 4} height={h(v)} className="fill-slate-600" />
            ))}
          {model.map((v, i) => (
            <rect
              key={`p${i}`}
              x={i * (BAR + GAP)}
              y={HEIGHT - h(v)}
              width={BAR}
              height={h(v)}
              fill="none"
              className={i < k ? 'stroke-slate-900' : 'stroke-slate-500'}
              strokeWidth={i < k ? 2 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <p className="text-[0.875em] text-slate-700">{t('playground.f7.to_l3')}</p>
      </div>
    </PlaygroundFrame>
  );
}
