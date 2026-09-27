import type { Triplet } from './match.js';
import type { Constraint } from './types.js';

/** Mirrors backend/app/eval/constraint.py. */
export function rank(preds: Triplet[]): Triplet[] {
  const scored = preds.filter((p) => p.score !== null);
  const unscored = preds.filter((p) => p.score === null);
  // Explicit comparison on (-score, relationship_id). Array.sort stability alone is not the
  // contract; the tuple key is, and the Python side sorts on the same tuple. NFR-4.
  scored.sort((a, b) => {
    const byScore = (b.score as number) - (a.score as number);
    if (byScore !== 0) return byScore;
    return a.relationship_id - b.relationship_id;
  });
  return [...scored, ...unscored];
}

export function hasTies(preds: Triplet[]): boolean {
  const seen = new Set<number>();
  for (const p of preds) {
    if (p.score === null) continue;
    if (seen.has(p.score)) return true;
    seen.add(p.score);
  }
  return false;
}

/**
 * Filter a ranked list. The pair key is the ORDERED OBJECT pair (subject_id, object_id).
 *
 * Tang's `sgg_eval.py` (commit fca9860, line 66) keeps the arg-max predicate for each pair of
 * predicted object indices, and M4's E4 writes pi(<s,p,o>) = (s,o) with s and o the objects. The key
 * was the ordered class pair until D99, which kept one predicate between two hands holding one
 * assembly where the reference keeps one each.
 *
 * `semi` caps predicates per ordered object pair at `maxPerPair`. It is not Action Genome's semi
 * constraint, which STTran (`lib/evaluation_recall.py`, commit bcc72cf) evaluates as the top
 * attention predicate plus every spatial or contacting predicate above 0.9 per pair (D99).
 */
export function applyConstraint(
  ranked: Triplet[],
  mode: Constraint,
  maxPerPair: number,
): Triplet[] {
  if (mode === 'none') return [...ranked];
  const cap = mode === 'graph' ? 1 : Math.max(1, maxPerPair);
  const counts = new Map<string, number>();
  const out: Triplet[] = [];
  for (const p of ranked) {
    const key = JSON.stringify([p.subject_id, p.object_id]);
    if ((counts.get(key) ?? 0) >= cap) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    out.push(p);
  }
  return out;
}
