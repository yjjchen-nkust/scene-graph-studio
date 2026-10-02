import { tripletKey, type Triplet } from '../logic';

/** A node as the drawing sees it: its centre, and half its width and height, in the drawing's pixels. */
export interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

interface Point {
  x: number;
  y: number;
}

export interface DrawnEdge {
  /** `tripletKey` under the direction setting on screen: one line per edge |E| counts. */
  key: string;
  subject_id: number;
  object_id: number;
  /** Every built triplet this line stands for; two or more where discarding direction merged them. */
  merged: Triplet[];
  /** How far the curve's middle stands off the straight line, in pixels, on the edge's own left. */
  bend: number;
}

/** Pixels between the middles of two neighbouring edges of one pair. */
const SPREAD = 28;
/** Pixels between a node's outline and the line that leaves or reaches it. */
const GAP = 4;

/**
 * The edges to draw: one per edge the readout counts, so the picture and |E| cannot disagree.
 *
 * Edges are keyed as `tripletKey` keys them under the direction setting, so with direction
 * discarded `table on person` and `person on table` become one line, which is the merge the
 * step teaches, drawn. The edges between one pair of nodes, in either direction and under any
 * predicate, are spread across the pair's axis so none is drawn over another; the spread is set
 * on the pair's own axis, from the lower id to the higher, and turned into each edge's own frame,
 * so `1 → 2` and `2 → 1` bend to opposite sides.
 */
export function drawnEdges(built: readonly Triplet[], directed: boolean): DrawnEdge[] {
  const byKey = new Map<string, Triplet[]>();
  for (const t of built) {
    const key = tripletKey(t, directed);
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }
  const edges: DrawnEdge[] = [...byKey].map(([key, merged]) => ({
    key,
    subject_id: merged[0]!.subject_id,
    object_id: merged[0]!.object_id,
    merged,
    bend: 0,
  }));

  const byPair = new Map<string, DrawnEdge[]>();
  for (const edge of edges) {
    const [low, high] = [edge.subject_id, edge.object_id].sort((x, y) => x - y);
    const pair = `${low}|${high}`;
    byPair.set(pair, [...(byPair.get(pair) ?? []), edge]);
  }
  for (const group of byPair.values()) {
    group.forEach((edge, i) => {
      const spread = (i - (group.length - 1) / 2) * SPREAD;
      // `|| 0` turns -0 into 0, which a lone reversed edge would otherwise carry.
      edge.bend = (edge.subject_id < edge.object_id ? spread : -spread) || 0;
    });
  }
  return edges;
}

/** Where a ray from the box's centre toward `toward` leaves its outline, `GAP` further on. */
function exit(box: Box, toward: Point): Point {
  const dx = toward.x - box.x;
  const dy = toward.y - box.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: box.x, y: box.y };
  const scale = Math.min(
    dx === 0 ? Infinity : box.hw / Math.abs(dx),
    dy === 0 ? Infinity : box.hh / Math.abs(dy),
  );
  return {
    x: box.x + dx * scale + (dx / length) * GAP,
    y: box.y + dy * scale + (dy / length) * GAP,
  };
}

const coordinate = (n: number) => String(Math.round(n * 10) / 10);

/**
 * One edge from box `a` to box `b`, as an SVG quadratic curve.
 *
 * The curve leaves `a` and reaches `b` at their outlines, not their centres: an arrowhead drawn to
 * a centre is drawn under the node's button and cannot be seen. The control point stands `bend`
 * pixels off the midpoint, on the normal to the left of the direction of travel.
 */
export function edgePath(a: Box, b: Box, bend: number): { d: string; start: Point; control: Point; end: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = {
    x: (a.x + b.x) / 2 + (-dy / length) * bend,
    y: (a.y + b.y) / 2 + (dx / length) * bend,
  };
  const start = exit(a, control);
  const end = exit(b, control);
  const d = `M ${coordinate(start.x)} ${coordinate(start.y)} Q ${coordinate(control.x)} ${coordinate(control.y)} ${coordinate(end.x)} ${coordinate(end.y)}`;
  return { d, start, control, end };
}

/**
 * Where node `i` of `n` sits, as percentages of the drawing, round an ellipse from the left,
 * clockwise. Used until the drawing has been measured, and wherever it cannot be (jsdom).
 */
export function nodePlace(i: number, n: number): { left: number; top: number } {
  const angle = Math.PI + (2 * Math.PI * i) / n;
  return { left: 50 + 38 * Math.cos(angle), top: 50 + 36 * Math.sin(angle) };
}
