import type { RouteObject } from 'react-router';
import { Link, Navigate, useParams } from 'react-router';
import { getMeta, getModule } from './content/registry';
import { useLocale } from './i18n/useLocale';
import { LabRoute } from './labs/registry';
import { FieldMap } from './pages/FieldMap';
import Home from './pages/Home';
import { Leaderboards } from './pages/Leaderboards';
import Status from './pages/Status';
import { LectureShell } from './shells/lecture/LectureShell';
import { PresenterWindow } from './shells/lecture/PresenterWindow';
import { StudyShell } from './shells/study/StudyShell';

/**
 * A module that is not in the corpus, said plainly.
 *
 * The alternative — rendering an empty shell — is the failure that takes a minute to diagnose
 * from the lectern, because an empty slide and a mistyped URL look identical on a projector.
 */
function NotFound({ what }: { what: string }) {
  const { t } = useLocale();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t('route.not_found')}</h1>
      <p className="mt-2 font-mono text-sm text-slate-600">{what}</p>
      <Link to="/" className="mt-6 inline-block text-slate-600 underline hover:text-slate-900">
        {t('shell.all_modules')}
      </Link>
    </main>
  );
}

function ModuleRoute() {
  const { moduleId = '' } = useParams();
  const { locale } = useLocale();
  const meta = getMeta(moduleId, locale);
  const steps = getModule(moduleId, locale);
  if (!meta || !steps) return <NotFound what={moduleId} />;
  const title = locale === 'en' ? meta.title_en : meta.title_zh;
  return <StudyShell moduleId={moduleId} title={title} steps={steps} />;
}

function LectureRoute() {
  const { moduleId = '' } = useParams();
  const { locale } = useLocale();
  const meta = getMeta(moduleId, locale);
  const steps = getModule(moduleId, locale);
  if (!meta || !steps) return <NotFound what={moduleId} />;
  const title = locale === 'en' ? meta.title_en : meta.title_zh;
  return <LectureShell moduleId={moduleId} title={title} steps={steps} />;
}

function LectureStart() {
  const { moduleId = '' } = useParams();
  return <Navigate replace to={`/lecture/m/${moduleId}/0`} />;
}

/**
 * The route table, contracts §2.2.
 *
 * One array, exported rather than handed straight to `createBrowserRouter`, so the browser and
 * the tests build their routers from the same object. A test that declared its own `<Routes>`
 * would assert something adjacent to the application rather than the application.
 *
 * Every route contracts §2.2 names is mounted. `/lab/:labId` resolves through `labs/registry`,
 * whose containers hold the data-fetching the labs themselves refuse to do — a lab takes a scene
 * graph as a prop and does not know where it came from, which is what let all eight be tested
 * before any of them was reachable.
 */
export const ROUTES: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/m/:moduleId', element: <ModuleRoute /> },
  // Bare `/lecture/m/:moduleId` is what a person types; step zero is what they meant.
  { path: '/lecture/m/:moduleId', element: <LectureStart /> },
  { path: '/lecture/m/:moduleId/:stepIndex', element: <LectureRoute /> },
  { path: '/lecture/notes', element: <PresenterWindow /> },
  { path: '/lab/:labId', element: <LabRoute /> },
  { path: '/map', element: <FieldMap /> },
  { path: '/leaderboards', element: <Leaderboards /> },
  { path: '/status', element: <Status /> },
  { path: '*', element: <NotFound what="" /> },
];
