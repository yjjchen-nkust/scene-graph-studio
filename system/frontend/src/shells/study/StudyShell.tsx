import { Link } from 'react-router';
import { itemsFor, Quiz } from '../../assess/quiz';
import type { ModuleStep } from '../../content/registry';
import { useLocale } from '../../i18n/useLocale';
import { GT as CHECKPOINT_GRAPH } from '../../labs/L2/fixture';
import { useRecordProgress } from '../../store/progress';

export interface StudyShellProps {
  moduleId: string;
  title: string;
  steps: ModuleStep[];
}

/**
 * The study shell: the same module, read alone, at reading size.
 *
 * Contracts §2.4 — one content base, two shells. The lecture shell shows one step and owns a
 * keyboard policy; this one shows every step in a single scrolling column and owns none. The
 * difference is layout and step policy, and nothing else: both read the same `ModuleStep[]`, and
 * neither knows what a lab is.
 *
 * Each step keeps its own `data-step-id` section. Task 7's progress tracking needs a stable
 * per-step anchor, and a heading-derived one would move whenever a translator added a subheading.
 */
export function StudyShell({ moduleId, title, steps }: StudyShellProps) {
  const { t } = useLocale();
  // Opening the column is reading it; the lecture shell records per step instead.
  useRecordProgress(moduleId, steps.length);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
        <Link
          to={`/lecture/m/${moduleId}/0`}
          className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {t('shell.lecture_mode')}
        </Link>
      </header>

      {steps.length === 0 ? (
        <p data-testid="study-empty" className="text-slate-600">
          {t('lecture.empty')}
        </p>
      ) : (
        <div className="space-y-10">
          {steps.map((step) => (
            <section key={step.id} data-step-id={step.id}>
              {step.node}
              {step.kind === 'checkpoint' && (
                // Generated, not authored (PRD §6.5): a checkpoint exists in every module without
                // ninety of them being written. One graph feeds them all for now — see D63.
                <div className="mt-4">
                  <Quiz items={itemsFor(moduleId, step.id, CHECKPOINT_GRAPH, 3)} />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-4 text-sm">
        <Link to="/" className="text-slate-600 hover:text-slate-900">
          {t('shell.all_modules')}
        </Link>
      </footer>
    </main>
  );
}
