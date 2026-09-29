import type { SceneGraph } from 'sgg-metrics';
import raw from '../../../../data/slices/placeholder/annotations.json';
import vgRaw from '../../../../data/slices/vg150-sgb/annotations.json';

/**
 * The one place a playground's data comes from.
 *
 * Imported at build time, as `pages/papers.ts` and `labs/L5/tables.ts` already import from
 * `data/content/`. Nothing is fetched, so a playground computes with no backend running, no
 * network and no corpus unpacked — which is a stronger guarantee than the labs have, and
 * deliberately so: a playground sits inside the lecture, and a hall with nothing running is the
 * case NFR-1 exists for.
 *
 * The images are imported by the components that draw them, through Vite's asset pipeline, for
 * the same reason.
 */
const parsed = raw as unknown as { dataset: string; graphs: SceneGraph[] };

export const FRAMES: SceneGraph[] = parsed.graphs;

export function frameById(imageId: string): SceneGraph | undefined {
  return FRAMES.find((frame) => frame.image_id === imageId);
}

/**
 * The predicate vocabulary, counted from the slice rather than written down.
 *
 * F1 offers this as its "this slice" preset against VG-150's 50. A literal here would be a
 * number whose origin is a developer's memory, which is the defect D54 recorded for a contrast
 * ratio; counting it means regenerating the slice moves the label rather than falsifying it.
 */
export const PREDICATES: string[] = [
  ...new Set(FRAMES.flatMap((frame) => frame.relationships.map((r) => r.predicate))),
].sort();

export const SLICE_PREDICATE_COUNT = PREDICATES.length;

/** The object classes, counted from the slice for the same reason: E10's "this slice" vocabulary. */
export const SLICE_CLASS_COUNT = new Set(
  FRAMES.flatMap((frame) => frame.objects.map((o) => o.names[0])),
).size;

const vgParsed = vgRaw as unknown as { dataset: string; graphs: SceneGraph[] };

/**
 * The `vg150-sgb` slice in `data/`: 80 frames of annotation, and no images.
 *
 * F6 and F7 count over a real vocabulary, and the placeholder's 16 predicates are this project's
 * own and carry no synonyms. The images of this slice are not committed (D-08) and neither
 * playground draws one, so both still compute with no backend, network or corpus. 583 KB raw,
 * 34 KB gzipped.
 */
export const VG_FRAMES: SceneGraph[] = vgParsed.graphs;

export function vgFrameById(imageId: string): SceneGraph | undefined {
  return VG_FRAMES.find((frame) => frame.image_id === imageId);
}
