import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useLocale } from '../i18n/useLocale';
import { messageOf } from './api';

/**
 * The chrome every standalone lab shares, and the three states it can be in.
 *
 * `data-lab` on the root is what the route test reads. It exists so "the route rendered the lab"
 * is a fact the suite can assert rather than a shape it infers from whatever text the lab
 * happens to contain — a lab could be rewritten to say something else and the assertion would
 * still be about the right thing.
 *
 * The failure state renders the backend's own bilingual sentence, from `ApiFailure`, because
 * contracts §1.1 writes those sentences for the reader and NFR-1 forbids a stack trace. A lab
 * showing "422" instead is a support question with a known answer.
 */
export function LabFrame({
  labId,
  pending,
  error,
  children,
}: {
  labId: string;
  pending?: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  const { locale, t } = useLocale();

  return (
    <main data-testid="lab-root" data-lab={labId} className="mx-auto max-w-5xl px-6 py-8">
      <nav className="mb-6 flex items-baseline gap-3 text-sm">
        <Link to="/" className="text-slate-600 underline hover:text-slate-900">
          {t('shell.all_modules')}
        </Link>
        <span className="font-mono text-slate-400">{labId}</span>
      </nav>

      {error ? (
        <p
          data-testid="lab-failure"
          className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          {messageOf(error, locale)}
        </p>
      ) : pending ? (
        <p data-testid="lab-pending" className="text-slate-500">
          {t('lab.loading')}
        </p>
      ) : (
        children
      )}
    </main>
  );
}

/** A lab id the registry does not know. Named, so a mistyped URL says which one. */
export function UnknownLab({ labId }: { labId: string }) {
  const { t } = useLocale();
  return (
    <main data-testid="lab-unknown" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t('lab.unknown')}</h1>
      <p className="mt-2 font-mono text-sm text-slate-600">{labId}</p>
      <Link to="/" className="mt-6 inline-block text-slate-600 underline hover:text-slate-900">
        {t('shell.all_modules')}
      </Link>
    </main>
  );
}
