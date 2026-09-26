import { ImageOverlay } from '../../graph/ImageOverlay';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import type { PlaygroundProps } from '../mounts';
import { candidateSpace, clamp, densityCut, flag, formatRatio, ratio } from '../logic';
import { placeholderImageUrl } from '../images';
import { FRAMES, SLICE_PREDICATE_COUNT, frameById } from '../slice';

/** VG-150's predicate count, which M0's own worked example computes with. */
const VG150_PREDICATES = 50;

/** The photograph's height at most, in viewport heights: part 1 fits 1024×768 with it (D96). */
const PICTURE_VH = 38;

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
 *
 * Two parts (D96): the picture and its layers, then the density, the vocabulary and the four
 * readouts. Mounted without a part, as its unit tests mount it, it is both.
 */
export function LabelsToStructure({ part }: PlaygroundProps = {}) {
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
  const layers = part !== 2;
  const counts = part !== 1;

  const controls = (
    <>
      <Choice
        id="F1.img"
        label={t('playground.frame')}
        value={frame.image_id}
        options={FRAMES.map((f) => ({ value: f.image_id, label: f.image_id }))}
        onChange={(next) => setParams({ 'F1.img': next })}
      />
      {layers && (
        <>
          <Toggle
            id="F1.labels"
            label={t('playground.layer_labels')}
            checked={flag(params['F1.labels'], true)}
            onChange={(on) => setParams({ 'F1.labels': on ? 1 : 0 })}
          />
          <Toggle
            id="F1.boxes"
            label={t('playground.layer_boxes')}
            checked={flag(params['F1.boxes'], true)}
            onChange={(on) => setParams({ 'F1.boxes': on ? 1 : 0 })}
          />
          <Toggle
            id="F1.rel"
            label={t('playground.layer_relations')}
            checked={flag(params['F1.rel'], true)}
            onChange={(on) => setParams({ 'F1.rel': on ? 1 : 0 })}
          />
        </>
      )}
      {counts && (
        <>
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
      )}
    </>
  );

  return (
    // Nothing here is clipped. The whole visual was until 2026-09-26, and at 1024 px and wider
    // the readouts stand in one column beside the picture, so the candidate count and the ratio --
    // the two numbers F1 exists to show -- sat under the clip at every panel size (D93).
    <PlaygroundFrame title="F1" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row">
        {layers && (
          // Sized, not clipped: at most PICTURE_VH tall and never wider than the frame, so the
          // photograph is whole. The overlay's children are all absolutely positioned and give
          // its box no width, and in the row at 1024 px and wider this box was given none either,
          // so the photograph rendered 0×0 on every projector from the day F1 landed (D96).
          <div
            className="min-w-0 flex-1"
            style={{ maxWidth: `calc(${PICTURE_VH}vh * ${frame.width} / ${frame.height})` }}
          >
            <ImageOverlay
              imageUrl={placeholderImageUrl(frame.image_id)}
              width={frame.width}
              height={frame.height}
              objects={frame.objects}
              // Part 1 has no density slider, so it draws the whole annotation; the cut is part 2's.
              relationships={part === 1 ? frame.relationships : kept}
              mode="view"
              layers={{
                boxes: flag(params['F1.boxes'], true),
                relationships: flag(params['F1.rel'], true),
                labels: flag(params['F1.labels'], true),
              }}
              className="w-full"
            />
          </div>
        )}
        {counts && (
          <div className={`grid shrink-0 grid-cols-2 gap-4 ${layers ? 'lg:grid-cols-1' : 'lg:grid-cols-4'}`}>
            <Readout id="F1.objects" label={t('playground.objects')} value={String(objectCount)} note="|V|" />
            <Readout
              id="F1.annotated"
              label={t('playground.annotated')}
              value={String(kept.length)}
              // `|E|` alone. This read `|E| / 6`, where the slash means "out of", directly above
              // `3 / 480`, where it means division -- and NFR-2 makes this note the place a
              // student checks the arithmetic, so a note that reads as arithmetic and is not one
              // is the wrong thing in the wrong place. The kept-of-total fraction is on the
              // density slider, which is the control that changes it.
              note="|E|"
            />
            <Readout
              id="F1.candidates"
              label={t('playground.candidates')}
              value={String(candidates)}
              note={`${objectCount} × ${objectCount - 1} × ${predicateCount}`}
            />
            <Readout
              id="F1.ratio"
              label={t('playground.ratio')}
              value={formatRatio(share)}
              note={`${kept.length} / ${candidates}`}
            />
          </div>
        )}
      </div>
    </PlaygroundFrame>
  );
}
