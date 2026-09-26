import type { SceneGraph, SGRelationship } from 'sgg-metrics';
import type { Note, Release, Split } from './splits';

/**
 * The arithmetic every playground displays, with no React in it.
 *
 * Separate from the components because `data/content/playground_golden.json` tests these
 * functions directly: a golden case states knobs and an expected number, and a component test
 * would have to render to check one. `labs/L3/freq.ts` is split from its lab for the same
 * reason.
 *
 * Nothing here is a metric. A count, a bound and a set membership are quantities their modules'
 * own definitions contain; R@K is a lab's business and belongs to `sgg-metrics`.
 */

export interface Triplet {
  subject_id: number;
  predicate: string;
  object_id: number;
}

/**
 * |V|(|V|-1)|P| — ordered pairs of *distinct* objects, times the predicate vocabulary.
 *
 * Distinct because a scene graph edge joins two objects: ⟨s,p,s⟩ is not a relation between two
 * things. Discarding direction identifies (s,o) with (o,s) and halves the space, which is the
 * claim F2's toggle exists to make visible.
 */
export function candidateSpace(objectCount: number, predicateCount: number, directed: boolean): number {
  if (objectCount < 2) return 0;
  const orderedPairs = objectCount * (objectCount - 1);
  const pairs = directed ? orderedPairs : orderedPairs / 2;
  return pairs * predicateCount;
}

/**
 * The first `density` fraction of the edges, as a prefix rather than a sample.
 *
 * A prefix so the slider is reversible: dragging back restores exactly what dragging forward
 * removed. A random sample would reshuffle on every render and make the picture flicker while
 * teaching nothing the fraction does not already say.
 */
export function densityCut(relationships: SGRelationship[], density: number): SGRelationship[] {
  const keep = Math.round(clamp(density, 0, 1) * relationships.length);
  return relationships.slice(0, keep);
}

/** Annotated over candidates. Zero rather than NaN when there are no candidates at all. */
export function ratio(annotated: number, candidates: number): number {
  if (candidates <= 0) return 0;
  return annotated / candidates;
}

export function formatRatio(value: number): string {
  // A share that rounds to zero is not a share of zero, and F1 exists to say how small this
  // number is -- so printing `0.00%` for both loses exactly the distinction the readout is for.
  // Unreachable on the committed slice, where the smallest non-zero share is 1/1500 = 0.07%, and
  // reachable the moment a frame carries more objects or the vocabulary grows.
  const percent = value * 100;
  if (value > 0 && percent < 0.005) return '< 0.01%';
  return `${percent.toFixed(2)}%`;
}

/** A triplet's identity. With direction discarded, the two endpoints are sorted into one key. */
export function tripletKey(t: Triplet, directed: boolean): string {
  if (directed) return `${t.subject_id}|${t.predicate}|${t.object_id}`;
  const [a, b] = [t.subject_id, t.object_id].sort((x, y) => x - y);
  return `${a}|${t.predicate}|${b}`;
}

/**
 * Whether this exact triplet is one the annotator wrote.
 *
 * Deliberately named for what it checks. M0's third implication is 已標註者不等於為真者, so
 * "in E" is the only claim this function is entitled to make, and F8 must report it in those
 * words rather than as true and false.
 */
export function isInE(graph: SceneGraph, t: Triplet): boolean {
  return graph.relationships.some(
    (r) => r.subject_id === t.subject_id && r.object_id === t.object_id && r.predicate === t.predicate,
  );
}

/**
 * A boolean knob, read from the number the URL carries.
 *
 * Deliberately not `value === 1`. That reads every value outside {0, 1} as *off*, so a URL
 * carrying `?F2.directed=2` selected the state opposite the default and showed a halved candidate
 * space nobody asked for. `useLabParams` rejects only what will not parse as a number, so an
 * absurd-but-numeric value reaches the component and the component is where it stops. Same rule
 * as `clamp` below, for the knobs that have two states rather than a range.
 */
export function flag(value: number, fallback: boolean): boolean {
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
}

/** A knob arriving from the URL is not necessarily in range; `useLabParams` only rejects NaN. */
export function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(Math.max(value, low), high);
}

// ---- F6: merging classes ------------------------------------------------------------------

/**
 * Each member of each group mapped to the group's first member.
 *
 * F6's checkboxes build this. A label in no group maps to itself through `canonical`, so an
 * empty map is the vocabulary exactly as annotated.
 */
export function mergeMap(groups: readonly (readonly string[])[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const group of groups) {
    const head = group[0];
    if (head === undefined) continue;
    for (const member of group) out.set(member, head);
  }
  return out;
}

export function canonical(label: string, merge: Map<string, string>): string {
  return merge.get(label) ?? label;
}

