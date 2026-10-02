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
 * Predicates whose reversal states the same fact: `man near window` is `window near man`.
 *
 * Reversing one of these produces a triplet that is still true, and an item built on it has no
 * wrong answer. The list is the course's own: M0's checkpoint asks for a reversible predicate and
 * its notes name `next to`, F8 shows `near` as the relation that reads as symmetric, and
 * `aligned with` (the placeholder slice) and `and` (VG-150) state a relation that holds both
 * ways. `beside` is `next to` in other words. A predicate that is only sometimes symmetric, such
 * as `with`, is left out: the cost of leaving one out is an item that may be unfair, and the cost
 * of listing one wrongly is a reversal the course teaches that the quiz never asks.
 */
export const SYMMETRIC_PREDICATES: ReadonlySet<string> = new Set([
  'near',
  'next to',
  'beside',
  'aligned with',
  'and',
]);

/** The ways one relation may be made wrong: the predicates it may become, and whether it turns. */
interface Options {
  rewrites: string[];
  reversible: boolean;
}

/** One corruption, before it is placed in a graph. */
interface Draft {
  corruptedIndex: number;
  kind: CorruptionKind;
  corrupted: SGRelationship;
}

function vocabulary(gt: SceneGraph): string[] {
  return [...new Set(gt.relationships.map((r) => r.predicate))];
}

/**
 * What the generator always offered: any other predicate of the graph, and any reversal but a
 * self-loop's. Kept as it was because the first draw of every item is made over it (see
 * `perturb`), and an item's FSRS history is keyed by the item's id.
 */
function offered(gt: SceneGraph, index: number): Options {
  const target = gt.relationships[index]!;
  return {
    rewrites: vocabulary(gt).filter((p) => p !== target.predicate),
    reversible: target.subject_id !== target.object_id,
  };
}

/**
 * Whether the graph already says this, as the quiz prints it.
 *
 * Compared by the objects' first names rather than their ids, because names are all the reader is
 * shown: two cups on one table are two triplets to the graph and one line on the screen, and a
 * corrupted line identical to a true one cannot be told from it. A comparison by ids would be the
 * weaker test, since equal ids always print alike.
 */
function holds(gt: SceneGraph, subjectId: number, predicate: string, objectId: number): boolean {
  const nameOf = (id: number) => gt.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);
  const line = `${nameOf(subjectId)}\u0000${predicate}\u0000${nameOf(objectId)}`;
  return gt.relationships.some(
    (r) => `${nameOf(r.subject_id)}\u0000${r.predicate}\u0000${nameOf(r.object_id)}` === line,
  );
}

/** The corruptions of one relation that a reader can tell are wrong: nothing that is still true. */
function sound(gt: SceneGraph, index: number): Options {
  const target = gt.relationships[index]!;
  const { rewrites, reversible } = offered(gt, index);
  return {
    rewrites: rewrites.filter((p) => !holds(gt, target.subject_id, p, target.object_id)),
    reversible:
      reversible &&
      !SYMMETRIC_PREDICATES.has(target.predicate) &&
      !holds(gt, target.object_id, target.predicate, target.subject_id),
  };
}

/**
 * The indices of the relations that can be made wrong at all. `itemsFor` asks about each at most
 * once, so this is also the most items one graph can carry.
 */
export function corruptible(gt: SceneGraph): number[] {
  return gt.relationships.flatMap((_, i) => {
    const { rewrites, reversible } = sound(gt, i);
    return rewrites.length > 0 || reversible ? [i] : [];
  });
}

/**
 * One draw: a relation among `indices`, then a kind, then a predicate where the kind needs one.
 * `null` where the relation drawn has no way to be corrupted under `options`.
 */
function draw(
  gt: SceneGraph,
  rng: Rng,
  indices: readonly number[],
  options: (index: number) => Options,
): Draft | null {
  const corruptedIndex = pick(indices, rng);
  const target = gt.relationships[corruptedIndex]!;
  const { rewrites, reversible } = options(corruptedIndex);
  const canRewrite = rewrites.length > 0;
  if (!canRewrite && !reversible) return null;

  const kind: CorruptionKind =
    canRewrite && reversible ? (rng() < 0.5 ? 'predicate' : 'reversed') :
    canRewrite ? 'predicate' : 'reversed';

  const corrupted: SGRelationship =
    kind === 'predicate'
      ? { ...target, predicate: pick(rewrites, rng) }
      : { ...target, subject_id: target.object_id, object_id: target.subject_id };

  return { corruptedIndex, kind, corrupted };
}

function isSound(gt: SceneGraph, d: Draft): boolean {
  const { rewrites, reversible } = sound(gt, d.corruptedIndex);
  return d.kind === 'predicate' ? rewrites.includes(d.corrupted.predicate) : reversible;
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
 * **A corruption must be false.** A reversed symmetric predicate, or a rewrite or reversal that
 * lands on a triplet the graph already holds, is still true, and an item built on one marks the
 * reader wrong whatever they choose. `skip` names relations an earlier item has already asked
 * about, so one checkpoint never asks about one relation twice.
 *
 * The first draw is the one this function has always made, over the corruptions it always
 * offered. Where that draw is sound and its relation is not skipped, it stands, so an item that
 * was already a fair question keeps its meaning and the FSRS history stored under its id. Only
 * otherwise is the item drawn again, from the same stream, among the sound corruptions of the
 * relations not skipped. Where there are none the function throws rather than returning an item
 * with no answer.
 */
export function perturb(
  gt: SceneGraph,
  rng: Rng,
  skip: ReadonlySet<number> = new Set(),
): Perturbed {
  if (gt.relationships.length === 0) {
    throw new Error('perturb: no relationship to corrupt in this graph');
  }

  const every = gt.relationships.map((_, i) => i);
  const first = draw(gt, rng, every, (i) => offered(gt, i));
  let chosen = first && !skip.has(first.corruptedIndex) && isSound(gt, first) ? first : null;
  if (!chosen) {
    const open = corruptible(gt).filter((i) => !skip.has(i));
    if (open.length === 0) {
      throw new Error(
        'perturb: no relationship left that can be made false without inventing a predicate',
      );
    }
    chosen = draw(gt, rng, open, (i) => sound(gt, i))!;
  }

  const { corruptedIndex, kind, corrupted } = chosen;
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
