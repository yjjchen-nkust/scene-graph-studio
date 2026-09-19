import type { BBox } from './types.js';

/** Mirrors backend/app/eval/iou.py box_iou. Half-open boxes; touching edges do not intersect. */
export function boxIou(a: BBox, b: BBox): number {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ix <= 0 || iy <= 0) return 0;
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
}
