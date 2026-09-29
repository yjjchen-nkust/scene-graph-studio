import type { TraditionalFrame, Triplet } from './data';

/**
 * What a demo computes: counts, set memberships and set differences over recorded artefacts,
 * never a metric (contracts §2.4, spec 2026-09-29-m0-demos-design §3.5). Pure, and importing
 * nothing from `sgg-metrics`: scoring is a lab's business, and the boundary is the point.
 *
 * Two readings of one list of triplets are kept apart. A completion's rows are its ranking, and
 * the counts of rows ("triplets emitted", the predicate histogram) count every row, repeats
 * included. E_t is a set, so churn and a revision's differences count distinct triplets, as F6
 * and F7 do (D96).
 */

/** n(n − 1): the ordered pairs of n objects, 0 for zero or one object. */
export function orderedPairs(n: number): number {
  return n < 2 ? 0 : n * (n - 1);
}

/** n(n − 1)·|P|: every predicate for every ordered pair. */
export function candidateTriplets(n: number, predicates: number): number {
  return orderedPairs(n) * predicates;
}

/** A key no two different triplets share, a term of which may itself contain a space. */
export function tripletKey(t: Triplet): string {
  return JSON.stringify(t);
}

/** Each triplet once, at its first occurrence. */
export function distinct(ts: readonly Triplet[]): Triplet[] {
  const seen = new Set<string>();
  const out: Triplet[] = [];
  for (const t of ts) {
    const key = tripletKey(t);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

export interface Churn {
  kept: Triplet[];
  added: Triplet[];
  removed: Triplet[];
  /** |E_a Δ E_b| */
  delta: number;
  /** |E_a ∪ E_b| */
  union: number;
}

/** From E_a to E_b over distinct triplets: what stayed, what appeared, what went. */
export function churn(a: readonly Triplet[], b: readonly Triplet[]): Churn {
  const before = distinct(a);
  const after = distinct(b);
  const inBefore = new Set(before.map(tripletKey));
  const inAfter = new Set(after.map(tripletKey));
  const kept = after.filter((t) => inBefore.has(tripletKey(t)));
  const added = after.filter((t) => !inBefore.has(tripletKey(t)));
  const removed = before.filter((t) => !inAfter.has(tripletKey(t)));
  return {
    kept,
    added,
    removed,
    delta: added.length + removed.length,
    union: kept.length + added.length + removed.length,
  };
}

/** |Δ| / |∪| to two decimals; `—` where both sets are empty, since 0 / 0 is no fraction. */
export function churnFraction(c: Pick<Churn, 'delta' | 'union'>): string {
  return c.union === 0 ? '—' : (c.delta / c.union).toFixed(2);
}

/** Which of a triplet's terms lie outside the object vocabulary O or the predicate vocabulary P. */
export function outsideVocabulary(
  t: Triplet,
  O: readonly string[],
  P: readonly string[],
): { subject: boolean; predicate: boolean; object: boolean } {
  return { subject: !O.includes(t[0]), predicate: !P.includes(t[1]), object: !O.includes(t[2]) };
}

export interface RevisionDiff {
  deleted: Triplet[];
  added: Triplet[];
  /** A deleted and an added triplet on the same subject and object: the predicate changed. */
  rewritten: { from: Triplet; to: Triplet }[];
}

/**
 * An expert's revision against the draft, over distinct triplets.
 *
 * A rewrite pairs a deleted triplet with an added one of the same subject and object. The deleted
 * triplets are taken in the draft's order, each paired with the first added triplet not yet
 * paired, so every triplet appears in exactly one of the three lists.
 */
export function revisionDiff(before: readonly Triplet[], after: readonly Triplet[]): RevisionDiff {
  const { removed, added } = churn(before, after);
  const unpaired = [...added];
  const deleted: Triplet[] = [];
  const rewritten: { from: Triplet; to: Triplet }[] = [];
  for (const from of removed) {
    const at = unpaired.findIndex((to) => to[0] === from[0] && to[2] === from[2]);
    if (at === -1) {
      deleted.push(from);
    } else {
      rewritten.push({ from, to: unpaired[at]! });
      unpaired.splice(at, 1);
    }
  }
  return { deleted, added: unpaired, rewritten };
}

/** Rows per predicate, repeats included: most rows first, ties by name. */
export function predicateHistogram(ts: readonly Triplet[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of ts) counts.set(t[1], (counts.get(t[1]) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
}

/**
 * D-T's relations as class-level triplets ⟨c_s, p, c_o⟩ under the detector's COCO labels, one row
 * per relation. Neither pipeline tracks identity across frames, so two detections of one class
 * name the same triplet, and `distinct` collapses them where a set is meant.
 */
export function traditionalTriplets(f: TraditionalFrame): Triplet[] {
  const labels = new Map(f.detections.map((d) => [d.object_id, d.label]));
  const label = (id: number) => {
    const found = labels.get(id);
    if (found === undefined) throw new Error(`${f.image_id}: relation names object ${id}, which no detection has`);
    return found;
  };
  return f.relations.map((r) => [label(r.subject_id), r.predicate, label(r.object_id)] as const);
}

/** A count as a slide prints it: thousands grouped with a comma in both locales, as T1 does. */
export function countText(n: number): string {
  return n.toLocaleString('en-US');
}

/** The `O_ISG` classes COCO has no category for, in the map's order. */
export function uncoveredClasses(oIsgCoco: Readonly<Record<string, string | null>>): string[] {
  return Object.entries(oIsgCoco).filter(([, coco]) => coco === null).map(([cls]) => cls);
}

/** How many of a frame's pairs the class-pair prior classified, and how many fell back. */
export function relationSources(f: TraditionalFrame): { prior: number; fallback: number } {
  const prior = f.relations.filter((r) => r.from === 'prior').length;
  return { prior, fallback: f.relations.length - prior };
}

/**
 * Why a frame's pairs fell back, of the two reasons the recorder has (spec §3.2).
 *
 * `unmapped`: the pair names a detected COCO label the class map sends to no slice class, so the
 * prior has no row for it; `classes` lists those labels, each once, in detection order.
 * `unseen`: both labels map to slice classes, but the prior's frames never show that class pair.
 */
export function fallbackCauses(
  f: TraditionalFrame,
  classMap: Readonly<Record<string, string | null>>,
): { unmapped: number; unseen: number; classes: string[] } {
  const label = new Map(f.detections.map((d) => [d.object_id, d.label]));
  const isUnmapped = (id: number) => (classMap[label.get(id) ?? ''] ?? null) === null;
  let unmapped = 0;
  let unseen = 0;
  for (const r of f.relations) {
    if (r.from !== 'fallback') continue;
    if (isUnmapped(r.subject_id) || isUnmapped(r.object_id)) unmapped += 1;
    else unseen += 1;
  }
  const classes = [...new Set(f.detections.map((d) => d.label))].filter((l) => (classMap[l] ?? null) === null);
  return { unmapped, unseen, classes };
}

/** Where a box's badge sits against the box's top-left corner: above it, or above and to its left. */
export type BadgeSide = 'above' | 'above-left';

/** Past this many boxes the placement is not searched; each badge sits above unless it cannot. */
export const BADGE_SEARCH_MAX = 10;

/**
 * Where each box's `#n` badge sits: above the box's top-left corner, or above and to the left of
 * it, never inside the box (D100). A badge must not cross the frame's right or left edge, so a
 * box whose badge would cross the right edge takes above-left. Among the placements that respect
 * the edges, the one with the fewest pairs of overlapping badges, then the least overlapping area,
 * then the fewest badges moved left; the first such in order, so the result is deterministic.
 *
 * `badge` is a badge's size in the frame's own pixels. Every placement is searched up to
 * `BADGE_SEARCH_MAX` boxes, 2¹⁰ of them at most; past it, each badge sits above unless that
 * crosses the right edge.
 */
export function badgePlaces(
  boxes: readonly { x: number; y: number }[],
  frameWidth: number,
  badge: { w: number; h: number },
): BadgeSide[] {
  const fits = (b: { x: number }, side: BadgeSide) =>
    side === 'above' ? b.x + badge.w <= frameWidth : b.x - badge.w >= 0;
  const options: BadgeSide[][] = boxes.map((b) => {
    const allowed = (['above', 'above-left'] as const).filter((side) => fits(b, side));
    return allowed.length > 0 ? allowed : ['above'];
  });
  if (boxes.length > BADGE_SEARCH_MAX) return options.map((o) => o[0]!);

  const rect = (b: { x: number; y: number }, side: BadgeSide) => {
    const left = side === 'above' ? b.x : b.x - badge.w;
    return { left, right: left + badge.w, top: b.y - badge.h, bottom: b.y };
  };
  type Rect = ReturnType<typeof rect>;
  const shared = (a: Rect, c: Rect) =>
    Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left))
    * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));

  let best: { key: [number, number, number]; sides: BadgeSide[] } | undefined;
  const sides: BadgeSide[] = [];
  const walk = (i: number) => {
    if (i === boxes.length) {
      const rects = boxes.map((b, k) => rect(b, sides[k]!));
      let pairs = 0;
      let area = 0;
      for (let a = 0; a < rects.length; a += 1) {
        for (let c = a + 1; c < rects.length; c += 1) {
          const s = shared(rects[a]!, rects[c]!);
          if (s > 0) {
            pairs += 1;
            area += s;
          }
        }
      }
      const key: [number, number, number] = [pairs, area, sides.filter((s) => s === 'above-left').length];
      const better = !best || key[0] < best.key[0]
        || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])));
      if (better) best = { key, sides: [...sides] };
      return;
    }
    for (const side of options[i]!) {
      sides.push(side);
      walk(i + 1);
      sides.pop();
    }
  };
  walk(0);
  return best!.sides;
}
