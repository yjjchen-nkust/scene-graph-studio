import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider } from '../controls';
import { byScore, capPerPair, matchedRanks, matchedTruths, snap, topK } from '../logic';
import { M4_FRAME, M4_K_MAX, M4_RANKING } from '../M4/ranking';
import { PairPhoto } from '../M4/PairPhoto';
import { RankedList } from '../M4/RankedList';
import { truthsNote } from '../M4/truths';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';

/** The most predicates E7 admits on one ordered object pair; three exhausts spec §4.1's rows. */
const M_MAX = 10;

/**
 * E7 — predicates admitted per pair.
 *
 * The same twelve rows as E3 and E4, capped per ordered object pair at a count a student sets
 * directly, `m` from 1 to 10, in place of one of E4's three named modes: `capPerPair(byScore(...),
 * m)` is the whole difference from E4's arithmetic, cap read from a slider rather than looked up
 * in `M4_CAPS`. The pool grows with `m` until every pair's own count of predictions is exhausted
 * -- 7, then 11, then 12 from m = 3, since no pair carries more than three rows -- while the count
 * at a fixed k need not grow with it: a pair kept twice over can crowd a distinct pair's row out of
 * the same k slots, which is why the top-k count can fall as m rises even though the pool only
 * grows.
 *
 * Two parts (D96): part 1 is m, the row and the photograph the row chooses; part 2 is m, k, the
 * ranked list and the two counts. Mounted without a part, as its unit tests mount it, it is both.
 */
export function PerPairCap({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'E7.m': 1, 'E7.k': 2, 'E7.row': 1 });

  const m = snap(params['E7.m'], 1, M_MAX, 1);
  const k = snap(params['E7.k'], 1, M4_K_MAX, 1);
  const row = snap(params['E7.row'], 1, M4_K_MAX, 1);
  const chosenRow = M4_RANKING.find((r) => r.rank === row)!;

  const kept = capPerPair(byScore(M4_RANKING), m);
  const top = topK(kept, k);

  const frame = frameById(M4_FRAME)!;
  const matchedIds = matchedTruths(top, frame.relationships);
  const matched = matchedRanks(top, frame.relationships);

  const rowView = part !== 2;
  const listView = part !== 1;

  const controls = (
    <>
      <Slider
        id="E7.m"
        label={t('playground.e7.m')}
        value={m}
        min={1}
        max={M_MAX}
        step={1}
        onChange={(next) => setParams({ 'E7.m': next })}
        valueLabel={String(m)}
      />
      {listView && (
        <Slider
          id="E7.k"
          label={t('playground.m4.k')}
          value={k}
          min={1}
          max={M4_K_MAX}
          step={1}
          onChange={(next) => setParams({ 'E7.k': next })}
          valueLabel={String(k)}
        />
      )}
      {rowView && (
        <Slider
          id="E7.row"
          label={t('playground.m4.row')}
          value={row}
          min={1}
          max={M4_K_MAX}
          step={1}
          onChange={(next) => setParams({ 'E7.row': next })}
          valueLabel={String(row)}
        />
      )}
    </>
  );

  return (
    <PlaygroundFrame title="E7" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {rowView && <PairPhoto row={chosenRow} testid="e7-pair" />}
        {listView && (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <RankedList
              rows={M4_RANKING}
              kept={kept}
              k={k}
              chosen={row}
              matched={matched}
              testid="e7-list"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <Readout
                id="E7.pool"
                label={t('playground.e7.pool')}
                value={String(kept.length)}
                note={t('playground.e7.pool_note')}
              />
              <Readout
                id="E7.truths"
                label={t('playground.m4.truths')}
                value={String(matchedIds.length)}
                note={truthsNote(matchedIds, locale, t)}
              />
            </div>
            <p className="text-[0.875em] text-slate-700">{t('playground.m4.to_l2')}</p>
          </div>
        )}
      </div>
    </PlaygroundFrame>
  );
}
