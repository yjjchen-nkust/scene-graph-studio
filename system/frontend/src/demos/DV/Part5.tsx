import { useLocale } from '../../i18n/useLocale';
import { CLIP_FRAMES, FRAME_IDS, KEYFRAME_IDS, TRADITIONAL, VLM, keyframeMark, type Triplet } from '../data';
import { churn, churnFraction, distinct, traditionalTriplets, tripletKey } from '../logic';
import { MARK, SIGN, type Change } from './marks';

/** A frame's time in the source video, as its tick names it, without the keyframe's mark. */
const seconds = (id: string) => `${CLIP_FRAMES.find((f) => f.image_id === id)?.t ?? id} s`;

/**
 * D-V, part 5: the frames over time.
 *
 * The three keyframes t₁, t₂ and t₃, each the distinct triplets of that frame's step-3 summary
 * (E_t is a set, D96). In t₂ and t₃ each triplet is kept, added (`+`, on a solid `blue-700` rule)
 * or removed (`−`, on a dotted `slate-700` rule) against the keyframe before; a removed triplet is
 * listed with the keyframe where it disappeared, as Figure 6 dots an edge in the later graph.
 * Below, the churn of both pipelines from each of the ten frames to the next, |E_{t−1} Δ E_t| over
 * |E_{t−1} ∪ E_t| and their ratio, `—` where both sets are empty; beside it the caption, which
 * states what the paper's equations fix: each frame is generated independently, since Eqs. (2) to
 * (4) take V_t and nothing of the frame before (spec §2), so a lower or a higher churn here is a
 * finding on this clip and not a property of the method.
 *
 * The keyframes are bands, one above the other, each a flowing list as D-T's part 4 draws its
 * triplets, rather than Figure 6's three columns (D116). At 18 px the t₂ column is seventeen rows,
 * 372 px, and three such columns take 742 px of the panel's 910: neither the churn table nor the
 * caption then fits below them or beside them at 1024×768. Flowing, the three keyframes take
 * twelve lines.
 */
export function Part5() {
  const { t, locale } = useLocale();
  const summaries = new Map(VLM.frames.map((f) => [f.image_id, distinct(f.summary)]));
  const relations = new Map(TRADITIONAL.frames.map((f) => [f.image_id, distinct(traditionalTriplets(f))]));
  const setOf = (sets: Map<string, Triplet[]>, id: string) => sets.get(id) ?? [];

  // Each keyframe: its own triplets, marked against the keyframe before, then what it removed.
  const keyframes = KEYFRAME_IDS.map((id, k): { id: string; items: { triplet: Triplet; change: Change }[] } => {
    const current = setOf(summaries, id);
    if (k === 0) return { id, items: current.map((triplet) => ({ triplet, change: 'kept' })) };
    const step = churn(setOf(summaries, KEYFRAME_IDS[k - 1]!), current);
    const added = new Set(step.added.map(tripletKey));
    return {
      id,
      items: [
        ...current.map((triplet) => ({ triplet, change: added.has(tripletKey(triplet)) ? 'added' : 'kept' } as const)),
        ...step.removed.map((triplet) => ({ triplet, change: 'removed' } as const)),
      ],
    };
  });

  const steps = FRAME_IDS.slice(1).map((id, i) => ({
    id,
    dt: churn(setOf(relations, FRAME_IDS[i]!), setOf(relations, id)),
    dv: churn(setOf(summaries, FRAME_IDS[i]!), setOf(summaries, id)),
  }));

  return (
    <div className="flex flex-col gap-2 text-[0.75em] leading-[1.15] text-slate-900">
      <div className="flex flex-col gap-1">
        {keyframes.map(({ id, items }) => (
          <section key={id} className="flex flex-wrap gap-x-4 border-t border-slate-300 first:border-t-0">
            <span className="whitespace-nowrap font-mono font-semibold">{`${keyframeMark(id)} ${seconds(id)}`}</span>
            {items.length === 0 ? (
              <span data-testid={`dv-keyframe-${id}-none`}>{t('demo.dv.no_triplet')}</span>
            ) : (
              <ul data-testid={`dv-keyframe-${id}`} className="contents">
                {items.map(({ triplet, change }, k) => (
                  <li
                    key={`${change}:${tripletKey(triplet)}`}
                    data-testid={`dv-keyframe-${id}-${k}`}
                    data-change={change}
                    data-triplet={triplet.join('|')}
                    className={`whitespace-nowrap ${MARK[change]}`}
                  >
                    {SIGN[change] && <span className={change === 'added' ? 'text-blue-700' : undefined}>{SIGN[change]}</span>}
                    {triplet.join(' ')}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-4">
        <table data-testid="dv-churn" className="border-collapse lg:shrink-0">
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="whitespace-nowrap pr-2 text-left font-semibold">|Δ| / |∪|</th>
              {steps.map(({ id }) => (
                <th key={id} scope="col" className="whitespace-nowrap px-1 text-right font-normal tabular-nums">{seconds(id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['dt', 'dv'] as const).map((pipeline) => (
              <tr key={pipeline}>
                <th scope="row" className="pr-2 text-left align-top font-semibold">{pipeline === 'dt' ? 'D-T' : 'D-V'}</th>
                {steps.map((s) => {
                  const c = s[pipeline];
                  const cell = `dv-churn-${pipeline}-${s.id}`;
                  return (
                    <td key={s.id} data-testid={cell} className="whitespace-nowrap px-1 text-right align-top tabular-nums">
                      <span className="block">
                        <span data-testid={`${cell}-delta`}>{c.delta}</span>
                        /
                        <span data-testid={`${cell}-union`}>{c.union}</span>
                      </span>
                      <span data-testid={`${cell}-fraction`} className="block font-semibold">{churnFraction(c)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="min-w-0 flex-1">
          {/* One paragraph, so the two sentences share the lines beside the table. */}
          {`${t('demo.dv.churn_caption')}${locale === 'zh-TW' ? '' : ' '}`}
          <span data-testid="dv-independent">{t('demo.dv.independent')}</span>
        </p>
      </div>
    </div>
  );
}
