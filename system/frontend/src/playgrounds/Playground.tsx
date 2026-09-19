import { useLocale } from '../i18n/useLocale';
import { PLAYGROUND_MOUNTS } from './mounts';

/**
 * What `<Playground kp="F1" />` in an MDX body resolves to.
 *
 * Supplied to the MDX through the `components` prop in `content/registry.tsx`, the way `Step`
 * is, rather than imported by each module. A module is two locale files, and an import line in
 * each is two places to drift; there is one here instead.
 */
export function Playground({ kp }: { kp: string }) {
  const { t } = useLocale();
  const Mount = PLAYGROUND_MOUNTS[kp];
  if (!Mount) {
    return (
      <p data-testid="playground-unknown" className="my-6 rounded border border-amber-300 bg-amber-50 p-4 text-base">
        {t('playground.unknown')} <span className="font-mono">{kp}</span>
      </p>
    );
  }
  return <Mount />;
}
