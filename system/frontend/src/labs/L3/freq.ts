import type { SGObject, SGRelationship } from 'sgg-metrics';
import type { SceneGraph } from 'sgg-metrics';

/**
 * FREQ, the frequency prior that humiliated the field, and the covariance that explains why.
 *
 * Knowledge point E11: `sigma_p(lambda) = (1 - lambda) * Pr[p | c_s, c_o] + lambda * f_theta(V, s, o)`.
 * At `lambda = 0` nothing in this module can see an image — there is no parameter through which
 * one could arrive — and yet `Cov(n, pi)` is large and positive by construction, so `R` is high
 * and `mR` is near zero. That is the entire lesson, and it is why a paper can post a competitive
 * `R@K` while having learned nothing about the picture.
 */

export type VisualScorer = (subject: string, object: string, predicate: string) => number;

export interface FreqModel {
  /** `"<subject class>|<object class>"` to a normalised distribution over predicates. */
  conditional: Map<string, Map<string, number>>;
  /** The predicate marginal, used for a pair the training slice never showed. */
  marginal: Map<string, number>;
  /** Every predicate seen, in descending frequency, so the tail is visible in the order. */
  predicates: string[];
}

const pairKey = (subject: string, object: string) => `${subject}|${object}`;

function normalise(counts: Map<string, number>): Map<string, number> {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return counts;
  return new Map([...counts].map(([k, v]) => [k, v / total]));
}

/**
 * Count `(subject class, object class) -> predicate` over a training slice and normalise.
 *
 * No pixels are read here either. The argument is a list of graphs, and what is counted is the
 * co-occurrence of three strings.
 */
export function fitFreq(graphs: SceneGraph[]): FreqModel {
  const raw = new Map<string, Map<string, number>>();
  const marginal = new Map<string, number>();

  for (const graph of graphs) {
    const nameOf = new Map(graph.objects.map((o) => [o.object_id, o.names[0]]));
    for (const r of graph.relationships) {
      const subject = nameOf.get(r.subject_id);
      const object = nameOf.get(r.object_id);
      if (subject === undefined || object === undefined) continue;
      const key = pairKey(subject, object);
      const byPredicate = raw.get(key) ?? new Map<string, number>();
      byPredicate.set(r.predicate, (byPredicate.get(r.predicate) ?? 0) + 1);
      raw.set(key, byPredicate);
      marginal.set(r.predicate, (marginal.get(r.predicate) ?? 0) + 1);
    }
  }

  return {
    conditional: new Map([...raw].map(([k, v]) => [k, normalise(v)])),
    marginal: normalise(marginal),
    predicates: [...marginal.entries()].sort((a, z) => z[1] - a[1]).map(([p]) => p),
  };
}

/**
 * Score every ordered pair of objects against every predicate, ranked.
 *
 * `blend` is E11's lambda. At zero, `visual` is never called: the blend is a real gate, not a
 * weight applied to a value that was computed anyway, because "consults no pixels" has to be true
 * of the code and not only of the arithmetic.
 */
export function predictFreq(
  model: FreqModel,
  objects: SGObject[],
  blend: number,
  visual?: VisualScorer,
): SGRelationship[] {
  const lambda = Math.min(1, Math.max(0, blend));
  const out: Array<{ subject: SGObject; object: SGObject; predicate: string; score: number }> = [];

  for (const subject of objects) {
    for (const object of objects) {
      if (subject.object_id === object.object_id) continue;
      const prior =
        model.conditional.get(pairKey(subject.names[0], object.names[0])) ?? model.marginal;
      for (const predicate of model.predicates) {
        const pi = prior.get(predicate) ?? 0;
        const f =
          lambda > 0 && visual ? visual(subject.names[0], object.names[0], predicate) : 0;
        out.push({ subject, object, predicate, score: (1 - lambda) * pi + lambda * f });
      }
    }
  }

  // Ties break by insertion order, which is object order then the predicates' own frequency
  // order. Deterministic, and NFR-4's rule applies downstream in `rank` regardless.
  out.sort((a, b) => b.score - a.score);
  return out.map((row, i) => ({
    relationship_id: i + 1,
    subject_id: row.subject.object_id,
    object_id: row.object.object_id,
    predicate: row.predicate,
    score: row.score,
  }));
}

/**
 * `R@k - mR@k = Cov(n, R) / n-bar`, computed from the engine's own per-predicate rows.
 *
 * E6's identity, evaluated rather than quoted. The lab renders it beside the two metrics so a
 * student can watch the gap open as the tail goes unrecovered, which is what makes the bias
 * problem one number rather than a paragraph.
 */
export function covarianceGap(
  perPredicate: Array<{ predicate: string; gt_count: number; matched: Record<string, number> }>,
  k: number,
): number {
  const rows = perPredicate.filter((row) => row.gt_count > 0);
  if (rows.length === 0) return 0;
  const n = rows.map((row) => row.gt_count);
  const recall = rows.map((row) => (row.matched[String(k)] ?? 0) / row.gt_count);
  const total = n.reduce((a, b) => a + b, 0);
  const nBar = total / rows.length;
  const rBar = recall.reduce((a, b) => a + b, 0) / rows.length;
  const cov =
    n.reduce((acc, ni, i) => acc + (ni - nBar) * (recall[i] - rBar), 0) / rows.length;
  return cov / nBar;
}

/**
 * A synthetic training slice whose predicate counts follow `n_p` proportional to `rank^-s`.
 *
 * The Zipf exponent is the lab's second control, and it is the one that makes the lesson general:
 * FREQ's advantage is not a fact about Visual Genome, it is a fact about any corpus whose
 * predicate distribution is steep enough. At `s = 0` the distribution is flat, `Cov(n, R)`
 * collapses towards zero, and R and mR converge -- which is the clearest way to show that the gap
 * is a property of the data rather than of the metric.
 */
export function zipfCorpus(
  exponent: number,
  predicates: string[],
  classes: string[],
  total = 120,
): SceneGraph[] {
  const weights = predicates.map((_, i) => Math.pow(i + 1, -exponent));
  const mass = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(1, Math.round((w / mass) * total)));

  const objects: SGObject[] = classes.map((name, i) => ({
    object_id: i + 1,
    names: [name],
    bbox: { x: i * 10, y: i * 10, w: 8, h: 8 },
  }));

  // Every ordered pair, so each predicate's instances spread across all of them and a pair's
  // conditional ends up mirroring the global distribution. Concentrating a predicate on a few
  // pairs instead would make each conditional degenerate -- one predicate at probability 1 -- and
  // the exponent would then move the marginal while changing no ranking, which is what the first
  // version of this function did and why the slider appeared to do nothing.
  const pairs: Array<[number, number]> = [];
  for (let a = 0; a < classes.length; a += 1) {
    for (let b = 0; b < classes.length; b += 1) {
      if (a !== b) pairs.push([a + 1, b + 1]);
    }
  }

  const graphs: SceneGraph[] = [];
  let step = 0;
  predicates.forEach((predicate, p) => {
    for (let i = 0; i < counts[p]; i += 1) {
      // Deterministic walk, so the corpus is a pure function of its arguments and the slider
      // never shows a number that a reload would change.
      const [subject, object] = pairs[step % pairs.length];
      step += 1;
      graphs.push({
        image_id: `zipf-${p}-${i}`,
        dataset: 'placeholder',
        width: 100,
        height: 100,
        objects,
        relationships: [
          { relationship_id: 1, subject_id: subject, object_id: object, predicate, score: null },
        ],
        provenance: { kind: 'ground_truth', fidelity: 'measured' },
      } as SceneGraph);
    }
  });
  return graphs;
}
