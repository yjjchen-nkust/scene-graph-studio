import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { BELIEF_GRAPHS, T_DEFAULT, T_MAX, W_DEFAULT, W_STEP, beliefGraph, type BeliefGraphName } from '../M5/beliefs';
import { Choice, PlaygroundFrame, Readout, Slider } from '../controls';
import {
  averagingRounds, decimals, degreeWeightedMean, degreeWeightedParts, fixedPoint, maxDistance, mean, snap, spread,
  sum,
} from '../logic';
import type { PlaygroundProps } from '../mounts';

/**
 * T2 — six beliefs under repeated averaging.
 *
 * `T2.graph` chooses the edge set `beliefGraph` reads (Task 2): `relations`, ph-001's own six
 * annotated relationships, or `every`, the complete graph over its six objects. `T2.w` is the
 * trust `averagingRound` places in a neighbour's belief against the object's own starting
 * evidence, and `T2.t` walks `averagingRounds` forward from b⁽⁰⁾. The table shows each object's
 * neighbourhood and its belief at the start and after t rounds; the readouts below show how far
 * b⁽ᵗ⁾ has spread and, for w < 1, how far it still sits from the fixed point b* `fixedPoint`
 * solves for and the bound `wᵗ‖b⁽⁰⁾ − b*‖∞` that distance can never cross. At w = 1 every
 * constant vector is a fixed point of b ↦ Sb, so what fails is uniqueness: I − S is singular
 * (`fixedPoint` returns null and is never called), so the same row shows instead the one value
 * `degreeWeightedMean` says every belief converges to, and, beside it, the plain mean of b⁽⁰⁾ —
 * equal degrees are sufficient, not necessary, for the two to agree; they agree whenever
 * Σⱼ (dⱼ − d̄) b⁽⁰⁾ⱼ = 0, which holds on the complete graph `every` and, here, does not on
 * `relations`.
 *
 * A belief under a stated rule, never a metric: nothing here imports from `sgg-metrics`, and no
 * readout is a recall. No photograph and no SVG (D93): the visual is the regime line, the table
 * and the readouts below it.
 *
 * Two parts (D96): part 1 is the regime line and the table; part 2 is the regime line, the
 * readouts and the closing line on IMP's own update. Mounted without a part, as its unit tests
 * mount it, it is all of them. All three knobs render on every part, since none of the three is
 * a part's alone to withhold.
 */
