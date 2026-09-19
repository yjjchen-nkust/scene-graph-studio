import type { EvalRequest, SceneGraph, SGRelationship } from 'sgg-metrics';

export interface Triplet {
  subject_id: number;
  object_id: number;
  predicate: string;
}

/**
 * L1 scores under PredCls, which is the protocol that isolates what the lab teaches.
 *
 * PredCls supplies the ground-truth boxes and labels, so the only thing the student is judged on
 * is the predicate and the pair they chose. Under SGDet the same submission would also be judged
 * on detection they never performed, and a low number would say nothing about the relation
 * reasoning the exercise is about. The constraint is `graph`, the strictest reading, so a student
 * cannot raise their score by proposing several predicates for one pair.
 */
export const DEFAULT_PARAMS = {
  protocol: 'predcls',
  constraint: 'graph',
  k: [20, 50, 100],
  iou_thresh: 0.5,
  mask_pairing: 'single_mpo',
} as const satisfies Omit<EvalRequest, 'gt' | 'pred'>;

const SEPARATOR = ',';

/** `1-on-2,3-near-4`. The predicate sits in the middle because an id cannot contain a hyphen. */
export function encodeTriplets(triplets: Triplet[]): string {
  return triplets.map((t) => `${t.subject_id}-${t.predicate}-${t.object_id}`).join(SEPARATOR);
}

export function decodeTriplets(raw: string): Triplet[] {
  const out: Triplet[] = [];
  for (const part of raw.split(SEPARATOR)) {
    const first = part.indexOf('-');
    const last = part.lastIndexOf('-');
    if (first <= 0 || last <= first) continue;
    const subject = Number(part.slice(0, first));
    const object = Number(part.slice(last + 1));
    const predicate = part.slice(first + 1, last);
    if (!Number.isInteger(subject) || !Number.isInteger(object) || !predicate) continue;
    out.push({ subject_id: subject, object_id: object, predicate });
  }
  return out;
}

/**
 * The graph the student built, as a `SceneGraph` the engine will accept.
 *
 * The objects are the ground truth's, unchanged, because PredCls gives them; the student
 * contributes only the edges. Scores descend in the order the triplets were added, which makes
 * that order the student's own ranking — the thing R@K reads.
 *
 * A triplet naming an object the image does not contain is dropped. `t` arrives from the address
 * bar, so it is user input, and a hand-edited id must not reach the engine as something to
 * believe: `SceneGraph` forbids a dangling reference, and inventing an object to satisfy one
 * would be scoring a claim nobody made.
 */
export function studentGraph(gt: SceneGraph, triplets: Triplet[]): SceneGraph {
  const known = new Set(gt.objects.map((o) => o.object_id));
  const relationships: SGRelationship[] = [];
  triplets.forEach((t) => {
    if (!known.has(t.subject_id) || !known.has(t.object_id)) return;
    relationships.push({
      relationship_id: relationships.length + 1,
      subject_id: t.subject_id,
      object_id: t.object_id,
      predicate: t.predicate,
      score: 1 - relationships.length / 1000,
    });
  });
  return {
    ...gt,
    objects: gt.objects,
    relationships,
    provenance: { kind: 'user', fidelity: 'measured' },
  };
}

