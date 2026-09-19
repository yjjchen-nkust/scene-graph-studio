import type { SceneGraph } from 'sgg-metrics';
import { encodeCounts } from 'sgg-metrics';

/**
 * Two prediction styles over one four-pixel scene, reconstructed to reproduce a documented
 * behaviour and labelled as such.
 *
 * These are **not** any model's output. They are the smallest fixtures that exhibit the property
 * the ECCV 2024 correction is about: a one-stage model emits several predictions at one ordered
 * pair of mask instances, a two-stage model emits one. Every graph therefore carries
 * `fidelity: 'reconstructed'` with a note, and the lab says so in standing text as well.
 */
const size: [number, number] = [4, 4];
const mask = (offset: number) => ({
  counts: encodeCounts([offset, 4, 16 - offset - 4]),
  size,
});

const SUBJ = mask(0);
const OBJ = mask(4);
const OTHER = mask(8);

const box = { x: 0, y: 0, w: 4, h: 4 };

function graph(
  id: string,
  objects: Array<[number, string, { counts: string; size: [number, number] }]>,
  rels: Array<[number, number, number, string, number | null]>,
  kind: 'ground_truth' | 'model',
  note: string | null,
): SceneGraph {
  return {
    image_id: id,
    dataset: 'psg',
    width: 4,
    height: 4,
    objects: objects.map(([oid, name, m]) => ({
      object_id: oid,
      names: [name],
      bbox: box,
      mask: m,
    })),
    relationships: rels.map(([rid, s, o, predicate, score]) => ({
      relationship_id: rid,
      subject_id: s,
      object_id: o,
      predicate,
      score,
    })),
    provenance:
      kind === 'ground_truth'
        ? { kind, fidelity: 'measured' }
        : { kind, fidelity: 'reconstructed', note: note ?? undefined },
  } as SceneGraph;
}

const OBJECTS: Array<[number, string, { counts: string; size: [number, number] }]> = [
  [1, 'person', SUBJ],
  [2, 'table', OBJ],
  [3, 'cup', OTHER],
];

export const GT = graph(
  'forensics',
  OBJECTS,
  // Three of the four ground-truth relations sit at one ordered pair of instances. That is the
  // shape the correction is about: it is where a model that emits duplicates can collect several
  // matches from one pair of masks.
  [
    [1, 1, 2, 'on', null],
    [2, 1, 2, 'near', null],
    [3, 1, 2, 'under', null],
    [4, 1, 3, 'holding', null],
  ],
  'ground_truth',
  null,
);

export const RECONSTRUCTED_NOTE_EN =
  'Reconstructed to reproduce the duplicate-mask behaviour reported for one-stage panoptic ' +
  'models by the ECCV 2024 mask-pairing correction. This is NOT any model’s output; no ' +
  'checkpoint was run.';

/** Several predictions at one ordered pair of masks: the behaviour the correction penalises. */
export const ONE_STAGE = graph(
  'forensics',
  OBJECTS,
  // Three predictions at one pair. Under multi_mpo all three count: 3/4. Under single_mpo only
  // the highest-scoring survives: 1/4.
  [
    [1, 1, 2, 'on', 0.9],
    [2, 1, 2, 'near', 0.8],
    [3, 1, 2, 'under', 0.7],
  ],
  'model',
  RECONSTRUCTED_NOTE_EN,
);

/** One prediction per ordered pair of masks, which is what a two-stage detector emits. */
export const TWO_STAGE = graph(
  'forensics',
  OBJECTS,
  // Two predictions at two different pairs, so the cap never bites: 2/4 under either mode. It
  // therefore starts behind the one-stage row and finishes ahead of it, which is the reordering.
  [
    [1, 1, 2, 'on', 0.9],
    [2, 1, 3, 'holding', 0.8],
  ],
  'model',
  RECONSTRUCTED_NOTE_EN,
);
