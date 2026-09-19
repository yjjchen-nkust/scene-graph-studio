import { ImageOverlay } from '../../graph/ImageOverlay';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import { candidateSpace, clamp, densityCut, formatRatio, ratio } from '../logic';
import { FRAMES, SLICE_PREDICATE_COUNT, frameById } from '../slice';

// Vite resolves these at build time and emits them as assets on this origin, so the playground
// draws a photograph with no backend running.
const IMAGES = import.meta.glob('../../../../../data/slices/placeholder/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function imageUrl(imageId: string): string {
  const hit = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${imageId}.png`));
  return hit?.[1] ?? '';
}

/** VG-150's predicate count, which M0's own worked example computes with. */
const VG150_PREDICATES = 50;

/**
 * F1 — 從標籤到結構.
 *
 * The claim M0 opens with is that a list of labels loses the scene. Turning every layer off
 * returns the bare photograph, which is that claim as a picture. The density slider then makes
 * the second claim: the candidate space does not move when the annotation budget does, and the
 * ratio between them is why every metric in this field is a recall rather than a precision.
 *
 * Computes a count, a bound and their ratio. No metric: that boundary is what separates a
 * playground from a lab.
 */
export function LabelsToStructure() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F1.img': FRAMES[0].image_id,
    'F1.density': 1,
    'F1.P': SLICE_PREDICATE_COUNT,
    'F1.labels': 1,
    'F1.boxes': 1,
    'F1.rel': 1,
  });

  const frame = frameById(params['F1.img']) ?? FRAMES[0];
  const density = clamp(params['F1.density'], 0, 1);
  // A |P| the URL invented is neither of the two on offer, and a bound computed from it would be
  // a number with no stated origin. Fall back rather than display it.
  const predicateCount =
    params['F1.P'] === VG150_PREDICATES ? VG150_PREDICATES : SLICE_PREDICATE_COUNT;

  const kept = densityCut(frame.relationships, density);
  const objectCount = frame.objects.length;
  const candidates = candidateSpace(objectCount, predicateCount, true);
  const share = ratio(kept.length, candidates);

  const controls = (
    <>
      <Choice
        id="F1.frame"
        label={t('playground.frame')}
        value={frame.image_id}
        options={FRAMES.map((f) => ({ value: f.image_id, label: f.image_id }))}
        onChange={(next) => setParams({ 'F1.img': next })}
      />
      <Toggle
        id="F1.labels"
        label={t('playground.layer_labels')}
        checked={params['F1.labels'] === 1}
        onChange={(on) => setParams({ 'F1.labels': on ? 1 : 0 })}
      />
      <Toggle
        id="F1.boxes"
        label={t('playground.layer_boxes')}
        checked={params['F1.boxes'] === 1}
        onChange={(on) => setParams({ 'F1.boxes': on ? 1 : 0 })}
      />
      <Toggle
        id="F1.rel"
        label={t('playground.layer_relations')}
        checked={params['F1.rel'] === 1}
        onChange={(on) => setParams({ 'F1.rel': on ? 1 : 0 })}
      />
      <Slider
        id="F1.density"
        label={t('playground.density')}
        value={density}
        min={0}
        max={1}
        step={1 / Math.max(frame.relationships.length, 1)}
        onChange={(next) => setParams({ 'F1.density': next })}
        valueLabel={`${kept.length} / ${frame.relationships.length}`}
      />
      <Choice
        id="F1.P"
        label={t('playground.predicate_vocabulary')}
        value={String(predicateCount)}
        options={[
          { value: String(SLICE_PREDICATE_COUNT), label: t('playground.vocab_slice') },
          { value: String(VG150_PREDICATES), label: t('playground.vocab_vg150') },
        ]}
        onChange={(next) => setParams({ 'F1.P': Number(next) })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F1" controls={controls}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <ImageOverlay
          imageUrl={imageUrl(frame.image_id)}
          width={frame.width}
          height={frame.height}
          objects={frame.objects}
          relationships={kept}
          mode="view"
          layers={{
            boxes: params['F1.boxes'] === 1,
            relationships: params['F1.rel'] === 1,
            labels: params['F1.labels'] === 1,
          }}
          className="max-w-2xl"
        />
        <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <Readout label={t('playground.objects')} value={String(objectCount)} note="|V|" />
          <Readout
            label={t('playground.annotated')}
            value={String(kept.length)}
            note={`|E| / ${frame.relationships.length}`}
          />
          <Readout
            label={t('playground.candidates')}
            value={String(candidates)}
            note={`${objectCount} × ${objectCount - 1} × ${predicateCount}`}
          />
          <Readout
            label={t('playground.ratio')}
            value={formatRatio(share)}
            note={`${kept.length} / ${candidates}`}
          />
        </div>
      </div>
    </PlaygroundFrame>
  );
}
