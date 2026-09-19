import type { SceneGraph, SGObject } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { describe, expect, it, vi } from 'vitest';
import { covarianceGap, fitFreq, predictFreq, zipfCorpus, type VisualScorer } from '../freq';

/**
 * A long-tailed training corpus, the shape the whole bias problem lives in.
 *
 * `on` dominates, `near` is middling, `holding` and `under` are the tail. Nothing here is a real
 * dataset; it is the smallest corpus in which `Cov(n, R)` is reliably positive, which is what E6
 * says the difference between R and mR is.
 */
const CLASSES = ['person', 'table', 'cup', 'shelf', 'box'] as const;
const box = (i: number) => ({ x: i * 10, y: i * 10, w: 8, h: 8 });

function graph(
  id: string,
  rels: Array<[number, number, string]>,
  kind: 'ground_truth' | 'model' = 'ground_truth',
  scored = false,
): SceneGraph {
  return {
    image_id: id,
    dataset: 'placeholder',
    width: 100,
    height: 100,
    objects: CLASSES.map((name, i) => ({ object_id: i + 1, names: [name], bbox: box(i) })),
    relationships: rels.map(([s, o, predicate], i) => ({
      relationship_id: i + 1,
      subject_id: s,
      object_id: o,
      predicate,
      score: scored ? 1 - i / 100 : null,
    })),
    provenance:
      kind === 'ground_truth'
        ? { kind, fidelity: 'measured' }
        : { kind: 'model', fidelity: 'reconstructed', note: 'test fixture' },
  } as SceneGraph;
}

// 1 person, 2 table, 3 cup, 4 shelf, 5 box.
//
// Training sees three pairs, all of them `on`, plus one `near` and one instance each of the two
// tail predicates. What matters for the lesson is which pairs are NOT here: `person -> box` and
// `box -> shelf` never occur, so at test time they back off to the marginal, where `on` outweighs
// the tail nine to one. That backoff is where FREQ's bias actually lives -- a conditional fitted
// on a pair it has seen once is not biased, it is just sparse.
const TRAIN: SceneGraph[] = [
  ...Array.from({ length: 3 }, (_, i) =>
    graph(`t${i}`, [
      [3, 2, 'on'],
      [4, 2, 'on'],
      [1, 2, 'on'],
    ]),
  ),
  graph('t3', [[1, 2, 'near']]),
  graph('t4', [[1, 3, 'holding']]),
  graph('t5', [[3, 4, 'under']]),
];

const OBJECTS: SGObject[] = CLASSES.map((name, i) => ({
  object_id: i + 1,
  names: [name],
  bbox: box(i),
}));

/**
 * The stand-in for `f_theta(V, s, o)`: a model that reads the frame, gets the two tail relations
 * right and the head relations wrong.
 *
 * Plan 04 calls the comparison a "head-biased visual model", which cannot be right. A head-biased
 * model behaves like the prior, so it would win on R and lose on mR exactly as FREQ does, and the
 * plan's two assertions would contradict each other. The contrast that makes E11's point is a
 * predictor that spends its confidence on the tail. DEVIATIONS D43.
 */
const tailAware: VisualScorer = (s, o, predicate) => {
  const triple = `${s}|${o}|${predicate}`;
  if (triple === 'person|box|holding') return 1.0;
  if (triple === 'box|shelf|under') return 0.95;
  return ({ under: 0.3, holding: 0.3, near: 0.2, on: 0.01 })[predicate] ?? 0.1;
};

/** Three head relations and two tail relations, the tail on pairs training never showed. */
const GT = graph('test', [
  [3, 2, 'on'],
  [1, 2, 'on'],
  [4, 2, 'on'],
  [1, 5, 'holding'],
  [5, 4, 'under'],
]);

const K = 5;

function recallOf(predictions: SceneGraph, metric: 'R' | 'mR', k = K): number {
  const body = evaluate({
    gt: GT,
    pred: predictions,
    protocol: 'predcls',
    constraint: 'none',
    k: [k],
    iou_thresh: 0.5,
    mask_pairing: 'single_mpo',
  });
  return body.metrics.find((m) => m.metric === metric && m.k === k)?.value ?? 0;
}

function predictionsAt(blend: number, visual: VisualScorer = tailAware): SceneGraph {
  const model = fitFreq(TRAIN);
  const relationships = predictFreq(model, OBJECTS, blend, visual);
  return {
    ...graph('test', [], 'model', true),
    relationships,
  } as SceneGraph;
}

