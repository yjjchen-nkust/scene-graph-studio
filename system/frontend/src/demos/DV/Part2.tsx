import { Fragment } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { TRADITIONAL, VLM, frameLabel, type VlmFrame } from '../data';
import { candidateTriplets, countText, outsideVocabulary } from '../logic';

const TERMS = ['subject', 'predicate', 'object'] as const;

/**
 * D-V, part 2: the step-1 draft.
 *
 * One call's triplets, rows in the order the completion wrote them, repeats kept (the order is the
 * ranking, and `parse_triplets` keeps a repeated line); each term outside the object vocabulary O
 * or the predicate vocabulary P carries `∉ O` or `∉ P` beside it. Beside the list, the calls a frame
 * costs (N + 2, three experts and the draft and the summary), the rows this call emitted, the rows
 * with a term outside O or P, and D-T's n(n − 1)·|P| candidates for the same frame, the count this
 * part answers.
 */
export function Part2({ frame }: { frame: VlmFrame }) {
  const { t } = useLocale();
  const traditional = TRADITIONAL.frames.find((f) => f.image_id === frame.image_id);
  const n = traditional?.detections.length ?? 0;
  const P = TRADITIONAL.vg150_predicate_count;
  const outside = frame.draft.map((row) => outsideVocabulary(row, VLM.O, VLM.P));
  const flagged = outside.filter((o) => o.subject || o.predicate || o.object).length;
  const time = frameLabel(frame.image_id);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:shrink-0">
        <Readout
          id="DV.calls"
          label={t('demo.dv.calls')}
          value={String(VLM.calls_per_frame)}
          note={`N + 2, N = ${frame.experts.length}`}
        />
        <Readout
          id="DV.emitted"
          label={t('demo.dv.emitted')}
          value={countText(frame.draft.length)}
          note={t('demo.dv.emitted_note')}
        />
        <Readout id="DV.outside" label={t('demo.dv.outside')} value={countText(flagged)} note={t('demo.dv.outside_note')} />
        <Readout
          id="DV.dt_candidates"
          label={t('demo.dv.dt_candidates')}
          value={countText(candidateTriplets(n, P))}
          note={`n(n−1)·${P}, n = ${n}`}
        />
      </div>
      <div className="min-w-0 flex-1 text-[0.75em] leading-tight text-slate-900">
        <p className="text-slate-700">{t('demo.dv.draft_caption').replace('{time}', time)}</p>
        {frame.draft.length === 0 ? (
          <p data-testid="dv-draft-none" className="mt-1">{t('demo.dv.draft_none')}</p>
        ) : (
          // One line to a row, so a leading under `leading-tight` costs no legibility, as D-T's
          // legend has it; thirteen rows at 100 s.
          <ol data-testid="dv-draft" className="mt-1 leading-[1.15]">
            {frame.draft.map((row, k) => {
              const out = outside[k]!;
              const any = out.subject || out.predicate || out.object;
              return (
                <li
                  // Rows repeat, so the index is part of the key.
                  key={`${k}:${row.join('|')}`}
                  data-testid={`dv-draft-${k}`}
                  data-triplet={row.join('|')}
                  data-outside={String(any)}
                  className="flex gap-2"
                >
                  <span className="w-7 shrink-0 text-right tabular-nums text-slate-700">{`${k + 1}.`}</span>
                  <span>
                    {'⟨'}
                    {TERMS.map((term, i) => (
                      <Fragment key={term}>
                        {i > 0 && ', '}
                        {row[i]}
                        {out[term] && (
                          <span
                            data-testid="dv-flag"
                            data-term={term}
                            className="mx-1 whitespace-nowrap rounded border border-dashed border-slate-900 px-1 font-semibold"
                          >
                            {term === 'predicate' ? '∉ P' : '∉ O'}
                          </span>
                        )}
                      </Fragment>
                    ))}
                    {'⟩'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
