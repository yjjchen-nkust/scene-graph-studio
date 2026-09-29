import type { SceneGraph } from 'sgg-metrics';
import type { VlmFrame } from '../data';

/**
 * `indvissgg.NO_GEOMETRY_EN`, word for word: the note `to_graph` puts on every replayed graph.
 * It is the graph's own record, in the language of the schema, not a slide's text; part 4 states
 * the same fact to the room through its own caption in the displayed locale.
 */
export const NO_GEOMETRY_NOTE =
  'This method returns triplets and no geometry. The boxes on this graph are placeholders so '
  + 'that it satisfies the SceneGraph schema; they were not measured and nothing may be computed '
  + 'from them.';

/**
 * One frame's step-3 summary as a `SceneGraph`: the TypeScript counterpart of
 * `app/vlm/indvissgg.py`'s `to_graph` for a replay (`live=False`).
 *
 * Each distinct entity name becomes one object, numbered from 1 in the order it first appears
 * reading each row's subject and then its object; each row becomes one relationship, repeats
 * included, since a completion's rows are its ranking. The method returns no geometry, so every
 * object carries a one-pixel box at an offset equal to its id: distinct, so two entities never
 * collide, and meaningless, so nobody mistakes it for a detection. Part 4 draws the graph with
 * `dagre`, by its structure; the placeholder boxes are never drawn.
 *
 * A replay is not the call, so the graph is `reconstructed` and its `vlm` is `transcript`, as
 * `to_graph` requires of any replay. `to_graph` also stamps the time of the replay; this function
 * runs on every render, so it stays pure and leaves `generated_at` out. The recording's own date
 * is on the part's provenance line.
 */
export function summaryGraph(frame: VlmFrame): SceneGraph {
  const ids = new Map<string, number>();
  for (const [subject, , object] of frame.summary) {
    for (const name of [subject, object]) if (!ids.has(name)) ids.set(name, ids.size + 1);
  }
  const id = (name: string) => ids.get(name)!;
  return {
    image_id: frame.image_id,
    dataset: 'mini-isg',
    width: 1024,
    height: 768,
    objects: [...ids].map(([name, n]) => ({ object_id: n, names: [name], bbox: { x: n, y: n, w: 1, h: 1 } })),
    relationships: frame.summary.map(([subject, predicate, object], i) => ({
      relationship_id: i + 1,
      subject_id: id(subject),
      object_id: id(object),
      predicate,
      score: null,
    })),
    provenance: { kind: 'vlm', fidelity: 'reconstructed', vlm: 'transcript', note: NO_GEOMETRY_NOTE },
  };
}
