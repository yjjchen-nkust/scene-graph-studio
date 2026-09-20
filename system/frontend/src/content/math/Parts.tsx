import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/useLocale';

/**
 * The four-part presentation contract of SRS §11.2, as components.
 *
 * Deliberately thin: a heading from `t()` and a styled container. Their value is structural, not
 * visual. `tools/content_lint.mjs` can only check that a definition arrives as intuition, then
 * statement, then worked example, then implications if those four things have names in the
 * source — a convention with no name is the first thing a deadline removes, and the result is a
 * formula dropped on a page with no account of what it measures or where it is gamed.
 *
 * The order is the order the professor teaches in, so the lint checks order and not merely
 * presence.
 */
function Part({ name, tone, children }: { name: string; tone: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    // `data-part` carries the component name, which is the name `tools/content_lint.mjs`
    // checks for in the source. One vocabulary, so a test and the lint agree on what a part is.
    <section data-part={name} className={`my-4 rounded border-l-4 pl-4 ${tone}`}>
      {/* `text-[0.75em]` and `slate-700`, not `text-xs` and `slate-500`. The heading names one of
          the four parts SRS §11.2 fixes, so it is read from the room, not skimmed: at 12 px and
          4.76:1 it met neither the deck's 18 px floor nor NFR-5's 7:1. It sat on every
          mathematics step in the corpus and `projector.spec.ts` could not see it, because the
          instrument filtered to a list of tag names that did not include `h4`. Sized in em so it
          follows whichever shell it is in, as the playgrounds are. */}
      <h4 className="mb-1 text-[0.75em] font-semibold uppercase tracking-wide text-slate-700">
        {t(`math.${name.toLowerCase()}`)}
      </h4>
      <div className="prose prose-slate max-w-none">{children}</div>
    </section>
  );
}

export function Intuition({ children }: { children: ReactNode }) {
  return <Part name="Intuition" tone="border-sky-400">{children}</Part>;
}

export function Formal({ children }: { children: ReactNode }) {
  return <Part name="Formal" tone="border-slate-400">{children}</Part>;
}

export function Worked({ children }: { children: ReactNode }) {
  return <Part name="Worked" tone="border-emerald-400">{children}</Part>;
}

export function Implications({ children }: { children: ReactNode }) {
  return <Part name="Implications" tone="border-amber-400">{children}</Part>;
}
