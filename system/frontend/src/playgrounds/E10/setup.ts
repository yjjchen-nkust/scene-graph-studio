import type { BadgePlace } from '../PhotoMarks';

/** The photograph E10 hands over under each protocol; B is counted from its size. */
export const E10_FRAME = 'ph-001';

/**
 * Where a box's number sits on ph-001 when not above its box. The wrench's box lies just above the
 * table's corner, so the table's number goes inside its box, and the wrench's goes above and to the
 * left, clear of the person's box beside it (D100).
 */
export const E10_BADGE_PLACES: Partial<Record<number, BadgePlace>> = { 1: 'inside', 5: 'above-left' };

/**
 * VG-150's vocabulary. Xu et al. 2017, arXiv 1701.02426v2, §4 (p. 5): "we use the most frequent
 * 150 object categories and 50 predicates for evaluation." The two literals E10 carries, each
 * labelled with this origin on screen, as F1's |P| presets are.
 */
export const VG150_CLASSES = 150;
export const VG150_PREDICATES = 50;
