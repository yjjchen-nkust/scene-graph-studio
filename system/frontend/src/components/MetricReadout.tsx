import type { MetricValue } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';

const LABEL: Record<MetricValue['metric'], string> = {
  R: 'R',
  mR: 'mR',
  ngR: 'ng-R',
  zR: 'zR',
};

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
 * `verified` and `fidelity` reach the DOM as data attributes so the unverified and reconstructed
 * styles are applied by CSS rather than by each caller remembering to (NFR-2, D-07).
 */
export function MetricReadout({ value, reason }: { value: MetricValue; reason?: string }) {
  const { t } = useLocale();
  // `predcls`, `sgcls`, `sgdet`, `graph`, `none` and `semi` are terms of art and stay verbatim in
  // both languages, as the course teaches them. `unstated` is not a term of art: it is a sentence
  // about the source, so it is translated. D34.
  const tag = (v: string) => (v === 'unstated' ? t('metric.unstated') : v);
  const shown = value.value === null ? '—' : (value.value * 100).toFixed(1);
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
