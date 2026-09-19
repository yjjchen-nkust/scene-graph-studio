import { render } from '@testing-library/react';
import type { SceneGraph, Verdict } from 'sgg-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cytoscape draws to a canvas, and jsdom implements none. Mocking the module is not a way around
 * an awkward dependency: element construction is a pure function tested directly below, and what
 * is left for the component to get wrong is the wiring — mounting once, handing over the right
 * container, registering the layout, and destroying the instance on unmount. A mock is exactly
 * the instrument for that, and a real Cytoscape in jsdom would test the canvas shim instead.
 */
const destroy = vi.fn();
const on = vi.fn();
const layoutRun = vi.fn();
const cyInstance = {
  destroy,
  on,
  layout: vi.fn(() => ({ run: layoutRun })),
  elements: vi.fn(() => ({ remove: vi.fn() })),
  add: vi.fn(),
  json: vi.fn(),
  fit: vi.fn(),
};
const cytoscapeFactory = vi.fn((_options: { container?: HTMLElement }) => cyInstance);

vi.mock('cytoscape', () => ({
  default: Object.assign(cytoscapeFactory, { use: vi.fn() }),
}));
vi.mock('cytoscape-dagre', () => ({ default: vi.fn() }));

const { SceneGraphView } = await import('../SceneGraphView');
const { buildElements } = await import('../elements');

const graph: SceneGraph = {
  image_id: 'i',
  dataset: 'vg150-sgb',
  width: 10,
  height: 10,
  objects: [
    { object_id: 1, names: ['person'], bbox: { x: 0, y: 0, w: 4, h: 4 } },
    { object_id: 2, names: ['table'], bbox: { x: 6, y: 6, w: 4, h: 4 } },
  ],
  relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
  provenance: { kind: 'user', fidelity: 'measured' },
};

const missed: Verdict = {
  pred_index: -1,
  gt_index: 0,
  verdict: 'missed',
  iou_subject: null,
  iou_object: null,
  rank: 0,
  entered_top_k: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildElements', () => {
  it('produces one node per object and one edge per relationship', () => {
    const els = buildElements(graph, undefined, []);
    expect(els.filter((e) => e.group === 'nodes').length).toBe(2);
    expect(els.filter((e) => e.group === 'edges').length).toBe(1);
  });

  it('adds a ghost edge for every missed ground-truth relationship', () => {
    const els = buildElements(graph, graph, [missed]);
    const ghosts = els.filter((e) => e.data?.verdict === 'missed');
    expect(ghosts.length).toBe(1);
    expect(ghosts[0]?.data.id).toBe('ghost-1');
  });

  it('pins node positions at box centroids under the preset layout', () => {
    const els = buildElements(graph, undefined, [], 'preset');
    const node = els.find((e) => e.data?.id === 'o1');
    expect(node?.position).toEqual({ x: 2, y: 2 });
  });

  it('leaves positions to the layout engine under dagre', () => {
    const els = buildElements(graph, undefined, [], 'dagre');
    expect(els.find((e) => e.data?.id === 'o1')?.position).toBeUndefined();
  });

  it('carries each prediction verdict onto its own edge, by position', () => {
    const els = buildElements(graph, undefined, [
      { ...missed, pred_index: 0, gt_index: null, verdict: 'localization' },
    ]);
    expect(els.find((e) => e.data?.id === 'r1')?.data.verdict).toBe('localization');
  });

  it('gives an unjudged edge no verdict rather than a default one', () => {
    const els = buildElements(graph, undefined, []);
    expect(els.find((e) => e.data?.id === 'r1')?.data.verdict).toBeUndefined();
  });

  it('reuses a predicted node for a ghost naming the same object, and does not double it', () => {
    const els = buildElements(graph, graph, [missed]);
    expect(els.filter((e) => e.group === 'nodes').length).toBe(2);
  });

  it('gives a ghost its own node when the id names a different object in the two graphs', () => {
    // Under sgdet the ids are the model's, not the dataset's, so id 1 in each is not the same
    // thing. Merging them would draw a ground-truth edge onto a predicted object.
    const otherGt: SceneGraph = {
      ...graph,
      objects: [
        { object_id: 1, names: ['dog'], bbox: { x: 0, y: 0, w: 4, h: 4 } },
        { object_id: 2, names: ['table'], bbox: { x: 6, y: 6, w: 4, h: 4 } },
      ],
    };
    const els = buildElements(graph, otherGt, [missed]);
    const ids = els.filter((e) => e.group === 'nodes').map((e) => e.data.id);
    expect(ids).toContain('gt1');
    expect(ids).toContain('o1');
  });

  it('skips a missed verdict whose gt_index names no relationship', () => {
    const els = buildElements(graph, graph, [{ ...missed, gt_index: 99 }]);
    expect(els.filter((e) => e.data?.verdict === 'missed').length).toBe(0);
  });

  it('skips a relationship naming an object the graph does not contain', () => {
    const dangling: SceneGraph = {
      ...graph,
      relationships: [{ relationship_id: 5, subject_id: 1, object_id: 404, predicate: 'on' }],
    };
    expect(buildElements(dangling, undefined, []).filter((e) => e.group === 'edges')).toEqual([]);
  });
});

describe('SceneGraphView', () => {
  it('mounts one Cytoscape instance into its own container', () => {
    const { container } = render(<SceneGraphView graph={graph} layout="dagre" />);
    expect(cytoscapeFactory).toHaveBeenCalledTimes(1);
    const options = cytoscapeFactory.mock.calls[0]![0];
    expect(options.container).toBe(container.querySelector('[data-testid="cy-container"]'));
  });

  it('destroys the instance on unmount, so a remount does not leak the old one', () => {
    const { unmount } = render(<SceneGraphView graph={graph} layout="dagre" />);
    expect(destroy).not.toHaveBeenCalled();
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reports an edge click by relationship id, not by element id', () => {
    const onEdgeClick = vi.fn();
    render(<SceneGraphView graph={graph} layout="dagre" onEdgeClick={onEdgeClick} />);
    const handler = on.mock.calls.find((c) => c[0] === 'tap' && c[1] === 'edge')?.[2] as (
      e: unknown,
    ) => void;
    handler({ target: { data: (key: string) => (key === 'relationshipId' ? 1 : undefined) } });
    expect(onEdgeClick).toHaveBeenCalledWith(1);
  });

  it('reports a node click by object id', () => {
    const onNodeClick = vi.fn();
    render(<SceneGraphView graph={graph} layout="dagre" onNodeClick={onNodeClick} />);
    const handler = on.mock.calls.find((c) => c[0] === 'tap' && c[1] === 'node')?.[2] as (
      e: unknown,
    ) => void;
    handler({ target: { data: (key: string) => (key === 'objectId' ? 2 : undefined) } });
    expect(onNodeClick).toHaveBeenCalledWith(2);
  });
});
