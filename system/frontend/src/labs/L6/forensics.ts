import type { MaskPairing, SceneGraph } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';

export interface Scored {
  key: string;
  label: string;
  family: 'one_stage' | 'two_stage';
  single: number;
  multi: number;
  fidelity: 'measured' | 'reconstructed';
  note: string | null;
}

/** R@K under one pairing mode, with everything else held fixed. */
export function recallUnder(
  gt: SceneGraph,
  pred: SceneGraph,
  mode: MaskPairing,
  k = 20,
): number {
  const body = evaluate({
    gt,
    pred,
    protocol: 'sgdet',
    // `none`, not `graph`: the graph constraint already caps the coarser class pair, so under it
    // the correction cannot move R at all. The PSG figures it overturned are no-constraint
    // numbers, and this lab is about those. See DEVIATIONS D36.
    constraint: 'none',
    k: [k],
    iou_thresh: 0.5,
    mask_pairing: mode,
  });
  const hit = body.metrics.find((m) => m.metric === 'R' && m.k === k);
  return hit?.value ?? 0;
}

export function scoreBoth(
  gt: SceneGraph,
  pred: SceneGraph,
): { single: number; multi: number } {
  return {
    single: recallUnder(gt, pred, 'single_mpo'),
    multi: recallUnder(gt, pred, 'multi_mpo'),
  };
}

/**
 * The two rankings, and which rows moved.
 *
 * Ordering is by the figure each mode produces, and the two orders are computed independently.
 * Nothing here merges them into a single table: the point of the lab is that one methodological
 * choice reorders a published ranking, which is only visible when both orders exist side by side.
 */
export function rankings(rows: Scored[]): {
  byMulti: Scored[];
  bySingle: Scored[];
  moved: Set<string>;
} {
  const byMulti = [...rows].sort((a, b) => b.multi - a.multi);
  const bySingle = [...rows].sort((a, b) => b.single - a.single);
  const moved = new Set<string>();
  byMulti.forEach((row, i) => {
    if (bySingle[i]?.key !== row.key) moved.add(row.key);
  });
  bySingle.forEach((row, i) => {
    if (byMulti[i]?.key !== row.key) moved.add(row.key);
  });
  return { byMulti, bySingle, moved };
}

/**
 * The published direction, as reported by the ECCV 2024 mask-pairing correction.
 *
 * Carried as a reference beside the lab's own numbers and never mixed with them: these are
 * figures on the full PSG test set, and the lab scores a handful of fixture frames.
 */
export const PUBLISHED_DIRECTION = [
  { method: 'PSGTR', family: 'one_stage' as const, before: 20.8, after: 11.62 },
  { method: 'HiLo', family: 'one_stage' as const, before: 30.3, after: 18.33 },
  { method: 'VCTree', family: 'two_stage' as const, before: null, after: null },
];
