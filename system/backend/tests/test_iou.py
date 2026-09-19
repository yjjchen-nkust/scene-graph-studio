from __future__ import annotations

from app.eval.iou import box_iou
from app.schema import BBox


def b(x: float, y: float, w: float, h: float) -> BBox:
    return BBox(x=x, y=y, w=w, h=h)


def test_identical_boxes_have_iou_one():
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 10, 10)) == 1.0


def test_disjoint_boxes_have_iou_zero():
    assert box_iou(b(0, 0, 10, 10), b(20, 20, 10, 10)) == 0.0


def test_touching_edges_have_iou_zero():
    assert box_iou(b(0, 0, 10, 10), b(10, 0, 10, 10)) == 0.0


def test_half_overlap():
    assert box_iou(b(0, 0, 10, 10), b(5, 0, 10, 10)) == 50 / 150


def test_containment_is_the_area_ratio():
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 5, 5)) == 25 / 100


def test_is_symmetric():
    p, q = b(3, 4, 7, 9), b(5, 2, 11, 6)
    assert box_iou(p, q) == box_iou(q, p)


def test_the_scale_bound_from_derivation_F3():
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 20, 20)) == 100 / 400
