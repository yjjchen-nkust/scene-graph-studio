import { useLocale } from '../../i18n/useLocale';
import { frameById } from '../slice';
import { M4_FRAME, type RankedRow } from './ranking';

/**
 * The line beside the photograph on the first part of E3, E4 and E7: the chosen row as a triplet
 * of ph-001's own object ids and class names, and whether the caller's pool keeps it.
 *
 * `kept` is the pool after `capPerPair`, as `RankedList` receives it; the line decides nothing but
 * membership, so the first part says what the second part's strike-through says, in words, on the
 * step that has no list (D106). The class names are ph-001's annotation, the same verbatim names
 * the presenter notes use in both locales.
 */
export function RowLine({ row, kept, testid }: { row: RankedRow; kept: RankedRow[]; testid: string }) {
  const { t } = useLocale();
  const frame = frameById(M4_FRAME)!;
  const name = (id: number) => frame.objects.find((o) => o.object_id === id)!.names[0]!;
  const isKept = kept.some((r) => r.rank === row.rank);
  const text = t('playground.m4.row_line')
    .replace('{row}', String(row.rank))
    .replace('{s}', String(row.subject))
    .replace('{sname}', name(row.subject))
    .replace('{predicate}', row.predicate)
    .replace('{o}', String(row.object))
    .replace('{oname}', name(row.object))
    .replace('{state}', t(isKept ? 'playground.m4.row_kept' : 'playground.m4.row_dropped'));

  return (
    <p data-testid={testid} data-kept={String(isKept)} className="text-[1em] leading-snug text-slate-900">
      {text}
    </p>
  );
}
