/**
 * What E13 is built on: five copies of one mask pair, named once for the component, its
 * tests and the engine checks.
 *
 * Copy 1 sits on ph-001's own objects 2 and 5 (person, wrench). Copy i >= 2 duplicates them
 * as objects 10 + i and 20 + i, same box and same mask as the ones they copy, so the
 * engine's mask-pairing key cannot tell any two copies apart: d predictions of one mask
 * pair, not d predictions of d different things that merely look alike.
 */
export interface MaskRow {
  subject: number;
  object: number;
  masks: string;
  predicate: string;
  score: number;
}

/**
 * The five copies' predicate and score, ranked. "holding" sits second so that person
 * holding wrench is matched only once the second copy is admitted, never by the first alone.
 */
export const E13_COPIES: { predicate: string; score: number }[] = [
  { predicate: 'next to', score: 0.9 },
  { predicate: 'holding', score: 0.88 },
  { predicate: 'near', score: 0.7 },
  { predicate: 'attached to', score: 0.6 },
  { predicate: 'in front of', score: 0.5 },
];

/**
 * The first `d` copies of the one mask pair. Copy 1 is ph-001's own objects 2 -> 5; copy
 * i >= 2 is the duplicate pair 10 + i -> 20 + i. Every row's `masks` is `'2|5'`: a copy
 * carries the same box and the same mask as the object it copies, so the pair the engine
 * keys mask-pairing on is the same pair for every copy.
 */
export function e13Copies(d: number): MaskRow[] {
  return Array.from({ length: d }, (_, index) => {
    const copy = index + 1;
    const { predicate, score } = E13_COPIES[index]!;
    return {
      subject: copy === 1 ? 2 : 10 + copy,
      object: copy === 1 ? 5 : 20 + copy,
      masks: '2|5',
      predicate,
      score,
    };
  });
}

/** VRD's predicate vocabulary per pair, as M4 s15 states. */
export const VRD_PREDICATES = 70;

/** K = 100, the engine's largest cut. */
export const VRD_CUT = 100;
