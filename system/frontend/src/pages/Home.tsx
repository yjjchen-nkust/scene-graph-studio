import { Link } from 'react-router';
import { getMeta, moduleIds } from '../content/registry';
import { LAB_IDS } from '../labs/registry';
import { useLocale } from '../i18n/useLocale';
import { loadProgress } from '../store/persist';
import { resumePoint } from '../store/progress';

/**
 * The module index — the one page that is reachable without knowing a URL.
 *
 * Ordered by each module's declared `order` rather than by its id, because the id is an
 * identifier and the order is a curriculum decision; they agree today and the frontmatter is
 * where a reordering would be made.
 *
 * Every module offers both shells. A student opens the reading column; the professor opens step
 * zero of the lecture. Contracts §2.2 makes the second one a URL, so it is also what goes in a
 * calendar invitation.
 */
export default function Home() {
  const { locale, t, setLocale } = useLocale();

  const modules = moduleIds()
    .map((id) => ({ id, meta: getMeta(id, locale) }))
    .filter((row): row is { id: string; meta: NonNullable<typeof row.meta> } => row.meta !== null)
    .sort((a, b) => a.meta.order - b.meta.order);

  // Read once per render rather than held in state: `localStorage` is the source, nothing else
  // in this page writes it, and a copy in state would be the stale one after a module is read.
  const seen = loadProgress().modules;
  const resume = resumePoint(modules.map((m) => m.id));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{t('app.title')}</h1>
          <p className="mt-1 text-slate-600">{t('app.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW')}
          className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {t('lang.toggle')}
        </button>
      </header>

      <nav className="mb-8 flex flex-wrap gap-4 text-sm">
        <Link className="text-slate-600 underline hover:text-slate-900" to="/map">
          {t('nav.map')}
        </Link>
        <Link className="text-slate-600 underline hover:text-slate-900" to="/leaderboards">
          {t('nav.leaderboards')}
        </Link>
        <Link className="text-slate-600 underline hover:text-slate-900" to="/status">
          {t('nav.status')}
        </Link>
      </nav>

      {resume && (
        <p data-testid="resume" className="mb-6 rounded border border-slate-200 bg-slate-50 p-3">
          <Link to={`/m/${resume.moduleId}`} className="text-slate-900 underline">
            {t('nav.resume')} {resume.moduleId}
          </Link>
        </p>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t('nav.modules')}
      </h2>
      <ol data-testid="module-index" className="divide-y divide-slate-200">
        {modules.map(({ id, meta }) => (
          <li key={id} className="flex items-baseline justify-between gap-4 py-2">
            <Link to={`/m/${id}`} className="text-slate-900 hover:underline">
              <span className="mr-3 font-mono text-sm text-slate-500">{id}</span>
              {locale === 'en' ? meta.title_en : meta.title_zh}
            </Link>
            <span className="flex shrink-0 items-baseline gap-3">
              {seen[id] ? (
                <span
                  data-testid={`seen-${id}`}
                  className="font-mono text-xs text-slate-500"
                >
                  {Math.min(seen[id], meta.steps.length)} / {meta.steps.length}
                </span>
              ) : null}
              <Link
                to={`/lecture/m/${id}/0`}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {t('shell.lecture_mode')}
              </Link>
            </span>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t('nav.labs')}
      </h2>
      <ul data-testid="lab-index" className="flex flex-wrap gap-2">
        {LAB_IDS.map((labId) => (
          <li key={labId}>
            <Link
              to={`/lab/${labId}`}
              className="rounded border border-slate-300 px-3 py-1 font-mono text-sm
                hover:bg-slate-100"
            >
              {labId}
            </Link>
          </li>
        ))}
      </ul>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-sm text-slate-600">
        {t('offline.note')}
      </footer>
    </main>
  );
}
