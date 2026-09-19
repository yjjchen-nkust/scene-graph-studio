import type { Triplet } from './match.js';
import type { MaskPairing } from './types.js';

/**
 * Cap how many predictions one ordered pair of mask instances may contribute.
 *
 * Mirrors backend/app/eval/pairing.py. Knowledge point E13 states the rule on instances:
 *
 *     SingleMPO: |{m : pi(m) = (s,o)}| = 1
 *     MultiMPO : |{m : pi(m) = (s,o)}| = d >= 1 permitted
 *
 * so the key is the pair of masks and nothing else. Applied after `rank`, so the survivor at
 * each pair is the highest-scoring one, and a no-op on graphs carrying no masks.
 */
export function applyPairing(ranked: Triplet[], mode: MaskPairing): Triplet[] {
  if (mode === 'multi_mpo') return [...ranked];
  const seen = new Set<string>();
  const out: Triplet[] = [];
  for (const p of ranked) {
    if (p.subject_mask === null || p.object_mask === null) {
      out.push(p);
      continue;
    }
    const key = JSON.stringify([p.subject_mask.counts, p.object_mask.counts]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
