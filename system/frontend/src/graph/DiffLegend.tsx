import { useLocale } from '../i18n/useLocale';
import { VERDICT_ORDER, VERDICT_STYLE } from './palette';

/**
 * The key to the four-colour diff.
 *
 * Each row draws its own swatch from `VERDICT_STYLE`, so the legend cannot drift from the graph:
 * if a hue or a dash pattern changes, both move together. The swatch is a real SVG line with the
 * real stroke and dash, not a coloured square, because the dash pattern is half the information
 * (NFR-5) and a square would show only the hue.
 */
export function DiffLegend({ className = '' }: { className?: string }) {
  const { t } = useLocale();
  return (
    <ul className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${className}`}>
      {VERDICT_ORDER.map((kind) => {
        const style = VERDICT_STYLE[kind];
        return (
          <li
            key={kind}
            data-verdict={kind}
            data-testid={`legend-${kind}`}
            className="inline-flex items-center gap-2"
          >
            <svg width="28" height="10" aria-hidden="true" className="shrink-0">
              <line
                x1="1"
                y1="5"
                x2="27"
                y2="5"
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash || undefined}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-slate-700">{t(style.labelKey)}</span>
          </li>
        );
      })}
    </ul>
  );
}
