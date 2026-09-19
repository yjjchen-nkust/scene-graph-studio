import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { cyStylesheet } from '../cyStyle';
import { VERDICT_ORDER, VERDICT_STYLE } from '../palette';
import { buildElements } from '../elements';

/**
 * The stylesheet against the real Cytoscape, not the mock the component tests use.
 *
 * `SceneGraphView.test.tsx` mocks the library, which is right for testing the wiring and blind to
 * the thing that cannot be checked by reading: whether every property name in the stylesheet is
 * one Cytoscape has. A misspelling is not an error and produces no warning — it is dropped in
 * silence, the edge renders in the default grey, and the diff loses the distinction it exists to
 * make while every other test stays green.
 *
 * `cytoscape.stylesheet()` is the instrument, because it is the one entry point that reports what
 * it kept. Constructing a headless instance reports nothing at all: it accepts a misspelled
 * property, an invalid enum, a malformed selector and an unparseable colour without a sound,
 * since the stylesheet is not parsed until a renderer asks for it, and `styleEnabled` in headless
 * mode starts a render loop that never settles.
 *
 * What this does not check is values. `target-arrow-shape: "trianggle"` survives here. Cytoscape
 * offers no reachable validator for them, and an allow-list copied out of its documentation would
 * be a second copy of the library's knowledge, going stale on its own schedule.
 */
const graph: SceneGraph = {
  image_id: 'i',
  dataset: 'psg',
  width: 10,
  height: 10,
  objects: [
    { object_id: 1, names: ['person'], bbox: { x: 0, y: 0, w: 4, h: 4 } },
    { object_id: 2, names: ['table'], bbox: { x: 6, y: 6, w: 4, h: 4 } },
  ],
  relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
  provenance: { kind: 'user', fidelity: 'measured' },
};

const MISSED = {
  pred_index: -1,
  gt_index: 0,
  verdict: 'missed' as const,
  iou_subject: null,
  iou_object: null,
  rank: 0,
  entered_top_k: {},
};

/** The property names Cytoscape kept out of one rule. Anything it does not know is absent. */
function accepted(selector: string, style: Record<string, unknown>): string[] {
  // `cytoscape.stylesheet()` is a real, documented entry point that @types/cytoscape omits.
  const factory = cytoscape as unknown as {
    stylesheet: () => {
      selector: (s: string) => { style: (o: Record<string, unknown>) => unknown };
    };
  };
  const sheet = factory.stylesheet().selector(selector).style(style) as Array<{
    properties: Array<{ name: string }>;
  }>;
  return sheet[0]!.properties.map((p) => p.name);
}

describe('cyStylesheet', () => {
  it('uses no property name Cytoscape does not have', () => {
    for (const rule of cyStylesheet()) {
      const style = rule.style as Record<string, unknown>;
      const kept = accepted(rule.selector as string, style);
      expect({ selector: rule.selector, dropped: Object.keys(style).filter((k) => !kept.includes(k)) })
        .toEqual({ selector: rule.selector, dropped: [] });
    }
  });

  it('carries a selector for every verdict, so none falls through to the default grey', () => {
    const selectors = cyStylesheet().map((rule) => rule.selector);
    for (const kind of VERDICT_ORDER) {
      expect(selectors).toContain(`edge[verdict = "${kind}"]`);
    }
  });

  it('takes its colours from the palette rather than repeating them', () => {
    const sheet = cyStylesheet();
    for (const kind of VERDICT_ORDER) {
      const rule = sheet.find((r) => r.selector === `edge[verdict = "${kind}"]`);
      const style = rule?.style as Record<string, unknown>;
      expect(style['line-color']).toBe(VERDICT_STYLE[kind].stroke);
      expect(style['target-arrow-color']).toBe(VERDICT_STYLE[kind].stroke);
      expect(style['width']).toBe(VERDICT_STYLE[kind].width);
    }
  });

  it('distinguishes the four verdicts without using hue, as NFR-5 requires', () => {
    const sheet = cyStylesheet();
    const channels = VERDICT_ORDER.map((kind) => {
      const style = sheet.find((r) => r.selector === `edge[verdict = "${kind}"]`)?.style as Record<
        string,
        unknown
      >;
      return JSON.stringify([
        style['width'],
        style['line-style'],
        style['line-dash-pattern'] ?? null,
        style['target-arrow-shape'],
        style['target-arrow-fill'],
      ]);
    });
    expect(new Set(channels).size).toBe(VERDICT_ORDER.length);
  });

  it('accepts the dagre layout the view asks for', () => {
    cytoscape.use(dagre);
    const cy = cytoscape({
      headless: true,
      style: cyStylesheet(),
      elements: buildElements(graph, undefined, []) as never,
    });
    expect(typeof cy.layout({ name: 'dagre' }).run).toBe('function');
    cy.destroy();
  });

  it('builds a ghost edge whose endpoints resolve to real nodes', () => {
    // Cytoscape throws on an edge naming a node it does not have, which makes construction the
    // assertion: if the ghost's endpoints were wrong, this would not reach the expectations.
    const cy = cytoscape({
      headless: true,
      style: cyStylesheet(),
      elements: buildElements(graph, graph, [MISSED]) as never,
    });
    expect(cy.edges().length).toBe(2);
    expect(cy.getElementById('ghost-1').isEdge()).toBe(true);
    cy.destroy();
  });

  it('builds a ghost against a differently-numbered ground truth without a dangling endpoint', () => {
    const otherGt: SceneGraph = {
      ...graph,
      objects: [
        { object_id: 1, names: ['dog'], bbox: { x: 0, y: 0, w: 4, h: 4 } },
        { object_id: 2, names: ['bench'], bbox: { x: 6, y: 6, w: 4, h: 4 } },
      ],
    };
    const cy = cytoscape({
      headless: true,
      style: cyStylesheet(),
      elements: buildElements(graph, otherGt, [MISSED]) as never,
    });
    expect(cy.nodes().length).toBe(4); // two predicted, two ghosts under their own ids
    expect(cy.getElementById('ghost-1').isEdge()).toBe(true);
    cy.destroy();
  });
});
