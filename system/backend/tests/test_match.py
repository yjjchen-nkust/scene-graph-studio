from __future__ import annotations

from app.eval.match import classify, to_triplets
from app.schema import BBox, Provenance, SceneGraph, SGObject, SGRelationship


def graph(objs, rels) -> SceneGraph:
    return SceneGraph(
        image_id="i", dataset="vg150-sgb", width=100, height=100,
        objects=[SGObject(object_id=i, names=[n], bbox=BBox(x=b[0], y=b[1], w=b[2], h=b[3]))
                 for i, n, b in objs],
        relationships=[SGRelationship(relationship_id=rid, subject_id=s, predicate=p, object_id=o)
                       for rid, s, p, o in rels],
        provenance=Provenance(kind="ground_truth", fidelity="measured"),
    )


GT = graph(
    [(1, "person", (0, 0, 10, 10)), (2, "table", (20, 20, 10, 10))],
    [(1, 1, "on", 2)],
)


def test_exact_match():
    gts = to_triplets(GT)
    preds = to_triplets(GT)
    verdict, gi, ious, iuo = classify(preds[0], gts, [False], 0.5, False)
    assert (verdict, gi) == ("match", 0)
    assert ious == 1.0 and iuo == 1.0


def test_wrong_predicate_is_spurious():
    gts = to_triplets(GT)
    p = to_triplets(graph(
        [(1, "person", (0, 0, 10, 10)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "under", 2)]))[0]
    assert classify(p, gts, [False], 0.5, False)[0] == "spurious"


def test_wrong_object_class_is_spurious():
    gts = to_triplets(GT)
    p = to_triplets(graph(
        [(1, "person", (0, 0, 10, 10)), (2, "chair", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    assert classify(p, gts, [False], 0.5, False)[0] == "spurious"


def test_right_classes_bad_boxes_is_localization_and_does_not_consume_gt():
    gts = to_triplets(GT)
    used = [False]
    p = to_triplets(graph(
        [(1, "person", (40, 40, 10, 10)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    verdict, gi, ious, _ = classify(p, gts, used, 0.5, False)
    assert verdict == "localization"
    assert ious == 0.0
    assert used == [False], "a localization failure must not consume the ground truth"


def test_iou_exactly_at_threshold_matches():
    """SRS 4.1 states the relation as IoU >= tau, so tau itself must match.

    The construction must land on 0.5 exactly in IEEE-754. Offsetting two 10x10 boxes by
    10/3 does not: it yields 0.4999999999999999 and silently tests the wrong side of the
    boundary. Containment does: a 10x20 prediction box holding the 10x10 ground-truth box
    gives inter = 100, union = 200, IoU = 0.5 with no rounding at all.
    """
    gts = to_triplets(GT)
    p = to_triplets(graph(
        [(1, "person", (0, 0, 10, 20)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    verdict, _, ious, _ = classify(p, gts, [False], 0.5, False)
    assert ious == 0.5, "the fixture must sit exactly on the threshold, not near it"
    assert verdict == "match", "the threshold is inclusive: IoU >= tau"


def test_iou_one_ulp_below_the_threshold_does_not_match():
    gts = to_triplets(GT)
    p = to_triplets(graph(
        [(1, "person", (0, 0, 10, 20.000001)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    verdict, _, ious, _ = classify(p, gts, [False], 0.5, False)
    assert ious < 0.5
    assert verdict == "localization"


def test_a_used_ground_truth_is_not_matched_twice():
    gts = to_triplets(GT)
    assert classify(to_triplets(GT)[0], gts, [True], 0.5, False)[0] == "localization"


def test_lowest_gt_index_wins_among_equal_candidates():
    gt = graph(
        [(1, "a", (0, 0, 10, 10)), (2, "b", (0, 0, 10, 10)), (3, "b", (0, 0, 10, 10))],
        [(1, 1, "on", 2), (2, 1, "on", 3)],
    )
    gts = to_triplets(gt)
    p = to_triplets(gt)[1]
    assert classify(p, gts, [False, False], 0.5, False)[1] == 0


def test_to_triplets_resolves_names_and_boxes_from_object_ids():
    t = to_triplets(GT)[0]
    assert t.classes == ("person", "on", "table")
    assert t.subject_bbox.x == 0 and t.object_bbox.x == 20
