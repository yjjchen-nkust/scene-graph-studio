import { useMemo } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { GT, ONE_STAGE, RECONSTRUCTED_NOTE_EN, TWO_STAGE } from './fixture';
import { PUBLISHED_DIRECTION, rankings, scoreBoth, type Scored } from './forensics';

/**
 * L6 — one methodological choice, two rankings.
 *
 * The lab demonstrates the **mechanism** of the ECCV 2024 mask-pairing correction, not a
 * reproduction of the published table: its predictions are reconstructed to exhibit the
 * duplicate-mask behaviour, and its scene is four pixels. The published direction sits in its own
 * panel because those figures are on the full PSG test set and this one is not.
 *
 * If plan 03 Task 3's spike ever produces real Motifs and PSGFormer output, the standing note
 * changes to say so and the fidelity chips change with it. D-07 made provenance a data field
 * precisely so that nothing else has to change.
 */
export function ProtocolForensics() {
  const { locale, t } = useLocale();
  const en = locale === 'en';

  const rows: Scored[] = useMemo(() => {
    const one = scoreBoth(GT, ONE_STAGE);
    const two = scoreBoth(GT, TWO_STAGE);
    return [
      {
        key: 'one-stage',
        label: t('l6.one_stage'),
        family: 'one_stage',
        single: one.single * 100,
        multi: one.multi * 100,
        fidelity: 'reconstructed',
        note: RECONSTRUCTED_NOTE_EN,
      },
      {
        key: 'two-stage',
        label: t('l6.two_stage'),
        family: 'two_stage',
        single: two.single * 100,
        multi: two.multi * 100,
        fidelity: 'reconstructed',
        note: RECONSTRUCTED_NOTE_EN,
      },
    ];
  }, [t]);

  const { byMulti, bySingle, moved } = rankings(rows);

  const column = (title: string, testid: string, list: Scored[], pick: (r: Scored) => number) => (
    <div data-testid={testid} className="flex-1">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <ol className="space-y-1">
        {list.map((row, i) => (
          <li
            key={row.key}
            {...(moved.has(row.key) ? { 'data-testid': `moved-${testid}-${row.key}` } : {})}
            className={`flex items-baseline justify-between rounded px-2 py-1 text-sm ${
              moved.has(row.key) ? 'bg-amber-100 ring-1 ring-amber-400' : 'bg-slate-50'
            }`}
          >
            <span>
              {i + 1}. {row.label}
            </span>
            <span data-figure={`lab-${testid}-${row.key}`} className="font-mono">
              <span data-fidelity={row.fidelity}>{pick(row).toFixed(1)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l6.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l6.subheading')}</p>
      </header>

      {/* Not collapsible, and not below the table. A reader who meets the numbers first has
          already read them as a benchmark. */}
      <p
        data-testid="standing-note"
        className="rounded border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900"
      >
        {t('l6.standing_note')}
      </p>

      <section data-testid="panel-own" className="space-y-3 rounded border-2 border-blue-300
        bg-blue-50 p-4">
        <h2 className="text-base font-semibold text-slate-900">{t('l6.own_heading')}</h2>
        <div className="flex flex-col gap-6 sm:flex-row">
          {column(t('l6.under_multi'), 'rank-multi', byMulti, (r) => r.multi)}
          {column(t('l6.under_single'), 'rank-single', bySingle, (r) => r.single)}
        </div>
        <p className="text-xs text-slate-700">{t('l6.moved_legend')}</p>
        <p className="text-xs text-slate-600">{rows[0]?.note}</p>
      </section>

      <section
        data-testid="panel-published"
        className="space-y-2 rounded border-2 border-slate-300 bg-slate-50 p-4"
      >
        <h2 className="text-base font-semibold text-slate-900">{t('l6.published_heading')}</h2>
        <p className="text-xs text-slate-600">{t('l6.published_note')}</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 font-medium">{t('l6.method')}</th>
              <th className="py-1 font-medium">multi_mpo</th>
              <th className="py-1 font-medium">single_mpo</th>
            </tr>
          </thead>
          <tbody>
            {PUBLISHED_DIRECTION.map((row) => (
              <tr key={row.method} className="border-t border-slate-200">
                <td className="py-1">{row.method}</td>
                <td data-figure={`pub-multi-${row.method}`} className="py-1 font-mono">
                  {row.before === null ? (
                    <span className="text-slate-500">{t('l6.unchanged')}</span>
                  ) : (
                    <span data-fidelity="published">{row.before.toFixed(2)}</span>
                  )}
                </td>
                <td data-figure={`pub-single-${row.method}`} className="py-1 font-mono">
                  {row.after === null ? (
                    <span className="text-slate-500">{t('l6.unchanged')}</span>
                  ) : (
                    <span data-fidelity="published">{row.after.toFixed(2)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-700">{en ? '' : ''}</p>
      </section>
    </div>
  );
}
