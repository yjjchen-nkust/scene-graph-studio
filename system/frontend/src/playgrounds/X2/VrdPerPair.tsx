import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout } from '../controls';
import { VRD_CUT, VRD_PREDICATES } from '../E13/setup';
import { candidateSpace } from '../logic';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';

const M_OPTIONS = ['1', '10', '70'];
const M_DEFAULT = '10';

/** ph-001's own frame: six objects, no fixture and no photograph is drawn from it here. */
const X2_FRAME = 'ph-001';

/**
 * X2 — VRD's per-pair count.
 *
 * A three-way `Choice` for m, VRD's predicates admitted per ordered pair (its own k, M4 s15).
 * ph-001's six objects fix 30 ordered pairs regardless of m; the pool is those pairs times
 * min(m, 70), since VRD carries only 70 predicates; the most one pair can place in the top
 * K = 100 is min(m, 100); and the cut at 100 selects only once the pool exceeds it, which does
 * not happen at m = 1 (pool 30).
 *
 * Computes four counts, one of them a yes/no over an inequality. No metric. One part: counts
 * alone, no list and no photograph.
 */
export function VrdPerPair(_: PlaygroundProps = {}) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ 'X2.m': M_DEFAULT as string });

  const mStr = M_OPTIONS.includes(params['X2.m']) ? params['X2.m'] : M_DEFAULT;
  const m = Number(mStr);

  const frame = frameById(X2_FRAME)!;
  const n = frame.objects.length;

  const pairs = candidateSpace(n, 1, true);
  const pool = candidateSpace(n, Math.min(m, VRD_PREDICATES), true);
  const share = Math.min(m, VRD_CUT);
  const selects = pool > VRD_CUT;
  const cutValue = t(selects ? 'playground.x2.cut_yes' : 'playground.x2.cut_no').replace(
    '{pool}',
    pool.toLocaleString('en-US'),
  );

  const controls = (
    <Choice
      id="X2.m"
      label={t('playground.x2.m')}
      value={mStr}
      options={M_OPTIONS.map((v) => ({ value: v, label: v }))}
      onChange={(next) => setParams({ 'X2.m': next })}
    />
  );

  return (
    <PlaygroundFrame title="X2" controls={controls} clip={false} dense>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <Readout
          id="X2.pairs"
          label={t('playground.x2.pairs')}
          value={pairs.toLocaleString('en-US')}
          note={t('playground.x2.pairs_note')}
        />
        <Readout
          id="X2.pool"
          label={t('playground.x2.pool')}
          value={pool.toLocaleString('en-US')}
          note={t('playground.x2.pool_note')}
        />
        <Readout
          id="X2.share"
          label={t('playground.x2.share')}
          value={share.toLocaleString('en-US')}
          note={t('playground.x2.share_note')}
        />
        {/* No copy-table key names this note; "pool > 100" is the plain arithmetic condition
            the yes/no rests on, not translated because no key exists for it (see the report). */}
        <Readout id="X2.cut" label={t('playground.x2.cut')} value={cutValue} note="pool > 100" />
      </div>
    </PlaygroundFrame>
  );
}
