import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider } from '../controls';
import { VG150_PREDICATES } from '../E10/setup';
import { candidateSpace, snap } from '../logic';
import { PAIR_ROWS, SLICE_TOTALS, T1_RANK_DEFAULT } from '../M5/pairs';
import type { PlaygroundProps } from '../mounts';

const en = (n: number): string => n.toLocaleString('en-US');

/**
 * T1 — pairs against relations.
 *
 * A single `T1.frame` slider walks spec §4.1's 80 VG150 frames, ranked by object count and then
 * by image id as a number (`PAIR_ROWS`, Task 2). For the ranked frame it shows: its object count
 * N; the ordered-pair candidate space N(N − 1) at |P| = 1; the decisions the engine's own
 * vocabulary poses over that space, N(N − 1) × 50 with VG150's |P| = 50 (`VG150_PREDICATES`); how
 * many relationship rows the frame carries; and how many distinct ordered pairs those rows touch,
 * each counted once however many rows name it (`relatedPairs`, Task 2) — a pair with several
 * annotated relations is one pair, not several. A sixth readout states the slice's own totals,
 * 651 of 26,282, fixed against every setting of the knob: the frame changes which numerator and
 * denominator apply to one frame; it never changes the slice's.
 *
 * A count and a set membership, never a metric: nothing here imports from `sgg-metrics`, and no
 * readout is a recall or a percentage. One part, no photograph and no SVG (D93): the visual is
 * the six readouts and the line naming the slice's own source.
 */
export function PairsAgainstRelations(_: PlaygroundProps = {}) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ 'T1.frame': T1_RANK_DEFAULT });

  const rank = snap(params['T1.frame'], 1, PAIR_ROWS.length, 1);
  const row = PAIR_ROWS[rank - 1]!;

  const decisions = candidateSpace(row.objects, VG150_PREDICATES, true);

  const objectsNote = t('playground.t1.objects_note')
    .replace('{image}', row.imageId)
    .replace('{rank}', String(rank));

  const pairsNote = t('playground.t1.pairs_note')
    .replace('{n}', en(row.objects))
    .replace('{m}', en(row.objects - 1));

  const relatedNote = t('playground.t1.related_note')
    .replace('{related}', en(row.related))
    .replace('{pairs}', en(row.pairs));

  const controls = (
    <Slider
      id="T1.frame"
      label={t('playground.t1.frame')}
      value={rank}
      min={1}
      max={PAIR_ROWS.length}
      step={1}
      onChange={(next) => setParams({ 'T1.frame': next })}
      valueLabel={String(rank)}
    />
  );

  return (
    <PlaygroundFrame title="T1" controls={controls} clip={false} dense>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Readout
          id="T1.objects"
          label={t('playground.t1.objects')}
          value={en(row.objects)}
          note={objectsNote}
        />
        <Readout
          id="T1.pairs"
          label={t('playground.t1.pairs')}
          value={en(row.pairs)}
          note={pairsNote}
        />
        <Readout
          id="T1.decisions"
          label={t('playground.t1.decisions')}
          value={en(decisions)}
          note={t('playground.t1.decisions_note')}
        />
        <Readout
          id="T1.rows"
          label={t('playground.t1.rows')}
          value={en(row.rows)}
          note={t('playground.t1.rows_note')}
        />
        <Readout
          id="T1.related"
          label={t('playground.t1.related')}
          value={en(row.related)}
          note={relatedNote}
        />
        <Readout
          id="T1.slice"
          label={t('playground.t1.slice')}
          value={`${en(SLICE_TOTALS.related)} / ${en(SLICE_TOTALS.pairs)}`}
          note={t('playground.t1.slice_note')}
        />
      </div>
      <p data-testid="t1-source" className="mt-2 text-[0.75em] leading-tight text-slate-700">
        {t('playground.t1.source')}
      </p>
    </PlaygroundFrame>
  );
}
