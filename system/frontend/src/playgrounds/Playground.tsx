import { useLocale } from '../i18n/useLocale';
import { PartContext } from './controls';
import { PLAYGROUND_MOUNTS, PLAYGROUND_PARTS } from './mounts';

/**
 * What `<Playground kp="F1" />` in an MDX body resolves to.
 *
 * Supplied to the MDX through the `components` prop in `content/registry.tsx`, the way `Step`
 * is, rather than imported by each module. A module is two locale files, and an import line in
 * each is two places to drift; there is one here instead.
 */
export function Playground({ kp, part }: { kp: string; part?: string }) {
  const { t } = useLocale();
  const Mount = PLAYGROUND_MOUNTS[kp];
  // MDX hands the attribute over as a string. A part the mount table does not give is named on
  // the slide, as an unknown playground is, rather than rounded to one that exists.
  const n = part === undefined ? undefined : Number(part);
  const parts = PLAYGROUND_PARTS[kp] ?? 1;
  const partKnown = n === undefined || (parts > 1 && Number.isInteger(n) && n >= 1 && n <= parts);
  if (!Mount || !partKnown) {
    return (
      <p data-testid="playground-unknown" className="my-6 rounded border border-amber-300 bg-amber-50 p-4 text-[1em]">
        {t(Mount ? 'playground.unknown_part' : 'playground.unknown')}{' '}
        <span className="font-mono">{kp}{part === undefined ? '' : ` ${t('playground.part')} ${part}`}</span>
      </p>
    );
  }
  return (
    <PartContext.Provider value={n}>
      <Mount part={n} />
    </PartContext.Provider>
  );
}
