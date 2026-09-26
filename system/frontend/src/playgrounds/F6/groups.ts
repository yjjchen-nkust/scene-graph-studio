/**
 * The two merges F6 offers, as kp F6's own `knobs` field names them:
 * "merge on/above/over/sitting-on · merge man/person/people".
 *
 * Not a claim that these are synonyms. The step's point is that the vocabulary has no hierarchy,
 * so whether `above` means `on` is a decision a paper makes; these are the decisions the knowledge
 * point was specified with. The first member names the merged class.
 */
export const PREDICATE_GROUP: readonly string[] = ['on', 'above', 'over', 'sitting on'];
export const OBJECT_GROUP: readonly string[] = ['man', 'person', 'people'];

/**
 * VG-150's predicate count, as Xu et al. 2017 §4 states it: "we use the most frequent 150 object
 * categories and 50 predicates". Shown beside the slice's own count and labelled with its origin.
 */
export const VG150_PREDICATES = 50;
