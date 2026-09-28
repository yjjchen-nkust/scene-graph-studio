import { useLocale } from '../../i18n/useLocale';
import { topK } from '../logic';
import type { RankedRow } from './ranking';

/**
 * Spec §4.1's twelve rows, the graph constraint's cap, and the cut a knob chooses, drawn as one
 * table. `kept` is `rows` after `capPerPair`; `k` and `chosen` are the caller's own knobs; the ranked
 * list never recomputes the constraint or the cut, it only draws what it is handed.
 *
 * `matched` holds ranks, not relationship ids, and this component does not trust it to carry only
 * top-k ranks: a row's ✓ requires it to be kept, in the first `k` of `kept`, and in `matched`, all
 * three (E3/E4/E7's Review Focus 3). A dropped row is struck through; the chosen row is outlined
 * and carries `aria-current`, whether or not the cap dropped it.
 *
 * The chosen row's rule follows E10's counts table (D102): a left border kept transparent in every
 * row but the chosen one, and an invisible sign held in every row's first cell, so neither the
 * columns nor the row heights move when the choice changes.
 */
export function RankedList({
  rows, kept, k, chosen, matched, testid,
}: {
  rows: RankedRow[];
  kept: RankedRow[];
  k: number;
  chosen: number;
  matched: Set<number>;
  testid: string;
}) {
  const { t } = useLocale();
  const keptRanks = new Set(kept.map((row) => row.rank));
  const topRanks = new Set(topK(kept, k).map((row) => row.rank));
  // The cut sits after the k-th kept row, or after the last one once k passes the pool (task 3's
  // own decision): `kept.length` rather than `k` bounds the index once k overruns it.
  const cutIndex = kept.length > 0 ? Math.min(Math.max(k, 1), kept.length) - 1 : -1;
  const cutAfterRank = cutIndex >= 0 ? kept[cutIndex]!.rank : null;
  const cutLabel = t('playground.m4.cut').replace('{k}', String(k));

  return (
    <div>
      <table data-testid={`${testid}-table`} className="w-full font-mono text-[0.875em]">
        <caption className="text-left font-sans text-[1em] text-slate-700">{t('playground.m4.list')}</caption>
        <tbody>
          {rows.flatMap((row) => {
            const isKept = keptRanks.has(row.rank);
            const isTop = topRanks.has(row.rank);
            const isMatched = isKept && isTop && matched.has(row.rank);
            const isChosen = row.rank === chosen;
            const tr = (
              <tr
                key={`row-${row.rank}`}
                data-testid={`${testid}-row-${row.rank}`}
                data-kept={String(isKept)}
                data-top={String(isTop)}
                data-matched={String(isMatched)}
                aria-current={isChosen ? 'true' : undefined}
                className={[
                  'border-l-4',
                  isChosen ? 'border-slate-900 bg-white font-semibold text-slate-900' : 'border-transparent text-slate-700',
                  isKept ? '' : 'line-through',
                ].filter(Boolean).join(' ')}
              >
                <th scope="row" className="py-0.5 pl-2 pr-4 text-left font-sans">
                  <span
                    data-testid={isChosen ? `${testid}-chosen` : undefined}
                    aria-hidden="true"
                    className={isChosen ? undefined : 'invisible'}
                  >
                    ►{' '}
                  </span>
                  {row.rank}
                </th>
                <td className="py-0.5 pr-4 text-right tabular-nums">#{row.subject}</td>
                <td className="py-0.5 pr-4">{row.predicate}</td>
                <td className="py-0.5 pr-4 text-right tabular-nums">#{row.object}</td>
                <td className="py-0.5 pr-4 text-right tabular-nums">{row.score.toFixed(2)}</td>
                <td className="py-0.5 pl-2 text-left">
                  <span aria-hidden={isMatched ? undefined : 'true'} className={isMatched ? undefined : 'invisible'}>✓</span>
                </td>
              </tr>
            );
            if (row.rank !== cutAfterRank) return [tr];
            return [
              tr,
              <tr key={`cut-${row.rank}`} data-testid={`${testid}-cut`}>
                <td colSpan={6} className="border-t-2 border-dashed border-slate-500 py-1 text-center text-[0.875em] text-slate-700">
                  {cutLabel}
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <p data-testid={`${testid}-legend`} className="mt-1 text-[0.875em] text-slate-700">
        {t('playground.m4.legend')}
      </p>
    </div>
  );
}
