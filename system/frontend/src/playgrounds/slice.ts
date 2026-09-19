import type { SceneGraph } from 'sgg-metrics';
import raw from '../../../../data/slices/placeholder/annotations.json';

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
