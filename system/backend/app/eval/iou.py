from __future__ import annotations

from app.schema import BBox


def box_iou(a: BBox, b: BBox) -> float:
    """Intersection over union of two axis-aligned boxes, in image pixels.

    Boxes are half-open: [x, x + w) x [y, y + h). Touching edges do not intersect.
    """
    ix = min(a.x + a.w, b.x + b.w) - max(a.x, b.x)
    iy = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
    if ix <= 0.0 or iy <= 0.0:
        return 0.0
    inter = ix * iy
    union = a.w * a.h + b.w * b.h - inter
    return inter / union
