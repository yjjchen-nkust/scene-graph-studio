import type { BBox, RLEMask, SGObject } from 'sgg-metrics';
import { decodeCounts } from 'sgg-metrics';

/**
 * The arithmetic the overlay needs, kept out of the component so it can be tested as arithmetic.
 *
 * Every function here works in **intrinsic image pixels** — the same units the annotations are
 * written in, and the same units the SVG viewBox declares. Nothing in this file knows how large
 * the image is being displayed, except `clientToImage`, whose entire job is to cross that line
 * once so nothing else has to.
 */

export function centroid(b: BBox): { cx: number; cy: number } {
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

/**
 * Convert a pointer event to intrinsic image pixels, honouring `xMidYMid meet` letterboxing.
 *
 * `meet` scales the viewBox until it fits inside the element, so one axis is filled and the
 * other is centred with dead space at both ends. A pointer landing in that dead space is not
 * over the image at all, and a conversion that ignores the padding is wrong by half the
 * letterbox on every drag — plausibly, and only on displays whose aspect ratio differs from
 * the image's, which is why it survives casual testing.
 */
export function clientToImage(
  event: { clientX: number; clientY: number },
  svg: SVGSVGElement,
  width: number,
  height: number,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / width, rect.height / height);
  if (!Number.isFinite(scale) || scale <= 0) {
    // The element has no layout: in a test without a stubbed rect, or before first paint.
    // There is no mapping to give, and inventing one would put Infinity into a bbox.
    return { x: Number.NaN, y: Number.NaN };
  }
  const padX = (rect.width - width * scale) / 2;
  const padY = (rect.height - height * scale) / 2;
  return {
    x: (event.clientX - rect.left - padX) / scale,
    y: (event.clientY - rect.top - padY) / scale,
  };
}

/**
 * Which object a click at this point selects: the smallest box containing it, or none — D75.
 *
 * A `<rect fill="none">` is hit-tested on its outline only, so before this function existed a
 * click aimed at the middle of a box selected nothing. The one-line browser fix, `pointer-events:
 * all`, hands the decision to paint order instead, and in a scene graph boxes nest — a hand
 * inside a person, a nut on a beam — so "whichever was drawn last" picks the wrong object often
 * and unpredictably.
 *
 * Smallest-containing is the rule annotation tools settle on because nesting makes it
 * *unambiguous*: the innermost box is the most specific thing at that point, and anyone wanting
 * the enclosing object has all of it that is not covered by the inner one to click in. Equal
 * areas break by the lower object id so the same click gives the same answer everywhere (NFR-4).
 *
 * The boundary counts as inside, which keeps the outline selecting what it outlines: the
 * behaviour this replaces is a subset of the behaviour it provides, so nothing that worked stops
 * working.
 */
export function pickObjectAt(
  objects: readonly SGObject[],
  point: { x: number; y: number },
): SGObject | null {
  let best: SGObject | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const o of objects) {
    const { x, y, w, h } = o.bbox;
    // NaN fails every one of these, which is the answer wanted for a point `clientToImage` could
    // not map: no layout means no selection rather than an arbitrary one.
    if (!(point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h)) continue;
    const area = w * h;
    if (area < bestArea || (area === bestArea && best !== null && o.object_id < best.object_id)) {
      best = o;
      bestArea = area;
    }
  }
  return best;
}

/** The box two corners span, in either drag direction. */
export function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }): BBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** Trim a box to the image. A region outside the image is not a region of the image. */
export function clampToImage(b: BBox, width: number, height: number): BBox {
  const x1 = Math.max(0, Math.min(b.x, width));
  const y1 = Math.max(0, Math.min(b.y, height));
  const x2 = Math.max(0, Math.min(b.x + b.w, width));
  const y2 = Math.max(0, Math.min(b.y + b.h, height));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * An RLE mask as SVG path data: one axis-aligned rectangle per run.
 *
 * COCO counts runs **column-major**, so a run is a vertical segment one pixel wide, and a run
 * long enough to pass the bottom of its column continues at the top of the next. Splitting on
 * that boundary is the whole of the work. Adjacent columns' rectangles share an edge and render
 * as one region, so no outline tracing is needed to draw the mask exactly.
 *
 * The cost is one subpath per run, which for a typical segment is a few hundred — cheap next to
 * tracing, and exact, where a traced polygon would be an approximation of a measurement.
 */
export function maskPath(mask: RLEMask): string {
  const height = mask.size[0];
  const parts: string[] = [];
  let at = 0;
  let on = false; // COCO RLE always starts with a run of zeros, possibly empty
  for (const run of decodeCounts(mask.counts)) {
    if (on && run > 0) {
      let start = at;
      const end = at + run;
      while (start < end) {
        const x = Math.floor(start / height);
        const y = start - x * height;
        const take = Math.min(end - start, height - y);
        parts.push(`M ${x} ${y} h 1 v ${take} h -1 Z`);
        start += take;
      }
    }
    at += run;
    on = !on;
  }
  return parts.join(' ');
}
