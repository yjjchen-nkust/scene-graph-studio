import { useLocale } from '../../i18n/useLocale';
import { TRADITIONAL, frameLabel, frameUrl, type TraditionalFrame, type Triplet } from '../data';
import { churn, churnFraction, distinct, traditionalTriplets, tripletKey } from '../logic';
import { MARK, SIGN, type Change } from '../marks';

/** A thumbnail's height at most, in viewport heights. */
const THUMB_VH = 9;

/**
 * D-T, part 4: no temporal coherence.
 *
 * The ten frames as a strip of thumbnails, each a button choosing its frame, with |E_t| beneath
 * it and, between it and the frame before, |E_{t−1} Δ E_t| over |E_{t−1} ∪ E_t| and their ratio,
 * `—` where both sets are empty. Below, the chosen frame's distinct class-level triplets against
 * the frame before: kept, added (`+`) and removed (`−`), in Figure 6's marks (`marks.ts`), which
 * D-V's parts 3 and 5 draw with too.
 *
 * E_t is a set of distinct class-level triplets, as spec §4 defines it for churn: the pipeline
 * tracks no identity across frames, so two detections of one class name one triplet (D96).
 *
 * The strip is a grid of five columns, so it takes two rows at every panel width rather than
 * wrapping wherever the thumbnails and the figures between them happen to run out of room.
 */
export function Part4({ frame, onPick }: { frame: TraditionalFrame; onPick: (id: string) => void }) {
  const { t } = useLocale();
  const frames = TRADITIONAL.frames;
  const sets = frames.map((f) => distinct(traditionalTriplets(f)));
  const at = frames.findIndex((f) => f.image_id === frame.image_id);
  const current = sets[at] ?? [];
  const before = at > 0 ? frames[at - 1]! : undefined;
  const step = at > 0 ? churn(sets[at - 1]!, current) : undefined;
  const added = new Set(step?.added.map(tripletKey));
  const items: { triplet: Triplet; change: Change }[] = [
    ...current.map((triplet) => ({ triplet, change: added.has(tripletKey(triplet)) ? 'added' as const : 'kept' as const })),
    ...(step?.removed ?? []).map((triplet) => ({ triplet, change: 'removed' as const })),
  ];
  const time = frameLabel(frame.image_id);

  const heading = step && before
    ? t('demo.dt.changes')
      .replace('{time}', time)
      .replace('{prev}', frameLabel(before.image_id))
      .replace('{kept}', String(step.kept.length))
      .replace('{added}', String(step.added.length))
      .replace('{removed}', String(step.removed.length))
    : t('demo.dt.first').replace('{time}', time);

  return (
    <div className="flex flex-col gap-1">
      <ol data-testid="dt-strip" className="grid grid-cols-5 gap-1">
        {frames.map((f, i) => {
          const id = f.image_id;
          const chosen = id === frame.image_id;
          const c = i > 0 ? churn(sets[i - 1]!, sets[i]!) : undefined;
          return (
            <li key={id} className="flex min-w-0 items-center gap-1">
              {c ? (
                <span
                  data-testid={`dt-churn-${id}`}
                  className="flex w-11 shrink-0 flex-col items-center text-[0.75em] leading-tight tabular-nums text-slate-900"
                >
                  <span data-testid={`dt-churn-${id}-delta`} className="whitespace-nowrap">{`Δ ${c.delta}`}</span>
                  <span data-testid={`dt-churn-${id}-union`} className="whitespace-nowrap border-t border-slate-700">
                    {`∪ ${c.union}`}
                  </span>
                  <span data-testid={`dt-churn-${id}-fraction`}>{churnFraction(c)}</span>
                </span>
              ) : (
                <span className="w-11 shrink-0" aria-hidden="true" />
              )}
              <button
                type="button"
                data-testid={`dt-thumb-${id}`}
                aria-pressed={chosen}
                onClick={() => onPick(id)}
                className={
                  chosen
                    ? 'min-w-0 flex-1 rounded border-2 border-slate-900 bg-white font-bold text-slate-900'
                    : 'min-w-0 flex-1 rounded border-2 border-transparent bg-white text-slate-900'
                }
                style={{ maxWidth: `calc(${THUMB_VH}vh * ${f.width} / ${f.height})` }}
              >
                <span className="relative block">
                  <img
                    src={frameUrl(id)}
                    alt={t('demo.dt.thumb').replace('{time}', frameLabel(id))}
                    width={f.width}
                    height={f.height}
                    className="block h-auto w-full"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 whitespace-nowrap bg-white px-1 text-[0.75em] leading-tight"
                  >
                    {frameLabel(id)}
                  </span>
                </span>
                <span
                  data-testid={`dt-edges-${id}`}
                  className={
                    chosen
                      ? 'block text-center text-[0.75em] leading-tight underline decoration-2 underline-offset-2'
                      : 'block text-center text-[0.75em] leading-tight'
                  }
                >
                  {`|E| = ${sets[i]!.length}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p data-testid="dt-changes" data-first={String(!step)} className="text-[0.75em] leading-tight text-slate-900">
        {heading}
      </p>
      {items.length === 0 ? (
        <p data-testid="dt-triplets-none" className="text-[0.75em] leading-tight text-slate-900">
          {t('demo.dt.no_triplet')}
        </p>
      ) : (
        <ul data-testid="dt-triplets" className="flex flex-wrap gap-x-4 gap-y-0.5 text-[0.75em] leading-tight">
          {items.map(({ triplet, change }, k) => (
            <li
              key={`${change}:${tripletKey(triplet)}`}
              data-testid={`dt-triplet-${k}`}
              data-change={change}
              data-triplet={triplet.join('|')}
              className={MARK[change]}
            >
              {`${SIGN[change]}${triplet.join(' ')}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
