import type { Warning } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';

/**
 * The engine's warnings, rendered wherever its numbers are.
 *
 * `gt_boxes_not_pairs` is emitted on every PredCls and SGCls response without exception, and
 * contracts §2.5 gives the reason: SRS §4.4 names it the most common misreading in the field, so
 * making it unconditional is what stops a student seeing a PredCls number without seeing it. A
 * component that computes the warnings and then does not show them defeats that exactly, which
 * is why every surface that renders a `MetricValue` renders this beside it.
 *
 * The messages come from the engine already translated into both locales, so nothing here is
 * re-worded: a warning a student quotes is the warning the backend would have sent.
 */
export function WarningList({ warnings, className = '' }: { warnings: Warning[]; className?: string }) {
  const { locale, t } = useLocale();
  if (warnings.length === 0) return null;
  return (
    <section className={className} aria-label={t('warnings.heading')}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        {t('warnings.heading')}
      </h3>
      <ul className="space-y-1">
        {warnings.map((w) => (
          <li
            key={w.code}
            data-testid={`warning-${w.code}`}
            data-code={w.code}
            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-amber-900"
          >
            {locale === 'en' ? w.message_en : w.message_zh}
          </li>
        ))}
      </ul>
    </section>
  );
}
