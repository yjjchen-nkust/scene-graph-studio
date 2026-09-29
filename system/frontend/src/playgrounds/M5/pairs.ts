import { candidateSpace, relatedPairs } from '../logic';
import { VG_FRAMES } from '../slice';

/**
 * One frame of the 80-frame `vg150-sgb` slice, spec §4.1's row: how many objects it carries, its
 * ordered-pair candidate space at |P| = 1 (T1's own count, distinct from the engine's |P| = 50
 * space F2 and E10 use), how many relationship rows it carries and how many distinct ordered
 * object pairs those rows touch.
 */
export interface PairRow {
  rank: number;
  imageId: string;
  objects: number;
  pairs: number;
  rows: number;
  related: number;
}

/**
 * Spec §4.1's 80 rows, ranked by object count and then by image id **as a number**. `image_id` is
 * a string, and a lexical comparison of strings stops at the first differing character: `'1246'`
 * sorts before `'547'` because `'1' < '5'`, which is not the ascending numeric order spec §4.1
 * states -- `547` carries fewer objects than `1246` only by coincidence of this slice, and the two
 * are adjacent ranks (40 and 41) precisely because both carry 16 objects.
 */
export const PAIR_ROWS: PairRow[] = VG_FRAMES
  .map((frame) => ({
    imageId: frame.image_id,
    objects: frame.objects.length,
    pairs: candidateSpace(frame.objects.length, 1, true),
    rows: frame.relationships.length,
    related: relatedPairs(frame.relationships),
  }))
  .sort((a, b) => a.objects - b.objects || Number(a.imageId) - Number(b.imageId))
  .map((row, i) => ({ rank: i + 1, ...row }));

/** The slice's totals, summed over `PAIR_ROWS`: spec §4.1's 80 frames, 1,348 objects, 26,282 pairs. */
export const SLICE_TOTALS: { frames: number; objects: number; pairs: number; rows: number; related: number } =
  PAIR_ROWS.reduce(
    (acc, r) => ({
      frames: acc.frames + 1,
      objects: acc.objects + r.objects,
      pairs: acc.pairs + r.pairs,
      rows: acc.rows + r.rows,
      related: acc.related + r.related,
    }),
    { frames: 0, objects: 0, pairs: 0, rows: 0, related: 0 },
  );

/** T1's starting rank: spec §4.1's middle example, 16 objects, neither the smallest nor the largest. */
export const T1_RANK_DEFAULT = 40;
