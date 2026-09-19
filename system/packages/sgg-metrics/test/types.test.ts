import { describe, expect, it } from 'vitest';
import type { SceneGraph } from '../src/types.js';
import { isSceneGraph } from '../src/types.js';

describe('wire types', () => {
  it('accepts a well-formed graph', () => {
    const g: SceneGraph = {
      image_id: 'i', dataset: 'vg150-sgb', width: 10, height: 10,
      objects: [{ object_id: 1, names: ['a'], bbox: { x: 0, y: 0, w: 1, h: 1 } }],
      relationships: [],
      provenance: { kind: 'ground_truth', fidelity: 'measured' },
    };
    expect(isSceneGraph(g)).toBe(true);
  });

  it('rejects a graph whose relationship dangles', () => {
    expect(isSceneGraph({
      image_id: 'i', dataset: 'vg150-sgb', width: 10, height: 10,
      objects: [],
      relationships: [{ relationship_id: 1, subject_id: 9, object_id: 8, predicate: 'on' }],
      provenance: { kind: 'user', fidelity: 'measured' },
    })).toBe(false);
  });

  it('rejects a non-graph without throwing', () => {
    expect(isSceneGraph(null)).toBe(false);
    expect(isSceneGraph({})).toBe(false);
  });
});
