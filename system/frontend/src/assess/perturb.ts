import type { SceneGraph, SGRelationship } from 'sgg-metrics';

/** A deterministic stream in [0, 1). Seeded, because an item has to be re-showable. */
export type Rng = () => number;

/**
 * mulberry32. Thirty-two bits of state, uniform enough for choosing an index, and — the reason
 * it is here rather than `Math.random` — reproducible from an integer, so a quiz item is a
 * number a student can be shown again and a failure is a seed in a bug report.
 */
export function seed(n: number): Rng {
  let state = (n + 0x6d2b79f5) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CorruptionKind = 'predicate' | 'reversed';

export interface Perturbed {
  graph: SceneGraph;
  /** The index into `relationships` that was changed. Exactly one is. */
  corruptedIndex: number;
  kind: CorruptionKind;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * One relation, made wrong. The item asks which triplet is the wrong one.
 *
 * **Exactly one edge changes, and the objects never do.** Moving a box as well would make two
 * answers defensible and leave the student right for a reason the item cannot score.
 *
 * Two corruptions, both of which a reader of the graph can actually adjudicate: the predicate is
 * rewritten to another predicate the same graph uses, or the direction is reversed. A predicate
 * drawn from outside the graph's own vocabulary would often be obviously absurd — `cup parked_on
 * table` is not a question — and a reversal is the error the literature's own models make, so it
 * is the one worth recognising.
 *
 * Reversal is the fallback where a rewrite is impossible, because a graph with one predicate has
 * nothing to rewrite to. Where neither is available the function throws rather than returning an
 * item with no answer.
 */
export function perturb(gt: SceneGraph, rng: Rng): Perturbed {
  if (gt.relationships.length === 0) {
    throw new Error('perturb: no relationship to corrupt in this graph');
  }

  const corruptedIndex = Math.floor(rng() * gt.relationships.length);
  const target = gt.relationships[corruptedIndex]!;

  const others = [...new Set(gt.relationships.map((r) => r.predicate))].filter(
    (p) => p !== target.predicate,
  );
  // A self-loop cannot be reversed into anything a student could judge, so it is never the
  // reversal case; the vocabulary check then decides, and the throw below catches the rest.
  const canReverse = target.subject_id !== target.object_id;
  const canRewrite = others.length > 0;

  if (!canRewrite && !canReverse) {
    throw new Error('perturb: no relationship can be corrupted without inventing a predicate');
  }

  const kind: CorruptionKind =
    canRewrite && canReverse ? (rng() < 0.5 ? 'predicate' : 'reversed') :
    canRewrite ? 'predicate' : 'reversed';

  const corrupted: SGRelationship =
    kind === 'predicate'
      ? { ...target, predicate: pick(others, rng) }
      : { ...target, subject_id: target.object_id, object_id: target.subject_id };

  return {
    graph: {
      ...gt,
      objects: gt.objects,
      relationships: gt.relationships.map((r, i) => (i === corruptedIndex ? corrupted : r)),
    },
    corruptedIndex,
    kind,
  };
}
