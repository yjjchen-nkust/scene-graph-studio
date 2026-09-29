import { neighbours, rowNormalised } from '../logic';
import { frameById } from '../slice';

/** ph-001: spec §4.2's six objects and its six annotated relationships, read once for T2. */
export const M5_FRAME = 'ph-001';

/**
 * Spec §4.2's starting beliefs, one per object id 1 to 6. Designed on paper rather than measured,
 * so that the two edge sets `beliefGraph` compares carry the belief vector to different fixed
 * points, and so that the degree-weighted mean and the plain mean of these six disagree at two
 * decimal places on the `relations` graph -- the discrepancy T2 exists to make visible. Equal
 * degrees are sufficient, not necessary, for the two to agree: they agree whenever
 * Σⱼ (dⱼ − d̄) b⁽⁰⁾ⱼ = 0, as on the complete graph `every`.
 */
export const M5_B0: Readonly<Record<number, number>> = { 1: 0.9, 2: 0.2, 3: 0.7, 4: 0.4, 5: 0.1, 6: 0.6 };

export type BeliefGraphName = 'relations' | 'every';

export const BELIEF_GRAPHS: readonly BeliefGraphName[] = ['relations', 'every'];

export const W_STEP = 0.05;
export const W_DEFAULT = 0.5;
export const T_MAX = 40;
export const T_DEFAULT = 0;

/** ph-001's six objects under one edge set: ids, first names, starting beliefs, neighbour lists and S. */
export interface BeliefGraph {
  ids: number[];
  names: string[];
  b0: number[];
  lists: number[][];
  a: number[][];
}

/**
 * ph-001's six objects under one of the two edge sets spec §4.2 and Review Focus 5 compare:
 * `relations` reads its six relationship rows as undirected edges (subject and object joined both
 * ways); `every` joins every pair of the six objects, `[i, j]` for every `i < j`, regardless of
 * what ph-001 annotates. Both are ascending by object id, so `ids`, `names`, `b0`, `lists` and the
 * rows of `a` all line up on the same index; `lists = neighbours(ids, edges)` and
 * `a = rowNormalised(ids, lists)` so the two functions this reads through are held to the same
 * tests `logic.test.ts` already runs against them directly.
 */
export function beliefGraph(name: BeliefGraphName): BeliefGraph {
  const frame = frameById(M5_FRAME)!;
  const ids = frame.objects.map((o) => o.object_id).sort((x, y) => x - y);
  const byId = new Map(frame.objects.map((o) => [o.object_id, o]));
  const names = ids.map((id) => byId.get(id)!.names[0]!);
  const b0 = ids.map((id) => M5_B0[id]!);
  const edges: [number, number][] = name === 'relations'
    ? frame.relationships.map((r): [number, number] => [r.subject_id, r.object_id])
    : ids.flatMap((i, x) => ids.slice(x + 1).map((j): [number, number] => [i, j]));
  const lists = neighbours(ids, edges);
  const a = rowNormalised(ids, lists);
  return { ids, names, b0, lists, a };
}
