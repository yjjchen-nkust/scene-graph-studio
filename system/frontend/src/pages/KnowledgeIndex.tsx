import { useMemo } from 'react';
import { Link } from 'react-router';
import { getMeta } from '../content/registry';
import { useLocale } from '../i18n/useLocale';
import { useLabParams } from '../labs/useLabParams';
import { CLUSTERS, POINTS, teachingOf } from './knowledge';
import { useFieldDraft } from './useFieldDraft';

/**
 * The 93 knowledge points as an index, one group per cluster, each pointing at the module that
 * teaches it and, where one exists, the lecture step that mounts its playground.
 *
 * The paper columns answer "where does this method sit"; this answers "where is this idea taught",
 * which a student revising for a checkpoint asks more often. Filter state lives in the URL beside
 * the paper view's, so switching views and back loses neither.
 */
export function KnowledgeIndex() {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const [params, setParams] = useLabParams({ cluster: '' as string, q: '' as string });
  // The filter reads the URL; the field shows what is being typed (see `useFieldDraft`).
  const search = useFieldDraft(params.q, (raw) => setParams({ q: raw }));

  const visible = useMemo(() => {
    const needle = params.q.trim().toLowerCase();
    return POINTS.filter((p) => {
      if (params.cluster && p.cluster !== params.cluster) return false;
      if (!needle) return true;
      return [p.id, p.title_en, p.title_zh].some((s) => s.toLowerCase().includes(needle));
    });
  }, [params.cluster, params.q]);

  const groups = CLUSTERS.map((c) => ({
    cluster: c,
    points: visible.filter((p) => p.cluster === c.id),
  })).filter((g) => g.points.length > 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.cluster')}</span>
          <select
            value={params.cluster}
            onChange={(e) => setParams({ cluster: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="">{t('map.all')}</option>
            {CLUSTERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {en ? c.en : c.zh}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-slate-600">{t('map.search')}</span>
          <input
            type="search"
            {...search}
            className="w-56 rounded border border-slate-300 px-2 py-1"
          />
        </label>

        <span data-testid="kp-count" className="text-slate-500">
          {visible.length} / {POINTS.length}
        </span>
      </section>

      {groups.length === 0 ? (
        <p data-testid="kp-empty" className="text-slate-600">
          {t('map.no_match')}
        </p>
      ) : null}

      {groups.map(({ cluster, points }) => (
        <section key={cluster.id} data-testid={`cluster-${cluster.id}`} data-count={points.length}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {cluster.id} · {en ? cluster.en : cluster.zh}
          </h3>
          <ul className="divide-y divide-slate-200">
            {points.map((p) => {
              const taught = teachingOf(p.id);
              const meta = taught ? getMeta(taught.moduleId, locale) : null;
              return (
                <li
                  key={p.id}
                  data-testid={`kp-${p.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <span>
                    <span className="mr-3 font-mono text-xs text-slate-500">{p.id}</span>
                    <span className="text-slate-900">{en ? p.title_en : p.title_zh}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    {taught ? (
                      <Link
                        to={`/m/${taught.moduleId}`}
                        data-testid={`kp-module-${p.id}`}
                        className="text-slate-600 hover:text-slate-900 hover:underline"
                      >
                        <span className="font-mono">{taught.moduleId}</span>
                        {meta ? ` ${en ? meta.title_en : meta.title_zh}` : null}
                      </Link>
                    ) : (
                      <span className="text-slate-500">{t('map.not_taught')}</span>
                    )}
                    {taught?.playgroundStep != null ? (
                      <Link
                        to={`/lecture/m/${taught.moduleId}/${taught.playgroundStep}`}
                        data-testid={`kp-playground-${p.id}`}
                        className="rounded border border-emerald-600 px-1.5 text-xs text-emerald-700
                          hover:bg-emerald-50"
                      >
                        {t('map.playground')}
                      </Link>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
