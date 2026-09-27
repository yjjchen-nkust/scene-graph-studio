import { useMemo } from 'react';
import { useLocale } from '../i18n/useLocale';
import { useLabParams } from '../labs/useLabParams';
import { KnowledgeIndex } from './KnowledgeIndex';
import { PaperCard } from './PaperCard';
import {
  ALL_DATASETS,
  BRANCH_LABEL,
  BRANCHES,
  byKey,
  datasetsOf,
  PAPERS,
  YEAR_MAX,
  YEAR_MIN,
  type Branch,
  type PaperCardData,
} from './papers';

/**
 * The field as nine columns, one per branch, with `predecessor` drawn as a line.
 *
 * The arrow is the point of the page. PRD §6.3 asks a student to place a paper on the taxonomy,
 * name its predecessor and say what defect it fixed, and a column of unconnected cards answers
 * only the first third of that. Every arrow here therefore has a sentence attached, and
 * `papers.test.mjs` refuses a predecessor with no `defect_fixed_en`.
 *
 * Filter state lives in the URL, like a lab's (contracts §2.2), so a filtered map is a link.
 */
function PaperColumns() {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const [params, setParams] = useLabParams({
    branch: '' as string,
    from: YEAR_MIN,
    to: YEAR_MAX,
    ds: '' as string,
    scored: 0,
    open: '' as string,
  });

  const visible = useMemo(() => {
    return PAPERS.filter((p) => {
      if (params.branch && p.branch !== params.branch) return false;
      if (p.year < params.from || p.year > params.to) return false;
      if (params.ds && !datasetsOf(p).includes(params.ds)) return false;
      if (params.scored === 1 && p.tier !== 'A') return false;
      return true;
    });
  }, [params.branch, params.from, params.to, params.ds, params.scored]);

  const shown = new Set(visible.map((p) => p.key));
  const opened = params.open ? byKey(params.open) : undefined;

  const columns: Array<[Branch, PaperCardData[]]> = BRANCHES.map((b) => [
    b,
    visible.filter((p) => p.branch === b).sort((a, z) => a.year - z.year),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.branch')}</span>
          <select
            value={params.branch}
            onChange={(e) => setParams({ branch: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="">{t('map.all')}</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {en ? BRANCH_LABEL[b].en : BRANCH_LABEL[b].zh}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.from')}</span>
          <input
            type="number"
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={params.from}
            onChange={(e) => setParams({ from: Number(e.target.value) })}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.to')}</span>
          <input
            type="number"
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={params.to}
            onChange={(e) => setParams({ to: Number(e.target.value) })}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.dataset')}</span>
          <select
            value={params.ds}
            onChange={(e) => setParams({ ds: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="">{t('map.all')}</option>
            {ALL_DATASETS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.scored === 1}
            onChange={(e) => setParams({ scored: e.target.checked ? 1 : 0 })}
          />
          <span className="text-slate-600">{t('map.scored_only')}</span>
        </label>

        <span data-testid="visible-count" className="text-slate-500">
          {visible.length} / {PAPERS.length}
        </span>
      </section>

      <section className="grid grid-flow-col auto-cols-[minmax(13rem,1fr)] gap-4 overflow-x-auto pb-4">
        {columns.map(([branch, papers]) => (
          <div key={branch} data-testid={`column-${branch}`} data-count={papers.length}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {en ? BRANCH_LABEL[branch].en : BRANCH_LABEL[branch].zh}
            </h3>
            <ul className="space-y-2">
              {papers.map((p) => {
                // An arrow is drawn only when both ends are on screen. A line to a card the
                // filter removed would assert a lineage the reader cannot check.
                const linked = p.predecessor && shown.has(p.predecessor);
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      data-testid={`card-${p.key}`}
                      data-predecessor={linked ? p.predecessor : undefined}
                      data-tier={p.tier}
                      onClick={() => setParams({ open: p.key })}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-left hover:border-slate-500"
                    >
                      <span className="block font-mono text-xs text-slate-900">{p.key}</span>
                      <span className="block text-xs text-slate-600">
                        {en ? p.core_idea_en : p.core_idea_zh}
                      </span>
                      {linked ? (
                        <span className="mt-1 block font-mono text-[10px] text-slate-500">
                          ← {p.predecessor}
                        </span>
                      ) : null}
                      {p.tier === 'A' ? (
                        <span className="mt-1 block text-[10px] uppercase tracking-wide text-emerald-700">
                          {t('paper.tier_a')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {opened ? (
        <section className="rounded border border-slate-300 bg-white p-5">
          <button
            type="button"
            onClick={() => setParams({ open: '' })}
            className="mb-3 text-sm text-slate-600 underline"
          >
            {t('map.close')}
          </button>
          <PaperCard paper={opened} />
        </section>
      ) : null}
    </div>
  );
}

const VIEWS = [
  ['papers', 'map.view_papers'],
  ['kp', 'map.view_kp'],
] as const;

/**
 * Two indexes over one course: the papers by branch, and the knowledge points by cluster (D101).
 *
 * The view is a URL parameter like every filter, so `/map?view=kp` is a link to the second. The
 * papers stay the default, so every link to the map written before D101 still lands where it did.
 */
export function FieldMap() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ view: 'papers' as string });
  const view = params.view === 'kp' ? 'kp' : 'papers';

  return (
    <div className="space-y-6">
      <div role="group" aria-label={t('map.view')} className="flex gap-2 text-sm">
        {VIEWS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`view-${id}`}
            aria-pressed={view === id}
            onClick={() => setParams({ view: id })}
            className={
              view === id
                ? 'rounded border border-slate-800 bg-slate-800 px-3 py-1 text-white'
                : 'rounded border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100'
            }
          >
            {t(label)}
          </button>
        ))}
      </div>
      {view === 'kp' ? <KnowledgeIndex /> : <PaperColumns />}
    </div>
  );
}
