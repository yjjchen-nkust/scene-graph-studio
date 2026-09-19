import { line, scaleLinear } from 'd3';
import { useId } from 'react';

export interface Series {
  key: string;
  label: string;
  colour: string;
  dash: string;
  points: Array<{ k: number; value: number | null }>;
}

const WIDTH = 420;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };

/**
 * R and mR against K, on one axis.
 *
 * One axis is the point. The gap between the two curves is the head-predicate effect, and it is
 * the thing the module argues about; two charts side by side, or two numbers to subtract, make
 * the reader do the comparison that the picture is supposed to be doing for them.
 *
 * A polyline, not a spline. The metric is defined at integer K and nowhere else, so a smoothed
 * curve would draw values between the samples that the definition does not have. Step-like
 * plateaus are what R@K genuinely looks like, and flattening them into a nice curve would be
 * drawing a claim rather than a measurement.
 *
 * d3 is used for its scales and its path generator and not for the DOM: React owns the elements,
 * which is what keeps the chart inspectable by the same queries as everything else.
 */
export function MetricCurve({ series, className = '' }: { series: Series[]; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const ks = [...new Set(series.flatMap((s) => s.points.map((p) => p.k)))].sort((a, b) => a - b);
  const x = scaleLinear()
    .domain([ks[0] ?? 0, ks[ks.length - 1] ?? 1])
    .range([PAD.left, WIDTH - PAD.right]);
  const y = scaleLinear()
    .domain([0, 1])
    .range([HEIGHT - PAD.bottom, PAD.top]);

  const path = line<{ k: number; value: number | null }>()
    .defined((p) => p.value !== null)
    .x((p) => x(p.k))
    .y((p) => y(p.value ?? 0));

  return (
    <svg
      data-testid="metric-curve"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`w-full ${className}`}
      role="img"
      aria-label={series.map((s) => s.label).join(', ')}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text x={4} y={y(v) + 4} className="fill-slate-500 text-[10px]">
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      {ks.map((k) => (
        <text key={k} x={x(k)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
          {k}
        </text>
      ))}
      {series.map((s) => {
        const d = path(s.points);
        return d ? (
          <path
            key={s.key}
            id={`${uid}-${s.key}`}
            data-series={s.key}
            d={d}
            fill="none"
            stroke={s.colour}
            strokeWidth={2}
            strokeDasharray={s.dash || undefined}
          />
        ) : null;
      })}
      {series.map((s, i) => (
        <g key={`legend-${s.key}`} transform={`translate(${PAD.left + 8}, ${PAD.top + 6 + i * 14})`}>
          <line x1={0} x2={18} y1={0} y2={0} stroke={s.colour} strokeWidth={2} strokeDasharray={s.dash || undefined} />
          <text x={24} y={4} className="fill-slate-700 text-[10px]">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
