import { useLocale } from '../i18n/useLocale';
import { PartContext } from '../playgrounds/controls';
import { DEMO_MOUNTS, DEMO_PARTS } from './mounts';

/**
 * What `<Demo id="DT" part="1" />` in an MDX body resolves to.
 *
 * Supplied to the MDX through the `components` prop in `content/registry.tsx`, as `Playground`
 * is, so no module imports it. A demo always spans parts, so a part absent, not an integer, or
 * outside 1 to `DEMO_PARTS[id]` is named on the slide, as an unknown demo is, rather than rounded
 * to one that exists.
 */
export function Demo({ id, part }: { id: string; part?: string }) {
  const { t } = useLocale();
  const Mount = DEMO_MOUNTS[id];
  const parts = DEMO_PARTS[id];
  const n = part === undefined ? NaN : Number(part);
  const partKnown = parts !== undefined && Number.isInteger(n) && n >= 1 && n <= parts;
  if (!Mount || !partKnown) {
    return (
      <p data-testid="demo-unknown" className="my-6 rounded border border-amber-300 bg-amber-50 p-4 text-[1em]">
        {t(parts !== undefined && !partKnown ? 'demo.unknown_part' : 'demo.unknown')}{' '}
        <span className="font-mono">{id}{part === undefined ? '' : ` ${t('demo.part')} ${part}`}</span>
      </p>
    );
  }
  return (
    <PartContext.Provider value={n}>
      <Mount part={n} />
    </PartContext.Provider>
  );
}
