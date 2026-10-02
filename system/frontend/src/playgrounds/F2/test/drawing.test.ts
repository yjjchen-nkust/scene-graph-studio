import { describe, expect, it } from 'vitest';
import { drawnEdges, edgePath, nodePlace, type Box } from '../drawing';

const on = (subject_id: number, object_id: number, predicate = 'on') => ({ subject_id, object_id, predicate });

describe('drawnEdges', () => {
  it('draws one edge per edge |E| counts, so the picture and the readout agree', () => {
    const built = [on(1, 2), on(2, 1), on(1, 2, 'near'), on(3, 4)];
    expect(drawnEdges(built, true)).toHaveLength(4);
    // Direction discarded: `1 on 2` and `2 on 1` become one edge, as |E| counts them.
    expect(drawnEdges(built, false)).toHaveLength(3);
  });

  it('bends the edges between one pair to opposite sides, and leaves a lone edge straight', () => {
    const edges = drawnEdges([on(1, 2), on(2, 1), on(3, 4)], true);
    const edge = (s: number, o: number) => edges.find((e) => e.subject_id === s && e.object_id === o)!;
    expect(edge(3, 4).bend).toBe(0);
    // Node 1 left of node 2 on one horizontal line: the two arrows' control points must lie
    // on opposite sides of it, or one arrow is drawn over the other.
    const boxes: Record<number, Box> = { 1: { x: 0, y: 0, hw: 10, hh: 5 }, 2: { x: 100, y: 0, hw: 10, hh: 5 } };
    const side = (e: { subject_id: number; object_id: number; bend: number }) =>
      Math.sign(edgePath(boxes[e.subject_id]!, boxes[e.object_id]!, e.bend).control.y);
    expect(side(edge(1, 2))).not.toBe(0);
    expect(side(edge(2, 1))).toBe(-side(edge(1, 2)));
  });

  it('bends three edges of one ordered pair apart, one straight between two curves', () => {
    const bends = drawnEdges([on(1, 2), on(1, 2, 'near'), on(1, 2, 'above')], true).map((e) => e.bend);
    expect(new Set(bends).size).toBe(3);
    expect(bends).toContain(0);
  });

  it('carries every triplet an undirected edge merged, so its title can name them all', () => {
    const [edge] = drawnEdges([on(1, 2), on(2, 1)], false);
    expect(edge!.merged).toHaveLength(2);
  });
});

describe('edgePath', () => {
  const a: Box = { x: 0, y: 0, hw: 10, hh: 5 };
  const b: Box = { x: 100, y: 0, hw: 20, hh: 5 };

  it('starts and ends at the two boxes, not at their centres, where an arrowhead would hide', () => {
    const { start, end } = edgePath(a, b, 0);
    expect(start.x).toBeGreaterThanOrEqual(10);
    expect(start.x).toBeLessThan(20);
    expect(end.x).toBeLessThanOrEqual(80);
    expect(end.x).toBeGreaterThan(70);
    expect(start.y).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(0);
  });

  it('puts the control point off the line by the bend, on the pair axis normal', () => {
    expect(edgePath(a, b, 0).control.y).toBeCloseTo(0);
    expect(Math.abs(edgePath(a, b, 30).control.y)).toBeCloseTo(30);
    expect(edgePath(a, b, 30).control.y).toBeCloseTo(-edgePath(a, b, -30).control.y);
  });

  it('writes an SVG quadratic path through its three points', () => {
    expect(edgePath(a, b, 0).d).toMatch(/^M [\d.-]+ [\d.-]+ Q [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
  });
});

describe('nodePlace', () => {
  it('sets the nodes round an ellipse inside the box, none on another', () => {
    const places = Array.from({ length: 6 }, (_, i) => nodePlace(i, 6));
    for (const { left, top } of places) {
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThan(100);
      expect(top).toBeGreaterThan(0);
      expect(top).toBeLessThan(100);
    }
    const keys = new Set(places.map((p) => `${p.left.toFixed(1)},${p.top.toFixed(1)}`));
    expect(keys.size).toBe(6);
  });
});
