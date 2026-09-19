import type { SceneGraph } from 'sgg-metrics';

/**
 * L2's fixture: one scene and one imperfect prediction over it.
 *
 * Every control the lab offers has to move something, or the student learns that it does not
 * matter. Each object is therefore wrong in exactly one way, and each way is the way one control
 * addresses:
 *
 *   - **object 1, `man`** — right label, box at IoU 0.619. Passes τ = 0.5, fails τ = 0.75. This
 *     is the τ slider's demonstration, and it only bites under SGDet, because the other two
 *     protocols hand the model the box.
 *   - **object 2, `table`** — right label, box at IoU 0.345. Fails under SGDet at any threshold
 *     the field uses, and is handed back by SGCls. This is the SGDet → SGCls step.
 *   - **object 3, `cup`** — exact box, right label. Never the reason anything fails.
 *   - **object 4, `window`** — exact box, labelled `door`. Fails under SGDet and SGCls, and is
 *     handed back by PredCls. This is the SGCls → PredCls step.
 *
 * The prediction also puts `under` on the pair (1, 2) above its own correct `on`, so the graph
 * constraint keeps the wrong one and `none` keeps both: the R ／ ng-R gap with nothing else
 * changed. And `on` appears twice in the ground truth while `near` and `in front of` appear once,
 * so mean recall and recall separate — the head-predicate effect that is the reason mR exists.
 *
 * Measured on this fixture, R@50 under the graph constraint at τ = 0.5 is 0.25 / 0.50 / 0.75 for
 * SGDet / SGCls / PredCls, and R@K over K = 1…4 is 0 / 0.25 / 0.50 / 0.75.
 *
 * Synthetic rather than carved from a slice, for the reason `data/LICENCES.md` gives: the image
 * is the part that cannot be redistributed, and every lab has to run on a bare clone with no
 * corpora (NFR-1). Four objects and five predictions are few enough to check by hand, which is
 * what makes the worked example in the module a worked example rather than an appeal to output.
 */
export const GT: SceneGraph = {
  image_id: 'l2-fixture',
  dataset: 'placeholder',
  width: 200,
  height: 150,
  objects: [
    { object_id: 1, names: ['man'], bbox: { x: 10, y: 10, w: 40, h: 60 } },
    { object_id: 2, names: ['table'], bbox: { x: 80, y: 90, w: 60, h: 40 } },
    { object_id: 3, names: ['cup'], bbox: { x: 95, y: 40, w: 20, h: 24 } },
    { object_id: 4, names: ['window'], bbox: { x: 150, y: 10, w: 40, h: 50 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 3, object_id: 1, predicate: 'in front of' },
    { relationship_id: 2, subject_id: 1, object_id: 2, predicate: 'on' },
    { relationship_id: 3, subject_id: 1, object_id: 4, predicate: 'near' },
    { relationship_id: 4, subject_id: 3, object_id: 2, predicate: 'on' },
  ],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
};

export const PRED: SceneGraph = {
  ...GT,
  objects: [
    { object_id: 1, names: ['man'], bbox: { x: 16, y: 16, w: 40, h: 60 } },
    { object_id: 2, names: ['table'], bbox: { x: 96, y: 102, w: 60, h: 40 } },
    { object_id: 3, names: ['cup'], bbox: { x: 95, y: 40, w: 20, h: 24 } },
    { object_id: 4, names: ['door'], bbox: { x: 150, y: 10, w: 40, h: 50 } },
  ],
  relationships: [
    // outscores its own correct `on` below, so the graph constraint discards the right answer
    { relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'under', score: 0.95 },
    { relationship_id: 2, subject_id: 3, object_id: 1, predicate: 'in front of', score: 0.9 },
    { relationship_id: 3, subject_id: 1, object_id: 2, predicate: 'on', score: 0.8 },
    { relationship_id: 4, subject_id: 1, object_id: 4, predicate: 'near', score: 0.7 },
    { relationship_id: 5, subject_id: 3, object_id: 2, predicate: 'on', score: 0.6 },
  ],
  provenance: { kind: 'model', fidelity: 'measured', model: 'l2-fixture' },
};
