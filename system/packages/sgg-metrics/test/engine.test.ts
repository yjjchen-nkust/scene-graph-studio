import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyConstraint, evaluate, rank, toTriplets } from '../src/index.js';
import type { SceneGraph } from '../src/types.js';
import { boxIou } from '../src/iou.js';
import { encodeCounts, decodeCounts, maskIou } from '../src/rle.js';

const TOL = 1e-9;
const cases = JSON.parse(
  readFileSync(new URL('../../../../data/golden/vectors.json', import.meta.url), 'utf-8'),
).cases as Array<Record<string, any>>;

describe('box iou', () => {
  it('halves correctly', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }))
      .toBeCloseTo(50 / 150, 12);
  });
  it('is zero on touching edges', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });
  it('is exactly one half under containment', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 20 })).toBe(0.5);
  });
});

describe('rle', () => {
  it('round-trips counts through the delta encoding', () => {
    for (const counts of [[16], [0, 16], [2, 3, 11], [0, 100000, 1], [12345, 6789, 100]]) {
      expect(decodeCounts(encodeCounts(counts))).toEqual(counts);
    }
  });
  it('matches the python worked example', () => {
    const a = { counts: encodeCounts([0, 8, 8]), size: [4, 4] as [number, number] };
    const b = { counts: encodeCounts([4, 8, 4]), size: [4, 4] as [number, number] };
    expect(maskIou(a, b)).toBeCloseTo(4 / 12, 12);
  });
});

describe('golden vectors', () => {
  for (const c of cases) {
    it(c.id, () => {
      const body = evaluate({ gt: c.gt, pred: c.pred, ...c.params });
      const got = new Map(body.metrics.map((m) => [`${m.metric}@${m.k}`, m.value]));
      for (const [metric, byK] of Object.entries(c.expect)) {
        if (metric === 'verdicts' || metric === 'warnings') continue;
        for (const [k, want] of Object.entries(byK as Record<string, number | null>)) {
          const have = got.get(`${metric}@${k}`);
          if (want === null) expect(have, `${c.id} ${metric}@${k}`).toBeNull();
          else expect(Math.abs((have as number) - want), `${c.id} ${metric}@${k}`)
            .toBeLessThan(TOL);
        }
      }
      for (const want of (c.expect.verdicts ?? [])) {
        const row = body.verdicts.find((v) => v.pred_index === want.pred_index);
        expect(row?.verdict, `${c.id} pred ${want.pred_index}`).toBe(want.verdict);
      }
      for (const code of (c.expect.warnings ?? [])) {
        expect(body.warnings.map((w) => w.code), c.id).toContain(code);
      }
    });
  }
});

describe('the constraint key is the ordered object pair (D99)', () => {
  // Tang's sgg_eval.py (fca9860, line 66) keeps the arg-max predicate for each pair of predicted
  // object indices; M4's E4 writes pi(<s,p,o>) = (s,o). Two objects of one class are two pairs.
  type T = Parameters<typeof applyConstraint>[0][number];
  const b = { x: 0, y: 0, w: 1, h: 1 };
  const t = (rid: number, s: string, p: string, o: string, score: number, sid: number, oid: number): T => ({
    index: rid,
    relationship_id: rid,
    subject_id: sid,
    object_id: oid,
    subject_name: s,
    predicate: p,
    object_name: o,
    subject_bbox: b,
    object_bbox: b,
    subject_mask: null,
    object_mask: null,
    score,
  });
  const ids = (xs: T[]) => xs.map((x) => x.relationship_id);

  it('graph keeps one predicate per object pair, not per class pair', () => {
    const twoPairs = [t(1, 'hand', 'holding', 'assembly', 0.9, 1, 3), t(2, 'hand', 'assembling', 'assembly', 0.8, 2, 3)];
    expect(ids(applyConstraint(rank(twoPairs), 'graph', 1))).toEqual([1, 2]);
  });

  it('graph still keeps one on a single object pair', () => {
    const onePair = [t(1, 'hand', 'holding', 'assembly', 0.9, 1, 3), t(2, 'hand', 'assembling', 'assembly', 0.8, 1, 3)];
    expect(ids(applyConstraint(rank(onePair), 'graph', 1))).toEqual([1]);
  });

  it('duplicate detections are two pairs', () => {
    const dup = [t(1, 'man', 'on', 'street', 0.9, 1, 9), t(2, 'man', 'on', 'street', 0.8, 2, 9)];
    expect(applyConstraint(rank(dup), 'graph', 1)).toHaveLength(2);
  });

  it('semi caps per object pair', () => {
    const preds = ['holding', 'assembling', 'near', 'holding', 'assembling', 'near'].map((p, i) =>
      t(i + 1, 'hand', p, 'assembly', 0.9 - i / 10, 1 + Math.floor(i / 3), 9));
    expect(ids(applyConstraint(rank(preds), 'semi', 2))).toEqual([1, 2, 4, 5]);
    expect(applyConstraint(rank(preds), 'semi', 1)).toHaveLength(2);
    expect(applyConstraint(rank(preds), 'semi', 0)).toHaveLength(2);
  });

  it('a self-pair is a pair', () => {
    const same = [t(1, 'arm', 'near', 'arm', 0.9, 4, 4), t(2, 'arm', 'on', 'arm', 0.8, 4, 4)];
    expect(applyConstraint(rank(same), 'graph', 1)).toHaveLength(1);
  });
});

