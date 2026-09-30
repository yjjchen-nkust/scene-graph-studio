import { Fragment } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { TRADITIONAL, VLM, frameLabel, type VlmFrame } from '../data';
import { bySubject, countText, predicateHistogram, traditionalTriplets } from '../logic';
import { outgoing } from './terms';

const CELL = 'py-0.5 pr-4';

/**
 * D-V, part 4: the summary.
 *
 * Step 3's summary for the chosen frame, triplets only, as text: each subject once, in the order
 * it first appears, above its rows written `predicate → object`, in the summary's order and with
 * any repeat kept, since the part counts rows. The method returns no geometry, and the caption
 * says so. Beside it one table of the predicates both pipelines produced over the ten frames,
 * counted in rows: D-T's relations and the rows of D-V's summaries. Predicates of P come in the
 * prompt's order, which part 1 showed, then any other by its count. A summary with no triplet says
 * so.
 *
 * Not a node-link drawing (D116): `SceneGraphView` draws its labels on a canvas at 12 px times its
 * fit zoom, about 8 to 15 px on a 1024×768 panel, below the 18 px floor, and the lecture's sweeps
 * cannot measure text on a canvas. Grouped by subject, the list keeps what the drawing showed,
 * which entity each relation leaves from, in text the floor holds.
 */
export function Part4({ frame }: { frame: VlmFrame }) {
  const { t } = useLocale();
  const groups = bySubject(frame.summary);
  const dt = new Map(predicateHistogram(TRADITIONAL.frames.flatMap(traditionalTriplets)));
  const dv = new Map(predicateHistogram(VLM.frames.flatMap((f) => f.summary)));
  const rank = (p: string) => (VLM.P.includes(p) ? VLM.P.indexOf(p) : VLM.P.length);
  const total = (p: string) => (dt.get(p) ?? 0) + (dv.get(p) ?? 0);
  const predicates = [...new Set([...dv.keys(), ...dt.keys()])].sort(
    (a, b) => rank(a) - rank(b) || total(b) - total(a) || (a < b ? -1 : a > b ? 1 : 0),
  );

  return (
    <div className="flex flex-col gap-3 text-[0.75em] leading-tight text-slate-900 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p data-testid="dv-no-geometry" className="text-slate-700">
          {t('demo.dv.summary_caption')
            .replace('{time}', frameLabel(frame.image_id))
            .replace('{rows}', countText(frame.summary.length))}
        </p>
        {groups.length === 0 ? (
          <p data-testid="dv-summary-none">{t('demo.dv.no_triplet')}</p>
        ) : (
          <dl data-testid="dv-summary" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {groups.map(({ subject, rows }, k) => (
              <Fragment key={subject}>
                <dt data-testid={`dv-summary-subject-${k}`} className="whitespace-nowrap font-semibold">{`${subject}:`}</dt>
                <dd>
                  <ul data-testid={`dv-summary-rows-${k}`}>
                    {rows.map((row, i) => (
                      // A row may repeat, so its place is part of its key.
                      <li key={`${i}:${row.join('|')}`} data-triplet={row.join('|')}>{outgoing(row)}</li>
                    ))}
                  </ul>
                </dd>
              </Fragment>
            ))}
          </dl>
        )}
      </div>
      <div className="flex flex-col gap-1 lg:shrink-0">
        <table data-testid="dv-hist" className="border-collapse">
          <caption className="whitespace-nowrap text-left font-semibold">
            {t('demo.dv.hist_caption').replace('{frames}', String(VLM.frames.length))}
          </caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className={`${CELL} text-left font-semibold`}>{t('demo.dv.predicate')}</th>
              <th scope="col" className={`${CELL} text-right font-semibold`}>{t('demo.dv.rows_dt')}</th>
              <th scope="col" className="py-0.5 text-right font-semibold">{t('demo.dv.rows_dv')}</th>
            </tr>
          </thead>
          <tbody>
            {predicates.map((p) => (
              <tr key={p} data-testid={`dv-hist-${p}`}>
                <th scope="row" className={`${CELL} whitespace-nowrap text-left font-normal`}>{p}</th>
                <td data-testid={`dv-hist-${p}-dt`} className={`${CELL} text-right tabular-nums`}>
                  {countText(dt.get(p) ?? 0)}
                </td>
                <td data-testid={`dv-hist-${p}-dv`} className="py-0.5 text-right tabular-nums">
                  {countText(dv.get(p) ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="max-w-[20em] text-slate-700">{t('demo.dv.hist_note')}</p>
      </div>
    </div>
  );
}
