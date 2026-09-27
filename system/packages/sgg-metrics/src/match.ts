import { boxIou } from './iou.js';
import { maskIou } from './rle.js';
import type { BBox, RLEMask, SceneGraph, VerdictKind } from './types.js';

/** Mirrors backend/app/eval/match.py. */
export interface Triplet {
  index: number;
  relationship_id: number;
  subject_id: number;
  object_id: number;
  subject_name: string;
  predicate: string;
  object_name: string;
  subject_bbox: BBox;
  object_bbox: BBox;
  subject_mask: RLEMask | null;
  object_mask: RLEMask | null;
  score: number | null;
}

export function classes(t: Triplet): [string, string, string] {
  return [t.subject_name, t.predicate, t.object_name];
}

/** Unambiguous key for a class signature. JSON, not a separator a predicate could contain. */
export function classKey(t: Triplet): string {
  return JSON.stringify(classes(t));
}

export function toTriplets(graph: SceneGraph): Triplet[] {
  const byId = new Map(graph.objects.map((o) => [o.object_id, o]));
  return graph.relationships.map((r, index) => {
    const s = byId.get(r.subject_id)!;
    const o = byId.get(r.object_id)!;
    return {
      index,
      relationship_id: r.relationship_id,
      subject_id: r.subject_id,
      object_id: r.object_id,
      subject_name: s.names[0]!,
      predicate: r.predicate,
      object_name: o.names[0]!,
      subject_bbox: s.bbox,
      object_bbox: o.bbox,
      subject_mask: s.mask ?? null,
      object_mask: o.mask ?? null,
      score: r.score ?? null,
    };
  });
}

function overlap(
  aBox: BBox,
  bBox: BBox,
  aMask: RLEMask | null,
  bMask: RLEMask | null,
  useMasks: boolean,
): number {
  if (useMasks && aMask !== null && bMask !== null) return maskIou(aMask, bMask);
  return boxIou(aBox, bBox);
}

export type MatchOutcome = [VerdictKind, number | null, number | null, number | null];

/**
 * Classify one prediction against the ground truth. Does not mutate `used`.
 *
 * Among unused ground truths satisfying all five conjuncts, the lowest index wins. If none
 * does but at least one agrees on all three classes, the verdict is 'localization' from the
 * candidate with the highest min(iouSubject, iouObject), and that ground truth is not
 * consumed. Otherwise 'spurious'. SRS 4.2 makes this order part of the specification because
 * it is observable in the diff view.
 */
export function classify(
  pred: Triplet,
  gts: Triplet[],
  used: boolean[],
  iouThresh: number,
  useMasks: boolean,
): MatchOutcome {
  let bestLoc: [number, number, number, number] | null = null;
  const pc = classes(pred);
  for (let gi = 0; gi < gts.length; gi += 1) {
    const gt = gts[gi]!;
    const gc = classes(gt);
    if (pc[0] !== gc[0] || pc[1] !== gc[1] || pc[2] !== gc[2]) continue;
    const ious = overlap(
      pred.subject_bbox,
      gt.subject_bbox,
      pred.subject_mask,
      gt.subject_mask,
      useMasks,
    );
    const iuo = overlap(
      pred.object_bbox,
      gt.object_bbox,
      pred.object_mask,
      gt.object_mask,
      useMasks,
    );
    if (!used[gi] && ious >= iouThresh && iuo >= iouThresh) return ['match', gi, ious, iuo];
    const weakest = Math.min(ious, iuo);
    if (bestLoc === null || weakest > bestLoc[0]) bestLoc = [weakest, gi, ious, iuo];
  }
  if (bestLoc !== null) return ['localization', bestLoc[1], bestLoc[2], bestLoc[3]];
  return ['spurious', null, null, null];
}
