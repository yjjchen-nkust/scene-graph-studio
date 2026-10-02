import type { MetricValue } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';
import { decimals } from '../playgrounds/logic';

const LABEL: Record<MetricValue['metric'], string> = {
  R: 'R',
  mR: 'mR',
  ngR: 'ng-R',
  zR: 'zR',
};

/**
 * The percentage a fraction stands for, shifted in decimal rather than multiplied in binary.
 *
 * `0.1298 * 100` is `12.979999999999999`, so a figure published as 12.98 would depend on which
 * side of it the rounding falls. Ten places of the fraction, eight of the percentage, absorb that
 * error and are more than any figure here carries; the exponent on the string is `decimals`'s
 * own device, for the same reason.
 */
function percentOf(fraction: number): number {
  return Number(`${fraction.toFixed(10)}e2`);
}

/**
 * Every place a published percentage carries, and never fewer than one.
 *
 * A quoted figure is never rounded: it prints at its source's precision. The frozen files carry it
 * as a JSON number, which keeps the two places of 12.98 but turns the `16.0` a table printed into
 * 16, so one place is the floor: every figure in `leaderboards.json` and `papers.json` is printed
 * with at least one. A source printing `12.90` would lose its zero here, and the corpus test in
 * `MetricReadout.test.tsx`, which compares every figure with the literal in its file, would say so.
 */
function publishedPlaces(percent: number): number {
  const fraction = percent.toFixed(8).replace(/0+$/, '').split('.')[1] ?? '';
  return Math.max(1, fraction.length);
}

/** One place for a figure computed here; its source's places for a figure quoted from a paper. */
function figure(value: number, fidelity: MetricValue['fidelity']): string {
  const percent = percentOf(value);
  return decimals(percent, fidelity === 'published' ? publishedPlaces(percent) : 1);
}

/**
 * The only component that renders a metric.
 *
 * It takes a `MetricValue` and there is no overload taking `number`. That refusal is how
 * contracts 1.0 enforces SRS 4.5: a bare number has no protocol and no constraint mode, and a
 * recall figure without both is not a fact about anything. Wanting to render one is always a
 * sign that the value lost its tags somewhere upstream.
 *
 * `null` renders as an em dash with a reason, never as `0.0` — those mean different things, and
 * a metric that does not apply under the current protocol is not a metric that scored zero.
 *
 * A `published` figure prints at the places its source printed, 12.98 and not 13.0; a figure
 * computed here prints at one. Both are shifted and rounded in decimal, a tie rounded up.
 *
 * `verified` and `fidelity` reach the DOM as data attributes so the unverified and reconstructed
 * styles are applied by CSS rather than by each caller remembering to (NFR-2, D-07).
 */
export function MetricReadout({ value, reason }: { value: MetricValue; reason?: string }) {
  const { t } = useLocale();
  // `predcls`, `sgcls`, `sgdet`, `graph`, `none` and `semi` are terms of art and stay verbatim in
  // both languages, as the course teaches them. `unstated` is not a term of art: it is a sentence
  // about the source, so it is translated. D34.
  const tag = (v: string) => (v === 'unstated' ? t('metric.unstated') : v);
  const shown = value.value === null ? '—' : figure(value.value, value.fidelity);
  const title =
    value.value === null
      ? (reason ?? t('metric.not_applicable'))
      : `${t('metric.source')}: ${value.source}`;
  return (
    <span
      className="inline-flex items-baseline gap-2 data-[verified=false]:opacity-70 data-[fidelity=reconstructed]:italic"
      data-verified={value.verified}
      data-fidelity={value.fidelity}
      title={title}
    >
      <span className="font-mono text-2xl">{shown}</span>
      <span className="text-sm text-slate-600">
        {LABEL[value.metric]}@{value.k} · {tag(value.protocol)} · {tag(value.constraint)}
      </span>
      {value.verified ? null : (
        <span className="text-xs uppercase tracking-wide text-amber-700">
          {t('metric.unverified')}
        </span>
      )}
    </span>
  );
}