export function BeliefsUnderAveraging({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({
    'T2.graph': 'relations' as string,
    'T2.w': W_DEFAULT,
    'T2.t': T_DEFAULT,
  });

  const graph: BeliefGraphName = (BELIEF_GRAPHS as readonly string[]).includes(params['T2.graph'])
    ? (params['T2.graph'] as BeliefGraphName)
    : 'relations';
  const w = snap(params['T2.w'], 0, 1, W_STEP);
  const round = snap(params['T2.t'], 0, T_MAX, 1);

  const g = beliefGraph(graph);
  const nameById = new Map(g.ids.map((id, i) => [id, g.names[i]!]));
  const bt = averagingRounds(g.a, w, g.b0, round);
  // `fixedPoint` returns null at w = 1 and is never asked for a solution there; nothing below
  // reads `star` unless `w < 1` first.
  const star = w < 1 ? fixedPoint(g.a, w, g.b0) : null;

  const regimeKey = w === 0 ? 'regime_zero' : w === 1 ? 'regime_one' : 'regime_between';

  const tableView = part !== 2;
  const readoutsView = part !== 1;

  // `‖b⁽⁰⁾ − b*‖∞`, the distance the bound decays from; 0, not undefined, when `star` is null,
  // since `d0` is only ever read from the `star`-guarded branch below, where it is never displayed.
  const d0 = star ? maxDistance(g.b0, star) : 0;
  // One source each for the limit note's Σ dⱼ b⁽⁰⁾ⱼ / Σ dⱼ and the mean note's Σ b⁽⁰⁾ⱼ, so a note
  // can never drift from the value beside it: `degreeWeightedMean` and `mean` divide these same
  // two expressions rather than the component recomputing either sum for display.
  const weightedParts = degreeWeightedParts(g.lists, g.b0);
  const b0Sum = sum(g.b0);

  const separator = locale === 'zh-TW' ? '、' : ', ';

  const controls = (
    <>
      <Choice
        id="T2.graph"
        label={t('playground.t2.graph')}
        value={graph}
        options={BELIEF_GRAPHS.map((name) => ({ value: name, label: t(`playground.t2.${name}`) }))}
        onChange={(next) => setParams({ 'T2.graph': next })}
      />
      <Slider
        id="T2.w"
        label={t('playground.t2.w')}
        value={w}
        min={0}
        max={1}
        step={W_STEP}
        onChange={(next) => setParams({ 'T2.w': next })}
        valueLabel={decimals(w, 2)}
      />
      <Slider
        id="T2.t"
        label={t('playground.t2.t')}
        value={round}
        min={0}
        max={T_MAX}
        step={1}
        onChange={(next) => setParams({ 'T2.t': next })}
        valueLabel={String(round)}
      />
    </>
  );

  return (
    <PlaygroundFrame title="T2" controls={controls} clip={false} dense>
      <p data-testid="t2-regime" className="text-[0.75em] leading-tight text-slate-700">
        {t(`playground.t2.${regimeKey}`)}
      </p>
      {tableView && (
        <table data-testid="t2-beliefs" className="mt-2 border-collapse text-[0.75em] leading-tight text-slate-700">
          <caption className="text-left">{t('playground.t2.table')}</caption>
          {/* The header row is set off by a bottom rule and semibold weight rather than a smaller
              size, since the table is already at the shell's minimum 0.75em (18 px, D93). */}
          <thead>
            <tr className="border-b border-slate-300 font-semibold">
              <th scope="col" className="py-0.5 pl-2 pr-4 text-left">{t('playground.t2.object')}</th>
              <th scope="col" className="py-0.5 pr-4 text-left">{t('playground.t2.neighbours')}</th>
              <th scope="col" className="py-0.5 pr-4 text-right tabular-nums">b⁽⁰⁾</th>
              <th scope="col" className="py-0.5 pr-4 text-right tabular-nums">b⁽ᵗ⁾</th>
            </tr>
          </thead>
          <tbody>
            {g.ids.map((id, i) => {
              const neighbourText = graph === 'every'
                ? t('playground.t2.others')
                : g.lists[i]!.map((j) => `#${j} ${nameById.get(j)}`).join(separator);
              return (
                <tr key={id} data-testid={`t2-belief-${id}`}>
                  <th scope="row" className="py-0.5 pl-2 pr-4 text-left font-normal">{`#${id} ${g.names[i]}`}</th>
                  <td data-testid={`t2-belief-${id}-nb`} className="py-0.5 pr-4">{neighbourText}</td>
                  <td data-testid={`t2-belief-${id}-b0`} className="py-0.5 pr-4 text-right tabular-nums">
                    {decimals(g.b0[i]!, 2)}
                  </td>
                  <td data-testid={`t2-belief-${id}-bt`} className="py-0.5 pr-4 text-right tabular-nums">
                    {decimals(bt[i]!, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {readoutsView && (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Readout
              id="T2.spread"
              label={t('playground.t2.spread')}
              value={decimals(spread(bt), 4)}
              note={
                star
                  ? t('playground.t2.spread_note').replace('{fixed}', decimals(spread(star), 4))
                  : t('playground.t2.spread_note_limit')
              }
            />
            {star ? (
              <>
                <Readout
                  id="T2.distance"
                  label={t('playground.t2.distance')}
                  value={decimals(maxDistance(bt, star), 4)}
                  note={t('playground.t2.distance_note')}
                />
                <Readout
                  id="T2.bound"
                  label={t('playground.t2.bound')}
                  value={decimals((w ** round) * d0, 4)}
                  note={t('playground.t2.bound_note')
                    .replace('{d0}', decimals(d0, 4))
                    .replace('{d0Again}', decimals(d0, 4))}
                />
              </>
            ) : (
              <>
                <Readout
                  id="T2.limit"
                  label={t('playground.t2.limit')}
                  value={decimals(degreeWeightedMean(g.lists, g.b0), 4)}
                  note={t('playground.t2.limit_note')
                    .replace('{weighted}', decimals(weightedParts.weighted, 1))
                    .replace('{degrees}', String(weightedParts.degrees))}
                />
                <Readout
                  id="T2.mean"
                  label={t('playground.t2.mean')}
                  value={decimals(mean(g.b0), 4)}
                  note={t('playground.t2.mean_note').replace('{sum}', decimals(b0Sum, 1))}
                />
              </>
            )}
          </div>
          <p data-testid="t2-model" className="mt-2 text-[0.75em] leading-tight text-slate-700">
            {t('playground.t2.model')}
          </p>
        </>
      )}
    </PlaygroundFrame>
  );
}
