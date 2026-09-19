import { MetricReadout } from '../components/MetricReadout';
import { useLocale } from '../i18n/useLocale';
import { BOARDS, type Leaderboard, type LeaderboardRow } from './boards';

/**
 * Frozen per-paper tables (PRD §6.4).
 *
 * Every board is one table out of one paper. Nothing on this page combines two of them, sorts
 * one of them, or computes anything from the numbers, and there is no exported helper that
 * could: the absence of the capability is how §6.4's "never merged into a single ranking" is
 * enforced, because a banner is advice and a missing function is not.
 *
 * The banner sits above its table, is not collapsible, and names the three axes the field does
 * not control — backbone, codebase, epoch budget. Where a source states none of them the cell
 * says so in words rather than going blank, because a blank cell reads as "nothing to say here"
 * and the whole point is that there is a great deal to say. D35.
 */

/** The (metric, k) columns this board actually carries, in the order the tables print them. */
function columnsOf(board: Leaderboard): Array<{ metric: string; k: number }> {
  const seen = new Map<string, { metric: string; k: number }>();
  for (const row of board.rows) {
    for (const v of row.values) seen.set(`${v.metric}@${v.k}`, { metric: v.metric, k: v.k });
  }
  return [...seen.values()].sort((a, z) => a.k - z.k || (a.metric === 'R' ? -1 : 1));
}

function Unstated() {
  const { t } = useLocale();
  return (
    <td data-testid="unstated-cell" className="px-3 py-2 text-sm italic text-slate-500">
      {t('lb.not_stated')}
    </td>
  );
}

function Row({ board, row }: { board: Leaderboard; row: LeaderboardRow }) {
  const columns = columnsOf(board);
  const cell = (value: string | null) =>
    value === null ? <Unstated /> : <td className="px-3 py-2 text-sm">{value}</td>;

  return (
    <tr className="border-t border-slate-200">
      <th scope="row" className="px-3 py-2 text-left font-mono text-sm font-normal">
        {row.paper_key}
      </th>
      {cell(row.detector_backbone)}
      {cell(row.codebase)}
      {cell(row.epoch_budget)}
      {columns.map((col) => {
        const hit = row.values.find((v) => v.metric === col.metric && v.k === col.k);
        return (
          <td key={`${col.metric}@${col.k}`} data-testid="figure" className="px-3 py-2">
            {hit ? (
              <MetricReadout
                value={{
                  value: hit.value / 100,
                  metric: hit.metric,
                  k: hit.k,
                  protocol: board.protocol,
                  constraint: board.constraint,
                  source: `${board.source} ${board.source_table}`,
                  verified: hit.verified,
                  fidelity: 'published',
                }}
              />
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function Board({ board }: { board: Leaderboard }) {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const columns = columnsOf(board);

  return (
    <section data-testid={`board-${board.id}`} className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">
          {en ? board.title_en : board.title_zh}
        </h2>
        <p data-testid="provenance" className="text-sm text-slate-600">
          {t('lb.read_from')}: <span className="font-mono">{board.source}</span>,{' '}
          {board.source_table} · {board.dataset}
        </p>
      </header>

      {/* Above the table, always, and with no control that could fold it away. */}
      <p
        data-testid="banner"
        className="rounded border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900"
      >
        {en ? board.banner_en : board.banner_zh}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-3 py-2 font-medium">{t('lb.method')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('lb.backbone')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('lb.codebase')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('lb.epochs')}</th>
              {columns.map((col) => (
                <th key={`${col.metric}@${col.k}`} scope="col" className="px-3 py-2 font-medium">
                  {col.metric}@{col.k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Source order, never value order. A table sorted by score is a ranking whatever
                the banner above it says. */}
            {board.rows.map((row, i) => (
              <Row key={`${row.paper_key}-${row.detector_backbone ?? i}`} board={board} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p data-testid="sunset" className="text-xs text-slate-600">
        {en ? board.dead_leaderboard_notice_en : board.dead_leaderboard_notice_zh}
      </p>
    </section>
  );
}

export function Leaderboards() {
  const { t } = useLocale();
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t('lb.heading')}</h1>
      {BOARDS.map((board) => (
        <Board key={board.id} board={board} />
      ))}
    </div>
  );
}
