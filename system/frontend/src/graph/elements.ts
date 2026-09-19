import type { ElementDefinition } from 'cytoscape';
import type { SceneGraph, SGObject, Verdict, VerdictKind } from 'sgg-metrics';
import { centroid } from './geometry';

export type LayoutName = 'dagre' | 'preset';

const nodeId = (objectId: number) => `o${objectId}`;
const ghostNodeId = (objectId: number) => `gt${objectId}`;

/**
 * The elements Cytoscape draws, as a pure function.
 *
 * Kept out of the component so the part that can be wrong is the part that can be tested: every
 * decision about what appears in the diff is made here, with no DOM, no canvas and no layout
 * engine. The component's remaining job is wiring, which is the only thing its own tests check.
 */
export function buildElements(
  pred: SceneGraph,
  gt: SceneGraph | undefined,
  verdicts: Verdict[],
  layout: LayoutName = 'dagre',
): ElementDefinition[] {
  const elements: ElementDefinition[] = [];
  const placed = new Map<string, string>(); // element id → the name it was placed under

  const addNode = (o: SGObject, id: string, ghost: boolean) => {
    if (placed.has(id)) return;
    placed.set(id, o.names[0] ?? '');
    elements.push({
      group: 'nodes',
      data: { id, objectId: o.object_id, label: o.names[0] ?? '', ...(ghost ? { ghost: 1 } : {}) },
      // Only 'preset' consumes positions. Emitting them under 'dagre' would be inert at best
      // and, if the layout were ever configured to respect them, silently wrong.
      ...(layout === 'preset'
        ? { position: { x: centroid(o.bbox).cx, y: centroid(o.bbox).cy } }
        : {}),
    });
  };

  for (const o of pred.objects) addNode(o, nodeId(o.object_id), false);

  const verdictAt = new Map<number, VerdictKind>();
  for (const v of verdicts) {
    if (v.pred_index >= 0) verdictAt.set(v.pred_index, v.verdict);
  }

  const predById = new Map(pred.objects.map((o) => [o.object_id, o]));
  pred.relationships.forEach((r, index) => {
    if (!predById.has(r.subject_id) || !predById.has(r.object_id)) return;
    elements.push({
      group: 'edges',
      data: {
        id: `r${r.relationship_id}`,
        source: nodeId(r.subject_id),
        target: nodeId(r.object_id),
        label: r.predicate,
        relationshipId: r.relationship_id,
        verdict: verdictAt.get(index),
      },
    });
  });

  if (!gt) return elements;

  const gtById = new Map(gt.objects.map((o) => [o.object_id, o]));

  /**
   * Which node a ground-truth object belongs on.
   *
   * Under PredCls and SGCls the boxes are given, so an id means the same object in both graphs
   * and the ghost edge should attach to the node already drawn. Under SGDet the ids are the
   * model's own and id 3 in each graph is not the same thing; merging them would hang a
   * ground-truth edge off a predicted object. Matching on the name as well is the cheap,
   * fail-safe rule: a mismatch costs an extra node, never a wrong one.
   */
  const attach = (o: SGObject): string => {
    const shared = nodeId(o.object_id);
    if (placed.get(shared) === (o.names[0] ?? '')) return shared;
    const own = ghostNodeId(o.object_id);
    addNode(o, own, true);
    return own;
  };

  for (const v of verdicts) {
    if (v.verdict !== 'missed' || v.gt_index === null) continue;
    const r = gt.relationships[v.gt_index];
    if (!r) continue;
    const subject = gtById.get(r.subject_id);
    const object = gtById.get(r.object_id);
    if (!subject || !object) continue;
    elements.push({
      group: 'edges',
      data: {
        id: `ghost-${r.relationship_id}`,
        source: attach(subject),
        target: attach(object),
        label: r.predicate,
        relationshipId: r.relationship_id,
        verdict: 'missed',
        ghost: 1,
      },
    });
  }

  return elements;
}

