import { applyConstraint, hasTies, rank } from './constraint.js';
import { toTriplets } from './match.js';
import { applyPairing } from './pairing.js';
import { assign, meanRecallAtK, recallAtK, zeroShotRecallAtK } from './metrics.js';
import type { EvalRequest, EvalResponse, MetricValue, Verdict, Warning } from './types.js';

export * from './types.js';
export { boxIou } from './iou.js';
export { decode, decodeCounts, encodeCounts, maskIou } from './rle.js';
export { classes, classKey, classify, toTriplets } from './match.js';
export { applyConstraint, hasTies, rank } from './constraint.js';
export { applyPairing } from './pairing.js';
export { assign, meanRecallAtK, recallAtK, zeroShotRecallAtK } from './metrics.js';

/** Mirrors backend/app/eval/engine.py WARNINGS, string for string. */
const WARNINGS: Record<string, [string, string]> = {
  gt_boxes_not_pairs: [
    'PredCls and SGCls supply ground-truth boxes, not ground-truth pairs.',
    'PredCls 與 SGCls 提供的是 ground-truth boxes，不是 ground-truth pairs。',
  ],
  empty_ground_truth: [
    'There is no ground truth; recall is undefined.',
    '沒有 ground truth，recall 無定義。',
  ],
  empty_prediction: ['No predictions were supplied.', '未提供任何預測。'],
  ties_broken_by_index: [
    'Two or more predictions share a score; ties break by relationship_id ascending.',
    '有預測分數相同，並列時依 relationship_id 由小至大排序。',
  ],
  masks_ignored: [
    'One graph carries masks and the other does not; boxes were used.',
    '僅一方帶有 mask，故改用 box 計算。',
  ],
  zero_shot_unavailable: [
    'No training split was supplied, so zero-shot recall is not computed.',
    '未提供訓練集三元組，因此不計算 zero-shot recall。',
  ],
};

function warn(code: string): Warning {
  const [en, zh] = WARNINGS[code]!;
  return { code, message_en: en, message_zh: zh };
}

/** Mirrors backend/app/eval/engine.py evaluate. Same field names, same semantics. */
export function evaluate(req: EvalRequest): EvalResponse {
  const gts = toTriplets(req.gt);
  const preds = toTriplets(req.pred);
  // Pairing sits between ranking and constraint filtering, so the survivor at each mask pair
  // is the highest-scoring one and both pools below inherit the cap. E13.
  const ranked = applyPairing(rank(preds), req.mask_pairing);
  const ks = [...new Set(req.k)].sort((a, b) => a - b);

  const gtMasked = req.gt.objects.some((o) => o.mask !== undefined && o.mask !== null);
  const predMasked = req.pred.objects.some((o) => o.mask !== undefined && o.mask !== null);
  const useMasks = gtMasked && predMasked;

  const semi = req.semi_constraint_max_per_pair ?? 2;
  const constrained = applyConstraint(ranked, req.constraint, semi);
  const unconstrained = applyConstraint(ranked, 'none', 1);
  const train = new Set((req.zero_shot_train_triplets ?? []).map((t) => JSON.stringify(t)));

  const metrics: MetricValue[] = [];
  const perPredicate = new Map<string, { predicate: string; gt_count: number; matched: Record<string, number> }>();
  for (const gt of gts) {
    const row = perPredicate.get(gt.predicate)
      ?? { predicate: gt.predicate, gt_count: 0, matched: {} };
    row.gt_count += 1;
    perPredicate.set(gt.predicate, row);
  }

  const widest = assign(constrained, gts, Math.max(...ks), req.iou_thresh, useMasks);

  for (const k of ks) {
    const a = assign(constrained, gts, k, req.iou_thresh, useMasks);
    const ng = assign(unconstrained, gts, k, req.iou_thresh, useMasks);
    const tag = { k, protocol: req.protocol, constraint: req.constraint, source: 'engine', verified: true, fidelity: 'measured' } as const;
    metrics.push({ value: recallAtK(a, k), metric: 'R', ...tag });
    metrics.push({ value: meanRecallAtK(a, k), metric: 'mR', ...tag });
    metrics.push({ value: recallAtK(ng, k), metric: 'ngR', ...tag });
    metrics.push({
      value: train.size ? zeroShotRecallAtK(a, gts, train, k) : null,
      metric: 'zR',
      ...tag,
    });
    for (let i = 0; i < gts.length; i += 1) {
      const at = a.matchedAt[i];
      const row = perPredicate.get(gts[i]!.predicate)!;
      row.matched[String(k)] = (row.matched[String(k)] ?? 0)
        + (at !== null && at !== undefined && at <= k ? 1 : 0);
    }
  }

  const verdicts: Verdict[] = [];
  const matchedGtIndices = new Set<number>();
  for (let position = 0; position < widest.verdicts.length; position += 1) {
    const [predIndex, verdict, gi, ious, iuo] = widest.verdicts[position]!;
    if (verdict === 'match' && gi !== null) matchedGtIndices.add(gi);
    const enteredTopK: Record<string, boolean> = {};
    for (const k of ks) enteredTopK[String(k)] = position + 1 <= k;
    verdicts.push({
      pred_index: predIndex,
      gt_index: gi,
      verdict,
      iou_subject: ious,
      iou_object: iuo,
      rank: position + 1,
      entered_top_k: enteredTopK,
    });
  }
  for (let gi = 0; gi < gts.length; gi += 1) {
    if (matchedGtIndices.has(gi)) continue;
    const enteredTopK: Record<string, boolean> = {};
    for (const k of ks) enteredTopK[String(k)] = false;
    verdicts.push({
      pred_index: -1,
      gt_index: gi,
      verdict: 'missed',
      iou_subject: null,
      iou_object: null,
      rank: 0,
      entered_top_k: enteredTopK,
    });
  }

  const warnings: Warning[] = [];
  if (req.protocol === 'predcls' || req.protocol === 'sgcls') warnings.push(warn('gt_boxes_not_pairs'));
  if (gts.length === 0) warnings.push(warn('empty_ground_truth'));
  if (preds.length === 0) warnings.push(warn('empty_prediction'));
  if (hasTies(preds)) warnings.push(warn('ties_broken_by_index'));
  if (gtMasked !== predMasked) warnings.push(warn('masks_ignored'));
  if (train.size === 0) warnings.push(warn('zero_shot_unavailable'));

  return {
    metrics,
    verdicts,
    matched_count: widest.matchedGt.filter(Boolean).length,
    gt_count: gts.length,
    pred_count_considered: constrained.length,
    per_predicate: [...perPredicate.values()],
    warnings,
    params_echo: req,
  };
}
