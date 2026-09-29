import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { BELIEF_GRAPHS, T_DEFAULT, T_MAX, W_DEFAULT, W_STEP, beliefGraph, type BeliefGraphName } from '../M5/beliefs';
import { Choice, PlaygroundFrame, Readout, Slider } from '../controls';
import { averagingRounds, decimals, degreeWeightedMean, fixedPoint, maxDistance, mean, snap, spread } from '../logic';
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
 * solves for and the bound `wᵗ‖b⁽⁰⁾ − b*‖∞` that distance can never cross. At w = 1 no fixed
 * point exists to solve for (`fixedPoint` returns null and is never called), so the same row
 * shows instead the one value `degreeWeightedMean` says every belief converges to, and, beside
 * it, the plain mean of b⁽⁰⁾ — the two agree only when every object carries the same number of
 * neighbours, which `every` does and `relations` does not.
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
        <table data-testid="t2-beliefs" className="mt-2 text-[0.75em] leading-tight">
          <caption>{t('playground.t2.table')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('playground.t2.object')}</th>
              <th scope="col">{t('playground.t2.neighbours')}</th>
              <th scope="col">b⁽⁰⁾</th>
              <th scope="col">b⁽ᵗ⁾</th>
            </tr>
          </thead>
          <tbody>
            {g.ids.map((id, i) => {
              const neighbourText = graph === 'every'
                ? t('playground.t2.others')
                : g.lists[i]!.map((j) => `#${j} ${nameById.get(j)}`).join(separator);
              return (
                <tr key={id} data-testid={`t2-belief-${id}`}>
                  <th scope="row">{`#${id} ${g.names[i]}`}</th>
                  <td data-testid={`t2-belief-${id}-nb`}>{neighbourText}</td>
                  <td data-testid={`t2-belief-${id}-b0`}>{decimals(g.b0[i]!, 2)}</td>
                  <td data-testid={`t2-belief-${id}-bt`}>{decimals(bt[i]!, 2)}</td>
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
                w === 1
                  ? t('playground.t2.spread_note_limit')
                  : t('playground.t2.spread_note').replace('{fixed}', decimals(spread(star!), 4))
              }
            />
            {w < 1 ? (
              <>
                <Readout
                  id="T2.distance"
                  label={t('playground.t2.distance')}
                  value={decimals(maxDistance(bt, star!), 4)}
                  note={t('playground.t2.distance_note')}
                />
                <Readout
                  id="T2.bound"
                  label={t('playground.t2.bound')}
                  value={decimals((w ** round) * maxDistance(g.b0, star!), 4)}
                  note={t('playground.t2.bound_note')
                    .replace('{d0}', decimals(maxDistance(g.b0, star!), 4))
                    .replace('{d0Again}', decimals(maxDistance(g.b0, star!), 4))}
                />
              </>
            ) : (
              <>
                <Readout
                  id="T2.limit"
                  label={t('playground.t2.limit')}
                  value={decimals(degreeWeightedMean(g.lists, g.b0), 4)}
                  note={t('playground.t2.limit_note')
                    .replace('{weighted}', decimals(g.b0.reduce((s, x, j) => s + g.lists[j]!.length * x, 0), 1))
                    .replace('{degrees}', String(g.lists.reduce((s, l) => s + l.length, 0)))}
                />
                <Readout
                  id="T2.mean"
                  label={t('playground.t2.mean')}
                  value={decimals(mean(g.b0), 4)}
                  note={t('playground.t2.mean_note').replace('{sum}', decimals(g.b0.reduce((s, x) => s + x, 0), 1))}
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
