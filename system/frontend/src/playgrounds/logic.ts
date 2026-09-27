import type { BBox, SceneGraph, SGRelationship } from 'sgg-metrics';
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

/**
 * `clamp`, then onto the slider's step, and onto the decimal the step is written in.
 *
 * A range input moves its thumb to the nearest step whatever value it is handed, so a URL carrying
 * `F3.lambda=1.45` would show the thumb at 1.5 while the readouts computed 1.45. Snapping here keeps
 * the two the same setting. The decimal rounding is not cosmetic: `k * 0.05` can land one ulp off
 * the value its string names, and a τ one ulp above 0.5 rejects an IoU of exactly 0.5.
 */
export function snap(value: number, low: number, high: number, step: number): number {
  const places = (String(step).split('.')[1] ?? '').length;
  // The count of steps is itself rounded to ten places first: (1.45 - 0.5) / 0.1 is 9.4999…98 in
  // binary, and the browser, which works in decimal, puts 1.45 exactly half way and rounds up.
  const steps = Math.round(Number(((clamp(value, low, high) - low) / step).toFixed(10)));
  const onStep = steps * step + low;
  return Number(clamp(onStep, low, high).toFixed(places));
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

/**
 * The predicate of every distinct triplet, after `merge`.
 *
 * E is a set: a frame that annotates (s, p, o) twice records one triplet, and the slice's 892
 * relationship rows are 684 triplets. The merge is applied before the rows are counted, because
 * it can make two rows of one pair the same triplet of E′: two members of the `on` group on the
 * same pair are one triplet once merged. Ids are a frame's own, so equal ids in two frames are two
 * triplets.
 */
export function predicateLabels(frames: SceneGraph[], merge: Map<string, string> = new Map()): string[] {
  return frames.flatMap((f) => {
    const seen = new Set<string>();
    return f.relationships.flatMap((r) => {
      const predicate = canonical(r.predicate, merge);
      const key = tripletKey({ subject_id: r.subject_id, predicate, object_id: r.object_id }, true);
      if (seen.has(key)) return [];
      seen.add(key);
      return [predicate];
    });
  });
}

/**
 * How many pairs, across the frames, carry more than one member of `group`, each counted once.
 *
 * These are the pairs a merge makes one triplet of E′. It is not the number of rows a merge
 * removes: three members on one pair are one pair and two rows, and the sentence F6 writes under
 * its subtraction names pairs.
 */
export function pairsWithSeveral(frames: SceneGraph[], group: readonly string[]): number {
  return frames.reduce((n, f) => {
    const members = new Map<string, Set<string>>();
    for (const r of f.relationships) {
      if (!group.includes(r.predicate)) continue;
      const pair = `${r.subject_id}|${r.object_id}`;
      members.set(pair, (members.get(pair) ?? new Set()).add(r.predicate));
    }
    return n + [...members.values()].filter((m) => m.size > 1).length;
  }, 0);
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

/** H_m^(s) = Σ_{p=1}^{m} p^(−s), the generalized harmonic number M1's s5 uses. */
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

// ---- F3: one box against its annotation ---------------------------------------------------

/**
 * The prediction: the annotated box moved by (dx, dy) and scaled by λ about its own centre.
 *
 * Rounded to whole pixels, so every area F3 prints is a count of pixels and |b ∩ b′| / |b ∪ b′|
 * is a ratio of two counts, as the formula's bars say. On object 3 and λ in steps of 0.1 the
 * rounding changes no size; it matters only for a λ a URL carries off the grid.
 */
export function scaledBox(gt: BBox, dx: number, dy: number, lambda: number): BBox {
  const w = Math.round(lambda * gt.w);
  const h = Math.round(lambda * gt.h);
  return {
    x: Math.round(gt.x + gt.w / 2 + dx - w / 2),
    y: Math.round(gt.y + gt.h / 2 + dy - h / 2),
    w,
    h,
  };
}

export function area(b: BBox): number {
  return b.w * b.h;
}

/**
 * The pixels two boxes share, or null when they share none.
 *
 * Half-open, as `sgg-metrics`' `boxIou` and `backend/app/eval/iou.py` are: two boxes whose edges
 * only touch share no pixel, so F3 and the engine agree on the case a student is most likely to
 * try.
 */
export function intersection(a: BBox, b: BBox): BBox | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** A + A′ − |a ∩ b|: the pixels in either box, each counted once. */
export function unionArea(a: BBox, b: BBox): number {
  const shared = intersection(a, b);
  return area(a) + area(b) - (shared ? area(shared) : 0);
}

/**
 * min(A, A′) / max(A, A′), M2 s2's bound on IoU, before any question of placement.
 *
 * Taken from the two whole-pixel areas rather than from λ², so it bounds the IoU printed beside
 * it even when rounding has moved the areas off λ²A. Zero when either box has no area.
 */
export function scaleBound(a: BBox, b: BBox): number {
  const small = Math.min(area(a), area(b));
  const large = Math.max(area(a), area(b));
  return large > 0 ? small / large : 0;
}

/**
 * numerator / denominator to three places, cut rather than rounded.
 *
 * F3 prints IoU beside the verdict IoU ≥ τ, and every τ on its slider has two places. Rounded,
 * 3,800 / 7,603 = 0.49980 printed 0.500 beside "IoU < τ" at τ = 0.5, and 972 settings did the
 * like; cut, the printed value is at least τ exactly when the quotient is. The quotient of two
 * whole numbers below 2^53 is off by less than 1e-13 at 1,000, far inside the 1 / denominator
 * that separates it from the next thousandth, so the floor is exact. A share above zero that cuts
 * to zero is said to be below 0.001, as `formatRatio` says of F1's, rather than printed as a zero
 * beside a hatched sliver.
 */
export function truncatedRatio(numerator: number, denominator: number): string {
  if (denominator <= 0 || numerator <= 0) return '0.000';
  const thousandths = Math.floor((numerator * 1000) / denominator);
  if (thousandths === 0) return '< 0.001';
  return (thousandths / 1000).toFixed(3);
}

// ---- E1: the match relation, one defect at a time -----------------------------------------

export interface BoxTriplet {
  subject: { name: string; box: BBox };
  predicate: string;
  object: { name: string; box: BBox };
}

export interface E1Defects { cs: boolean; co: boolean; p: boolean; bs: boolean; bo: boolean }

/** The five conjuncts of t̂ ≃ t, named as M3 s2 names them: c_ŝ, c_ô, p̂, IoU_s, IoU_o. */
export interface Conjuncts { cs: boolean; co: boolean; p: boolean; is: boolean; io: boolean }

export function annotatedTriplet(frame: SceneGraph, relationshipId: number): BoxTriplet {
  const r = frame.relationships.find((x) => x.relationship_id === relationshipId)!;
  const byId = new Map(frame.objects.map((o) => [o.object_id, o]));
  const s = byId.get(r.subject_id)!;
  const o = byId.get(r.object_id)!;
  return {
    subject: { name: s.names[0]!, box: s.bbox },
    predicate: r.predicate,
    object: { name: o.names[0]!, box: o.bbox },
  };
}

/** What each defect puts in place of the annotated value; E1's is `E1_DEFECTS`. */
export interface DefectTable {
  subject: string;
  object: string;
  predicate: string;
  subjectShift: { dx: number; dy: number };
  objectShift: { dx: number; dy: number };
}

/** The annotated triplet with the chosen defects injected, each touching one conjunct only. */
export function withDefects(t: BoxTriplet, d: E1Defects, table: DefectTable): BoxTriplet {
  const { subjectShift: ss, objectShift: os } = table;
  return {
    subject: {
      name: d.cs ? table.subject : t.subject.name,
      box: d.bs ? scaledBox(t.subject.box, ss.dx, ss.dy, 1) : t.subject.box,
    },
    predicate: d.p ? table.predicate : t.predicate,
    object: {
      name: d.co ? table.object : t.object.name,
      box: d.bo ? scaledBox(t.object.box, os.dx, os.dy, 1) : t.object.box,
    },
  };
}

/** The pixels two boxes share and the pixels in either: IoU as the two counts it divides. */
export function iouCounts(a: BBox, b: BBox): [number, number] {
  const shared = intersection(a, b);
  return [shared ? area(shared) : 0, unionArea(a, b)];
}

function meets(a: BBox, b: BBox, tau: number): boolean {
  const [shared, union] = iouCounts(a, b);
  return ratio(shared, union) >= tau;
}

export function conjuncts(pred: BoxTriplet, gt: BoxTriplet, tau: number): Conjuncts {
  return {
    cs: pred.subject.name === gt.subject.name,
    co: pred.object.name === gt.object.name,
    p: pred.predicate === gt.predicate,
    is: meets(pred.subject.box, gt.subject.box, tau),
    io: meets(pred.object.box, gt.object.box, tau),
  };
}

/** Which half fails, in M3 s2's words: a wrong name, a wrong place, or both. */
export function failureMode(c: Conjuncts): 'none' | 'name' | 'place' | 'both' {
  const name = c.cs && c.co && c.p;
  const place = c.is && c.io;
  if (name && place) return 'none';
  if (!name && !place) return 'both';
  return name ? 'place' : 'name';
}

/**
 * The verdict the engine's diff gives one prediction against a frame with nothing yet consumed.
 *
 * `sgg-metrics`' `classify`, restated for this case: a match is an annotated triplet with the
 * same three names and both IoUs at least τ; failing that, any with the same three names makes it
 * `localization`; anything else is `spurious`. `logic.test.ts` holds this to `classify` over
 * every setting of E1's toggles.
 */
export function frameVerdict(pred: BoxTriplet, frame: SceneGraph, tau: number): 'match' | 'localization' | 'spurious' {
  const named = frame.relationships
    .map((r) => annotatedTriplet(frame, r.relationship_id))
    .filter((t) => t.subject.name === pred.subject.name && t.predicate === pred.predicate
      && t.object.name === pred.object.name);
  if (named.some((t) => meets(pred.subject.box, t.subject.box, tau) && meets(pred.object.box, t.object.box, tau))) {
    return 'match';
  }
  return named.length > 0 ? 'localization' : 'spurious';
}

// ---- E10: what each protocol leaves the model to search -----------------------------------

export type Protocol = 'predcls' | 'sgcls' | 'sgdet';

/** Axis-aligned boxes with whole-pixel corners and positive area: C(width+1, 2) · C(height+1, 2). */
export function wholePixelBoxes(width: number, height: number): bigint {
  const pairs = (n: bigint) => (n * (n - 1n)) / 2n;
  return pairs(BigInt(width) + 1n) * pairs(BigInt(height) + 1n);
}

/**
 * The single-triplet hypotheses a protocol lets the model output, ⟨(b_s, c_s), p, (b_o, c_o)⟩.
 *
 * PredCls fixes boxes and classes, so an ordered pair of distinct objects and a predicate:
 * |V|(|V|-1)|P|. SGCls frees the two classes: |V|(|V|-1)|C|²|P|. SGDet frees the boxes too, any
 * two distinct whole-pixel boxes: B(B-1)|C|²|P|. `bigint` because the last exceeds 2^53.
 */
export function hypothesisSpace(protocol: Protocol, objects: number, classes: number, predicates: number, boxes: bigint): bigint {
  const P = BigInt(predicates);
  const C2 = BigInt(classes) ** 2n;
  const pairs = BigInt(objects) * BigInt(objects - 1);
  if (protocol === 'predcls') return pairs * P;
  if (protocol === 'sgcls') return pairs * C2 * P;
  return boxes * (boxes - 1n) * C2 * P;
}

/**
 * The first and last of a set of ids when they run without a gap, else null. "#1 to #6" names six
 * boxes only when the ids are 1 to 6; E10 wrote it from the count alone (D102). A repeated id breaks
 * the run, since two objects cannot share one number.
 */
export function idRun(ids: readonly number[]): { first: number; last: number } | null {
  if (ids.length === 0) return null;
  const sorted = [...ids].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1]! + 1) return null;
  }
  return { first: sorted[0]!, last: sorted[sorted.length - 1]! };
}
