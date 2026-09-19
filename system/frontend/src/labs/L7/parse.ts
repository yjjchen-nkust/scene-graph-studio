import type { SceneGraph } from 'sgg-metrics';

/**
 * A sentence to a scene graph, by rule, over a closed vocabulary.
 *
 * No natural-language library. The lesson of L7 is the structural correspondence between a
 * sentence and a graph — nouns are nodes, what sits between two nouns is an edge — and a
 * dependency parser would hide exactly that behind an import. The cost of the rule is that it
 * handles captions and not English, which is the right trade for a teaching surface.
 *
 * The one behaviour that is not a simplification: a predicate outside `P` is **kept**, marked, and
 * counted. Knowledge point L10 — an out-of-vocabulary predicate is scored as a false positive and
 * leaves the true triplet missed, so one error is counted twice. Dropping it silently, which is
 * what a tidier parser would do, would hide the entire lesson.
 */

/** Object classes, longest first so a multi-word noun is never matched by its first word. */
export const O_DEFAULT = [
  'robot arm',
  'conveyor',
  'workbench',
  'terminals',
  'screwdriver',
  'wrench',
  'person',
  'worker',
  'panel',
  'shelf',
  'table',
  'beam',
  'box',
  'cup',
  'tape',
];

/** Predicate classes, longest first for the same reason. */
export const P_DEFAULT = ['knocking on', 'installing', 'holding', 'above', 'under', 'near', 'on'];

/** Words that carry no structure: they neither open a node nor belong to an edge. */
const FILLER = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'being', 'been', 'and', 'of', 'to', 'that',
  'this', 'there', 'it', 'its', 'his', 'her', 'their',
]);

export type CaptionWarning = 'self_loop' | 'no_predicate' | 'unparsed_word';

export interface CaptionGraph extends SceneGraph {
  /** Structural complaints about the sentence, for the lab to render beside the graph. */
  warnings: CaptionWarning[];
}

const NOTE =
  'Parsed from a sentence, which carries no geometry. The boxes on this graph are placeholders ' +
  'laid out in a row so that it satisfies the SceneGraph schema; they were not measured and ' +
  'nothing may be computed from them.';

function normalise(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** The longest phrase from `vocabulary` matching at `tokens[i]`, or null. */
function matchAt(tokens: string[], i: number, vocabulary: string[]): string | null {
  for (const phrase of vocabulary) {
    const words = phrase.split(' ');
    if (words.every((w, j) => tokens[i + j] === w)) return phrase;
  }
  return null;
}

export function parse(
  sentence: string,
  { O = O_DEFAULT, P = P_DEFAULT }: { O?: string[]; P?: string[] } = {},
): CaptionGraph {
  // Longest first, so `robot arm` wins over `arm` and `knocking on` over `on`.
  const nouns = [...O].sort((a, b) => b.split(' ').length - a.split(' ').length);
  const predicates = [...P].sort((a, b) => b.split(' ').length - a.split(' ').length);

  const tokens = normalise(sentence);
  const ids = new Map<string, number>();
  const objects: SceneGraph['objects'] = [];
  const relationships: SceneGraph['relationships'] = [];
  const warnings = new Set<CaptionWarning>();

  const nodeFor = (name: string): number => {
    const existing = ids.get(name);
    if (existing !== undefined) return existing;
    const id = objects.length + 1;
    ids.set(name, id);
    objects.push({
      object_id: id,
      names: [name],
      // A row of unit boxes. Distinct enough that no two nodes collide, meaningless enough that
      // nobody mistakes one for a detection.
      bbox: { x: (id - 1) * 2, y: 0, w: 1, h: 1 },
    });
    return id;
  };

  let previous: number | null = null;
  let buffer: string[] = [];
  let sawAnyPair = false;

  for (let i = 0; i < tokens.length; ) {
    const noun = matchAt(tokens, i, nouns);
    if (noun !== null) {
      const id = nodeFor(noun);
      if (previous !== null) {
        sawAnyPair = true;
        // Whatever sits between two nouns is the edge, in or out of vocabulary. `buffer` is
        // already stripped of filler, so what survives is the caption's own words for it.
        const predicate = buffer.join(' ').trim();
        if (predicate === '') {
          warnings.add('no_predicate');
        } else if (id === previous) {
          warnings.add('self_loop');
        } else {
          relationships.push({
            relationship_id: relationships.length + 1,
            subject_id: previous,
            object_id: id,
            predicate,
            // A caption asserts; it does not rank. `null` is honest and `rank` puts unscored
            // predictions after every scored one, which is the right place for an assertion.
            score: null,
          });
        }
      }
      previous = id;
      buffer = [];
      i += noun.split(' ').length;
      continue;
    }

    const phrase = matchAt(tokens, i, predicates);
    if (phrase !== null) {
      buffer.push(phrase);
      i += phrase.split(' ').length;
      continue;
    }

    if (!FILLER.has(tokens[i])) {
      // Kept, because an unknown word between two nouns is the out-of-vocabulary predicate L10 is
      // about. A word that ends up next to no second noun is dropped and reported.
      buffer.push(tokens[i]);
      warnings.add('unparsed_word');
    }
    i += 1;
  }

  if (objects.length >= 2 && relationships.length === 0 && !sawAnyPair) {
    warnings.add('no_predicate');
  }

  return {
    image_id: 'caption',
    dataset: 'placeholder',
    width: Math.max(2, objects.length * 2),
    height: 2,
    objects,
    relationships,
    provenance: { kind: 'user', fidelity: 'reconstructed', note: NOTE },
    warnings: [...warnings],
  } as CaptionGraph;
}

/**
 * The predicates this graph asserts that `P` does not contain, in order of first appearance.
 *
 * L10's two-fold cost: each of these occupies a rank that a legal triplet could have held, **and**
 * leaves the relation it describes unmatched. One mistake, counted twice.
 */
export function outOfVocabulary(graph: SceneGraph, P: string[]): string[] {
  const legal = new Set(P);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of graph.relationships) {
    if (!legal.has(r.predicate) && !seen.has(r.predicate)) {
      seen.add(r.predicate);
      out.push(r.predicate);
    }
  }
  return out;
}
