import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider } from '../controls';
import { byScore, capPerPair, matchedRanks, matchedTruths, snap, topK } from '../logic';
import { M4_CAPS, M4_FRAME, M4_K_MAX, M4_RANKING } from '../M4/ranking';
import { PairPhoto } from '../M4/PairPhoto';
import { RankedList } from '../M4/RankedList';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';

/**
 * E3 — the top k.
 *
 * The graph constraint's own cap (one prediction per ordered object pair) applied to spec §4.1's
 * twelve rows, then cut at k: how many predictions survive, and how many of ph-001's six ground
 * truths one of them names exactly. |G ∩ X_k| is a count, never R@k -- L2 is where the count is
 * divided by 6.
 *
 * Two parts (D96): part 1 is both knobs and the photograph of the row `E3.row` chooses; part 2
 * is the ranked list at `E3.k`, its two counts, and the line pointing at L2. Mounted without a
 * part, as its unit tests mount it, it is both.
 */
export function TopK({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'E3.k': 4, 'E3.row': 1 });

  const k = snap(params['E3.k'], 1, M4_K_MAX, 1);
  const row = snap(params['E3.row'], 1, M4_K_MAX, 1);
  const chosenRow = M4_RANKING.find((r) => r.rank === row)!;

  const kept = capPerPair(byScore(M4_RANKING), M4_CAPS.graph);
  const top = topK(kept, k);

  const frame = frameById(M4_FRAME)!;
  const matchedIds = matchedTruths(top, frame.relationships);
  const matched = matchedRanks(top, frame.relationships);

  const rowView = part !== 2;
  const listView = part !== 1;

  const separator = locale === 'zh-TW' ? '、' : ', ';
  const idsText = matchedIds.length > 0
    ? matchedIds.map((id) => `g${id}`).join(separator)
    : t('playground.m4.none');
  const truthsNote = t('playground.m4.truths_note').replace('{ids}', idsText);

  const controls = (
    <>
      <Slider
        id="E3.k"
        label={t('playground.m4.k')}
        value={k}
        min={1}
        max={M4_K_MAX}
        step={1}
        onChange={(next) => setParams({ 'E3.k': next })}
        valueLabel={String(k)}
      />
      {rowView && (
        <Slider
          id="E3.row"
          label={t('playground.m4.row')}
          value={row}
          min={1}
          max={M4_K_MAX}
          step={1}
          onChange={(next) => setParams({ 'E3.row': next })}
          valueLabel={String(row)}
        />
      )}
    </>
  );

  return (
    <PlaygroundFrame title="E3" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {rowView && <PairPhoto row={chosenRow} testid="e3-pair" />}
        {listView && (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <RankedList
              rows={M4_RANKING}
              kept={kept}
              k={k}
              chosen={row}
              matched={matched}
              testid="e3-list"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <Readout
                id="E3.in_top"
                label={t('playground.e3.in_top')}
                value={String(top.length)}
                note={t('playground.e3.in_top_note')}
              />
              <Readout
                id="E3.truths"
                label={t('playground.m4.truths')}
                value={String(matchedIds.length)}
                note={truthsNote}
              />
            </div>
            <p className="text-[0.875em] text-slate-700">{t('playground.m4.to_l2')}</p>
          </div>
        )}
      </div>
    </PlaygroundFrame>
  );
}
