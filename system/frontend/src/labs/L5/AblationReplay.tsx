import { useLocale } from '../../i18n/useLocale';
import { PUBLISHED_NOTE, SOURCE, TABLE3_READING, type Table3Row } from './tables';
import type { OwnRun } from './types';

/**
 * Table 3 beside the student's own run, in two panels that never become one.
 *
 * The rule is structural: a `[data-figure]` element holds figures of one fidelity or of none.
 * Nesting a published number and a student's inside one element is what the separation exists to
 * prevent, and a test walks the DOM for it rather than trusting the layout.
 *
 * **The student's panel carries no recall figure, and says why.** Plan 03 Task 8 assumes the two
 * panels hold comparable numbers. They cannot: R@20 needs ground truth, this corpus has none for
 * the Figure 2 frame, and a number invented to fill the column would be the exact fabrication the
 * provenance apparatus exists to stop. The panel shows what the run produced -- the triplets --
 * and states the absence. DEVIATIONS D40.
 */
export function AblationReplay({ published, own }: { published: Table3Row[]; own: OwnRun }) {
  const { locale, t } = useLocale();
  const en = locale === 'en';

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article
        data-testid="panel-published"
        className="rounded border-2 border-slate-300 bg-slate-50 p-4"
      >
        <h3 className="mb-1 text-base font-semibold text-slate-900">{t('l5.published_heading')}</h3>
        <p className="mb-3 text-xs text-slate-600">{en ? PUBLISHED_NOTE.en : PUBLISHED_NOTE.zh}</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 font-medium">O</th>
              <th className="py-1 font-medium">P</th>
              <th className="py-1 font-medium">E</th>
              <th className="py-1 font-medium">R@20</th>
              <th className="py-1 font-medium">mR@50</th>
            </tr>
          </thead>
          <tbody>
            {published.map((row) => (
              <tr key={row.components || 'none'} data-testid={`t3-row-${row.components || 'none'}`}
                  className="border-t border-slate-200">
                <td className="py-1">{row.O ? '✓' : '✗'}</td>
                <td className="py-1">{row.P ? '✓' : '✗'}</td>
                <td className="py-1">{row.E ? '✓' : '✗'}</td>
                {/* One fidelity per figure element, always. */}
                <td data-figure="published-r20" className="py-1 font-mono">
                  <span data-fidelity="published">{row.r_at_20.toFixed(3)}</span>
                </td>
                <td data-figure="published-mr50" className="py-1 font-mono">
                  <span data-fidelity="published">{row.mr_at_50.toFixed(3)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-600">
          {t('l5.read_from')}: <span className="font-mono">{SOURCE}</span>, Table 3
        </p>
        <p className="mt-2 text-xs text-slate-700">{en ? TABLE3_READING.en : TABLE3_READING.zh}</p>
      </article>

      <article
        data-testid="panel-own"
        className="rounded border-2 border-blue-300 bg-blue-50 p-4"
      >
        <h3 className="mb-1 text-base font-semibold text-slate-900">{t('l5.own_heading')}</h3>
        <p className="mb-3 text-xs text-slate-600">
          {t('l5.own_components')}: <span className="font-mono">{own.components || '—'}</span>
        </p>
        <ul data-figure="own-triplets" className="space-y-1 font-mono text-sm">
          {own.triplets.map(([s, p, o], i) => (
            <li key={i} data-fidelity={own.fidelity}>
              &lt;{s}, {p}, {o}&gt;
            </li>
          ))}
        </ul>
        {own.triplets.length === 0 ? (
          <p className="text-sm text-slate-600">{t('l5.own_empty')}</p>
        ) : null}
        <p data-testid="no-metric" className="mt-3 rounded bg-white/70 p-2 text-xs text-slate-700">
          {t('l5.no_metric')}
        </p>
        {own.note ? (
          <p data-testid="own-note" className="mt-2 text-xs text-slate-600">
            {own.note}
          </p>
        ) : null}
      </article>
    </section>
  );
}
