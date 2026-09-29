import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { frameLabel, type ExpertRecord, type Triplet, type VlmFrame } from '../data';
import { revisionDiff } from '../logic';
import { MARK, SIGN, angled } from './marks';

/** One list of a revision's changes: its name and count, then its rows, or none when it is empty. */
function Group({ name, testid, count, children }: {
  name: string; testid: string; count: number; children: ReactNode;
}) {
  return (
    <div>
      <p className="font-semibold">
        {`${name} `}
        <span data-testid={`${testid}-count`} className="tabular-nums">{count}</span>
      </p>
      {count > 0 && <ul data-testid={testid}>{children}</ul>}
    </div>
  );
}

/**
 * D-V, part 3: the experts.
 *
 * One expert at a time, chosen by `DV.expert`: its revision against step 1's draft, as the
 * triplets it rewrote (a deleted and an added triplet on the same subject and object, `from → to`),
 * deleted (`−`) and added (`+`), each counted over distinct triplets (`revisionDiff`); and the
 * analysis the expert wrote, verbatim and labelled as model output, in the displayed locale's
 * field only. An expert whose revision is the draft is stated in words, "no change recorded", and
 * an analysis the completion did not carry in this locale is stated as absent. The other locale's
 * text is never shown in its place: a Chinese room reading an English paragraph under a Chinese
 * label would take it for the expert's Chinese.
 */
export function Part3({ frame, expert }: { frame: VlmFrame; expert: number }) {
  const { t, locale } = useLocale();
  // A frame recorded with no expert has, in effect, returned the draft and written nothing.
  const record: ExpertRecord = frame.experts.find((e) => e.index === expert)
    ?? { index: expert, revision: frame.draft, analysis_en: '', analysis_zh: '' };
  const diff = revisionDiff(frame.draft, record.revision);
  const unchanged = diff.rewritten.length + diff.deleted.length + diff.added.length === 0;
  const analysis = locale === 'zh-TW' ? record.analysis_zh : record.analysis_en;
  const section = locale === 'zh-TW' ? 'ANALYSIS_ZH' : 'ANALYSIS_EN';
  const key = (tr: Triplet) => tr.join('|');

  return (
    <div className="flex flex-col gap-3 text-[0.75em] leading-tight text-slate-900 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-col gap-1 lg:w-96 lg:shrink-0">
        <p className="text-slate-700">
          {t('demo.dv.against').replace('{n}', String(record.index)).replace('{time}', frameLabel(frame.image_id))}
        </p>
        {unchanged ? (
          <p data-testid="dv-no-change">{t('demo.dv.no_change')}</p>
        ) : (
          <>
            <Group name={t('demo.dv.rewritten')} testid="dv-rewritten" count={diff.rewritten.length}>
              {diff.rewritten.map(({ from, to }, k) => (
                <li key={`${key(from)}>${key(to)}`} data-testid={`dv-rewritten-${k}`} data-from={key(from)} data-to={key(to)}>
                  {`${angled(from)} → ${angled(to)}`}
                </li>
              ))}
            </Group>
            <Group name={t('demo.dv.deleted')} testid="dv-deleted" count={diff.deleted.length}>
              {diff.deleted.map((tr, k) => (
                <li key={key(tr)} data-testid={`dv-deleted-${k}`} data-triplet={key(tr)} className={`w-fit ${MARK.removed}`}>
                  {`${SIGN.removed}${angled(tr)}`}
                </li>
              ))}
            </Group>
            <Group name={t('demo.dv.added')} testid="dv-added" count={diff.added.length}>
              {diff.added.map((tr, k) => (
                <li key={key(tr)} data-testid={`dv-added-${k}`} data-triplet={key(tr)} className={`w-fit ${MARK.added}`}>
                  <span className="text-blue-700">{SIGN.added}</span>
                  {angled(tr)}
                </li>
              ))}
            </Group>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p data-testid="dv-analysis-label" className="font-semibold">
          {`${t('demo.model_output')} · `}
          <span className="font-mono">{section}</span>
        </p>
        {analysis === '' ? (
          <p data-testid="dv-analysis-none">{t('demo.dv.analysis_none')}</p>
        ) : (
          <p data-testid="dv-analysis" className="whitespace-pre-line">{analysis}</p>
        )}
      </div>
    </div>
  );
}
