import { classKey, classify, type Triplet } from './match.js';
import type { VerdictKind } from './types.js';

/** Mirrors backend/app/eval/metrics.py. */
export interface Assignment {
  gts: Triplet[];
  matchedGt: boolean[];
  verdicts: Array<[number, VerdictKind, number | null, number | null, number | null]>;
  matchedAt: Array<number | null>;
}

/** Greedy one-to-one assignment over the top-k of a ranked prediction list. */
export function assign(
  rankedPreds: Triplet[],
  gts: Triplet[],
  k: number,
  iouThresh: number,
  useMasks: boolean,
): Assignment {
  const used = gts.map(() => false);
  const matchedAt: Array<number | null> = gts.map(() => null);
  const verdicts: Assignment['verdicts'] = [];
  const top = rankedPreds.slice(0, k);
  for (let i = 0; i < top.length; i += 1) {
    const pred = top[i]!;
    const [verdict, gi, ious, iuo] = classify(pred, gts, used, iouThresh, useMasks);
    if (verdict === 'match' && gi !== null) {
      used[gi] = true;
      matchedAt[gi] = i + 1;
    }
    verdicts.push([pred.index, verdict, gi, ious, iuo]);
  }
  return { gts, matchedGt: used, verdicts, matchedAt };
}

/** R@K. null -- not zero -- when there is no ground truth to recall. */
export function recallAtK(a: Assignment, k: number): number | null {
  if (a.gts.length === 0) return null;
  const hit = a.matchedAt.filter((m) => m !== null && m <= k).length;
  return hit / a.gts.length;
}

/** mR@K: R@K per predicate class, averaged unweighted over classes present in the GT. */
export function meanRecallAtK(a: Assignment, k: number): number | null {
  if (a.gts.length === 0) return null;
  const totals = new Map<string, number>();
  const hits = new Map<string, number>();
  for (let i = 0; i < a.gts.length; i += 1) {
    const p = a.gts[i]!.predicate;
    totals.set(p, (totals.get(p) ?? 0) + 1);
    const at = a.matchedAt[i];
    if (at !== null && at !== undefined && at <= k) hits.set(p, (hits.get(p) ?? 0) + 1);
  }
  let sum = 0;
  for (const [p, n] of totals) sum += (hits.get(p) ?? 0) / n;
  return sum / totals.size;
}

/** zR@K: R@K restricted to GT triplet types absent from the training split. */
export function zeroShotRecallAtK(
  a: Assignment,
  gts: Triplet[],
  trainTriplets: Set<string>,
  k: number,
): number | null {
  const zero: number[] = [];
  for (let i = 0; i < gts.length; i += 1) {
    if (!trainTriplets.has(classKey(gts[i]!))) zero.push(i);
  }
  if (zero.length === 0) return null;
  const hit = zero.filter((i) => {
    const at = a.matchedAt[i];
    return at !== null && at !== undefined && at <= k;
  }).length;
  return hit / zero.length;
}
