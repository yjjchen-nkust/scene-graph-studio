import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice } from '../../playgrounds/controls';
import { DEFAULT_FRAME, FRAME_IDS, TRADITIONAL, frameLabel, resolveFrame } from '../data';
import { DemoFrame } from '../DemoFrame';
import type { DemoProps } from '../mounts';
import { Part1 } from './Part1';
import { Part2 } from './Part2';
import { Part3 } from './Part3';
import { Part4 } from './Part4';

/**
 * D-T — the traditional pipeline over the clip's ten frames: detect, enumerate, classify (spec
 * 2026-09-29-m0-demos-design §3.2), one shortcoming to a part (§4).
 *
 * 1. Closed vocabulary: the clip, the frame with the detector's COCO boxes, and each `O_ISG`
 *    class with or without a COCO category under the class map.
 * 2. Pair explosion: n(n − 1) ordered pairs and n(n − 1)·|P| candidate triplets.
 * 3. Generic predicates: the predicate histograms, `P_ISG` present or absent, and which pairs the
 *    prior classified rather than the fallback.
 * 4. No temporal coherence: the ten frames as a strip, |Δ| and |∪| between neighbours, and the
 *    chosen frame's triplets against the frame before.
 *
 * One knob, `DT.frame`, held in the URL, so the stepper carries it from part to part (D96). An id
 * the clip does not have, or none, reads as `DEFAULT_FRAME`. Part 1 picks through the clip's
 * ticks and part 4 through its thumbnails; parts 2 and 3, which show no picture of the clip, carry
 * the same knob as a list.
 *
 * Every figure is a count, a set membership or a set difference over `TRADITIONAL`, computed
 * through `logic.ts`; nothing here is a metric and nothing imports a value from `sgg-metrics`.
 */
export function Traditional({ part }: DemoProps) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ 'DT.frame': DEFAULT_FRAME });
  const id = resolveFrame(params['DT.frame']);
  // `data.test.ts` holds the artefact's frames to the manifest's ids, which `resolveFrame` keeps to.
  const frame = TRADITIONAL.frames.find((f) => f.image_id === id)!;
  const pick = (next: string) => setParams({ 'DT.frame': next });

  const controls = part === 2 || part === 3
    ? (
      <Choice
        id="DT.frame"
        label={t('demo.frame')}
        value={id}
        options={FRAME_IDS.map((f) => ({ value: f, label: frameLabel(f) }))}
        onChange={pick}
      />
    )
    : null;

  const { provenance, prior } = TRADITIONAL;
  const line = [
    provenance.model,
    provenance.generated_at.slice(0, 10),
    t('demo.provenance_measured'),
    t('demo.dt.prior_source').replace('{frames}', String(prior.frames)),
  ].join(' · ');

  return (
    <DemoFrame title={t(`demo.dt.title${part}`)} controls={controls} provenance={line}>
      {part === 1 && <Part1 frame={frame} onPick={pick} />}
      {part === 2 && <Part2 frame={frame} />}
      {part === 3 && <Part3 frame={frame} />}
      {part === 4 && <Part4 frame={frame} onPick={pick} />}
    </DemoFrame>
  );
}