describe('an object_id names one object (D100)', () => {
  // Python resolved the first of two objects sharing an id and TypeScript the last, and the
  // constraint key is the id pair (D99), so both engines refuse such a graph.
  const repeated: SceneGraph = {
    image_id: 'repeated',
    dataset: 'placeholder',
    width: 100,
    height: 100,
    objects: [
      { object_id: 1, names: ['man'], bbox: { x: 0, y: 0, w: 10, h: 10 } },
      { object_id: 2, names: ['table'], bbox: { x: 20, y: 0, w: 10, h: 10 } },
      { object_id: 2, names: ['chair'], bbox: { x: 40, y: 0, w: 10, h: 10 } },
    ],
    relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
    provenance: { kind: 'ground_truth', fidelity: 'measured' },
  };

  it('refuses a graph that repeats an object_id', () => {
    expect(() => toTriplets(repeated)).toThrow('object_ids [2] appear more than once in this graph');
  });
});

describe('the protocol ordering is observed, not forced (D98, D99)', () => {
  // Two annotated triplets on one pair of objects. Under the graph constraint a prediction keeps
  // one predicate per predicted pair, so a model handed the boxes (SGCls) can match at most one;
  // a model that proposes its own boxes (SGDet) can put the two predicates on two distinct box
  // pairs, each overlapping the annotation by IoU >= 0.5, and match both. Recall is higher with
  // less input, so no ordering between protocols holds for every model.
  const box = (x: number, y: number) => ({ x, y, w: 100, h: 100 });
  const gt: SceneGraph = {
    image_id: 'ordering',
    dataset: 'placeholder',
    width: 400,
    height: 200,
    objects: [
      { object_id: 1, names: ['man'], bbox: box(0, 0) },
      { object_id: 2, names: ['table'], bbox: box(200, 0) },
    ],
    relationships: [
      { relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' },
      { relationship_id: 2, subject_id: 1, object_id: 2, predicate: 'near' },
    ],
    provenance: { kind: 'ground_truth', fidelity: 'measured' },
  };
  const recall = (pred: SceneGraph, protocol: 'sgcls' | 'sgdet') =>
    evaluate({ gt, pred, protocol, constraint: 'graph', k: [50], iou_thresh: 0.5, mask_pairing: 'single_mpo' })
      .metrics.find((m) => m.metric === 'R' && m.k === 50)!.value;

  it('the given boxes allow one predicate for the pair, so at most half is recalled', () => {
    const givenBoxes: SceneGraph = {
      ...gt,
      relationships: [
        { relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on', score: 0.9 },
        { relationship_id: 2, subject_id: 1, object_id: 2, predicate: 'near', score: 0.8 },
      ],
      provenance: { kind: 'model', fidelity: 'measured', model: 'ordering' },
    };
    expect(recall(givenBoxes, 'sgcls')).toBe(0.5);
  });

  it('boxes of its own let a model recall both', () => {
    const ownBoxes: SceneGraph = {
      ...gt,
      objects: [
        { object_id: 1, names: ['man'], bbox: box(0, 0) },
        { object_id: 2, names: ['table'], bbox: box(200, 0) },
        // 98 x 98 = 9604 shared of 10000 + 10000 - 9604 = 10396: IoU 0.924 with each annotation.
        { object_id: 3, names: ['man'], bbox: box(2, 2) },
        { object_id: 4, names: ['table'], bbox: box(202, 2) },
      ],
      relationships: [
        { relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on', score: 0.9 },
        { relationship_id: 2, subject_id: 3, object_id: 4, predicate: 'near', score: 0.8 },
      ],
      provenance: { kind: 'model', fidelity: 'measured', model: 'ordering' },
    };
    expect(recall(ownBoxes, 'sgdet')).toBe(1);
  });
});
