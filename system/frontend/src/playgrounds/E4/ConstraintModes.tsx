import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Slider } from '../controls';
import { byScore, capPerPair, matchedRanks, matchedTruths, snap, topK } from '../logic';
import { M4_CAPS, M4_FRAME, M4_K_MAX, M4_RANKING } from '../M4/ranking';
import { PairPhoto } from '../M4/PairPhoto';
import { RankedList } from '../M4/RankedList';
import { truthsNote } from '../M4/truths';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';

const MODES = ['graph', 'semi', 'none'] as const;
type ConstraintMode = (typeof MODES)[number];

/**
 * E4 — what each mode keeps.
 *
 * The same twelve rows as E3, but the cap a student chooses rather than the graph constraint's
 * own: `graph` (one prediction per ordered object pair), `semi` (the engine's own default, two),
 * or `none` (every row kept). `E4.truths_none` holds the top-k count `none` would have found at
 * the same k, so a mode's own count sits beside the count it changed from -- one arithmetic,
 * `matchedTruths`, read twice over two pools built by the one `capPerPair`.
 *
 * Two parts (D96): part 1 is the mode, the row and the photograph the row chooses; part 2 is the
 * mode, k, the ranked list and the three counts. Mounted without a part, as its unit tests mount
 * it, it is both.
 */
export function ConstraintModes({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'E4.mode': 'graph' as string, 'E4.k': 2, 'E4.row': 1 });

  // A mode the URL invented is none of the three; fall back rather than count under no cap at all.
  const mode: ConstraintMode = (MODES as readonly string[]).includes(params['E4.mode'])
    ? (params['E4.mode'] as ConstraintMode)
    : 'graph';
  const k = snap(params['E4.k'], 1, M4_K_MAX, 1);
  const row = snap(params['E4.row'], 1, M4_K_MAX, 1);
  const chosenRow = M4_RANKING.find((r) => r.rank === row)!;

  const ranked = byScore(M4_RANKING);
  const kept = capPerPair(ranked, M4_CAPS[mode]);
  const top = topK(kept, k);

  const frame = frameById(M4_FRAME)!;
  const matchedIds = matchedTruths(top, frame.relationships);
  const matched = matchedRanks(top, frame.relationships);

  const noneTop = topK(capPerPair(ranked, M4_CAPS.none), k);
  const noneIds = matchedTruths(noneTop, frame.relationships);

  const rowView = part !== 2;
  const listView = part !== 1;

  const controls = (
    <>
      <Choice
        id="E4.mode"
        label={t('playground.e4.mode')}
        value={mode}
        options={MODES.map((m) => ({ value: m, label: t(`playground.e4.${m}`) }))}
        onChange={(next) => setParams({ 'E4.mode': next })}
      />
      {listView && (
        <Slider
          id="E4.k"
          label={t('playground.m4.k')}
          value={k}
          min={1}
          max={M4_K_MAX}
          step={1}
          onChange={(next) => setParams({ 'E4.k': next })}
          valueLabel={String(k)}
        />
      )}
      {rowView && (
        <Slider
          id="E4.row"
          label={t('playground.m4.row')}
          value={row}
          min={1}
          max={M4_K_MAX}
          step={1}
          onChange={(next) => setParams({ 'E4.row': next })}
          valueLabel={String(row)}
        />
      )}
    </>
  );

  return (
    <PlaygroundFrame title="E4" controls={controls} clip={false} dense>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {rowView && <PairPhoto row={chosenRow} testid="e4-pair" />}
        {listView && (
          <div className="flex min-w-0 flex-1 flex-col gap-0">
            <RankedList
              rows={M4_RANKING}
              kept={kept}
              k={k}
              chosen={row}
              matched={matched}
              testid="e4-list"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <Readout
                id="E4.pool"
                label={t('playground.e4.pool')}
                value={String(kept.length)}
                note={t('playground.e4.pool_note')}
              />
              <Readout
                id="E4.truths"
                label={t('playground.m4.truths')}
                value={String(matchedIds.length)}
                note={truthsNote(matchedIds, locale, t)}
              />
              <Readout
                id="E4.truths_none"
                label={t('playground.e4.truths_none')}
                value={String(noneIds.length)}
                note={truthsNote(noneIds, locale, t)}
              />
            </div>
            <p className="text-[0.75em] leading-tight text-slate-700">{t('playground.m4.to_l2')}</p>
          </div>
        )}
      </div>
    </PlaygroundFrame>
  );
}
