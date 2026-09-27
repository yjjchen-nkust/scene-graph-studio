/**
 * What E1 is built on, named once for the component, its tests and the golden cases.
 *
 * The annotated triplet is relationship 1 of ph-001, box#3 on table#1. Each defect falsifies
 * exactly one conjunct of the match relation, and none of the eight name triples the defects can
 * produce, (box | glove, on | near, table | panel), is annotated in ph-001 except (box, on, table),
 * so the engine's verdict against the whole frame is the verdict against this one triplet.
 */
export const E1_FRAME = 'ph-001';
export const E1_RELATIONSHIP = 1;

export const E1_DEFECTS = {
  subject: 'glove',
  object: 'panel',
  predicate: 'near',
  /** IoU 3,150 / 9,450 = 1/3 against the 90 x 70 box. */
  subjectShift: { dx: 45, dy: 0 },
  /** IoU 23,100 / 69,300 = 1/3 against the 420 x 110 table, and still inside the photograph. */
  objectShift: { dx: 0, dy: 55 },
} as const;