/** How often each class occurs once the merge is applied. `.size` is the class count. */
export function classCounts(labels: Iterable<string>, merge: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const label of labels) {
    const c = canonical(label, merge);
    out.set(c, (out.get(c) ?? 0) + 1);
  }
  return out;
}

export function predicateLabels(frames: SceneGraph[]): string[] {
  return frames.flatMap((f) => f.relationships.map((r) => r.predicate));
}

/** The first name of every object. Every object in the committed slices carries exactly one. */
export function objectLabels(frames: SceneGraph[]): string[] {
  return frames.flatMap((f) => f.objects.flatMap((o) => (o.names[0] === undefined ? [] : [o.names[0]])));
}

/**
 * Whether the triplet is one the annotator wrote, once synonyms are merged.
 *
 * Keyed on the two object ids and the predicate's class, as `isInE` is keyed on the ids and the
 * predicate itself; with an empty merge the two agree. F6 reports it in F8's words, recorded in
 * E′, never correct. Direction is kept: merging synonyms does not make a relation symmetric.
 */
export function isInMergedE(graph: SceneGraph, t: Triplet, merge: Map<string, string>): boolean {
  const p = canonical(t.predicate, merge);
  return graph.relationships.some(
    (r) => r.subject_id === t.subject_id && r.object_id === t.object_id && canonical(r.predicate, merge) === p,
  );
}

// ---- F7: the shape of the tail --------------------------------------------------------------

/** H_m^(s) = Σ_{p=1}^{m} p^(−s), the generalized harmonic number M1's s4 uses. */
export function harmonic(m: number, s: number): number {
  let sum = 0;
  for (let p = 1; p <= m; p += 1) sum += p ** -s;
  return sum;
}

function classCount(C: number): number {
  return Number.isFinite(C) ? Math.max(1, Math.round(C)) : 1;
}

/**
 * The share of all triplets held by the k most frequent of C classes when n_p ∝ p^(−s).
 *
 * H_k^(s) / H_C^(s): a ratio of two counts and nothing else. F7 shows how the data is shaped;
 * what a model's recall does on that shape is L3's to score.
 */
export function headShare(k: number, C: number, s: number): number {
  const classes = classCount(C);
  const head = Number.isFinite(k) ? Math.min(Math.max(1, Math.round(k)), classes) : 1;
  return harmonic(head, s) / harmonic(classes, s);
}

/** n_C / n_1 = C^(−s): the rarest class as a fraction of the most frequent. */
export function tailToHead(C: number, s: number): number {
  return classCount(C) ** -s;
}

export interface RankedClass {
  label: string;
  count: number;
}

/** Classes by count, most frequent first, ties broken by label so the order never depends on input order. */
export function ranked(labels: Iterable<string>): RankedClass[] {
  return [...classCounts(labels, new Map())]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/** The share of all counted triplets held by the first k classes of a ranking. */
export function measuredHeadShare(rank: RankedClass[], k: number): number {
  const total = rank.reduce((n, c) => n + c.count, 0);
  if (total === 0) return 0;
  const head = Number.isFinite(k) ? Math.min(Math.max(0, Math.round(k)), rank.length) : 0;
  return rank.slice(0, head).reduce((n, c) => n + c.count, 0) / total;
}

// ---- X1: releases compared ------------------------------------------------------------------

/** a − b for one split, only when both releases state it as a count. A share is not a count. */
export function splitDifference(a: Release, b: Release, split: Split): number | null {
  const x = a.figures[split]?.value;
  const y = b.figures[split]?.value;
  return typeof x === 'number' && typeof y === 'number' ? x - y : null;
}

/**
 * The note of the sources a difference on `split` equals, if either release carries one.
 *
 * Matched on magnitude, so a − b and b − a find the same note, and on the split the note is about,
 * so a difference on another split that happens to equal it claims nothing. The equality is
 * computed here; the sentence is the source's. A zero difference has nothing to explain.
 */
export function explain(difference: number, split: Split, releases: Release[]): Note | undefined {
  const magnitude = Math.abs(difference);
  if (magnitude === 0) return undefined;
  for (const r of releases) {
    const hit = r.notes.find((n) => n.split === split && n.value === magnitude);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The pool validation was drawn from, as the source states it, or null where it does not.
 *
 * Not a disjointness verdict: v1 drew validation from the test pool, yet its validation and test
 * sets partition that pool (27,032 + 4,844 = 31,876), and no source says they overlap.
 */
export function valPool(r: Release): 'trainval' | 'test' | null {
  const from = r.figures.val_from?.value;
  return from === 'trainval' || from === 'test' ? from : null;
}