describe('fitFreq', () => {
  it('normalises each ordered class pair to a distribution', () => {
    const model = fitFreq(TRAIN);
    for (const [, byPredicate] of model.conditional) {
      const total = [...byPredicate.values()].reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  it('learns that the head predicate dominates its pair', () => {
    const model = fitFreq(TRAIN);
    const personTable = model.conditional.get('person|table')!;
    expect(personTable.get('on')).toBeCloseTo(0.75, 12);
    expect(personTable.get('near')).toBeCloseTo(0.25, 12);
  });

  it('backs off to the marginal for a pair it never saw', () => {
    const model = fitFreq(TRAIN);
    expect(model.conditional.has('person|box')).toBe(false);
    // The marginal still ranks the head first, which is the bias the lab is about.
    expect([...model.marginal.entries()].sort((a, z) => z[1] - a[1])[0][0]).toBe('on');
  });
});

describe('the frequency baseline', () => {
  it('consults no pixels at lambda zero', () => {
    // The plan calls `predictFreq` twice and compares, which tests determinism rather than
    // pixel-blindness. The claim is that the visual term is not reached at all, so the test is
    // that the scorer is never invoked.
    const visual = vi.fn(tailAware);
    predictFreq(fitFreq(TRAIN), OBJECTS, 0, visual);
    expect(visual).not.toHaveBeenCalled();
  });

  it('does consult them at any positive lambda, or the blend is a no-op', () => {
    const visual = vi.fn(tailAware);
    predictFreq(fitFreq(TRAIN), OBJECTS, 0.5, visual);
    expect(visual).toHaveBeenCalled();
  });

  it('beats the tail-aware model on R', () => {
    expect(recallOf(predictionsAt(0), 'R')).toBeGreaterThan(recallOf(predictionsAt(1), 'R'));
  });

  it('loses badly to it on mR', () => {
    expect(recallOf(predictionsAt(0), 'mR')).toBeLessThan(recallOf(predictionsAt(1), 'mR'));
  });

  it('is affine in the blend parameter', () => {
    // E11 derives that `R_p(lambda)` is affine -- the per-pair *score* is. Plan 04 asserts it of
    // recall within 0.05, which does not follow: recall is a property of a ranking, and a ranking
    // is a step function of the scores. The exact claim is testable, so it is the one tested.
    // DEVIATIONS D43.
    const model = fitFreq(TRAIN);
    const key = (r: { subject_id: number; object_id: number; predicate: string }) =>
      `${r.subject_id}|${r.object_id}|${r.predicate}`;
    const scores = (l: number) =>
      new Map(predictFreq(model, OBJECTS, l, tailAware).map((r) => [key(r), r.score as number]));
    const [a, mid, b] = [scores(0), scores(0.5), scores(1)];
    expect(mid.size).toBe(a.size);
    for (const [k, v] of mid) {
      expect(v).toBeCloseTo((a.get(k)! + b.get(k)!) / 2, 12);
    }
  });

  it('emits every ordered pair and predicate, ranked and scored', () => {
    const model = fitFreq(TRAIN);
    const out = predictFreq(model, OBJECTS, 0);
    const pairs = OBJECTS.length * (OBJECTS.length - 1);
    expect(out).toHaveLength(pairs * model.predicates.length);
    expect(out.every((r) => r.score !== null)).toBe(true);
    const scores = out.map((r) => r.score as number);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('never predicts a relation from an object to itself', () => {
    const out = predictFreq(fitFreq(TRAIN), OBJECTS, 0);
    expect(out.some((r) => r.subject_id === r.object_id)).toBe(false);
  });
});

describe('the covariance identity of E6', () => {
  it('equals the gap between R and mR', () => {
    // R@k - mR@k = Cov(n, R)/n-bar. The whole bias problem is the sign of that one covariance,
    // so the lab shows it live rather than asserting it in prose.
    const pred = predictionsAt(0);
    const body = evaluate({
      gt: GT,
      pred,
      protocol: 'predcls',
      constraint: 'none',
      k: [K],
      iou_thresh: 0.5,
      mask_pairing: 'single_mpo',
    });
    const r = body.metrics.find((m) => m.metric === 'R' && m.k === K)!.value!;
    const mr = body.metrics.find((m) => m.metric === 'mR' && m.k === K)!.value!;
    expect(covarianceGap(body.per_predicate, K)).toBeCloseTo(r - mr, 10);
  });

  it('is positive when the head is recovered and the tail is not', () => {
    const body = evaluate({
      gt: GT,
      pred: predictionsAt(0),
      protocol: 'predcls',
      constraint: 'none',
      k: [K],
      iou_thresh: 0.5,
      mask_pairing: 'single_mpo',
    });
    expect(covarianceGap(body.per_predicate, K)).toBeGreaterThan(0);
  });
});

describe('the Zipf corpus', () => {
  const PREDICATES = ['on', 'near', 'holding', 'under'];
  const classes = [...CLASSES];

  it('is a pure function of its arguments', () => {
    const a = zipfCorpus(1.5, PREDICATES, classes);
    const b = zipfCorpus(1.5, PREDICATES, classes);
    expect(a).toEqual(b);
  });

  it('gets steeper as the exponent rises', () => {
    const share = (s: number) => {
      const model = fitFreq(zipfCorpus(s, PREDICATES, classes));
      return model.marginal.get('on') ?? 0;
    };
    expect(share(2)).toBeGreaterThan(share(1));
    expect(share(1)).toBeGreaterThan(share(0));
  });

  it('is flat at exponent zero, which is the point of the control', () => {
    const model = fitFreq(zipfCorpus(0, PREDICATES, classes));
    const shares = PREDICATES.map((p) => model.marginal.get(p) ?? 0);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.02);
  });

  it('never emits a self-loop', () => {
    for (const g of zipfCorpus(1.2, PREDICATES, classes)) {
      for (const r of g.relationships) expect(r.subject_id).not.toBe(r.object_id);
    }
  });
});
