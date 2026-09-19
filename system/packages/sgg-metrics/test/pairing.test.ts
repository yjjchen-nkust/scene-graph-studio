import { describe, expect, it } from 'vitest';
import { rank } from '../src/constraint.js';
import type { Triplet } from '../src/match.js';
import { applyPairing } from '../src/pairing.js';
import { encodeCounts } from '../src/rle.js';

/** Mirrors backend/tests/test_pairing.py, case for case. */

const B = { x: 0, y: 0, w: 4, h: 4 };
const mask = (offset: number) => ({
  counts: encodeCounts([offset, 4, 16 - offset - 4]),
  size: [4, 4] as [number, number],
});
const SUBJ = mask(0);
const OBJ = mask(4);
const OTHER = mask(8);

function t(
  rid: number,
  predicate: string,
  score: number,
  over: Partial<Triplet> = {},
): Triplet {
  return {
    index: rid,
    relationship_id: rid,
    subject_name: 'person',
    predicate,
    object_name: 'table',
    subject_bbox: B,
    object_bbox: B,
    subject_mask: SUBJ,
    object_mask: OBJ,
    score,
    ...over,
  };
}

describe('mask pairing', () => {
  it('admits one prediction per ordered mask pair under single_mpo', () => {
    const preds = [t(1, 'on', 0.9), t(2, 'near', 0.8), t(3, 'on', 0.7, { object_mask: OTHER })];
    expect(applyPairing(rank(preds), 'single_mpo')).toHaveLength(2);
  });

  it('admits every one of them under multi_mpo', () => {
    const preds = [t(1, 'on', 0.9), t(2, 'near', 0.8), t(3, 'on', 0.7, { object_mask: OTHER })];
    expect(applyPairing(rank(preds), 'multi_mpo')).toHaveLength(3);
  });

  it('keeps the highest-scoring prediction at the pair', () => {
    const kept = applyPairing(rank([t(1, 'near', 0.4), t(2, 'on', 0.9)]), 'single_mpo');
    expect(kept.map((p) => p.score)).toEqual([0.9]);
  });

  it('keys on the mask instance and not on the class name', () => {
    // E13's pi is defined on instances: two labels for one mask are two hypotheses about one
    // thing. Plan 03's snippet keys on the names too, which would keep both. DEVIATIONS D36.
    const preds = [t(1, 'on', 0.9, { subject_name: 'person' }), t(2, 'on', 0.8, { subject_name: 'man' })];
    expect(applyPairing(rank(preds), 'single_mpo')).toHaveLength(1);
  });

  it('passes a prediction missing either mask through untouched', () => {
    const preds = [t(1, 'on', 0.9, { subject_mask: null }), t(2, 'near', 0.8, { subject_mask: null })];
    expect(applyPairing(rank(preds), 'single_mpo')).toHaveLength(2);
  });

  it('leaves a boxes-only graph identical under either mode', () => {
    const preds = [
      t(1, 'on', 0.9, { subject_mask: null, object_mask: null }),
      t(2, 'near', 0.8, { subject_mask: null, object_mask: null }),
    ];
    const ranked = rank(preds);
    expect(applyPairing(ranked, 'single_mpo')).toEqual(applyPairing(ranked, 'multi_mpo'));
  });
});
