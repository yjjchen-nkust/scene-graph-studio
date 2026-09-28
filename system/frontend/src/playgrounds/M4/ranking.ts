/**
 * The photograph the ranked list lives on. PredCls, so every row's boxes are the ground
 * truth's: spec §4.1 designs the ranks, the pairs and the predicates on paper, against ph-001
 * alone.
 */
export const M4_FRAME = 'ph-001';

/** One scored prediction of the ranked list, in spec §4.1's own columns. */
export interface RankedRow {
  rank: number;
  subject: number;
  predicate: string;
  object: number;
  score: number;
}

/**
 * Spec §4.1's twelve rows, exactly, rank 1 to 12. Hand-built on ph-001 rather than read from
 * `data/predictions/placeholder/`, whose ranks were not designed for what E3, E4 and E7 need
 * to show; a prediction matches a ground truth exactly when subject id, object id and
 * predicate all agree, since ph-001's object names are distinct. Scores are distinct, so no
 * tie is broken. A test that disagrees with this table is the defect, not the table.
 */
export const M4_RANKING: RankedRow[] = [
  { rank: 1, subject: 2, predicate: 'holding', object: 5, score: 0.95 },
  { rank: 2, subject: 2, predicate: 'next to', object: 5, score: 0.90 },
  { rank: 3, subject: 3, predicate: 'on', object: 1, score: 0.85 },
  { rank: 4, subject: 2, predicate: 'in front of', object: 1, score: 0.80 },
  { rank: 5, subject: 6, predicate: 'above', object: 1, score: 0.75 },
  { rank: 6, subject: 2, predicate: 'near', object: 5, score: 0.70 },
  { rank: 7, subject: 2, predicate: 'near', object: 1, score: 0.65 },
  { rank: 8, subject: 2, predicate: 'holding', object: 4, score: 0.60 },
  { rank: 9, subject: 3, predicate: 'near', object: 1, score: 0.55 },
  { rank: 10, subject: 2, predicate: 'wearing', object: 4, score: 0.50 },
  { rank: 11, subject: 5, predicate: 'on', object: 1, score: 0.45 },
  { rank: 12, subject: 1, predicate: 'behind', object: 2, score: 0.40 },
];

/**
 * Per-pair caps the three constraint modes apply: `graph` keeps one prediction per ordered
 * object pair, the engine's `semi` default (`index.ts:58`) keeps two, and `none` keeps every
 * one -- `Infinity` rather than a count, so `capPerPair(rows, M4_CAPS.none)` drops nothing
 * without a special case.
 */
export const M4_CAPS = { graph: 1, semi: 2, none: Infinity } as const;

/** The ranked list's length: every k a playground offers runs from 1 to this. */
export const M4_K_MAX = 12;
