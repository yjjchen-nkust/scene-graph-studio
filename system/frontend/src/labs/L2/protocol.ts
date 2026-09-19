import type { Protocol, SceneGraph } from 'sgg-metrics';

/**
 * One model prediction, as each of the three protocols would hand it to the model.
 *
 * **The engine does not branch on `protocol`.** It copies the value onto every `MetricValue` as a
 * tag and never reads it again — `assign()` is never given it, in either implementation. That is
 * not an oversight. In the literature the protocol governs what the model is *handed*, upstream
 * of scoring, and the same scoring code then runs on whatever comes back. A knob that changed
 * the scoring instead would be inventing a fourth protocol nobody publishes against.
 *
 * So the protocol is applied here, to the prediction, before the engine sees it:
 *
 *   - `sgdet`   — nothing is given. The model's own boxes and its own labels.
 *   - `sgcls`   — the boxes are given. Each object keeps the model's label and takes the
 *                 ground-truth box.
 *   - `predcls` — boxes and labels are both given. The only thing still the model's is which
 *                 pairs it proposes and what predicate it puts on them.
 *
 * Correspondence is by `object_id`, not by overlap, and that is the whole reason PredCls means
 * what it means: under PredCls and SGCls the model is handed the ground-truth object set at the
 * start, so it predicts *over those objects*. There is no detection to match up. Corresponding by
 * IoU instead would deny the ground truth to exactly the badly-placed object that PredCls exists
 * to relieve of the burden — the object whose box would have failed — which inverts the lesson.
 *
 * An object the ground truth does not contain is left alone: nothing is given for a detection of
 * something that is not there, under any protocol.
 *
 * This transform is what makes the ordering invariant a measurement rather than a tautology.
 * Scoring one fixed prediction under three protocol *labels* returns the same number three times.
 */
export function underProtocol(gt: SceneGraph, pred: SceneGraph, protocol: Protocol): SceneGraph {
  if (protocol === 'sgdet') return pred;
  const truth = new Map(gt.objects.map((o) => [o.object_id, o]));
  return {
    ...pred,
    objects: pred.objects.map((p) => {
      const g = truth.get(p.object_id);
      if (!g) return p;
      return protocol === 'predcls'
        ? { ...p, names: g.names, bbox: g.bbox, mask: g.mask }
        : { ...p, bbox: g.bbox, mask: g.mask };
    }),
  };
}
