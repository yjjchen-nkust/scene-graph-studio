import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { TRADITIONAL, VLM, frameLabel, type TraditionalFrame } from '../data';
import { countText, fallbackCauses, predicateHistogram, relationSources, traditionalTriplets } from '../logic';

const CELL = 'py-0.5 pr-4';

/** One predicate histogram as a table, predicate and rows, or a row saying it is empty. */
function Histogram({ testid, caption, rows }: { testid: string; caption: string; rows: [string, number][] }) {
  const { t } = useLocale();
  return (
    <table data-testid={testid} className="border-collapse text-[0.75em] leading-tight text-slate-900">
      <caption className="whitespace-nowrap text-left font-semibold">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-300">
          <th scope="col" className={`${CELL} text-left font-semibold`}>{t('demo.dt.predicate')}</th>
          <th scope="col" className="py-0.5 text-right font-semibold">{t('demo.dt.rows')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td data-testid={`${testid}-empty`} colSpan={2} className="py-0.5 text-slate-700">
              {t('demo.dt.hist_empty')}
            </td>
          </tr>
        ) : (
          rows.map(([p, n]) => (
            <tr key={p}>
              <th scope="row" className={`${CELL} text-left font-normal`}>{p}</th>
              <td data-testid={`${testid}-${p}`} className="py-0.5 text-right tabular-nums">{countText(n)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/**
 * D-T, part 3: generic predicates.
 *
 * The chosen frame's predicate histogram beside the ten frames', each counting rows (one row per
 * relation, as a completion's histogram counts its rows); which pairs of this frame the class
 * pair prior classified and which fell back to the slice's most frequent predicate; and each of
 * the seven `P_ISG` predicates marked present or absent in D-T's output over the ten frames.
 *
 * Where the prior classified no pair the part says so in words, since a readout of 0 beside a
 * one-bar histogram would otherwise read as a fault of the part rather than of the pipeline; and
 * it counts the pairs that fell back under each of the recorder's two reasons (`fallbackCauses`):
 * a detected class with no counterpart in the slice, or two slice classes whose pair the prior's
 * frames never show.
 */
export function Part3({ frame }: { frame: TraditionalFrame }) {
  const { t, locale } = useLocale();
  const frames = TRADITIONAL.frames;
  const { prior, class_map: classMap } = TRADITIONAL;
  const here = predicateHistogram(traditionalTriplets(frame));
  const everywhere = predicateHistogram(frames.flatMap(traditionalTriplets));
  const produced = new Set(everywhere.map(([p]) => p));
  const sources = relationSources(frame);
  const causes = fallbackCauses(frame, classMap);
  const tenFrames = String(frames.length);
  const separator = locale === 'zh-TW' ? '、' : ', ';

  let finding = null;
  if (frame.relations.length === 0) {
    finding = (
      <p data-testid="dt-no-pairs" className="text-[0.75em] leading-tight text-slate-900">{t('demo.dt.no_pairs')}</p>
    );
  } else if (sources.fallback > 0) {
    const reasons = [
      {
        testid: 'dt-fallback-unmapped',
        n: causes.unmapped,
        text: t('demo.dt.cause_unmapped')
          .replace('{dataset}', prior.dataset)
          .replace('{classes}', causes.classes.join(separator)),
      },
      {
        testid: 'dt-fallback-unseen',
        n: causes.unseen,
        text: t('demo.dt.cause_unseen').replace('{dataset}', prior.dataset).replace('{frames}', String(prior.frames)),
      },
    ].filter((r) => r.n > 0);
    finding = (
      <div className="text-[0.75em] leading-tight text-slate-900">
        {sources.prior === 0 ? (
          <p data-testid="dt-prior-none">{t('demo.dt.prior_none').replace('{predicate}', prior.fallback)}</p>
        ) : (
          <p data-testid="dt-fallback-some">{t('demo.dt.fallback_some').replace('{predicate}', prior.fallback)}</p>
        )}
        <table data-testid="dt-causes" className="mt-0.5 border-collapse">
          <tbody>
            {reasons.map((r) => (
              <tr key={r.testid} data-testid={r.testid}>
                <td data-testid={`${r.testid}-count`} className="py-0.5 pr-3 text-right align-top tabular-nums">
                  {countText(r.n)}
                </td>
                <td className="py-0.5">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
          <Histogram
            testid="dt-hist-frame"
            caption={t('demo.dt.hist_frame').replace('{time}', frameLabel(frame.image_id))}
            rows={here}
          />
          <Histogram testid="dt-hist-all" caption={t('demo.dt.hist_all').replace('{frames}', tenFrames)} rows={everywhere} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Readout
            id="DT.prior"
            label={t('demo.dt.prior')}
            value={countText(sources.prior)}
            note={t('demo.dt.prior_note').replace('{frames}', String(prior.frames))}
          />
          <Readout
            id="DT.fallback"
            label={t('demo.dt.fallback')}
            value={countText(sources.fallback)}
            note={t('demo.dt.fallback_note').replace('{predicate}', prior.fallback)}
          />
        </div>
        {finding}
      </div>
      <table data-testid="dt-pisg" className="border-collapse text-[0.75em] leading-tight text-slate-900 lg:shrink-0">
        <caption className="text-left font-semibold">{t('demo.dt.pisg').replace('{frames}', tenFrames)}</caption>
        <tbody>
          {VLM.P.map((p) => {
            const present = produced.has(p);
            return (
              <tr key={p} data-testid={`dt-pisg-${p}`} data-present={String(present)}>
                <th scope="row" className={`${CELL} whitespace-nowrap text-left font-normal`}>{p}</th>
                <td className={present ? 'whitespace-nowrap py-0.5' : 'whitespace-nowrap py-0.5 text-slate-700'}>
                  {present ? `✓ ${t('demo.dt.present')}` : `— ${t('demo.dt.absent')}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
